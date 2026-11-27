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
