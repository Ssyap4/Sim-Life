import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {applyFamilyLife,contextualEvents,creditLifeEvent,offerLifeEvent,validFamilyLife,eventStatus,type LifeEvent} from '../../src/shared/familyLife';
import {weatherAt} from '../../src/shared/weather';
import {addLedger} from '../../src/shared/economy';
const accept=(s:ReturnType<typeof initialState>,id:LifeEvent)=>{
 s.familyLife!.event={id,day:s.clock.day,status:'open'};
 const r=applyFamilyLife(s,'vlad',{type:'family_event',id,day:s.clock.day,accept:true});
 assert.ok(r.ok,r.ok?'':r.reason);return r.state;
};
test('contextual eligibility uses actual weather, money, pets, equipment and paid work',()=>{
 const s=initialState();s.clock={day:3,minute:600};s.money=1000;s.pets.verdell.happiness=42;s.pets.simba.happiness=35;
 s.furnishing.placed.push({id:1,sku:'hobby-workbench',finish:'oak',x:10.5,z:-6.4,rotation:0});
 addLedger(s,'alina','income','work',3200,'Смена');
 const c=contextualEvents(s,['vlad','alina']);for(const id of ['dogAttention','catAttention','budgetDinner','workBonus','modelingDay','invitation'] as const)assert.ok(c.includes(id),id);
 assert.ok(!contextualEvents(s,['vlad']).includes('workBonus'));
 s.world.places.vlad='market';s.world.places.alina='market';assert.deepEqual(contextualEvents(s,['vlad','alina']),['workBonus']);
 s.world.places.vlad=s.world.places.alina='home';
 const rainy=Array.from({length:36},(_,i)=>i+1).find(day=>['rain','storm','snow'].includes(weatherAt({day,minute:600}).kind))!;
 s.clock.day=rainy;assert.ok(contextualEvents(s,['vlad','alina']).includes('rainyEvening'));assert.ok(!contextualEvents(s,['vlad']).includes('rainyEvening'));
});
test('goal requires real completion, correct pet and shared presence; no duplicate reward',()=>{
 let s=initialState();s.clock.day=3;s.characters.vlad.mood=30;s.characters.alina.mood=30;
 s=accept(s,'dogAttention');assert.equal(s.characters.vlad.mood,30);assert.equal(creditLifeEvent(s,'vlad',{type:'pet_action',pet:'simba',action:'pet'}),'');
 assert.match(creditLifeEvent(s,'vlad',{type:'pet_action',pet:'verdell',action:'play'}),/выполнено/);assert.equal(s.characters.vlad.mood,38);
 assert.equal(creditLifeEvent(s,'alina',{type:'pet_action',pet:'verdell',action:'pet'}),'');assert.equal(s.characters.alina.mood,30);
 s=accept(s,'rainyEvening');assert.equal(creditLifeEvent(s,'vlad',{type:'together',action:'film'}),'');
 assert.match(creditLifeEvent(s,'vlad',{type:'together',action:'film'},true),/выполнено/);assert.equal(s.characters.alina.mood,38);
 assert.equal(s.relationship.memories.at(-1)?.action,'lifeEvent:rainyEvening');
 s=accept(s,'budgetDinner');s.clock.day++;assert.equal(creditLifeEvent(s,'vlad',{type:'cook',recipe:'omelette'}),'');assert.equal(eventStatus(s.familyLife!.event!,s.clock.day),'Истекло');
});
test('random eligible selection, cooldown, saved history, one shared bonus',()=>{
 let s=initialState();s.clock={day:3,minute:600};s.pets.verdell.happiness=20;s.pets.simba.happiness=90;s.money=10000;
 assert.equal(offerLifeEvent(s,3479,[],()=>0),false);
 assert.equal(offerLifeEvent(s,3479,['vlad'],()=>0),true);assert.equal(s.familyLife!.event!.id,'dogAttention');
 s.clock={day:6,minute:600};assert.equal(offerLifeEvent(s,7799,['vlad'],()=>0),true);
 assert.notEqual(s.familyLife!.event!.id,'dogAttention');assert.equal(s.familyLife!.eventHistory?.[0].id,'dogAttention');assert.ok(validFamilyLife(s.familyLife));
 const money=s.money;s=accept(s,'workBonus');assert.equal(s.money,money+450);
 assert.equal(applyFamilyLife(s,'alina',{type:'family_event',id:'workBonus',day:6,accept:true}).ok,false);
 assert.equal(s.ledger.at(-1)?.category,'work');
});
test('creative and cooking event rewards only relevant completed activity',()=>{
 let s=accept(initialState(),'modelingDay');assert.equal(creditLifeEvent(s,'vlad',{type:'read_book',book:'master'}),'');
 assert.match(creditLifeEvent(s,'alina',{type:'furniture_use',action:'buildCar',furnitureId:2}),/выполнено/);
 s=accept(s,'budgetDinner');assert.match(creditLifeEvent(s,'vlad',{type:'cook',recipe:'omelette'}),/выполнено/);
});
