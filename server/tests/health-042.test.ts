import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {advanceLife} from '../life';
import {advancePetHealth,foodIllness,humanHealth,petHealth,validHealth} from '../../src/shared/health';
test('Healthy routine and offline resident do not acquire illness',()=>{
 const s=initialState();s.characters.alina.hunger=0;
 const n=advanceLife(s,720,['vlad']);assert.equal(humanHealth(n,'vlad').illness,undefined);assert.equal(humanHealth(n,'alina').risk.hunger,0);assert.equal(s.health,undefined);assert.ok(validHealth(n.health));
});
test('Only sustained critical hunger causes gastritis; recovery grants grace period',()=>{
 const s=initialState();s.characters.vlad.hunger=0;
 let n=advanceLife(s,719,['vlad']);assert.equal(humanHealth(n,'vlad').illness,undefined);
 n=advanceLife(n,1,['vlad']);assert.equal(humanHealth(n,'vlad').illness?.id,'gastritis');
 n=advanceLife(n,1440,['vlad']);n=advanceLife(n,1440,['vlad']);assert.equal(humanHealth(n,'vlad').illness,undefined);assert.equal(humanHealth(n,'vlad').cooldown,1440);
});
test('Food risk is quality-dependent and cannot replace an existing illness',()=>{
 const s=initialState();assert.equal(foodIllness(s,'alina','perfect',()=>0),false);
 assert.equal(foodIllness(s,'alina','bad',()=>.09),false);
 assert.equal(foodIllness(s,'alina','bad',()=>.01),true);
 assert.equal(foodIllness(s,'alina','average',()=>0),false);
 assert.equal(humanHealth(s,'alina').illness?.id,'poisoning');
});
test('Pets have independent neglect counters and recover with grace',()=>{
 const s=initialState();s.pets.verdell.satiety=0;
 advancePetHealth(s,1439);assert.equal(petHealth(s,'verdell').illness,undefined);
 advancePetHealth(s,1);assert.equal(petHealth(s,'verdell').illness?.id,'digestive');assert.equal(petHealth(s,'simba').illness,undefined);
 advancePetHealth(s,1440);advancePetHealth(s,1440);assert.equal(petHealth(s,'verdell').illness,undefined);assert.equal(petHealth(s,'verdell').cooldown,1440);
});
test('Invalid persisted illnesses are rejected',()=>{
 const s=initialState();foodIllness(s,'vlad','bad',()=>0);assert.ok(validHealth(s.health));
 (s.health!.people.vlad.illness as any).id='not-a-condition';assert.equal(validHealth(s.health),false);
});
