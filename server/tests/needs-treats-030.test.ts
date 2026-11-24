import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {RECIPES,TAKEOUT} from '../../src/shared/food';
import {applyAction} from '../logic';
import {applyPetAction,runPetRoutines} from '../pets';
import {treatsRemaining,PET_IDS} from '../../src/shared/pets';
import {openServerFiles} from '../storage';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {homeSeat} from '../../src/shared/home';
import {PetActor} from '../../src/game/PetActor';
import {Vector3} from 'three';
import {planTask} from '../tasks';

test('all everyday needs and meals have sensible complete restoration, with high-tier meals capped at 100',()=>{
  const s=initialState();
  for(const [action,need,value] of [['toiletUse','bladder',100],['bathShower','hygiene',80],['bathSoak','hygiene',90],['bathFoam','hygiene',100]] as const){
    s.characters.vlad[need]=0;
    const r=applyAction(s,'vlad',action);
    assert.ok(r.ok);assert.equal(r.state.characters.vlad[need],value);
  }
  for(const item of [...Object.values(RECIPES),...Object.values(TAKEOUT)])
    assert.ok(item.hunger>=60&&item.hunger<=100,item.name);
  assert.equal(RECIPES.omelette.hunger,65);
  assert.equal(RECIPES.chickenRice.hunger,70);
  assert.equal(RECIPES.beefWellington.hunger,100);
  assert.equal(RECIPES.lambRosemary.hunger,100);
  assert.equal(TAKEOUT.rollsPremium.hunger,100);
});
test('three treats shared per pet per day, independent cats/dogs, no stock or money charge, persisted and reset after midnight',()=>{
  let s=initialState();
  const money=s.money,stock=structuredClone(s.petFood);
  for(const id of PET_IDS){
    Object.assign(s.pets[id],{satiety:0,happiness:10,bond:10});
    for(let i=0;i<3;i++){
      const r=applyPetAction(s,i%2?'alina':'vlad',id,'treat');
      assert.ok(r.ok);s=r.state;
      assert.equal(treatsRemaining(s.pets[id],s.clock.day),2-i);
    }
    assert.equal(s.pets[id].satiety,90);
    assert.equal(s.pets[id].happiness,46);
    assert.equal(s.pets[id].bond,34);
    assert.equal(applyPetAction(s,'alina',id,'treat').ok,false);
  }
  assert.equal(s.money,money);assert.deepEqual(s.petFood,stock);
  const dir=mkdtempSync(join(tmpdir(),'sim-life-treats-'));
  try{
    const files=openServerFiles(dir);files.save(s);s=files.load();
    for(const id of PET_IDS)assert.equal(treatsRemaining(s.pets[id],s.clock.day),0);
    s.clock.day++;
    for(const id of PET_IDS){
      assert.equal(treatsRemaining(s.pets[id],s.clock.day),3);
      const r=applyPetAction(s,'vlad',id,'treat');assert.ok(r.ok);s=r.state;
      assert.equal(s.pets[id].satiety,100);assert.equal(treatsRemaining(s.pets[id],s.clock.day),2);
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
  assert.equal(planTask({type:'pet_action',pet:'simba',action:'treat'})?.durationMs,6000);
});
test('pets seek a real diner, perform distinct gestures, and stop begging without a meal or remaining treats',()=>{
  const s=initialState();
  const owner=homeSeat('table','vlad').approach;
  const diners=new Map([['vlad',owner]] as const);
  for(const id of PET_IDS){
    Object.assign(s.pets[id],{energy:95,satiety:65,bladder:95});
  }
  runPetRoutines(s,0,480,new Set(),()=>.2,undefined,diners);
  for(const id of PET_IDS){
    const routine=s.pets[id].routine;
    assert.equal(routine?.kind,'beg',id);
    assert.ok(routine!.goal);
    assert.ok(Math.hypot(routine!.goal!.x-owner.x,routine!.goal!.z-owner.z)<2);
    const actor=new PetActor(id);
    const goal=routine!.goal!;
    actor.root.position.set(goal.x,0,goal.z);
    actor.followRoute([], 'beg',Math.atan2(owner.x-goal.x,owner.z-goal.z));
    for(let i=0;i<60;i++)actor.update(1/60);
    assert.equal(actor.currentIdleGesture(),id==='verdell'?'beg':'pawWave');
    assert.ok(actor.root.position.distanceTo(new Vector3(goal.x,0,goal.z))<.01);
  }
  assert.notDeepEqual(s.pets.simba.routine?.goal,s.pets.verdell.routine?.goal);
  const before=structuredClone(s.pets);
  runPetRoutines(s,0,481,new Set(),()=>.99,undefined,new Map());
  for(const id of PET_IDS){
    assert.notEqual(s.pets[id].routine?.kind,'beg');
    assert.equal(s.pets[id].satiety,before[id].satiety);
  }
  s.pets.verdell.treats={day:s.clock.day,used:3};delete s.pets.verdell.routine;
  runPetRoutines(s,0,482,new Set(),()=>.2,undefined,diners);
  assert.notEqual((s.pets.verdell.routine as import('../../src/shared/pets').PetRoutine|undefined)?.kind,'beg');
});
