import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {pairScenes,completeTogether,cooperationDenial} from '../society';
import {homeSeat} from '../../src/shared/home';

test('shared tea uses exactly two portions and cannot complete without stock',()=>{
 for(const action of ['teaTogether','yardTea']){
  const s=initialState();s.pantry.tea=2;
  const command={type:'together' as const,action};
  const homes=pairScenes(s,'vlad',command);assert.ok(homes);
  for(const role of ['vlad','alina'] as const)assert.equal(homes[role].pair?.seat,action==='yardTea'?'yardTable':'table');
  assert.notDeepEqual(homes.vlad.route.path.at(-1),homes.alina.route.path.at(-1));
  const result=completeTogether(s,'vlad',command,['vlad','alina'],0,homes);assert.ok(result.ok);
  assert.equal(result.state.pantry.tea,0);assert.equal(s.pantry.tea,2);assert.equal(s.money,result.state.money);
  assert.ok(cooperationDenial(result.state,'vlad',command));
  assert.equal(completeTogether(result.state,'vlad',command,['vlad','alina'],0,homes).ok,false);
 }
});
test('yard rest and shared music use real distinct seats without spending resources',()=>{
 for(const action of ['yardRest','musicTogether']){
  const s=initialState(),command={type:'together' as const,action};
  const homes=pairScenes(s,'alina',command);assert.ok(homes);
  for(const role of ['vlad','alina'] as const){
   assert.deepEqual(homes[role].route.path.at(-1),homeSeat(action==='yardRest'?'yardTable':'sofa',role).approach);
  }
  const result=completeTogether(s,'alina',command,['vlad','alina'],0,homes);assert.ok(result.ok);
  assert.equal(result.state.money,s.money);assert.deepEqual(result.state.pantry,s.pantry);
 }
});