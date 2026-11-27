import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {MEDIA_CATALOG,validSelection,nextEpisode} from '../../src/shared/mediaCatalog';
import {markMedia,recordViewing,libraryFor,continueSeries,validLibrary,bookmarkFor,saveBookmark} from '../../src/shared/mediaLibrary';
import {planTask,evaluateTask} from '../tasks';
import {applyServiceCommand} from '../services';
import {openServerFiles} from '../storage';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('catalog unique, movie and episode selections validated with genre',()=>{
 assert.equal(MEDIA_CATALOG.filter(t=>!t.seasons).length,45);assert.equal(MEDIA_CATALOG.filter(t=>t.year===2026).length,20);assert.ok(MEDIA_CATALOG.filter(t=>!t.seasons).every(t=>Number.isInteger(t.runtimeMinutes)&&t.runtimeMinutes!>0));assert.equal(MEDIA_CATALOG.length,59);assert.equal(new Set(MEDIA_CATALOG.map(t=>t.id)).size,59);
 assert.ok(validSelection({id:'odyssey'},'action'));assert.ok(!validSelection({id:'odyssey',episode:1}));
 assert.ok(!validSelection({id:'__proto__'}));assert.ok(!validSelection({id:'knight',season:1,episode:7}));
 assert.deepEqual(nextEpisode({id:'dark',season:1,episode:10}),{id:'dark',season:2,episode:1});
 assert.equal(nextEpisode({id:'knight',season:1,episode:6}),undefined);
 assert.equal(planTask({type:'movie',genre:'comedy',selection:{id:'odyssey'}}),null);
 assert.ok(planTask({type:'movie',genre:'action',selection:{id:'odyssey'}})?.label.includes('Одиссея'));
});
test('private lists and shared list, no economy or need changes',()=>{
 const s=initialState(),r=markMedia(s,'vlad',{type:'media_mark',list:'favorites',id:'dark',enabled:true});
 assert.ok(r.ok);assert.deepEqual(libraryFor(r.state).favorites,{vlad:['dark'],alina:[]});
 assert.equal(r.state.money,s.money);assert.deepEqual(r.state.characters,s.characters);
 const q=markMedia(r.state,'alina',{type:'media_mark',list:'together',id:'odyssey',enabled:true});assert.ok(q.ok);
 assert.deepEqual(libraryFor(q.state).together,['odyssey']);assert.ok(validLibrary(q.state.mediaLibrary));
 assert.equal(markMedia(q.state,'vlad',{list:'__proto__',id:'dark',enabled:true}).ok,false);
 assert.equal(markMedia(q.state,'vlad',{list:'favorites',id:'fake',enabled:true}).ok,false);
});
test('only completed viewing advances history; both roles and series progress persist',()=>{
 let s=initialState();const paid=applyServiceCommand(s,'vlad',{type:'service_connect',service:'netflix'});assert.ok(paid.ok);s=paid.state;
 const selection={id:'dark',season:1,episode:10},plan=planTask({type:'movie',genre:'thriller',selection})!;
 assert.equal(libraryFor(s).history.vlad.length,0);
 const v=evaluateTask(s,'vlad',plan.command,true);assert.ok(v.ok);
 assert.deepEqual(continueSeries(v.state,'vlad','dark'),{id:'dark',season:2,episode:1});
 const a=evaluateTask(v.state,'alina',plan.command,true);assert.ok(a.ok);
 assert.equal(libraryFor(a.state).history.alina[0].together,true);
 const dir=mkdtempSync(join(tmpdir(),'media068-'));try{const files=openServerFiles(dir);files.save(a.state);assert.deepEqual(libraryFor(files.load()),libraryFor(a.state));}finally{rmSync(dir,{recursive:true,force:true});}
});
test('history bounded and final movie removes watch-later entry',()=>{
 let s=initialState();const r=markMedia(s,'alina',{type:'media_mark',list:'watchLater',id:'odyssey',enabled:true});assert.ok(r.ok);s=r.state;
 for(let i=0;i<125;i++)recordViewing(s,'alina',{id:'odyssey'},false);
 assert.equal(libraryFor(s).history.alina.length,120);assert.deepEqual(libraryFor(s).watchLater.alina,[]);assert.ok(validLibrary(s.mediaLibrary));
});

test('bookmarks survive disk, cannot regress or award rewards, are scoped to character and exact episode',()=>{
 const s=initialState(),selection={id:'dark',season:1,episode:2};saveBookmark(s,'vlad',selection,45.9);saveBookmark(s,'vlad',selection,22);
 assert.equal(bookmarkFor(s,'vlad',selection),45);assert.equal(bookmarkFor(s,'alina',selection),0);assert.equal(bookmarkFor(s,'vlad',{...selection,episode:1}),0);assert.equal(libraryFor(s).history.vlad.length,0);
 const dir=mkdtempSync(join(tmpdir(),'media068-bookmark-'));try{const files=openServerFiles(dir);files.save(s);assert.equal(bookmarkFor(files.load(),'vlad',selection),45);recordViewing(s,'vlad',selection,false);assert.equal(bookmarkFor(s,'vlad',selection),0);}finally{rmSync(dir,{recursive:true,force:true});}
 const bad=structuredClone(libraryFor(s));bad.unfinished={vlad:[null as never],alina:[]};assert.equal(validLibrary(bad),false);
 const legacy=structuredClone(libraryFor(s));delete legacy.unfinished;assert.ok(validLibrary(legacy));
});
