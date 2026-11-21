import assert from 'node:assert/strict';
import {test} from 'node:test';
import {once} from 'node:events';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import WebSocket from 'ws';
import {COMPUTER_GAMES,GAME_GENRES,VIDEO_CLIPS,GAME_BY_ID,gamePreference,initialComputerLibrary} from '../../src/shared/computerGames';
import {initialState,type CharacterId,type GameState,type ServerPacket} from '../../src/shared/protocol';
import {computerResource} from '../../src/shared/computer';
import {completeComputerGame,completeComputerVideo,changeComputerFavorite} from '../computers';
import {planTask} from '../tasks';
import {openServerFiles} from '../storage';
import {startServer} from '../server';

test('Twelve authored games occupy four genres, three each, with different timings and effects',()=>{
 assert.equal(COMPUTER_GAMES.length,12);
 assert.equal(new Set(COMPUTER_GAMES.map(game=>game.id)).size,12);
 for(const genre of Object.keys(GAME_GENRES))assert.equal(COMPUTER_GAMES.filter(game=>game.genre===genre).length,3,genre);
 assert.ok(COMPUTER_GAMES.every(g=>g.duration>=30 && g.duration<=75 && g.fun>0 && g.energy<0));
 assert.ok(new Set(COMPUTER_GAMES.map(g=>g.duration)).size>=10);
 assert.ok(new Set(COMPUTER_GAMES.map(g=>g.fun)).size>=8);
 assert.ok(COMPUTER_GAMES.filter(g=>g.genre==='strategy').every(g=>g.skill===1));
 assert.equal(gamePreference('vlad','strategy'),3);
 assert.equal(gamePreference('alina','sim'),3);
 assert.equal(gamePreference('vlad','horror'),0);
 assert.equal(Object.keys(VIDEO_CLIPS).length,3);
});

test('Games and videos use independent device resources; forged commands are rejected',()=>{
 for(const device of ['laptop','desktop'] as const){
   for(const game of COMPUTER_GAMES){
     const plan=planTask({type:'play_game',game:game.id,device});
     assert.equal(plan?.resource,computerResource(device));
     assert.equal(plan?.durationMs,game.duration*1000);
     assert.deepEqual(plan?.command,{type:'play_game',game:game.id,device});
   }
   for(const clip of Object.keys(VIDEO_CLIPS)){
     const plan=planTask({type:'computer_video',clip,device});
     assert.equal(plan?.resource,computerResource(device));
   }
 }
 assert.equal(planTask({type:'play_game',game:'forged',device:'desktop'}),null);
 assert.equal(planTask({type:'play_game',game:'neon-drift',device:'phone'}),null);
 assert.equal(planTask({type:'computer_video',clip:'forged',device:'laptop'}),null);
 assert.deepEqual(initialComputerLibrary().vlad,initialComputerLibrary().alina);
});

test('Completed games affect only their owner, update recent history once, and preserve prior favorites',()=>{
 const original=initialState();
 original.computerLibrary.vlad.favorites.push('green-valley');
 original.characters.vlad.fun=40;
 original.characters.alina.fun=40;
 let state:GameState=original;
 const first=COMPLETE(state,'vlad','orbital-frontier','laptop');
 assert.equal(first.computerLibrary.vlad.last,'orbital-frontier');
 assert.deepEqual(first.computerLibrary.vlad.recent,['orbital-frontier']);
 assert.deepEqual(first.computerLibrary.vlad.favorites,['green-valley']);
 assert.equal(first.computerLibrary.vlad.sessions,1);
 assert.equal(first.characters.vlad.fun,40+GAME_BY_ID.get('orbital-frontier')!.fun+3);
 assert.equal(first.characters.vlad.skill,1);
 assert.equal(first.characters.alina.fun,40);
 assert.deepEqual(original.computerLibrary.vlad.recent,[]);
 state=first;
 for(const game of COMPUTER_GAMES.slice(0,8))state=COMPLETE(state,'vlad',game.id,'desktop');
 assert.equal(state.computerLibrary.vlad.recent.length,5);
 assert.equal(new Set(state.computerLibrary.vlad.recent).size,5);
 assert.equal(state.computerLibrary.vlad.sessions,9);
 assert.equal(state.computerLibrary.alina.sessions,0);
 assert.equal(completeComputerGame(state,'vlad','forged','desktop').ok,false);
 assert.equal(completeComputerGame(state,'vlad','green-valley','tablet').ok,false);
});
function COMPLETE(s:GameState,r:CharacterId,id:string,d:'laptop'|'desktop'){
 const result=completeComputerGame(s,r,id,d);
 assert.equal(result.ok,true);
 if(!result.ok)throw Error('Computer action failed');
 return result.state;
}
test('Favorite toggles are idempotent, role-private, validated, and persist without touching economy',()=>{
 const original=initialState();
 const added=changeComputerFavorite(original,'alina','paw-house',true);
 assert.equal(added.ok,true);
 if(!added.ok)throw Error('Favorite failed');
 assert.deepEqual(added.state.computerLibrary.alina.favorites,['paw-house']);
 assert.equal(added.state.computerLibrary.vlad.favorites.length,0);
 assert.equal(added.state.money,original.money);
 assert.equal(original.computerLibrary.alina.favorites.length,0);
 const same=changeComputerFavorite(added.state,'alina','paw-house',true);
 assert.equal(same.ok,true);
 if(same.ok)assert.strictEqual(same.state,added.state);
 assert.equal(changeComputerFavorite(original,'alina','forged',true).ok,false);
 assert.equal(changeComputerFavorite(original,'alina','paw-house','yes').ok,false);
});

test('Video viewing needs internet and rewards only at completion',()=>{
 const state=initialState();
 const result=completeComputerVideo(state,'alina','pets','laptop');
 assert.equal(result.ok,true);
 if(!result.ok)throw Error('Computer action failed');
 assert.equal(result.state.characters.alina.fun,Math.min(100,state.characters.alina.fun+VIDEO_CLIPS.pets.fun));
 assert.equal(result.state.computerLibrary.alina.sessions,0);
 assert.equal(state.characters.alina.fun,INITIAL_FUN(state,'alina'));
 assert.equal(completeComputerVideo(state,'alina','broken','desktop').ok,false);
});
const INITIAL_FUN=(state:GameState,role:CharacterId)=>state.characters[role].fun;

test('Legacy saves gain independent empty libraries without losing household or career progress',()=>{
 const dir=mkdtempSync(join(tmpdir(),'sim-life-computers-'));
 try{
   const files=openServerFiles(dir);
   const original=initialState();
   original.money=23345;
   original.characters.alina.skill=17;
   const legacy=structuredClone(original) as Partial<GameState>;
   delete legacy.computerLibrary;
   writeFileSync(join(dir,'household.json'),JSON.stringify(legacy));
   const restored=files.load();
   assert.equal(restored.money,23345);
   assert.equal(restored.characters.alina.skill,17);
   assert.deepEqual(restored.computerLibrary,initialComputerLibrary());
   assert.deepEqual(files.load().computerLibrary,initialComputerLibrary());
   assert.equal(JSON.parse(readFileSync(join(dir,'household.json'),'utf8')).money,23345);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

async function launch(){
 const dir=mkdtempSync(join(tmpdir(),'sim-life-games-live-'));
 const server=await startServer({port:0,dataDir:dir,taskTimeScale:.025});
 const access=JSON.parse(readFileSync(join(dir,'access.json'),'utf8')) as Record<CharacterId,string>;
 const connect=async(role:CharacterId)=>{
   const ws=new WebSocket('ws://127.0.0.1:'+server.port+'/sync');
   await once(ws,'open');
   ws.send(JSON.stringify({type:'auth',role,code:access[role]}));
   await watch(ws,p=>p.type==='ready');
   return ws;
 };
 const vlad=await connect('vlad'),alina=await connect('alina');
 return {dir,server,vlad,alina};
}
function watch(ws:WebSocket,ok:(p:ServerPacket)=>boolean):Promise<ServerPacket>{
 return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{ws.off('message',receive);reject(Error('Timed out waiting for game packet'));},7500);
   function receive(raw:WebSocket.RawData){
     const p=JSON.parse(raw.toString()) as ServerPacket;
     if(ok(p)){clearTimeout(timer);ws.off('message',receive);resolve(p);}
   }
   ws.on('message',receive);
 });
}
const send=(ws:WebSocket,message:object)=>ws.send(JSON.stringify(message));
test('Two live players keep game sessions, cancellation and favorite snapshots server-authoritative',async()=>{
 const ctx=await launch();
 try{
   const added=watch(ctx.alina,p=>p.type==='snapshot'&&p.state.computerLibrary.alina.favorites.includes('paw-house'));
   send(ctx.alina,{type:'computer_favorite',game:'paw-house',enabled:true});
   await added;
   const started=watch(ctx.vlad,p=>p.type==='task_started'&&p.role==='vlad'&&p.command.type==='play_game');
   send(ctx.vlad,{type:'play_game',game:'neon-drift',device:'desktop'});
   const start=await started;
   assert.equal(start.type,'task_started');
   if(start.type!=='task_started')return;
   const cancelled=watch(ctx.alina,p=>p.type==='task_ended'&&p.role==='vlad'&&p.taskId===start.taskId);
   send(ctx.vlad,{type:'cancel_task',taskId:start.taskId});
   const ended=await cancelled;
   assert.equal(ended.type,'task_ended');
   if(ended.type==='task_ended')assert.equal(ended.outcome,'cancelled');
   const va=watch(ctx.vlad,p=>p.type==='task_started'&&p.role==='vlad'&&p.command.type==='play_game');
   const aa=watch(ctx.alina,p=>p.type==='task_started'&&p.role==='alina'&&p.command.type==='play_game');
   const doneV=watch(ctx.vlad,p=>p.type==='task_ended'&&p.role==='vlad'&&p.outcome==='completed');
   const doneA=watch(ctx.alina,p=>p.type==='task_ended'&&p.role==='alina'&&p.outcome==='completed');
   send(ctx.vlad,{type:'play_game',game:'orbital-frontier',device:'desktop'});
   send(ctx.alina,{type:'play_game',game:'paw-house',device:'laptop'});
   await Promise.all([va,aa,doneV,doneA]);
   const saved=JSON.parse(readFileSync(join(ctx.dir,'household.json'),'utf8')) as GameState;
   assert.equal(saved.computerLibrary.vlad.sessions,1);
   assert.equal(saved.computerLibrary.alina.sessions,1);
   assert.deepEqual(saved.computerLibrary.vlad.recent,['orbital-frontier']);
   assert.deepEqual(saved.computerLibrary.alina.favorites,['paw-house']);
   assert.equal(saved.computerLibrary.alina.last,'paw-house');
 }finally{
   ctx.vlad.terminate();ctx.alina.terminate();await ctx.server.close();rmSync(ctx.dir,{recursive:true,force:true});
 }
});
