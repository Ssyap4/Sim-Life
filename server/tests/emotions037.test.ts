import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {emotionFor,rankLeisure,wishEmotionPriority,PERSONALITIES} from '../../src/shared/emotions';
import {autonomyCandidates,fullLeisureCandidates,thoughtFor} from '../../src/shared/autonomy';
import {wishesFor} from '../../src/shared/wishes';
const healthy={...initialState().characters.vlad,hunger:90,energy:90,mood:90,bladder:90,hygiene:90,social:90,fun:90,comfort:90};
test('emotion tracks existing needs and critical physical discomfort wins',()=>{
 assert.equal(emotionFor(healthy).id,'happy');
 assert.equal(emotionFor({...healthy,hunger:10,energy:35}).id,'hungry');
 assert.equal(emotionFor({...healthy,mood:25,social:22}).id,'lonely');
 assert.equal(emotionFor({...healthy,mood:25}).id,'sad');
 assert.equal(emotionFor({...healthy,energy:35,fun:35,social:35}).id,'tense');
 assert.equal(emotionFor({...healthy,energy:30}).id,'tired');
 assert.equal(emotionFor({...healthy,mood:74}).id,'inspired');
});
test('personal tastes prioritize different activities without removing choices',()=>{
 const actions=[{type:'act',actionId:'sofaMusic'},{type:'act',actionId:'deskGames'},{type:'act',actionId:'sofaRest'}] as const;
 assert.equal(rankLeisure(actions,'vlad',healthy,0)[0].actionId,'deskGames');
 assert.equal(rankLeisure(actions,'alina',healthy,0)[0].actionId,'sofaMusic');
 assert.deepEqual(rankLeisure(actions,'vlad',healthy,2),actions);
 assert.notDeepEqual(PERSONALITIES.vlad.traits,PERSONALITIES.alina.traits);
 assert.ok(wishEmotionPriority('together-time','alina','lonely')>wishEmotionPriority('reading','alina','lonely'));
});
test('emotion layer respects autonomy mode and leaves household unchanged',()=>{
 const s=initialState();Object.assign(s.characters.vlad,healthy,{mood:25});const before=structuredClone(s);
 assert.equal(fullLeisureCandidates(s,'vlad',0).length,0);
 assert.equal(autonomyCandidates(s,'vlad').length,0);
 assert.equal(thoughtFor(s,'vlad').emoji,'😔');
 assert.ok(wishesFor(s,'vlad').length<=3);
 assert.deepEqual(s,before);
 s.autonomy.vlad='needs';s.characters.vlad.bladder=30;
 assert.equal(autonomyCandidates(s,'vlad')[0].need,'bladder');
 assert.equal(fullLeisureCandidates(s,'vlad',0).length,0);
 s.autonomy.vlad='full';assert.ok(fullLeisureCandidates(s,'vlad',0).length>0);
});

import {recordEmotion,activeEmotions,residentEmotion,validEmotionalHistory,recordCompletedActivity} from '../../src/shared/emotions';
test('favorite pets are Simba for Vlad and Verdell for Alina',()=>{
 const s=initialState();
 assert.equal(PERSONALITIES.vlad.pet,'simba');assert.equal(PERSONALITIES.alina.pet,'verdell');
 for(const role of ['vlad','alina'] as const){
  s.autonomy[role]='full';
  const pet=PERSONALITIES[role].pet;
  assert.ok(fullLeisureCandidates(s,role,0).some(c=>c.type==='pet_action'&&c.pet===pet));
  recordCompletedActivity(s,role,{type:'pet_action',pet,action:'pet'});
  assert.equal(activeEmotions(s,role)[0].kind,'favoritePet');
 }
});
test('temporary emotions expire, deduplicate, stay bounded and never change needs',()=>{
 const s=initialState();Object.assign(s.characters.vlad,healthy);const before=structuredClone(s.characters.vlad);
 recordEmotion(s,'vlad','mealBad');assert.equal(residentEmotion(s,'vlad').id,'sad');
 recordEmotion(s,'vlad','mealBad');assert.equal(activeEmotions(s,'vlad').length,1);
 for(const kind of ['mealGood','study','shift','music','pet'] as const)recordEmotion(s,'vlad',kind);
 assert.equal(activeEmotions(s,'vlad').length,4);assert.ok(validEmotionalHistory(s.emotionalEvents));
 assert.equal(validEmotionalHistory({vlad:[{kind:'invalid',until:1,emotion:'happy'}],alina:[]}),false);
 assert.deepEqual(s.characters.vlad,before);
 s.characters.vlad.hunger=10;assert.equal(residentEmotion(s,'vlad').id,'hungry');
 s.clock.day+=1;assert.equal(activeEmotions(s,'vlad').length,0);
 assert.equal(activeEmotions(s,'alina').length,0);
});
