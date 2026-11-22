import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {wishesFor} from '../../src/shared/wishes';
import {addReadyFood} from '../../src/shared/readyFood';
import {applyAction} from '../logic';

test('wishes are personal, use the lowest real needs and offer executable instructions',()=>{
 const state=initialState();
 state.characters.vlad.bladder=13;
 state.characters.vlad.hygiene=44;
 state.characters.alina.fun=28;
 const vlad=wishesFor(state,'vlad'),alina=wishesFor(state,'alina');
 assert.equal(vlad.length,3);
 assert.equal(vlad[0].need,'bladder');
 assert.deepEqual(vlad[0].command,{type:'act',actionId:'toiletUse'});
 assert.equal(vlad[0].urgency,'urgent');
 assert.equal(alina[0].need,'fun');
 assert.deepEqual(alina[0].command,{type:'act',actionId:'sofaMusic'});
 assert.notDeepEqual(vlad.map(w=>w.title),alina.map(w=>w.title));
});

test('hunger chooses served food, refrigerated portions, safe unlocked cooking or an honest empty state',()=>{
 const state=initialState();
 state.characters.vlad.hunger=10;
 // No ready food, pantry and low-level kitchen recipe are used, never high-level inaccessible steak.
 for(const key of Object.keys(state.pantry) as (keyof typeof state.pantry)[])state.pantry[key]=0;
 let wish=wishesFor(state,'vlad')[0];
 assert.equal(wish.need,'hunger');
 assert.equal(wish.command,undefined);
 assert.match(wish.detail,/не хватает продуктов/i);
 state.pantry.bread=2;
 state.pantry.cheese=2;
 wish=wishesFor(state,'vlad')[0];
 assert.deepEqual(wish.command,{type:'cook',recipe:'toast'});
 addReadyFood(state,'meal','toast',2,'fridge');
 wish=wishesFor(state,'vlad')[0];
 assert.deepEqual(wish.command,{type:'fridge'});
 addReadyFood(state,'meal','toast',2,'table');
 wish=wishesFor(state,'vlad')[0];
 assert.deepEqual(wish.command,{type:'eat',recipe:'toast'});
});

test('wishes never use sold ghost sofa/bed and never buy stock or change personal savings',()=>{
 const state=initialState();
 state.characters.vlad.energy=15;
 state.characters.vlad.social=22;
 state.furnishing.soldFixtures=['bed','sofa','table'];
 const wishes=wishesFor(state,'vlad');
 const energy=wishes.find(w=>w.need==='energy')!;
 const social=wishes.find(w=>w.need==='social')!;
 assert.equal(energy.command,undefined);
 assert.equal(social.command,undefined);
 assert.match(energy.detail,/кровать/i);
 assert.ok(wishes.every(w=>!w.command||!['buy','checkout','travel'].includes(w.command.type)));
 assert.equal(wishes.length,3);
});

test('leisure wish actually restores fun rather than the wrong need',()=>{
 const state=initialState();
 state.characters.alina.fun=21;
 const wish=wishesFor(state,'alina')[0];
 assert.equal(wish.need,'fun');
 assert.ok(wish.command);
 assert.equal(wish.command?.type,'act');
 if(wish.command?.type!=='act')return;
 const result=applyAction(state,'alina',wish.command.actionId);
 assert.equal(result.ok,true);
 if(result.ok){
   assert.ok(result.state.characters.alina.fun>state.characters.alina.fun);
   assert.equal(result.state.money,state.money);
 }
});
