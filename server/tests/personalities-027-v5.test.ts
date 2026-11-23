import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {initialState} from '../../src/shared/protocol';
import {homeHabitSuggestions,homeHabitCommands} from '../../src/shared/personalityHabits';
import {choosePetIdle,petCanWelcome,type PetIdleContext} from '../../src/game/PetIdle';
import {Actor} from '../../src/game/Actor';
import {PetActor} from '../../src/game/PetActor';

test('0.27 v5: quiet after 23:00, distinct household rhythms and no invented chores',()=>{
  const state=initialState(),before=structuredClone(state);
  state.clock.minute=2*60;
  const v=homeHabitSuggestions(state,'vlad',0),a=homeHabitSuggestions(state,'alina',0);
  assert.equal(v[0],'sofaRest');
  assert.equal(a[0],'sofaMusic');
  for(const items of [v,a]){
    assert.ok(!items.includes('deskGames'));
    assert.ok(!items.includes('sofaCall'));
    assert.ok(!items.includes('kitchenDishes'));
    assert.equal(new Set(items).size,items.length);
  }
  assert.notDeepEqual(v,a);
  state.clock.minute=15*60;
  state.characters.vlad.mood=30;
  state.characters.alina.mood=30;
  assert.equal(homeHabitSuggestions(state,'vlad',0)[0],'deskJournal');
  assert.equal(homeHabitSuggestions(state,'alina',0)[0],'sofaMusic');
  state.characters.vlad.mood=80;
  state.characters.vlad.social=32;
  assert.equal(homeHabitSuggestions(state,'vlad',0)[0],'sofaCall');
  state.characters.vlad.social=75;
  state.dirtyDishes.table=2;
  assert.equal(homeHabitSuggestions(state,'vlad',0)[0],'kitchenDishes');
  const cmds=homeHabitCommands(state,'vlad',0);
  assert.ok(cmds.some(c=>c.habit==='kitchenDishes'));
  assert.equal(state.money,before.money);
  assert.deepEqual(state.pantry,before.pantry);
  assert.deepEqual(state.furnishing,before.furnishing);
});

test('0.27 v5: Verdell is not begging every few seconds and tired Simba does not pounce',()=>{
  const c:PetIdleContext={satiety:88,energy:86,happiness:91,bond:89,bowl:2,personNearby:true};
  let dogRequests=0,catNuzzles=0;
  for(let t=0;t<120;t++){
    if(['beg','happyHop','greet'].includes(choosePetIdle('verdell',c,t))) dogRequests++;
    if(choosePetIdle('simba',c,t)==='nuzzle')catNuzzles++;
  }
  assert.ok(dogRequests<50,'The dog needs long quiet stretches between attention cues');
  assert.ok(catNuzzles<=16,'The cat stays independent');
  assert.equal(choosePetIdle('verdell',c,4),'happyHop');
  assert.equal(choosePetIdle('simba',c,1),'nuzzle');
  assert.equal(choosePetIdle('simba',{...c,energy:34},4),'observe');
  assert.equal(choosePetIdle('verdell',{...c,satiety:12,bowl:0},4),'hungryLook');
  assert.equal(petCanWelcome({...c,energy:21}),false);
});

test('0.27 v5: arriving pet gets a glance, not a fake interaction or repeat trigger',()=>{
  const a=new Actor('vlad',[1,2]);
  a.setNeeds({mood:89,energy:92,hunger:90,bladder:90,hygiene:84});
  const start=a.root.position.clone();
  a.setIdleSurroundings(null,null);
  a.setIdleSurroundings(.4,null);
  a.update(.08);
  assert.equal(a.currentIdleGesture(),'noticePet');
  for(let i=0;i<100;i++)a.update(.05);
  // Leaving and returning in the 70-second cooldown does not force another
  // greeting. Ordinary idle loops remain allowed after the first greeting.
  a.setIdleSurroundings(null,null);
  a.setIdleSurroundings(.2,null);
  a.update(.08);
  assert.notEqual(a.currentIdleGesture(),'noticePet');
  assert.ok(a.root.position.distanceTo(start)<1e-8);
  const working=new Actor('alina',[0,0]);
  working.setNeeds({mood:90,energy:90,hunger:90,bladder:90,hygiene:90});
  working.setPose('work');
  working.setIdleSurroundings(.3,null);
  working.update(.1);
  assert.equal(working.currentIdleGesture(),null);
});

test('0.27 v5: pet arrival interrupts cosmetic idle only, never server-owned sleep',()=>{
  const context:PetIdleContext={satiety:89,energy:88,happiness:90,bond:90,bowl:2,personNearby:false};
  const dog=new PetActor('verdell');
  dog.setAmbient(context);
  dog.update(4.0);
  assert.ok(dog.currentIdleGesture());
  const before=dog.root.position.clone();
  dog.setAmbient({...context,personNearby:true});
  dog.update(.08);
  assert.equal(dog.currentIdleGesture(),'happyHop');
  assert.ok(dog.root.position.equals(before));
  const sleeping=new PetActor('verdell');
  sleeping.followRoute([],'sleep');
  sleeping.setAmbient({...context,personNearby:true});
  sleeping.update(.08);
  assert.equal(sleeping.currentIdleGesture(),null);
  assert.ok(sleeping.root.position.toArray().every(Number.isFinite));
  assert.ok(new THREE.Vector3().distanceToSquared(sleeping.root.position)>=0);
});
