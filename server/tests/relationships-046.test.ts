import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {careScore,careEffects,validVanity,careTopicAvailable} from '../../src/shared/vanity';
import {evaluateTask,planTask} from '../tasks';
import {SOCIAL_BY_ID} from '../../src/shared/socialLife';
import {completeTogether,pairScenes,cooperationDenial,parkConversation,validRelationship} from '../society';
test('Vlad care is independent, role-gated and cannot farm mood',()=>{
 let s=initialState(); s.characters.vlad.mood=30;
 const cmd={type:'vanity_care' as const,care:'vladShave' as const};
 assert.equal(planTask(cmd)?.resource,'basin');assert.equal(evaluateTask(s,'alina',cmd).ok,false);
 let r=evaluateTask(s,'vlad',cmd);assert.ok(r.ok);s=r.state;assert.equal(careScore(s,'vlad'),60);assert.equal(careScore(s),40);assert.equal(s.characters.vlad.mood,40);
 r=evaluateTask(s,'vlad',cmd);assert.ok(r.ok);s=r.state;assert.equal(s.characters.vlad.mood,40);assert.ok(validVanity(s.vladCare,'vlad'));assert.equal(validVanity(s.vladCare),false);
 const id='nearTalk:vladCareCompliment';assert.ok(careTopicAvailable(s,'alina',id));s=parkConversation(s,'alina',SOCIAL_BY_ID.get(id)!,0);assert.equal(careTopicAvailable(s,'alina',id),false);assert.equal(s.characters.vlad.mood,55);assert.equal(careEffects(s).length,0);
});
test('received gifts consumed exactly once on pair completion, without second payment',()=>{
 const s=initialState();s.gifts={giftFlowers:1,giftSweets:1};s.characters.alina.mood=20;
 const cmd={type:'together' as const,action:'giftFlowers'};const homes=pairScenes(s,'vlad',cmd);assert.ok(homes);
 assert.equal(s.ledger.length,0);assert.equal(cooperationDenial(s,'vlad',cmd),undefined);
 const r=completeTogether(s,'vlad',cmd,['vlad','alina'],0,homes);assert.ok(r.ok);assert.equal(r.state.money,s.money);assert.equal(r.state.gifts?.giftFlowers,0);assert.ok(r.state.characters.alina.mood>=40);assert.ok(validRelationship(r.state.relationship));assert.ok(cooperationDenial(r.state,'vlad',cmd));assert.equal(completeTogether(r.state,'vlad',cmd,['vlad','alina'],0,homes).ok,false);
 assert.equal(cooperationDenial(r.state,'alina',{type:'together',action:'giftSweets'}),undefined);
 s.gifts={};assert.ok(cooperationDenial(s,'vlad',cmd));assert.equal(completeTogether(s,'vlad',cmd,['vlad','alina'],0,homes).ok,false);
});
test('massage uses sofa seating and gives only recipient recovery once per cooldown',()=>{
 const s=initialState();s.characters.alina.energy=50;s.characters.alina.comfort=30;
 const cmd={type:'together' as const,action:'sofaMassage'};const homes=pairScenes(s,'vlad',cmd);assert.ok(homes);
 assert.equal(homes.alina.pair?.motion,'sofaMassage');assert.equal(homes.vlad.pair?.seat,'sofa');
 const result=completeTogether(s,'vlad',cmd,['vlad','alina'],0,homes);assert.ok(result.ok);
 assert.equal(result.state.characters.alina.energy,58);assert.ok(result.state.characters.alina.comfort>=50);
 assert.equal(result.state.money,s.money);assert.ok(cooperationDenial(result.state,'vlad',cmd));assert.ok(validRelationship(result.state.relationship));
});
import {applyWorld} from '../locations';
import {approachFor,stationById,DELIVERY_FEE} from '../../src/shared/locations';
import {clockAt} from '../../src/shared/life';
import {checkout} from '../market';
test('gift delivery pays once, stays unavailable until collection, and consumes stock',()=>{
 let s=initialState();const before=s.money,cmd={type:'together' as const,action:'giftFlowers'};
 const lines=[{id:'gift:giftFlowers',quantity:1}];assert.equal(checkout(s,'vlad',lines).ok,false);
 const order=applyWorld(s,'vlad',{type:'delivery_order',sequence:0,lines});assert.ok(order.ok);s=order.state;
 assert.equal(s.money,before-850-DELIVERY_FEE);assert.equal(s.ledger.at(-1)?.category,'gifts');assert.ok(cooperationDenial(s,'vlad',cmd));assert.equal(s.gifts?.giftFlowers,undefined);
 const parcel=s.world.deliveries[0];s.clock=clockAt(parcel.readyAt);
 Object.assign(s.characters.vlad,approachFor(stationById('home','courier-handoff')!,'vlad'));
 const handed=applyWorld(s,'vlad',{type:'delivery_handoff',id:parcel.id});assert.ok(handed.ok);s=handed.state;assert.ok(cooperationDenial(s,'vlad',cmd));
 Object.assign(s.characters.vlad,approachFor(stationById('home','parcel')!,'vlad'));
 const claimed=applyWorld(s,'vlad',{type:'delivery_claim',id:parcel.id});assert.ok(claimed.ok);s=claimed.state;
 assert.equal(s.gifts?.giftFlowers,1);assert.equal(s.money,before-850-DELIVERY_FEE);assert.equal(cooperationDenial(s,'vlad',cmd),undefined);assert.equal(applyWorld(s,'vlad',{type:'delivery_claim',id:parcel.id}).ok,false);
});
