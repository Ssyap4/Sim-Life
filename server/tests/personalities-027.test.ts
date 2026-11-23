import {test} from 'node:test';
import * as THREE from 'three';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {characterDemeanor} from '../../src/game/CharacterDemeanor';
import {choosePetIdle, type PetIdleContext} from '../../src/game/PetIdle';
import {homeHabitCommands, homeHabitSuggestions} from '../../src/shared/personalityHabits';
import {preferredPetWanderTarget} from '../../src/shared/petPersonality';
import {PET_ROAM} from '../../src/shared/pets';
import {Actor} from '../../src/game/Actor';
import {PetActor} from '../../src/game/PetActor';

test('Emotion is visible while idle/walking, but never overrides real activities, sleep or navigation',()=>{
  const sunny={mood:91,energy:84,hunger:77};
  const upset={mood:19,energy:22,hunger:52};
  const happy=characterDemeanor(sunny,'idle'),sad=characterDemeanor(upset,'idle');
  assert.ok(happy.smile>.10);
  assert.equal(happy.shoulders,0);
  assert.ok(sad.shoulders>.02);
  assert.ok(sad.gaze>.04);
  const walking=characterDemeanor(upset,'walking');
  assert.ok(walking.shoulders<=.025 && walking.gaze<=.045);
  assert.deepEqual(characterDemeanor(upset,'busy'),{smile:0,shoulders:0,gaze:0,friendly:false});
  assert.deepEqual(characterDemeanor(upset,'sleep'),{smile:0,shoulders:0,gaze:0,friendly:false});
  assert.equal(characterDemeanor(upset,'idle').friendly,false);
  assert.equal(characterDemeanor(sunny,'idle').friendly,true);
  const bad=characterDemeanor({mood:NaN,energy:Infinity,hunger:-8},'idle');
  assert.ok(Object.values(bad).every(value=>typeof value==='boolean'||Number.isFinite(value)));
});

test('Resident personalities have distinct morning, daytime and evening routines without money or job commands',()=>{
  const state=initialState();
  const original=structuredClone(state);
  state.clock.minute=7*60;
  const vMorning=homeHabitSuggestions(state,'vlad',0),aMorning=homeHabitSuggestions(state,'alina',0);
  assert.equal(vMorning[0],'bathTeeth');
  assert.equal(aMorning[0],'bathTeeth');
  assert.notDeepEqual(vMorning,aMorning);
  state.clock.minute=13*60;
  assert.equal(homeHabitSuggestions(state,'vlad',0)[0],'deskJournal');
  assert.equal(homeHabitSuggestions(state,'alina',0)[0],'tablePlan');
  state.clock.minute=20*60;
  assert.equal(homeHabitSuggestions(state,'alina',0)[0],'sofaMusic');
  state.characters.vlad.energy=32;
  assert.equal(homeHabitSuggestions(state,'vlad',2)[0],'sofaRest');
  for(const role of ['vlad','alina'] as const)for(const turn of [0,1,5,20]){
    const first=homeHabitSuggestions(state,role,turn);
    assert.equal(new Set(first).size,first.length);
    assert.ok(first.every(id=>!id.includes('Order')&&!id.includes('Consult')&&!id.includes('Study')));
    assert.deepEqual(first,homeHabitSuggestions(state,role,turn));
  }
  assert.equal(state.money,original.money);
  assert.deepEqual(state.pantry,original.pantry);
  assert.deepEqual(state.savings,original.savings);
});

test('Pet affection requires actual bond, energy and proximity, never disguises urgent hunger',()=>{
  const happy:PetIdleContext={satiety:83,energy:75,happiness:82,bond:72,bowl:2,personNearby:true};
  assert.equal(choosePetIdle('verdell',happy,4),'happyHop');
  assert.equal(choosePetIdle('simba',happy,1),'nuzzle');
  assert.notEqual(choosePetIdle('simba',{...happy,personNearby:false},1),'nuzzle');
  assert.notEqual(choosePetIdle('verdell',{...happy,energy:22},4),'happyHop');
  assert.notEqual(choosePetIdle('simba',{...happy,bond:8},1),'nuzzle');
  assert.equal(choosePetIdle('simba',{...happy,satiety:12,bowl:0},1),'hungryLook');
  assert.equal(choosePetIdle('verdell',{...happy,satiety:12,bowl:0},4),'hungryLook');
});

test('New visual personality loops keep actual actor/pet navigation roots and bone transforms finite',()=>{
  const vlad=new Actor('vlad',[1.2,2.4]),dog=new PetActor('verdell'),cat=new PetActor('simba');
  const original=[vlad.root.position.clone(),dog.root.position.clone(),cat.root.position.clone()];
  vlad.setNeeds({mood:87,energy:92,hunger:72,bladder:74,hygiene:80});
  dog.setAmbient({satiety:85,energy:85,happiness:90,bond:90,bowl:3,personNearby:true});
  cat.setAmbient({satiety:85,energy:85,happiness:90,bond:90,bowl:3,personNearby:true});
  // Several normal idle cycles; keep the same navigation coordinates and
  // ordinary collision geometry, even if gestures raise paws or tilt a head.
  for(let i=0;i<260;i++){
    vlad.update(.05);
    dog.update(.05);
    cat.update(.05);
  }
  for(const [i,root] of [vlad.root,dog.root,cat.root].entries()){
    assert.ok(root.position.distanceTo(original[i])<1e-6);
    root.traverse(node=>{
      assert.ok(node.position.toArray().every(Number.isFinite));
      assert.ok([node.rotation.x,node.rotation.y,node.rotation.z].every(Number.isFinite));
    });
  }
});

test('0.27 v2: remembers real habits and resolves sold starter stations to purchased furniture',()=>{
  const state=initialState();
  state.clock.minute=20*60;
  state.furnishing.soldFixtures=['sofa','table','desk'];
  state.furnishing.placed=[
    {id:401,sku:'sofa-luna',finish:'oak',x:-3,z:1,rotation:0},
    {id:402,sku:'table-family',finish:'oak',x:2,z:0,rotation:0},
    {id:403,sku:'desk-simple',finish:'walnut',x:4,z:2,rotation:0},
    {id:404,sku:'table-coffee',finish:'oak',x:5,z:4,rotation:0},
  ];
  const snapshot=structuredClone(state);
  const vlad=homeHabitCommands(state,'vlad',0);
  const alina=homeHabitCommands(state,'alina',0);
  assert.ok(vlad.some(row=>row.habit==='tablePlan'&&row.command.type==='furniture_use'&&row.command.furnitureId===402));
  assert.ok(vlad.some(row=>row.habit==='deskJournal'&&row.command.type==='furniture_use'&&row.command.furnitureId===403));
  assert.ok(alina.some(row=>row.habit==='sofaMusic'&&row.command.type==='furniture_use'&&row.command.furnitureId===401));
  assert.ok(!vlad.some(row=>row.habit==='tablePlan'&&row.command.type==='act'));
  assert.ok(!alina.some(row=>row.habit==='sofaMusic'&&row.command.type==='act'));
  assert.ok(!vlad.some(row=>row.command.type==='furniture_use'&&row.command.furnitureId===404));
  assert.deepEqual(state,snapshot);
  const prioritized=homeHabitSuggestions(state,'vlad',0,['tablePlan','sofaRest']);
  assert.ok(!['tablePlan','sofaRest'].includes(prioritized[0]));
  assert.ok(prioritized.includes('tablePlan')&&prioritized.includes('sofaRest'));
  state.furnishing.placed=[];
  assert.ok(homeHabitCommands(state,'vlad',0).every(row=>row.command.type!=='furniture_use'));
  assert.ok(!homeHabitCommands(state,'vlad',0).some(row=>row.habit==='deskJournal'));
});

test('0.27 v2: pet wandering personalities use existing destinations with different day/night preferences',()=>{
  assert.equal(preferredPetWanderTarget('verdell',12*60,()=>0),7);
  assert.equal(preferredPetWanderTarget('simba',12*60,()=>0),2);
  assert.equal(preferredPetWanderTarget('verdell',23*60,()=>0),0);
  assert.equal(preferredPetWanderTarget('simba',23*60,()=>0),0);
  for(const id of ['verdell','simba'] as const)for(const minute of [0,400,700,1200,1800]){
    for(const value of [0,.1,.45,.85,.9999]){
      const index=preferredPetWanderTarget(id,minute,()=>value);
      assert.ok(Number.isInteger(index)&&index>=0&&index<PET_ROAM.length);
    }
  }
});

test('0.27 v2: greetings are proximity-triggered, need-gated, and never move roots',()=>{
  const person=new Actor('vlad',[1,2]);
  person.setNeeds({mood:90,energy:85,hunger:80,bladder:80,hygiene:80});
  person.setIdleSurroundings(null,null);
  person.setIdleSurroundings(null,.3);
  person.update(.06);
  assert.equal(person.currentIdleGesture(),'noticePartner');
  const happy:PetIdleContext={satiety:82,energy:75,happiness:85,bond:75,bowl:2,personNearby:true};
  const dog=new PetActor('verdell'),cat=new PetActor('simba'),starving=new PetActor('verdell');
  const before=[dog.root.position.clone(),cat.root.position.clone()];
  dog.setAmbient(happy);cat.setAmbient(happy);
  starving.setAmbient({...happy,satiety:12,bowl:0});
  dog.update(.06);cat.update(.06);starving.update(.06);
  assert.equal(dog.currentIdleGesture(),'happyHop');
  assert.equal(cat.currentIdleGesture(),'nuzzle');
  assert.notEqual(starving.currentIdleGesture(),'happyHop');
  assert.ok(dog.root.position.equals(before[0])&&cat.root.position.equals(before[1]));
});

test('0.27 v3: hello wave visibly changes the shoulder rig without shifting navigation',()=>{
  const friendly=new Actor('alina',[1,2]);
  const neutral=new Actor('alina',[1,2]);
  for(const actor of [friendly,neutral])
    actor.setNeeds({mood:91,energy:88,hunger:86,bladder:89,hygiene:84});
  friendly.setIdleSurroundings(null,null);
  friendly.setIdleSurroundings(null,.38);
  const start=friendly.root.position.clone();
  for(let i=0;i<32;i++){friendly.update(.055);neutral.update(.055);}
  const arm=(friendly as unknown as {rightArm:THREE.Object3D}).rightArm;
  const ordinary=(neutral as unknown as {rightArm:THREE.Object3D}).rightArm;
  assert.equal(friendly.currentIdleGesture(),'noticePartner');
  assert.ok(arm.quaternion.angleTo(ordinary.quaternion)>.12,
    'The new wave must actually raise the visible arm, not only change expression');
  assert.ok(friendly.root.position.distanceTo(start)<1e-8);
});

test('0.27 v3: Verdell has a narrower visible ruff and a recognizable hop without moving his feet roots',()=>{
  const dog=new PetActor('verdell');
  const coat=dog.root.children[0].children.find(part=>part instanceof THREE.Mesh) as THREE.Mesh;
  assert.ok(coat?.geometry,'The real Spitz coat must exist');
  coat.geometry.computeBoundingBox();
  const bounds=coat.geometry.boundingBox!;
  assert.ok(bounds.max.x-bounds.min.x<.75,
    'The old sphere-like heavy coat should not come back');
  const start=dog.root.position.clone();
  dog.setAmbient({satiety:84,energy:85,happiness:91,bond:81,bowl:2,personNearby:true});
  let maxLift=0;
  for(let i=0;i<75;i++){
    dog.update(.04);
    maxLift=Math.max(maxLift,dog.root.children[0].position.y);
  }
  assert.ok(maxLift>.16,'Happy welcome should be readable on a mobile screen');
  assert.ok(dog.root.position.equals(start));
});

test('0.27 v3: partner greeting replaces only cosmetic idle and bypasses its cooldown',()=>{
  const person=new Actor('alina',[1,2]);
  person.setNeeds({mood:94,energy:90,hunger:90,bladder:92,hygiene:89});
  for(let i=0;i<130;i++)person.update(.06);
  assert.ok(person.currentIdleGesture(),'An old hair/idle gesture should already be active');
  person.setIdleSurroundings(null,null);
  person.setIdleSurroundings(null,.35);
  person.update(.05);
  assert.equal(person.currentIdleGesture(),'noticePartner');
  const active=new Actor('alina',[1,2]);
  active.setNeeds({mood:94,energy:90,hunger:90,bladder:92,hygiene:89});
  active.setPose('work');
  active.setIdleSurroundings(null,.35);
  active.update(.05);
  assert.equal(active.currentIdleGesture(),null,'Never interrupt actual work');
});

test('0.27 v4: real wave IK brings the visible wrist up beside the face, not behind the torso',()=>{
  const resident=new Actor('vlad',[1,2]);
  resident.setNeeds({mood:92,energy:91,hunger:82,bladder:92,hygiene:90});
  const rig=(resident as unknown as {rig:{head:THREE.Object3D;wrists:THREE.Object3D[]}}).rig;
  resident.root.updateWorldMatrix(true,true);
  const initialWrist=rig.wrists[1].getWorldPosition(new THREE.Vector3());
  const initialHead=rig.head.getWorldPosition(new THREE.Vector3());
  resident.setIdleSurroundings(null,.37);
  const start=resident.root.position.clone();
  for(let i=0;i<32;i++)resident.update(.05);
  resident.root.updateWorldMatrix(true,true);
  const wrist=rig.wrists[1].getWorldPosition(new THREE.Vector3());
  const head=rig.head.getWorldPosition(new THREE.Vector3());
  assert.equal(resident.currentIdleGesture(),'noticePartner');
  assert.ok(wrist.y>initialWrist.y+.22,
    'Raised wrist should actually appear at shoulder/face height');
  assert.ok(wrist.distanceTo(head)<initialWrist.distanceTo(initialHead)-.25,
    'Wrist should approach the face rather than disappear behind the body');
  assert.ok(resident.root.position.distanceTo(start)<1e-8);
});
