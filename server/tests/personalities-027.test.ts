import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {characterDemeanor} from '../../src/game/CharacterDemeanor';
import {choosePetIdle, type PetIdleContext} from '../../src/game/PetIdle';
import {homeHabitSuggestions} from '../../src/shared/personalityHabits';
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
