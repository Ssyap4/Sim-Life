import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openServerFiles} from '../storage';
import {applyFamilyLife,creditCelebration,creditHobby,offerLifeEvent,validFamilyLife,occasionsAhead} from '../../src/shared/familyLife';
test('personal calendar dates validated and shared, celebration once on real day',()=>{
 let s=initialState();
 assert.equal(applyFamilyLife(s,'vlad',{type:'family_date',id:'anniversary',month:2,day:30}).ok,false);
 const r=applyFamilyLife(s,'vlad',{type:'family_date',id:'anniversary',month:3,day:1});assert.ok(r.ok);s=r.state;
 assert.ok(occasionsAhead(s).some(o=>o.id==='anniversary'&&o.inDays===0));
 assert.deepEqual(creditCelebration(s,'walk'),[]);
 assert.deepEqual(creditCelebration(s,'film'),['Годовщина отношений']);
 assert.deepEqual(creditCelebration(s,'film'),[]);assert.ok(validFamilyLife(s.familyLife));assert.equal(s.relationship.memories.length,1);
 s.clock.day++;const changed=applyFamilyLife(s,'vlad',{type:'family_date',id:'anniversary',month:3,day:12});assert.ok(changed.ok);assert.ok(!creditCelebration(changed.state,'film').includes('Годовщина отношений'));
});
test('hobby completion counts once daily, tracks variety and milestones',()=>{
 const s=initialState();
 assert.equal(creditHobby(s,'vlad',{type:'read_book',book:'master'}),'');
 creditHobby(s,'vlad',{type:'read_book',book:'orwell'});
 assert.equal(s.familyLife?.hobbies.vlad.reading?.sessions,1);
 assert.equal(s.familyLife?.hobbies.vlad.reading?.unique.length,2);
 s.clock.day++;creditHobby(s,'vlad',{type:'read_book',book:'master'});
 s.clock.day++;assert.match(creditHobby(s,'vlad',{type:'read_book',book:'master'}),/Любитель книг/);
 assert.equal(Boolean(s.familyLife?.hobbies.alina.reading),false);assert.ok(validFamilyLife(s.familyLife));
 creditHobby(s,'alina',{type:'furniture_use',action:'read_book',furnitureId:1,book:'master'});assert.equal(s.familyLife?.hobbies.alina.reading?.sessions,1);
 s.furnishing.placed.push({id:1,sku:'leisure-tennis',finish:'sage',x:10,z:8.6,rotation:0});creditHobby(s,'vlad',{type:'together',action:'leisureTogether',item:'1'});assert.equal(s.familyLife?.hobbies.vlad.sport?.sessions,1);
});
test('single shared event, no stale claim, no double claim and no offline backfill',()=>{
 const s=initialState();s.clock={day:3,minute:600};const at=2*1440+600;
 assert.equal(offerLifeEvent(s,at-1,[]),false);
 assert.equal(offerLifeEvent(s,at-1,['vlad','alina']),true);assert.equal(offerLifeEvent(s,at-1,['vlad']),false);
 const e=s.familyLife!.event!,cmd={type:'family_event',day:e.day,id:e.id,accept:true};
 const r=applyFamilyLife(s,'alina',cmd);assert.ok(r.ok);assert.equal(r.state.money,s.money+350);
 assert.equal(applyFamilyLife(r.state,'vlad',cmd).ok,false);assert.ok(validFamilyLife(r.state.familyLife));
 s.clock.day++;assert.equal(applyFamilyLife(s,'vlad',cmd).ok,false);
});

test('new journal persists and discounted flowers respect existing capacity',()=>{
 const dir=mkdtempSync(join(tmpdir(),'family-life-056-test-'));
 try{
  const s=initialState();s.clock={day:6,minute:600};offerLifeEvent(s,5*1440+599,['vlad']);assert.equal(s.familyLife?.event?.id,'flowers');
  s.gifts={giftFlowers:10};const command={type:'family_event',day:6,id:'flowers',accept:true};assert.equal(applyFamilyLife(s,'vlad',command).ok,false);
  s.gifts={giftFlowers:1};const r=applyFamilyLife(s,'vlad',command);assert.ok(r.ok);assert.equal(r.state.money,s.money-250);assert.equal(r.state.gifts?.giftFlowers,2);
  creditHobby(r.state,'vlad',{type:'cook',recipe:'omelette'});const files=openServerFiles(dir);files.save(r.state);assert.deepEqual(files.load().familyLife,r.state.familyLife);
 }finally{rmSync(dir,{recursive:true,force:true});}
});