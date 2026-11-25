import assert from 'node:assert/strict';
import test from 'node:test';
import {initialState} from '../../src/shared/protocol';
import {careScore,careBonuses,careTopicAvailable,finishCare,validVanity} from '../../src/shared/vanity';
import {planTask,evaluateTask} from '../tasks';
import {advanceLife} from '../life';
import {parkConversation,cooperationDenial} from '../society';
import {SOCIAL_BY_ID} from '../../src/shared/socialLife';
test('Care is optional, Alina-only, time-limited and replaces effects',()=>{
 let s=initialState();assert.equal(careScore(s),40);assert.equal(planTask({type:'vanity_care',care:'invalid'}),null);
 assert.equal(evaluateTask(s,'vlad',{type:'vanity_care',care:'style'}).ok,false);
 s.characters.alina.mood=30;
 const r=evaluateTask(s,'alina',{type:'vanity_care',care:'style'});assert.ok(r.ok);s=r.state;assert.equal(careScore(s),55);assert.equal(s.characters.alina.mood,40);
 finishCare(s,'style');assert.equal(s.characters.alina.mood,40);finishCare(s,'light');assert.equal(careScore(s),70);
 finishCare(s,'evening');finishCare(s,'fancy');finishCare(s,'skin');finishCare(s,'perfume');
 assert.equal(careScore(s),100);assert.deepEqual(careBonuses(s,'alina'),{mood:.75,social:1.25});assert.equal(careBonuses(s,'vlad').mood,1);
 assert.ok(validVanity(s.vanity));assert.equal(careScore(advanceLife(s,1440,[])),40);
 assert.equal(validVanity({hair:{id:'light',until:1,noticed:false}}),false);
});
test('Contextual questions are role- and effect-gated; a compliment is not repeatable',()=>{
 let s=initialState();const action='nearTalk:careMakeup',topic=SOCIAL_BY_ID.get(action)!;
 assert.equal(careTopicAvailable(s,'alina',action),false);finishCare(s,'light');assert.equal(careTopicAvailable(s,'alina',action),true);assert.equal(careTopicAvailable(s,'vlad',action),false);
 assert.ok(cooperationDenial(s,'vlad',{type:'together',action}));s.characters.alina.mood=20;s.characters.alina.social=20;
 s=parkConversation(s,'alina',topic,0);assert.equal(s.characters.alina.mood,35);assert.equal(s.characters.alina.social,40);
 assert.equal(careTopicAvailable(s,'alina',action),false);finishCare(s,'light');assert.equal(careTopicAvailable(s,'alina',action),false);
 assert.equal(parkConversation(s,'alina',topic,0).characters.alina.mood,35);
});
