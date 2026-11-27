import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {familyMoments,momentDenial,momentReward} from '../../src/shared/familyMoments';
import {FAMILY_MEMORY_LIMIT,journalEntries,journalSummary} from '../../src/shared/familyJournal';
import {validRelationship,completeTogether,pairScenes} from '../society';
import {openServerFiles} from '../storage';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('062 morning tea requires stock, does not mutate on read, and is unavailable across locations',()=>{
 const s=initialState();s.pantry.tea=2;s.characters.alina.energy=95;s.characters.alina.mood=95;
 const before=structuredClone(s);
 const m=familyMoments(s,'vlad').find(m=>m.id==='morningTea');
 assert.ok(m);assert.deepEqual(s,before);
 assert.equal(momentDenial(s,'vlad',{type:'together',action:'teaTogether',moment:m.id}),undefined);
 s.pantry.tea=0;assert.ok(momentDenial(s,'vlad',{type:'together',action:'teaTogether',moment:m.id}));
 s.world.places.alina='park';assert.deepEqual(familyMoments(s,'vlad'),[]);
});
test('062 park stories use real actions and record only the completed story',()=>{
 const s=initialState();s.world.places.vlad='park';s.world.places.alina='park';
 const m=familyMoments(s,'vlad').find(m=>m.id==='parkBreak');assert.ok(m);
 const cmd={type:'together' as const,action:m.action,moment:m.id};
 const scenes=pairScenes(s,'vlad',cmd);assert.ok(scenes);
 const r=completeTogether(s,'vlad',cmd,['vlad','alina'],0,scenes);
 if(!r.ok)assert.fail(r.reason);
 assert.equal(r.state.money,s.money);
 assert.equal(r.state.relationship.memories.filter(x=>x.action==='familyMoment:parkBreak').length,1);
 assert.equal(familyMoments(r.state,'vlad').some(x=>x.id==='parkBreak'),false);
});
test('062 journal filters, day grouping, archive cap and persistence',()=>{
 const s=initialState();
 for(let i=0;i<FAMILY_MEMORY_LIMIT;i++)s.relationship.memories.push({at:i*1440,action:i%2?'familyMoment:parkBreak':'film',group:i%2?'care':'fun',title:'Moment',description:'Completed'});
 const before=structuredClone(s.relationship.memories);
 assert.equal(journalSummary(before).days,FAMILY_MEMORY_LIMIT);
 assert.equal(journalEntries(before,'story').length,FAMILY_MEMORY_LIMIT/2);
 assert.equal(journalEntries(before,'fun').length,FAMILY_MEMORY_LIMIT/2);
 assert.ok(journalEntries(before)[0].at>journalEntries(before).at(-1)!.at);
 assert.deepEqual(s.relationship.memories,before);
 const dir=mkdtempSync(join(tmpdir(),'journal062-'));
 try{const files=openServerFiles(dir);files.save(s);assert.deepEqual(files.load().relationship.memories,before);}finally{rmSync(dir,{recursive:true,force:true});}
 s.clock.day=FAMILY_MEMORY_LIMIT+1;
 momentReward(s,'vlad',{id:'parkBreak',emoji:'',title:'Park',description:'Rest',action:'parkRest',bonus:'Together'});
 assert.equal(s.relationship.memories.length,FAMILY_MEMORY_LIMIT);assert.equal(s.relationship.memories[0].at,1440);assert.ok(validRelationship(s.relationship));
});

import {familyTraditions,familyHighlights} from '../../src/shared/familyJournal';
import {applyWeekend,creditWeekendTogether,validWeekendState,WEEKEND_PRESETS,weekendEstimate} from '../../src/shared/weekends';
import {SOCIAL_BY_ID} from '../../src/shared/socialLife';
import {addRelationship} from '../society';

test('062 traditions count distinct days, never pay rewards or invent history',()=>{
 const s=initialState(),m=s.relationship.memories;
 const record=(at:number,action:string)=>m.push({at,action,group:'home',title:'Real',description:'Completed'});
 record(20,'teaTogether');record(25,'familyMoment:morningTea');record(1450,'yardTea');
 assert.equal(familyTraditions(m)[0].days,2);assert.equal(familyTraditions(m)[0].established,false);
 record(2900,'yardCoffee');assert.equal(familyTraditions(m)[0].days,3);assert.equal(familyTraditions(m)[0].established,true);
 assert.equal(familyTraditions(m).length,1);const before=structuredClone(s);
 assert.deepEqual(familyHighlights(m),[]);familyTraditions(m);assert.deepEqual(s,before);
 record(4000,'homeEvening');record(4200,'homeEvening');record(3100,'holiday:newYear');
 assert.deepEqual(familyHighlights(m).map(x=>[x.id,x.memory.at]),[['holiday',3100],['evening',4000]]);
});
test('062 family plans: new presets consent, real location, no duplicate credit, no cost',()=>{
 let s=initialState();
 for(const id of ['quiet','date','green','lakeDay'] as const)assert.ok(WEEKEND_PRESETS[id].items.length<=6);
 const apply=(role:'vlad'|'alina',type:string,extra:Record<string,unknown>={})=>{
   const r=applyWeekend(s,role,{type,version:s.weekends?.version??0,...extra});if(!r.ok)assert.fail(r.reason);s=r.state;
 };
 apply('vlad','weekend_propose',{preset:'custom',items:['tea','dinner','film','evening','bench','campfire']});
 creditWeekendTogether(s,'teaTogether');assert.deepEqual(s.weekends?.plan?.done,[]);
 apply('alina','weekend_accept');
 creditWeekendTogether(s,'parkRest');creditWeekendTogether(s,'lakeTalk:gratitude');assert.deepEqual(s.weekends?.plan?.done,[]);
 creditWeekendTogether(s,'teaTogether');creditWeekendTogether(s,'takeout','pizza');creditWeekendTogether(s,'film','comedy');creditWeekendTogether(s,'film','comedy');
 assert.deepEqual(s.weekends?.plan?.done,['tea','dinner','film']);
 creditWeekendTogether(s,'sofaTalk');s.world.places={vlad:'park',alina:'park'};creditWeekendTogether(s,'parkRest');
 s.world.places={vlad:'lake',alina:'lake'};creditWeekendTogether(s,'lakeTalk:gratitude');
 assert.deepEqual(s.weekends?.plan?.done,['tea','dinner','film','evening','bench','campfire']);
 assert.ok(validWeekendState(s.weekends));assert.equal(s.money,10000);
 assert.deepEqual(weekendEstimate(['tea','dinner','film']),{min:0,max:0});
 apply('vlad','weekend_finish');assert.equal(s.relationship.memories.length,0);
 apply('alina','weekend_finish');assert.equal(s.relationship.memories.length,1);assert.match(s.relationship.memories[0].description,/Чай вдвоём/);
});
test('062 ordinary completed tea is remembered but repeating same day is not an extra memory',()=>{
 const s=initialState();const a=SOCIAL_BY_ID.get('teaTogether')!;
 addRelationship(s,a,0);addRelationship(s,a,1);
 assert.equal(s.relationship.memories.length,1);s.clock.day++;addRelationship(s,a,0);
 assert.equal(familyTraditions(s.relationship.memories)[0].days,2);
});

test('062 tea can finish a planned evening, using real supplies and recording actual completion',()=>{
 const s=initialState();s.pantry.tea=2;
 s.relationship.evening={kind:'cook',recipe:'omelette',phase:'unwind',startedAt:0,occasion:'ordinary'};
 const cmd={type:'together' as const,action:'teaTogether'};
 const scenes=pairScenes(s,'vlad',cmd);assert.ok(scenes);
 const r=completeTogether(s,'vlad',cmd,['vlad','alina'],0,scenes);
 if(!r.ok)assert.fail(r.reason);
 assert.equal(r.state.pantry.tea,0);
 assert.equal(r.state.relationship.evening?.phase,'complete');
 assert.match(r.state.relationship.memories.find(m=>m.action==='homeEvening')!.description,/выпили чай вместе/);
 assert.equal(r.state.money,s.money);
});

import {familyAutonomyReady,familyAutoInitiator,familyAutoTopics,familyAutoLeisure} from '../../src/shared/familyAutonomy';
import {contextAvailable,NEARBY_TALK_TOPICS} from '../../src/shared/socialLife';
import {newCareerProgress} from '../../src/shared/careers';
import {gameMinutes} from '../../src/shared/life';
import {weatherAt} from '../../src/shared/weather';
import {recordCompletedActivity,activeEmotions} from '../../src/shared/emotions';
const ready=()=>{const s=initialState();s.autonomy={vlad:'full',alina:'full'};for(const r of ['vlad','alina'] as const)Object.assign(s.characters[r],{hunger:90,energy:90,hygiene:90,bladder:90,comfort:90,social:90,fun:90,mood:90,pose:'idle'});return s;};
test('062 greetings remain completed after short relationship history is pruned and persisted',()=>{
 const s=ready(),a=SOCIAL_BY_ID.get('nearTalk:goodMorning')!;
 s.clock.minute=370;assert.ok(contextAvailable(a,s,'vlad'));
 addRelationship(s,a,0);s.relationship.recent=[];s.clock.minute=650;
 assert.equal(contextAvailable(a,s,'alina'),false);assert.ok(validRelationship(s.relationship));
 const dir=mkdtempSync(join(tmpdir(),'greetings062-'));try{const files=openServerFiles(dir);files.save(s);assert.deepEqual(files.load().relationship.greetings,s.relationship.greetings);}finally{rmSync(dir,{recursive:true,force:true});}
 s.clock.day++;s.clock.minute=370;assert.ok(contextAvailable(a,s,'alina'));
 assert.equal(validRelationship({...s.relationship,greetings:{bad:123}}),false);
});
test('062 returning worker is greeted by waiting partner, not arbitrary rotation',()=>{
 const s=ready();s.clock.minute=1020;const progress=newCareerProgress();
 progress.history.push({id:1,at:gameMinutes(s.clock)-10,title:'Смена завершена',text:'Домой'});
 s.careers.residents.alina.progress.marketing=progress;
 assert.equal(familyAutoInitiator(s,'alina'),'vlad');
 assert.equal(familyAutoTopics(s,'vlad')[0],'nearTalk:welcomeHome');
 addRelationship(s,SOCIAL_BY_ID.get('nearTalk:welcomeHome')!,0);
 s.relationship.recent=[];assert.equal(contextAvailable(SOCIAL_BY_ID.get('nearTalk:welcomeHome')!,s,'vlad'),false);
 s.autonomy.alina='needs';assert.equal(familyAutonomyReady(s),false);
});
test('062 automatic topics prioritize support, vary, stay free and respect weather and vital needs',()=>{
 const s=ready();s.clock.minute=780;s.characters.alina.social=30;
 assert.equal(familyAutoInitiator(s,'alina'),'vlad');assert.equal(familyAutoTopics(s,'vlad')[0],'nearTalk:listen');
 const before=structuredClone(s);familyAutoTopics(s,'vlad');assert.deepEqual(s,before);
 s.characters.alina.social=90;
 const topics=new Set<string>();for(let day=1;day<=12;day++){s.clock.day=day;topics.add(familyAutoTopics(s,'vlad')[0]);}
 assert.ok(topics.size>=5);
 s.clock.minute=1300;assert.ok(!familyAutoLeisure(s,'vlad').includes('yardRest'));
 for(let day=1;day<=36;day++){s.clock={day,minute:800};if(['rain','storm','snow'].includes(weatherAt(s.clock).kind))assert.ok(!familyAutoLeisure(s,'vlad').includes('yardRest'));}
 s.characters.alina.hunger=50;assert.deepEqual(familyAutoTopics(s,'vlad'),[]);
 assert.ok(NEARBY_TALK_TOPICS.some(a=>a.id==='nearTalk:listenWithoutAdvice'));
 recordCompletedActivity(s,'vlad',{type:'together',action:'nearTalk:goodMorning'});assert.equal(activeEmotions(s,'vlad')[0]?.kind,'quietMorning');
});

import {dailyCompleted,dailyRoutineChoices,companionChoices} from '../../src/shared/dailyRoutine';
import {addReadyFood} from '../../src/shared/readyFood';
import {planTask} from '../tasks';
test('062 shared breakfast consumes exactly two real portions and records both routines',()=>{
 const s=ready();s.clock.minute=480;s.meals.omelette=2;addReadyFood(s,'meal','omelette',2,'table');
 for(const r of ['vlad','alina'] as const)s.characters[r].hunger=65;
 const cmd={type:'together' as const,action:'eat',item:'omelette'};
 const homes=pairScenes(s,'vlad',cmd);assert.ok(homes);
 const result=completeTogether(s,'vlad',cmd,['vlad','alina'],0,homes);if(!result.ok)assert.fail(result.reason);
 for(const r of ['vlad','alina'] as const){
  assert.ok(dailyCompleted(result.state,r).has('breakfast'));
  assert.ok(!dailyRoutineChoices(result.state,r,dailyCompleted(result.state,r)).some(x=>x.key==='breakfast'));
 }
 assert.equal(result.state.meals.omelette,0);assert.equal(result.state.dirtyDishes.table,2);assert.equal(result.state.money,s.money);
 assert.equal(s.meals.omelette,2);
});
test('062 breakfast preparation records real cooked food, not imaginary breakfast eaten',()=>{
 const s=ready();s.clock.minute=480;s.characters.alina.hunger=65;s.pantry.eggs=2;s.pantry.milk=1;
 const m=familyMoments(s,'vlad').find(x=>x.id==='prepareBreakfast');assert.ok(m);
 const cmd={type:'together' as const,action:m.action,item:m.item,moment:m.id};
 const homes=pairScenes(s,'vlad',cmd);assert.ok(homes);
 const result=completeTogether(s,'vlad',cmd,['vlad','alina'],0,homes);if(!result.ok)assert.fail(result.reason);
 assert.equal(result.state.pantry.eggs,0);assert.ok(result.state.meals.omelette>=2);
 assert.ok(!dailyCompleted(result.state,'vlad').has('breakfast'));assert.ok(!dailyCompleted(result.state,'alina').has('breakfast'));
 assert.ok(result.state.relationship.memories.some(x=>x.action==='familyMoment:prepareBreakfast'));assert.equal(result.state.money,s.money);
});
test('062 fridge suggestion moves one existing fresh serving and never conjures food',()=>{
 const s=ready();s.clock.minute=750;s.characters.alina.hunger=65;
 s.meals.omelette=2;addReadyFood(s,'meal','omelette',2,'fridge');
 const m=familyMoments(s,'vlad').find(x=>x.id==='serveFromFridge');assert.ok(m);
 const cmd={type:'together' as const,action:m.action,item:m.item,moment:m.id};
 const homes=pairScenes(s,'vlad',cmd);assert.ok(homes);
 const result=completeTogether(s,'vlad',cmd,['vlad','alina'],0,homes);if(!result.ok)assert.fail(result.reason);
 assert.equal(result.state.readyFood.filter(b=>b.item==='omelette'&&b.storage==='table').reduce((n,b)=>n+b.portions,0),1);
 assert.equal(result.state.readyFood.filter(b=>b.item==='omelette'&&b.storage==='fridge').reduce((n,b)=>n+b.portions,0),1);
 assert.equal(result.state.meals.omelette,2);assert.equal(result.state.money,s.money);
});
test('062 pet play suggested only for awake, fed, rested animals; companion chores reserve separate resources',()=>{
 const s=ready();s.clock.minute=750;
 Object.assign(s.pets.simba,{happiness:55,energy:80,satiety:80,bladder:80,routine:undefined});
 assert.ok(familyMoments(s,'vlad').some(x=>x.id==='petGames'&&x.item==='simba'));
 s.pets.simba.energy=20;assert.ok(!familyMoments(s,'vlad').some(x=>x.id==='petGames'&&x.item==='simba'));
 const dish={type:'act',actionId:'kitchenDishes'} as const;
 const choices=companionChoices(s,'alina',dish);assert.ok(choices.length);assert.ok(choices.every(c=>planTask(c)?.resource!==planTask(dish)?.resource));
 s.autonomy.alina='needs';assert.deepEqual(companionChoices(s,'alina',dish),[]);
});

import {PERSONALITIES,personalPreference} from '../../src/shared/emotions';
import {rankFull} from '../../src/shared/fullAutonomy';
import {fullLeisureCandidates,thoughtFor} from '../../src/shared/autonomy';
import {finishCare} from '../../src/shared/vanity';
test('062 individual dreams and preferences influence real leisure without monopolizing it',()=>{
 const s=ready();s.clock.minute=780;
 assert.match(PERSONALITIES.vlad.dream,/вайбкодинг/);assert.match(PERSONALITIES.alina.dream,/реконструкц/);
 assert.equal(PERSONALITIES.alina.pet,'verdell');
 assert.ok(personalPreference('vlad','games')>personalPreference('alina','games'));
 assert.ok(personalPreference('alina','reading')>personalPreference('vlad','reading'));
 const opts=[{type:'play_game',game:'strategy',device:'desktop'},{type:'read_book',book:'prince'}] as const;
 assert.equal(rankFull(s,'vlad',opts as any,[])[0].type,'play_game');
 assert.equal(rankFull(s,'alina',opts as any,[])[0].type,'read_book');
 assert.ok(fullLeisureCandidates(s,'alina',0).some(c=>c.type==='vanity_care'&&c.care==='style'));
 finishCare(s,'style');assert.ok(!fullLeisureCandidates(s,'alina',0).some(c=>c.type==='vanity_care'&&c.care==='style'));
 assert.ok(!fullLeisureCandidates(s,'vlad',0).some(c=>c.type==='vanity_care'));
 s.characters.alina.hunger=35;assert.ok(!fullLeisureCandidates(s,'alina',0).some(c=>c.type==='vanity_care'));
 assert.equal(thoughtFor(s,'alina').need,'hunger');
 s.autonomy.alina='needs';assert.deepEqual(fullLeisureCandidates(s,'alina',0),[]);
});
test('062 personal topics are attributed to the actual character and keep shared travel available',()=>{
 const s=ready();s.clock.minute=780;
 for(const id of ['vladStudio','codeIdeas','fishingDream','techIdeas']){
  const a=SOCIAL_BY_ID.get('nearTalk:'+id)!;assert.ok(a);assert.ok(contextAvailable(a,s,'vlad'));assert.equal(contextAvailable(a,s,'alina'),false);
 }
 for(const id of ['alinaStudio','hairIdeas','bookIdeas','recipeIdeas']){
  const a=SOCIAL_BY_ID.get('nearTalk:'+id)!;assert.ok(a);assert.ok(contextAvailable(a,s,'alina'));assert.equal(contextAvailable(a,s,'vlad'),false);
 }
 for(const role of ['vlad','alina'] as const)assert.ok(contextAvailable(SOCIAL_BY_ID.get('nearTalk:travelDream')!,s,role));
 const before=structuredClone(s);familyAutoTopics(s,'vlad');familyAutoTopics(s,'alina');assert.deepEqual(s,before);
});

test('062 cooking and technology interests are personal and cooking has its own preference',()=>{
 assert.ok(PERSONALITIES.vlad.interests.some(x=>x.includes('Технологии')));
 assert.ok(PERSONALITIES.alina.interests.some(x=>x.includes('Кулинария')));
 assert.ok(personalPreference('alina','cooking')>personalPreference('vlad','cooking'));
});

import {collectionFor,collectionSummary,validCollections} from '../../src/shared/personalCollections';
import {applyFoodAction} from '../food';
import {lakeTogetherTrip,localActivity,applyWorld} from '../locations';
import {approachFor,stationById} from '../../src/shared/locations';
test('062 recipe collections count actual successful batches with best and last quality, independent of portions',()=>{
 let s=ready();s.pantry.eggs=4;s.pantry.milk=2;
 const a=applyFoodAction(s,'alina',{type:'cook',recipe:'omelette'},()=>.999);if(!a.ok)assert.fail(a.reason);
 const b=applyFoodAction(a.state,'alina',{type:'cook',recipe:'omelette'},()=>0);if(!b.ok)assert.fail(b.reason);
 const row=collectionFor(b.state,'alina').recipes.omelette!;
 assert.equal(row.count,2);assert.equal(row.perfect,1);assert.equal(row.best,'perfect');assert.equal(row.last,'bad');
 assert.equal(collectionSummary(b.state,'alina').recipes,1);
 assert.equal(collectionSummary(b.state,'vlad').batches,0);
 assert.equal(applyFoodAction(b.state,'alina',{type:'cook',recipe:'omelette'}).ok,false);
 assert.equal(collectionSummary(b.state,'alina').batches,2);
 assert.ok(validCollections(b.state.personalCollections));
 const dir=mkdtempSync(join(tmpdir(),'collection062-'));try{const f=openServerFiles(dir);f.save(b.state);assert.deepEqual(f.load().personalCollections,b.state.personalCollections);}finally{rmSync(dir,{recursive:true,force:true});}
});
test('062 fishing journal records a real catch once, release does not add another, no attribution to other player',()=>{
 let s=ready();s.money=10000;
 const trip=lakeTogetherTrip(s,'vlad','night');if(!trip.ok)assert.fail(trip.reason);s=trip.state;
 Object.assign(s.characters.vlad,approachFor(stationById('lake','lake-rental')!,'vlad'));
 const rent=applyWorld(s,'vlad',{type:'lake_rent',category:'rod',item:'float'});if(!rent.ok)assert.fail(rent.reason);s=rent.state;
 Object.assign(s.characters.vlad,approachFor(stationById('lake','lake-fish-1')!,'vlad'));
 const old=Math.random;try{Math.random=()=>.10;const r=localActivity(s,'vlad','lakeFishFloat','lake-fish-1');if(!r.ok)assert.fail(r.reason);s=r.state;}finally{Math.random=old;}
 assert.equal(collectionSummary(s,'vlad').catches,1);assert.equal(collectionSummary(s,'alina').catches,0);
 assert.ok(collectionSummary(s,'vlad').bestGrams>0);assert.ok(validCollections(s.personalCollections));
 assert.equal(localActivity(s,'vlad','lakeFishFloat','lake-fish-1').ok,false);
 const release=applyWorld(s,'vlad',{type:'lake_catch',keep:false});if(!release.ok)assert.fail(release.reason);
 assert.equal(collectionSummary(release.state,'vlad').catches,1);
 assert.deepEqual(collectionFor(initialState(),'vlad'),{recipes:{},fish:{}});
 assert.equal(validCollections({vlad:{recipes:{omelette:{count:1,perfect:2,best:'perfect',last:'good',at:0}},fish:{}}}),false);
});

test('062 legacy missing collection field normalizes once to the same shape as a new household without inventing progress',()=>{
 const dir=mkdtempSync(join(tmpdir(),'collection-migration-062-'));
 try{
  const fresh=initialState(),old=structuredClone(fresh);delete old.personalCollections;
  old.money=34567;fresh.money=34567;
  const f=openServerFiles(dir);f.save(old);
  const loaded=f.load();assert.deepEqual(loaded,fresh);
  assert.deepEqual(loaded.personalCollections,{});f.save(loaded);
  assert.deepEqual(openServerFiles(dir).load(),fresh);
  assert.notEqual(initialState().personalCollections,initialState().personalCollections);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
