import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {autonomyCandidates,foodSupplyProblem,fullLeisureCandidates} from '../../src/shared/autonomy';
import {addReadyFood} from '../../src/shared/readyFood';
test('50 percent is the care threshold for all seven needs and fridge portions are served',()=>{
 const state=initialState();state.autonomy.alina='needs';
 const needs=['hunger','energy','hygiene','bladder','social','fun','comfort'] as const;
 for(const need of needs)state.characters.alina[need]=80;
 for(const need of needs){
   state.characters.alina[need]=50;assert.ok(autonomyCandidates(state,'alina').some(c=>c.need===need),need);
   state.characters.alina[need]=51;assert.ok(!autonomyCandidates(state,'alina').some(c=>c.need===need),need);
   state.characters.alina[need]=80;
 }
 state.characters.alina.hunger=50;
 for(const key of Object.keys(state.pantry) as (keyof typeof state.pantry)[])state.pantry[key]=0;
 state.readyFood=[];assert.equal(foodSupplyProblem(state,'alina'),true);
 state.meals.omelette=1;addReadyFood(state,'meal','omelette',1,'fridge');
 assert.equal(foodSupplyProblem(state,'alina'),false);
 assert.ok(autonomyCandidates(state,'alina').some(c=>c.command.type==='act'&&c.command.actionId==='kitchenServe'));
 state.autonomy.alina='full';assert.ok(fullLeisureCandidates(state,'alina',0).length>=12);
 assert.equal(fullLeisureCandidates(state,'alina',0).some(c=>c.type==='play_game'&&c.device==='laptop'),true);
});
