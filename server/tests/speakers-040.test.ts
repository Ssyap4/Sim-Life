import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {SPEAKER_MODELS,SPEAKER_TRACKS,trackInfo,TRACK_MINUTES,type SpeakerSku} from '../../src/shared/speakerCatalog';
import {applySpeaker,advanceSpeakers,validSpeakers,speakerDevice} from '../../src/shared/speaker';
import {applyWorld} from '../locations';
import {applyFurnishing} from '../furnishing';
import {stationById,approachFor,placeObstacles,floorFor,spawn,STATIONS} from '../../src/shared/locations';
import {pointIsClear,findRoute} from '../../src/game/navigation';
import {buildSpeakerModel} from '../../src/game/SpeakerArt';
import {advanceLife} from '../life';
import {initialDust,advanceDust} from '../../src/shared/homeDust';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
const first={id:1,sku:'speaker-alice',finish:'ivory' as const,x:14,z:-6,rotation:0 as const};
function home(){const s=initialState();s.furnishing.placed=[first];s.furnishing.nextId=2;return s;}
test('three unique speakers can be purchased at cashier and placed through furniture inventory',()=>{
 for(const [sku,m] of Object.entries(SPEAKER_MODELS)){
  let s=initialState();s.money=100000;
  assert.equal(applyWorld(s,'vlad',{type:'speaker_buy',sku}).ok,false);
  s.world.places.vlad='electronics';Object.assign(s.characters.vlad,approachFor(stationById('electronics','tech-cash')!,'vlad'));
  const bought=applyWorld(s,'vlad',{type:'speaker_buy',sku});assert.ok(bought.ok);s=bought.state;
  assert.equal(s.money,100000-m.price);assert.equal(s.furnishing.stored[0].sku,sku);
  s.world.places.vlad='home';
  const placed=applyFurnishing(s,'vlad',{type:'furniture_place',id:s.furnishing.stored[0].id,x:14,z:-6,rotation:0},0);
  assert.ok(placed.ok);
 }
 for(const role of ['vlad','alina'] as const)for(const st of STATIONS.electronics){const p=approachFor(st,role);assert.ok(pointIsClear(p,placeObstacles('electronics'),floorFor('electronics')),st.id);assert.ok(findRoute(spawn('electronics',role),p,placeObstacles('electronics'),floorFor('electronics')),st.id);}
});
test('genre playback advances by household clock, next, shuffle, stop and individual volume',()=>{
 const s=home();s.clock.minute=100;
 assert.equal(applySpeaker(s,'vlad',{type:'speaker_control',id:1,action:'play',genre:'house'}),undefined);
 const first=speakerDevice(s,1).track!;assert.equal(trackInfo(first).genre,'house');
 s.clock.minute+=TRACK_MINUTES;advanceSpeakers(s);
 assert.notEqual(speakerDevice(s,1).track,first);assert.equal(trackInfo(speakerDevice(s,1).track!).genre,'house');
 assert.equal(applySpeaker(s,'alina',{type:'speaker_control',id:1,action:'volume',volume:35}),undefined);
 assert.equal(speakerDevice(s,1).volume,35);
 applySpeaker(s,'alina',{type:'speaker_control',id:1,action:'random'});assert.ok(speakerDevice(s,1).shuffle);
 applySpeaker(s,'vlad',{type:'speaker_control',id:1,action:'stop'});assert.equal(speakerDevice(s,1).track,undefined);
 assert.ok(validSpeakers(s.speakers));
 assert.ok(applySpeaker(s,'vlad',{type:'speaker_control',id:1,action:'volume',volume:110}));
 assert.ok(applySpeaker(s,'vlad',{type:'speaker_control',id:999,action:'stop'}));
});
test('assistant uses actual game weather and time, triggers installed vacuum and a one-time next-day alarm',()=>{
 const s=home();s.clock.minute=1430;
 applySpeaker(s,'vlad',{type:'speaker_control',id:1,action:'weather'});assert.ok(speakerDevice(s,1).reply!.text.includes('градусов'));
 applySpeaker(s,'alina',{type:'speaker_control',id:1,action:'time'});assert.ok(speakerDevice(s,1).reply!.text.includes('23:50'));
 applySpeaker(s,'vlad',{type:'speaker_control',id:1,action:'vacuum'});assert.ok(speakerDevice(s,1).reply!.text.includes('пылесос'));
 s.furnishing.placed.push({id:2,sku:'vacuum-dreame',finish:'ivory',x:13,z:-6,rotation:0});s.furnishing.nextId=3;s.homeDust=advanceDust(initialDust(),4320);
 applySpeaker(s,'vlad',{type:'speaker_control',id:1,action:'vacuum'});assert.equal(s.vacuum?.mode,'cleaning');
 applySpeaker(s,'vlad',{type:'speaker_control',id:1,action:'alarm',minute:10});
 const after=advanceLife(s,20,['vlad','alina']);assert.equal(speakerDevice(after,1).alarmAt,undefined);assert.equal(speakerDevice(after,1).reply?.to,'all');
 const seq=speakerDevice(after,1).reply!.seq;advanceSpeakers(after);assert.equal(speakerDevice(after,1).reply!.seq,seq);
});
test('all sixteen original audio files contain 32 seconds of non-silent PCM, three models fit their footprints',()=>{
 assert.equal(SPEAKER_TRACKS.length,16);for(const track of SPEAKER_TRACKS){
 const b=readFileSync('public/audio/speakers/'+track.id+'.wav');assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.readUInt32LE(24),16000);assert.equal(b.readUInt32LE(40),32*16000*2);
 assert.ok(b.subarray(44).some(x=>x!==0),track.id);
 }
 for(const [sku,m] of Object.entries(SPEAKER_MODELS)){
 const obj=buildSpeakerModel(sku as SpeakerSku),b=new THREE.Box3().setFromObject(obj),size=b.getSize(new THREE.Vector3());
 assert.ok(size.x<=m.width+.015&&size.z<=m.depth+.015&&size.y<=m.height+.015,sku+': '+size.toArray());
 }
});

import WebSocket from 'ws';
import {once} from 'node:events';
import {startServer} from '../server';
import {openServerFiles} from '../storage';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {CharacterId,ServerPacket} from '../../src/shared/protocol';
function packet(ws:WebSocket,check:(p:ServerPacket)=>boolean):Promise<ServerPacket>{
 return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{ws.off('message',on);reject(Error('packet timeout'));},6000);
 function on(raw:WebSocket.RawData){const p=JSON.parse(raw.toString()) as ServerPacket;if(check(p)){clearTimeout(timer);ws.off('message',on);resolve(p);}}ws.on('message',on);});
}
test('live two-player server shares music, volume, and reply; storing removes speaker state',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'speaker-live-')),files=openServerFiles(dir),s=home();s.autonomy={vlad:'off',alina:'off'};files.save(s);
 const server=await startServer({port:0,dataDir:dir,lifeClock:{now:()=>0,tickMs:600000}});const sockets:WebSocket[]=[];
 try{
  async function connect(role:CharacterId){const ws=new WebSocket('ws://127.0.0.1:'+server.port+'/sync');sockets.push(ws);await once(ws,'open');const ready=packet(ws,p=>p.type==='ready');ws.send(JSON.stringify({type:'auth',role,code:files.access[role]}));await ready;return ws;}
  const v=await connect('vlad'),a=await connect('alina');
  const music=packet(a,p=>p.type==='snapshot'&&p.state.speakers?.[1]?.track==='speaker-track-lofi-0');v.send(JSON.stringify({type:'speaker_control',id:1,action:'play',genre:'lofi'}));await music;
  const volume=packet(v,p=>p.type==='snapshot'&&p.state.speakers?.[1]?.volume===35);a.send(JSON.stringify({type:'speaker_control',id:1,action:'volume',volume:35}));await volume;
  assert.equal(files.load().speakers?.[1]?.volume,35);
  const gone=packet(v,p=>p.type==='snapshot'&&!p.state.furnishing.placed.some(x=>x.id===1)&&!p.state.speakers?.[1]);a.send(JSON.stringify({type:'furniture_store',id:1}));await gone;
 }finally{sockets.forEach(w=>w.terminate());await server.close();rmSync(dir,{recursive:true,force:true});}
});
