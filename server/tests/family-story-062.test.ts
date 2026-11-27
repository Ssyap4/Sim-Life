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
