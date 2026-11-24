import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../../src/shared/protocol';
import { gameMinutes } from '../../src/shared/life';
import { applyLifeMoments } from '../../src/shared/lifeMoments';
import { activeEmotions, recordCompletedActivity, recordEmotion, residentEmotion, validEmotionalHistory } from '../../src/shared/emotions';
import { wishesFor } from '../../src/shared/wishes';
import { wishAtStart, fulfillWish } from '../happiness';

const healthy={hunger:90,energy:90,bladder:90,hygiene:90,social:90,fun:90,comfort:90,mood:90,pose:'idle' as const};
function fixture(){
 const s=initialState();
 Object.assign(s.characters.vlad,healthy);
 Object.assign(s.characters.alina,healthy);
 return s;
}
test('moments are occasional, bounded, deterministic and do not alter economy or needs',()=>{
 let total=0;
 for(let day=1;day<=30;day++){
  const s=fixture();
  let count=0;
  for(const minute of [480,840,1200]){
   s.clock={day,minute};
   const before=structuredClone(s);
   const twin=structuredClone(s);
   const previous=gameMinutes(s.clock)-1;
   applyLifeMoments(s,previous,['vlad']);
   applyLifeMoments(twin,previous,['vlad']);
   assert.deepEqual(s,twin);
   const event=activeEmotions(s,'vlad')[0];
   if(event)count++;
   assert.deepEqual(s.characters,before.characters);
   assert.deepEqual(s.happiness,before.happiness);
   assert.equal(s.money,before.money);
   assert.equal(activeEmotions(s,'alina').length,0);
   assert.ok(validEmotionalHistory(s.emotionalEvents));
   const same=structuredClone(s);
   applyLifeMoments(s,gameMinutes(s.clock),['vlad']);
   assert.deepEqual(s,same);
  }
  assert.ok(count<=1);
  total+=count;
 }
 assert.ok(total>0&&total<30);
});
test('no moment for unavailable, sleeping, low-needs or occupied residents; real events win',()=>{
 for(let day=1;day<=12;day++)for(const minute of [480,840,1200]){
  const s=fixture();s.clock={day,minute};
  const previous=gameMinutes(s.clock)-1;
  s.characters.vlad.hunger=30;
  s.characters.alina.pose='sleep';
  applyLifeMoments(s,previous,['vlad','alina']);
  assert.equal(activeEmotions(s,'vlad').length+activeEmotions(s,'alina').length,0);
  Object.assign(s.characters.vlad,healthy);
  applyLifeMoments(s,previous,[]);
  assert.equal(activeEmotions(s,'vlad').length,0);
  recordEmotion(s,'vlad','mealBad');
  applyLifeMoments(s,previous,['vlad']);
  assert.equal(activeEmotions(s,'vlad')[0].kind,'mealBad');
  assert.equal(residentEmotion(s,'vlad').id,'sad');
 }
});
test('completed real home activities create appropriate emotional memories, not free rewards',()=>{
 const s=fixture(), before=structuredClone(s);
 for(const [actionId,kind] of [['kitchenTea','teaMoment'],['kitchenDishes','tidyMoment'],['sofaRead','readingMoment'],['tableTalk','friendlyCall']] as const){
  recordCompletedActivity(s,'vlad',{type:'act',actionId});
  assert.equal(activeEmotions(s,'vlad')[0].kind,kind);
 }
 assert.deepEqual(s.happiness,before.happiness);
 assert.deepEqual(s.characters,before.characters);
});
test('contextual wishes keep the three-card limit and use ordinary reward cooldown',()=>{
 const s=fixture();s.clock.minute=600;
 s.characters.vlad.energy=65;
 recordEmotion(s,'vlad','shift');
 const wishes=wishesFor(s,'vlad');
 assert.ok(wishes.length<=3);
 const wish=wishes.find(w=>w.id==='rest-break');
 assert.ok(wish);
 assert.match(wish.detail,/После работы/);
 const matched=wishAtStart(s,'vlad',{type:'act',actionId:'sofaRest'});
 assert.equal(matched?.id,'rest-break');
 const before=structuredClone(s);
 assert.ok(fulfillWish(s,'vlad',matched,before));
 assert.equal(fulfillWish(s,'vlad',matched,before),'');
 assert.ok(!wishesFor(s,'vlad').some(w=>w.id==='rest-break'));
 s.characters.vlad.bladder=15;
 assert.equal(wishesFor(s,'vlad')[0].id,'need-bladder');
});
