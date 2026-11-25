import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {venueTogetherTrip,applyWorld,validWorld} from '../locations';
import {STATIONS,doorwayArrival,approachFor,placeObstacles,floorFor} from '../../src/shared/locations';
import {findRoute} from '../../src/game/navigation';
import {VENUE_GAMES,venueWinner,type VenueGame} from '../../src/shared/venue';
import {cooperationDenial,pairScenes,completeTogether} from '../society';
import {createLocation} from '../../src/game/LocationScene';
const roles=['vlad','alina'] as const;
test('PLAY ARENA is separate, accessible by paired car trip, all approaches are clear',()=>{
 const s=initialState();assert.equal(applyWorld(s,'vlad',{type:'travel',place:'venue'}).ok,false);
 const trip=venueTogetherTrip(s,'vlad');assert.ok(trip.ok);assert.ok(validWorld(trip.state.world));
 assert.equal(trip.state.money,s.money);
 for(const role of roles)for(const station of STATIONS.venue)assert.ok(findRoute(doorwayArrival('venue','district',role),approachFor(station,role),placeObstacles('venue'),floorFor('venue')),role+' '+station.id);
 const scene=createLocation('venue');try{assert.equal(scene.stations.size,STATIONS.venue.length);scene.animate?.(1);}finally{scene.dispose();}
});
test('all six venue games have real paired routes, shared outcome, one charge and memories',()=>{
 for(const id of Object.keys(VENUE_GAMES) as VenueGame[]){
  const s=initialState();const command={type:'together' as const,action:id};assert.ok(cooperationDenial(s,'vlad',command));
  const trip=venueTogetherTrip(s,'vlad');assert.ok(trip.ok);const state=trip.state;
  state.characters.vlad.fun=state.characters.alina.fun=10;
  assert.equal(cooperationDenial(state,'vlad',command),undefined);
  const homes=pairScenes(state,'vlad',command);assert.ok(homes,id);assert.deepEqual(homes.vlad.consoleMatch,homes.alina.consoleMatch);
  assert.notDeepEqual(homes.vlad.route.path.at(-1),homes.alina.route.path.at(-1));
  assert.equal(homes.vlad.furnitureSeat,VENUE_GAMES[id].seated);assert.equal(homes.vlad.consoleGame,id==='venueUfc'?'ufc6':undefined);
  const result=completeTogether(state,'vlad',command,[...roles],0,homes);assert.ok(result.ok,id);
  assert.equal(result.state.money,state.money-VENUE_GAMES[id].price);assert.equal(result.state.ledger.length,state.ledger.length+1);
  assert.ok(result.state.relationship.memories.some(m=>m.action===id));assert.ok(result.state.characters.vlad.fun>10);assert.ok(result.state.characters.alina.fun>10);
  assert.match(result.message,venueWinner(homes.vlad.consoleMatch!)==='vlad'?/Влад победил/:/Алина победила/);
  assert.equal(completeTogether(state,'vlad',command,['vlad'],0,homes).ok,false);
  state.money=0;assert.equal(completeTogether(state,'vlad',command,[...roles],0,homes).ok,false);
 }
});
test('both can return from PLAY ARENA, regardless of who exits first',()=>{
 const trip=venueTogetherTrip(initialState(),'vlad');assert.ok(trip.ok);let s=trip.state;
 for(const role of roles){const route=applyWorld(s,role,{type:'approach',place:'venue',station:'venue-exit'},true);assert.ok(route.ok);const back=applyWorld(route.state,role,{type:'travel',place:'district',via:'venue-exit'},true);assert.ok(back.ok);s=back.state;assert.ok(validWorld(s.world));}
 assert.equal(s.world.carDriver,undefined);
});
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import WebSocket from 'ws';
import {startServer} from '../server';
import {openServerFiles} from '../storage';
import type {ServerPacket} from '../../src/shared/protocol';
test('real two-player visit and UFC 6 consent, no household console purchase, no duplicate charge',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'venue-pair-')),files=openServerFiles(dir),s=initialState();s.autonomy={vlad:'off',alina:'off'};files.save(s);
 const server=await startServer({port:0,dataDir:dir,taskTimeScale:.02,autonomyTiming:{idleMs:99999999,careCooldownMs:99999999,leisureCooldownMs:99999999}});const sockets:WebSocket[]=[];
 async function connect(role:'vlad'|'alina'){
  const ws=new WebSocket('ws://127.0.0.1:'+server.port+'/sync');sockets.push(ws);const inbox:ServerPacket[]=[];ws.on('message',m=>inbox.push(JSON.parse(m.toString())));
  const send=(o:object)=>ws.send(JSON.stringify(o));
  async function take<K extends ServerPacket['type']>(kind:K,where:(e:Extract<ServerPacket,{type:K}>)=>boolean=()=>true){
   const end=Date.now()+10000;while(Date.now()<end){const i=inbox.findIndex(e=>e.type===kind&&where(e as Extract<ServerPacket,{type:K}>));if(i>=0)return inbox.splice(i,1)[0] as Extract<ServerPacket,{type:K}>;await new Promise(r=>setTimeout(r,10));}throw Error('Missing '+kind+'; '+JSON.stringify(inbox.filter(e=>e.type==='error'||e.type==='social_closed')));
  }
  await once(ws,'open');send({type:'auth',role,code:files.access[role]});await take('ready');return {send,take};
 }
 try{
  const v=await connect('vlad'),a=await connect('alina');v.send({type:'venue_trip'});await a.take('world_event',p=>p.role==='alina'&&p.message.includes('PLAY ARENA'));assert.equal(files.load().world.places.vlad,'home');
  a.send({type:'venue_trip'});await v.take('snapshot',p=>p.state.world.places.vlad==='venue'&&p.state.world.places.alina==='venue');
  v.send({type:'social_propose',action:'venueUfc'});const pending=await a.take('social_pending');assert.equal(files.load().money,10000);
  a.send({type:'social_reply',inviteId:pending.offer.id,choice:0});const x=await v.take('task_started',p=>p.role==='vlad'),y=await a.take('task_started',p=>p.role==='alina');assert.equal(x.home?.consoleGame,'ufc6');assert.deepEqual(x.home?.consoleMatch,y.home?.consoleMatch);
  await v.take('task_ended',p=>p.taskId===x.taskId&&p.outcome==='completed');await a.take('task_ended',p=>p.taskId===y.taskId&&p.outcome==='completed');
  assert.equal(files.load().money,9000);assert.deepEqual(files.load().consoleLibrary,s.consoleLibrary);
 }finally{sockets.forEach(ws=>ws.terminate());await server.close();rmSync(dir,{recursive:true,force:true});}
});
