import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {applyWorld,localActivity,spaTogetherTrip,validWorld} from '../locations';
import {approachFor,stationById,STATIONS,doorwayArrival,floorFor,placeObstacles} from '../../src/shared/locations';
import {findRoute} from '../../src/game/navigation';
import {SPA_ACTIVITIES,SPA_PASSES,SPA_MASSAGE_PRICE,validSpa,spaProgress,spaSwimFrame} from '../../src/shared/spa';
import {planTask} from '../tasks';
const roles=['vlad','alina'] as const;
test('SPA single ticket, route, one-time effects and paid massage',()=>{
 let s=initialState();Object.assign(s.characters.vlad,approachFor(stationById('home','family-car')!,'vlad'));
 assert.equal(applyWorld(s,'vlad',{type:'travel',place:'spa'}).ok,false);
 const trip=applyWorld(s,'vlad',{type:'car_travel',place:'spa'});assert.ok(trip.ok);s=trip.state;
 assert.equal(s.money,10000-SPA_PASSES.single.price);assert.ok(validWorld(s.world));
 for(const [id,a] of [['spa-pool','spaPool'],['spa-jacuzzi','spaJacuzzi'],['spa-sauna','spaSauna'],['spa-lounge-v','spaLounge'],['spa-massage-v','spaMassage']] as const){
  assert.equal(planTask({type:'local_activity',station:id,action:a})?.durationMs,SPA_ACTIVITIES[a].seconds*1000);
  const route=applyWorld(s,'vlad',{type:'approach',place:'spa',station:id});assert.ok(route.ok,id);s=route.state;
  const r=localActivity(s,'vlad',a,id);assert.ok(r.ok,id);s=r.state;assert.equal(localActivity(s,'vlad',a,id).ok,false);
 }
 assert.equal(s.money,10000-SPA_PASSES.single.price-SPA_MASSAGE_PRICE);
 const exit=applyWorld(s,'vlad',{type:'approach',place:'spa',station:'spa-exit'});assert.ok(exit.ok);
 const home=applyWorld(exit.state,'vlad',{type:'travel',place:'district',via:'spa-exit'});assert.ok(home.ok);assert.equal(home.state.world.spa?.vlad,undefined);assert.ok(validWorld(home.state.world));
});
test('package is charged once; both guests get included massage and can return separately',()=>{
 let s=initialState();s.money=1000;assert.equal(spaTogetherTrip(s,'vlad','package').ok,false);
 s.money=10000;const trip=spaTogetherTrip(s,'vlad','package');assert.ok(trip.ok);s=trip.state;
 assert.equal(s.money,5100);assert.ok(validWorld(s.world));assert.equal(spaTogetherTrip(s,'alina','package').ok,false);
 for(const r of roles){const id='spa-massage-'+r[0];const a=applyWorld(s,r,{type:'approach',place:'spa',station:id},true);assert.ok(a.ok,r);const done=localActivity(a.state,r,'spaMassage',id);assert.ok(done.ok);s=done.state;assert.equal(s.money,5100);}
 for(const r of roles){const a=applyWorld(s,r,{type:'approach',place:'spa',station:'spa-exit'},true);assert.ok(a.ok);const b=applyWorld(a.state,r,{type:'travel',place:'district',via:'spa-exit'},true);assert.ok(b.ok);s=b.state;assert.ok(validWorld(s.world));}
 assert.equal(s.world.carDriver,undefined);assert.equal(s.world.places.alina,'home');
});
test('SPA access validates persisted visits and action identifiers',()=>{
 assert.equal(validSpa({vlad:{pass:'package',used:['spaPool','spaPool']}}),false);
 assert.equal(validSpa({vlad:{pass:'free',used:[]}}),false);
 const s=initialState();s.world.places.vlad='spa';assert.equal(validWorld(s.world),false);
 assert.equal(planTask({type:'local_activity',station:'spa-pool',action:'spaMassage'}),null);
});
test('all SPA stations are reachable from entrance for both guests',()=>{
 for(const r of roles)for(const station of STATIONS.spa){const route=findRoute(doorwayArrival('spa','district',r),approachFor(station,r),placeObstacles('spa'),floorFor('spa'));assert.ok(route,r+' '+station.id);}
});

import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import WebSocket from 'ws';
import {startServer} from '../server';
import {openServerFiles} from '../storage';
import type {ServerPacket} from '../../src/shared/protocol';
import {createLocation} from '../../src/game/LocationScene';
test('SPA scene constructs and disposes with all stations',()=>{
 const scene=createLocation('spa');try{assert.equal(scene.stations.size,STATIONS.spa.length);scene.animate?.(2);}finally{scene.dispose();}
});
test('SPA paired package requires matching consent over real WebSockets and is charged only once',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'spa-pair-')),files=openServerFiles(dir),s=initialState();
 s.autonomy={vlad:'off',alina:'off'};for(const r of roles)Object.assign(s.characters[r],{comfort:20,mood:20,energy:40,fun:20});files.save(s);
 const server=await startServer({port:0,dataDir:dir,taskTimeScale:.025,autonomyTiming:{idleMs:99999999,careCooldownMs:99999999,leisureCooldownMs:99999999}});
 const sockets:WebSocket[]=[];
 async function connect(role:'vlad'|'alina'){
  const ws=new WebSocket('ws://127.0.0.1:'+server.port+'/sync');sockets.push(ws);
  const inbox:ServerPacket[]=[];ws.on('message',m=>inbox.push(JSON.parse(m.toString())));
  const send=(o:object)=>ws.send(JSON.stringify(o));
  async function take<K extends ServerPacket['type']>(kind:K,where:(e:Extract<ServerPacket,{type:K}>)=>boolean=()=>true){
   const end=Date.now()+8000;
   while(Date.now()<end){const i=inbox.findIndex(e=>e.type===kind&&where(e as Extract<ServerPacket,{type:K}>));if(i>=0)return inbox.splice(i,1)[0] as Extract<ServerPacket,{type:K}>;await new Promise(r=>setTimeout(r,10));}
   throw Error('Missing '+kind+'; '+JSON.stringify(inbox.filter(e=>e.type==='error')));
  }
  await once(ws,'open');send({type:'auth',role,code:files.access[role]});await take('ready');return {send,take};
 }
 try{
  const v=await connect('vlad'),a=await connect('alina');
  v.send({type:'spa_trip',pass:'package'});await a.take('world_event',p=>p.role==='alina'&&p.message.includes('4900'));
  assert.equal(files.load().money,10000);assert.equal(files.load().world.places.vlad,'home');
  a.send({type:'spa_trip',pass:'pair'});await v.take('world_event',p=>p.role==='vlad'&&p.message.includes('3200'));
  assert.equal(files.load().money,10000);
  v.send({type:'spa_trip',pass:'package'});await a.take('world_event',p=>p.role==='alina'&&p.message.includes('4900'));
  a.send({type:'spa_trip',pass:'package'});const arrived=await v.take('snapshot',p=>p.state.world.places.vlad==='spa'&&p.state.world.places.alina==='spa');
  assert.equal(arrived.state.money,5100);
  v.send({type:'local_activity',action:'spaMassage',station:'spa-massage-v'});
  a.send({type:'local_activity',action:'spaMassage',station:'spa-massage-a'});
  const x=await v.take('task_started',p=>p.role==='vlad'),y=await a.take('task_started',p=>p.role==='alina');
  const partial=await v.take('snapshot',p=>!!p.state.world.spa?.vlad?.progress?.spaMassage);assert.ok(partial.state.characters.vlad.comfort>20&&partial.state.characters.vlad.comfort<65);assert.equal(partial.state.money,5100);
  await v.take('task_ended',p=>p.taskId===x.taskId&&p.outcome==='completed');await a.take('task_ended',p=>p.taskId===y.taskId&&p.outcome==='completed');
  const end=await a.take('snapshot',p=>!!p.state.world.spa?.vlad?.used.includes('spaMassage')&&!!p.state.world.spa?.alina?.used.includes('spaMassage'));
  assert.equal(end.state.money,5100);
 }finally{sockets.forEach(ws=>ws.terminate());await server.close();rmSync(dir,{recursive:true,force:true});}
});

test('changing rooms are private, temporary and cannot farm rewards; showers restore hygiene once',()=>{
 const trip=spaTogetherTrip(initialState(),'vlad','pair');assert.ok(trip.ok);let s=trip.state;
 const use=(r:'vlad'|'alina',id:string,a:'spaLocker'|'spaShower'|'spaPool')=>{const route=applyWorld(s,r,{type:'approach',place:'spa',station:id});assert.ok(route.ok);return localActivity(route.state,r,a,id);};
 assert.equal(use('vlad','spa-locker-a','spaLocker').ok,false);
 const original=structuredClone(s.world.wardrobe);
 let r=use('vlad','spa-locker-v','spaLocker');assert.ok(r.ok);s=r.state;assert.equal(s.world.spa!.vlad!.changed,false);
 assert.equal(use('vlad','spa-pool','spaPool').ok,false);
 r=use('vlad','spa-locker-v','spaLocker');assert.ok(r.ok);s=r.state;assert.equal(s.world.spa!.vlad!.changed,true);assert.deepEqual(s.world.wardrobe,original);
 assert.equal(s.world.spa!.vlad!.used.length,0);
 s.characters.vlad.hygiene=15;r=use('vlad','spa-shower-v','spaShower');assert.ok(r.ok);s=r.state;
 assert.equal(s.characters.vlad.hygiene,100);assert.equal(use('vlad','spa-shower-v','spaShower').ok,false);
 assert.equal(use('alina','spa-shower-v','spaShower').ok,false);assert.ok(validWorld(s.world));assert.equal(s.money,6800);
});

test('SPA partial rewards persist and finishing grants only the unearned remainder',()=>{
 const trip=spaTogetherTrip(initialState(),'vlad','package');assert.ok(trip.ok);const s=trip.state;
 Object.assign(s.characters.vlad,{comfort:20,mood:20,energy:40,fun:20});
 spaProgress(s,'vlad','spaMassage',.25);assert.equal(s.characters.vlad.comfort,31.25);
 assert.equal(s.world.spa!.vlad!.progress!.spaMassage,.25);assert.ok(validSpa(s.world.spa));
 spaProgress(s,'vlad','spaMassage',.10);assert.equal(s.characters.vlad.comfort,31.25);
 spaProgress(s,'vlad','spaMassage',.5);assert.equal(s.characters.vlad.comfort,42.5);
 const route=applyWorld(s,'vlad',{type:'approach',place:'spa',station:'spa-massage-v'},true);assert.ok(route.ok);
 const done=localActivity(route.state,'vlad','spaMassage','spa-massage-v');assert.ok(done.ok);assert.equal(done.state.characters.vlad.comfort,65);assert.equal(done.state.characters.vlad.energy,60);assert.equal(done.state.money,5100);assert.equal(done.state.world.spa!.vlad!.progress!.spaMassage,undefined);assert.ok(validSpa(done.state.world.spa));
});
test('larger SPA pool swim loops remain inside separate lanes',()=>{
 const pool=stationById('spa','spa-pool')!;assert.equal(pool.width,7.6);assert.equal(pool.depth,4.8);
 for(let t=0;t<120;t+=.1){const v=spaSwimFrame(t,'vlad'),a=spaSwimFrame(t,'alina');
  for(const f of [v,a])for(const offset of [0,1.6]){assert.ok(Math.abs(f.x-offset*Math.sin(f.yaw))<pool.width/2-.20);assert.ok(Math.abs(f.z-offset*Math.cos(f.yaw))<pool.depth/2-.20);}
  assert.ok(v.x<-.3&&a.x>.3);
 }
});
