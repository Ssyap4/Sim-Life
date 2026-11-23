import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {initialState} from '../../src/shared/protocol';
import {PETS} from '../../src/shared/pets';
import {currentCatPerch} from '../../src/shared/CatPerches';
import {applyPetAction,runPetRoutines} from '../pets';
import {openServerFiles} from '../storage';

test('0.28: an owner can call a pet without moving the human or teleporting the animal',()=>{
  const state=initialState();
  const owner=structuredClone(state.characters.vlad);
  const before=structuredClone(state.pets.verdell.position);
  const called=applyPetAction(state,'vlad','verdell','call');
  assert.equal(called.ok,true,called.ok?'':called.reason);
  if(!called.ok)return;
  assert.deepEqual(called.state.characters.vlad,owner);
  assert.deepEqual(called.state.pets.verdell.position,before);
  assert.equal(called.state.pets.verdell.routine?.kind,'come');
  const routine=called.state.pets.verdell.routine!;
  assert.deepEqual(routine.route.path.at(-1)??routine.route.from,routine.goal);
  assert.ok(routine.until>routine.startedAt);
  assert.equal(called.state.money,state.money);
  assert.equal(state.revision,0,'original household state must not be mutated');
  const next=called.state;
  const bond=next.pets.verdell.bond;
  runPetRoutines(next,0,routine.until,new Set(),()=>.99);
  assert.equal(next.pets.verdell.bond,bond+3);
});

test('0.28: Simba chooses a REAL available couch with an unmodified floor navigation root',()=>{
  const state=initialState();
  const start=structuredClone(state.pets.simba.position);
  const result=applyPetAction(state,'alina','simba','perch');
  assert.equal(result.ok,true,result.ok?'':result.reason);
  if(!result.ok)return;
  const routine=result.state.pets.simba.routine!;
  assert.equal(routine.kind,'perch');
  assert.ok(routine.perch&&currentCatPerch(result.state.furnishing,routine.perch));
  assert.deepEqual(result.state.pets.simba.position,start);
  assert.equal(result.state.money,state.money);
  const blocked=structuredClone(state);
  blocked.furnishing.soldFixtures=['sofa','bed'];
  assert.equal(applyPetAction(blocked,'alina','simba','perch').ok,false);
  assert.equal(applyPetAction(state,'vlad','verdell','perch').ok,false);
});

test('0.28: Verdell fetches a physical ball to a ground point and returns it on a safe path',()=>{
  const state=initialState();
  const result=applyPetAction(state,'vlad','verdell','fetch');
  assert.equal(result.ok,true,result.ok?'':result.reason);
  if(!result.ok)return;
  const routine=result.state.pets.verdell.routine!;
  assert.equal(routine.kind,'fetch');
  assert.ok(routine.fetchPoint);
  assert.ok(routine.fetchPickupDistance&&routine.fetchPickupDistance>.3);
  assert.deepEqual(routine.route.path.at(-1),routine.goal);
  assert.equal(result.state.money,state.money);
  assert.deepEqual(result.state.pets.verdell.position,state.pets.verdell.position);
  const happy=result.state.pets.verdell.happiness;
  runPetRoutines(result.state,0,routine.until,new Set(),()=>.99);
  assert.equal(result.state.pets.verdell.happiness,Math.min(100,happy+10));
  assert.equal(applyPetAction(state,'vlad','simba','fetch').ok,false);
});

test('0.28: low needs and busy feeding prevent forced pet routes',()=>{
  const state=initialState();
  state.pets.verdell.satiety=12;
  assert.equal(applyPetAction(state,'vlad','verdell','call').ok,false);
  assert.equal(applyPetAction(state,'vlad','verdell','fetch').ok,false);
  state.pets.verdell.satiety=88;
  state.pets.verdell.routine={
    kind:'eat',target:0,startedAt:480,until:500,
    route:{from:PETS.verdell.home,path:[]},
  };
  assert.equal(applyPetAction(state,'vlad','verdell','call').ok,false);
  state.world.places.vlad='park';
  assert.equal(applyPetAction(state,'vlad','verdell','fetch').ok,false);
});

test('0.28: new routes survive isolated save/reload without altering the household schema',()=>{
  const dir=mkdtempSync(join(tmpdir(),'sim-life-pets028-'));
  try{
    const files=openServerFiles(dir);
    const state=initialState();
    for(const [id,action,role] of [['verdell','fetch','vlad'],['simba','perch','alina']] as const){
      const out=applyPetAction(state,role,id,action);
      assert.equal(out.ok,true,out.ok?'':out.reason);
      if(out.ok){
        state.pets[id]=out.state.pets[id];
      }
    }
    files.save(state);
    const loaded=files.load();
    assert.equal(loaded.version,2);
    assert.equal(loaded.pets.verdell.routine?.kind,'fetch');
    assert.equal(loaded.pets.simba.routine?.kind,'perch');
    assert.equal(loaded.money,10000);
    assert.equal(loaded.petFood.verdell,2);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
