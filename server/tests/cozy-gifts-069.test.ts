import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {initialState} from '../../src/shared/protocol';
import {FAMILY_GIFTS,isGift,giftCount,validGifts} from '../../src/shared/gifts';
import {SOCIAL_BY_ID} from '../../src/shared/socialLife';
import {marketProduct} from '../../src/shared/market';
import {applyWorld} from '../locations';
import {approachFor,stationById,DELIVERY_FEE} from '../../src/shared/locations';
import {clockAt} from '../../src/shared/life';
import {completeTogether,cooperationDenial,pairScenes} from '../society';
import {applyFurnishing} from '../furnishing';
import {FURNITURE_BY_ID,isValidFurnishing,lampLevel,furnishingObstacles} from '../../src/shared/furniture';
import {buildFurnishingModel} from '../../src/game/FurnishingArt';
import {checkFurniturePlacement} from '../../src/shared/furnishingPlacement';
test('every gift is purchasable, delivered, received and consumed exactly once by either resident',()=>{
 for(const id of Object.keys(FAMILY_GIFTS)){
  assert.ok(isGift(id)); const g=FAMILY_GIFTS[id];
  for(const role of ['vlad','alina'] as const){
   let s=initialState();s.money=100000;
   const cmd: {type: 'together';action:string}={type:'together' as const,action:id};const other=role==='vlad'?'alina':'vlad';s.characters[other].mood=20;
   assert.equal(marketProduct('gift:'+id)?.price,g.price);assert.equal(SOCIAL_BY_ID.get(id)?.motion,'gift');
   const order=applyWorld(s,role,{type:'delivery_order',sequence:0,lines:[{id:'gift:'+id,quantity:1}]});assert.ok(order.ok);s=order.state;
   assert.equal(s.money,100000-g.price-DELIVERY_FEE);assert.ok(cooperationDenial(s,role,cmd));
   const parcel=s.world.deliveries[0];s.clock=clockAt(parcel.readyAt);
   Object.assign(s.characters[role],approachFor(stationById('home','courier-handoff')!,role));
   const hand=applyWorld(s,role,{type:'delivery_handoff',id:parcel.id});assert.ok(hand.ok);s=hand.state;
   Object.assign(s.characters[role],approachFor(stationById('home','parcel')!,role));
   const claim=applyWorld(s,role,{type:'delivery_claim',id:parcel.id});assert.ok(claim.ok);s=claim.state;
   assert.equal(giftCount(s,id),1);assert.ok(validGifts(s.gifts));
   // Restore normal resident positions for pair routing after pickup.
   const home=initialState();for(const r of ['vlad','alina'] as const)Object.assign(s.characters[r],{x:home.characters[r].x,z:home.characters[r].z,pose:'idle'});
   const scenes=pairScenes(s,role,cmd);assert.ok(scenes,id+' '+role);
   const done=completeTogether(s,role,cmd,['vlad','alina'],0,scenes);assert.ok(done.ok,id+' '+role);
   assert.equal(giftCount(done.state,id),0);assert.equal(done.state.money,s.money);assert.ok(done.state.characters[other].mood>=40);
   assert.equal(completeTogether(done.state,role,cmd,['vlad','alina'],0,scenes).ok,false);
  }
 }
});
test('cozy furniture is modeled in its declared bounds and lamps have validated shared modes',()=>{
 const s=initialState();s.money=100000;
 for(const sku of ['sofa-cozy','lamp-amber','lamp-table-linen']){
  const def=FURNITURE_BY_ID.get(sku)!;assert.ok(def);
  const model=buildFurnishingModel(sku,'oak');const bounds=new THREE.Box3().setFromObject(model);
  assert.ok(bounds.max.y<=def.height+.001);assert.ok(bounds.max.x-bounds.min.x<=def.width+.001);assert.ok(bounds.max.z-bounds.min.z<=def.depth+.001);
  assert.ok(applyFurnishing(s,'vlad',{type:'furniture_order',sku,finish:'oak',shipping:'regular',quantity:1},0).ok);
 }
 const lamp={id:1,sku:'lamp-amber',finish:'oak' as const,x:13.5,z:-5.5,rotation:0 as const};
 assert.ok(checkFurniturePlacement(s,lamp).valid);s.furnishing.placed.push(lamp);s.furnishing.nextId=2;
 const before=furnishingObstacles(s.furnishing);
 for(const role of ['vlad','alina'] as const)for(const mode of ['off','soft','warm','auto'] as const){
  const r=applyFurnishing(s,role,{type:'furniture_light',id:1,mode},0);assert.ok(r.ok);assert.equal(r.state.furnishing.placed[0].lightMode,mode);
  assert.ok(isValidFurnishing(r.state.furnishing));assert.equal(r.state.money,s.money);assert.deepEqual(furnishingObstacles(r.state.furnishing),before);
 }
 assert.equal(applyFurnishing(s,'vlad',{type:'furniture_light',id:1,mode:'invalid' as any},0).ok,false);
 assert.equal(applyFurnishing(s,'vlad',{type:'furniture_light',id:9,mode:'warm'},0).ok,false);
 assert.equal(lampLevel('off',1),0);assert.equal(lampLevel('soft',0),.45);assert.equal(lampLevel('warm',0),1);assert.equal(lampLevel('auto',.6),.6);
});

test('table lamp is mounted on real furniture and cannot block routes or overlap equipment',()=>{
 const s=initialState();s.money=100000;s.furnishing.placed=[{id:1,sku:'dresser-nora',finish:'oak',x:14,z:-6,rotation:0}];s.furnishing.stored=[{id:2,sku:'lamp-table-linen',finish:'ivory'},{id:3,sku:'speaker-alice',finish:'oak'}];s.furnishing.nextId=4;
 const before=furnishingObstacles(s.furnishing);
 assert.equal(applyFurnishing(s,'vlad',{type:'furniture_place',id:2,x:13,z:-4,rotation:0},0).ok,false);
 const r=applyFurnishing(s,'vlad',{type:'furniture_place',id:2,x:14,z:-6,rotation:0},0);assert.ok(r.ok);
 assert.deepEqual(r.state.furnishing.placed.find(p=>p.id===2)?.mount,{support:'item:1',u:0,v:0});assert.deepEqual(furnishingObstacles(r.state.furnishing),before);
 assert.equal(applyFurnishing(r.state,'alina',{type:'furniture_place',id:3,x:14,z:-6,rotation:0},0).ok,false);
 assert.equal(applyFurnishing(r.state,'alina',{type:'furniture_store',id:1},0).ok,false);
 assert.equal(applyFurnishing(r.state,'alina',{type:'furniture_light',id:1,mode:'warm'},0).ok,false);
 const lit=applyFurnishing(r.state,'alina',{type:'furniture_light',id:2,mode:'soft'},0);assert.ok(lit.ok);assert.equal(lit.state.furnishing.placed.find(p=>p.id===2)?.lightMode,'soft');
});

import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import WebSocket,{type RawData} from 'ws';
import {startServer} from '../server';
import {openServerFiles} from '../storage';
import type {CharacterId,ServerPacket} from '../../src/shared/protocol';
function next(ws:WebSocket,predicate:(packet:ServerPacket)=>boolean):Promise<ServerPacket>{
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{ws.off('message',listener);reject(new Error('Cozy network timeout'));},8000);
  function listener(raw:RawData){const packet=JSON.parse(raw.toString()) as ServerPacket;if(!predicate(packet))return;clearTimeout(timer);ws.off('message',listener);resolve(packet);}
  ws.on('message',listener);
 });
}
test('both phones receive shared lamp changes without spending money or stopping sleep',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cozy-069-'));const files=openServerFiles(dir),s=initialState();
 s.money=100000;s.autonomy={vlad:'off',alina:'off'};s.characters.vlad.energy=10;
 s.furnishing.placed=[{id:1,sku:'lamp-amber',finish:'oak',x:13.5,z:-5.5,rotation:0}];s.furnishing.nextId=2;files.save(s);
 const server=await startServer({port:0,dataDir:dir});const sockets:WebSocket[]=[];
 async function enter(role:CharacterId){const ws=new WebSocket('ws://127.0.0.1:'+server.port+'/sync');sockets.push(ws);await once(ws,'open');const p=next(ws,m=>m.type==='ready');ws.send(JSON.stringify({type:'auth',role,code:files.access[role]}));await p;return ws;}
 try{
  const v=await enter('vlad'),a=await enter('alina');const sleep=next(a,p=>p.type==='time_status'&&p.status.sleepers.vlad==='full');
  v.send(JSON.stringify({type:'sleep_start',mode:'full'}));await sleep;
  for(const [sender,mode] of [[a,'warm'],[v,'off'],[a,'soft']] as const){
   const predicate=(p:ServerPacket)=>p.type==='snapshot'&&p.state.furnishing.placed.find(i=>i.id===1)?.lightMode===mode;
   const snapshots=[next(v,predicate),next(a,predicate)];
   sender.send(JSON.stringify({type:'furniture_light',id:1,mode}));await Promise.all(snapshots);
   assert.equal(files.load().money,100000);assert.equal(files.load().characters.vlad.pose,'sleep');
  }
 }finally{for(const socket of sockets)socket.terminate();await server.close();rmSync(dir,{recursive:true,force:true});}
});
