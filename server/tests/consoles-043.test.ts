import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {initialState} from '../../src/shared/protocol';
import {CONSOLES,CONSOLE_GAMES,consoleLibrary,consoleInstalled,validConsoleLibrary} from '../../src/shared/consoleCatalog';
import {applyWorld} from '../locations';
import {applyFurnishing} from '../furnishing';
import {STATIONS,approachFor,stationById,doorwayArrival,floorFor,placeObstacles} from '../../src/shared/locations';
import {findRoute,pointIsClear} from '../../src/game/navigation';
import {createLocation} from '../../src/game/LocationScene';
import {buildFurnishingModel} from '../../src/game/FurnishingArt';
import {HOME_PLACEMENTS} from '../../src/shared/home';
import {speakerMountAt} from '../../src/shared/speakerPlacement';
import {openServerFiles} from '../storage';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('Expanded electronics department keeps all previous stands and both new routes',()=>{
 const floor=floorFor('electronics'),obs=placeObstacles('electronics');
 for(const role of ['vlad','alina'] as const){
  const spawn=doorwayArrival('electronics','district',role);
  assert.ok(pointIsClear(spawn,obs,floor));
  for(const station of STATIONS.electronics){const target=approachFor(station,role);assert.ok(pointIsClear(target,obs,floor),station.id);assert.ok(findRoute(spawn,target,obs,floor),station.id);assert.ok(findRoute(target,spawn,obs,floor),station.id);}
 }
 const scene=createLocation('electronics');try{assert.equal(scene.stations.size,11);assert.ok(scene.stations.has('tech-ps5'));assert.ok(scene.stations.has('tech-switch'));}finally{scene.dispose();}
});
test('Both consoles must be paid at cashier, placed on supported furniture and unlock their own shared games',()=>{
 let s=initialState();s.money=200000;
 const send=(command:Record<string,unknown>,role:'vlad'|'alina'='vlad')=>{const r=applyWorld(s,role,command);if(!r.ok)assert.fail(r.reason);s=r.state;};
 assert.equal(applyWorld(s,'vlad',{type:'console_buy',sku:'console-ps5'}).ok,false);
 assert.equal(applyWorld(s,'vlad',{type:'console_game_buy',game:'ufc6'}).ok,false);
 Object.assign(s.characters.vlad,approachFor(stationById('home','family-car')!,'vlad'));
 send({type:'car_travel',place:'electronics'});send({type:'approach',place:'electronics',station:'tech-cash'});
 for(const sku of ['console-ps5','console-switch2'] as const){send({type:'console_buy',sku});assert.equal(applyWorld(s,'vlad',{type:'console_buy',sku}).ok,false);}
 assert.equal(s.money,85020);
 send({type:'approach',place:'electronics',station:'tech-exit'});send({type:'travel',place:'district',via:'tech-exit'});assert.equal(s.world.places.vlad,'home');
 assert.equal(applyWorld(s,'vlad',{type:'console_game_buy',game:'ufc6'}).ok,false);
 const nav=placeObstacles('home',s.furnishing),tv=HOME_PLACEMENTS.tv;
 for(const [sku,offset] of [['console-ps5',-.60],['console-switch2',.60]] as const){
  const item=s.furnishing.stored.find(i=>i.sku===sku)!;
  assert.equal(applyFurnishing(s,'vlad',{type:'furniture_place',id:item.id,x:13,z:-4,rotation:0},0).ok,false);
  const r=applyFurnishing(s,'vlad',{type:'furniture_place',id:item.id,x:tv.x+offset,z:tv.z+.04,rotation:0},0);
  if(!r.ok)assert.fail(r.reason);s=r.state;assert.ok(consoleInstalled(s,sku));
  const placed=s.furnishing.placed.find(p=>p.id===item.id)!;assert.ok(placed.mount?.support.startsWith('static:tv:'));assert.equal(speakerMountAt(s.furnishing,{...placed,id:99}),null);
 }
 assert.deepEqual(placeObstacles('home',s.furnishing),nav);
 send({type:'console_game_buy',game:'ufc6'},'alina');assert.ok(consoleLibrary(s).includes('ufc6'));
 assert.equal(applyWorld(s,'vlad',{type:'console_game_buy',game:'ufc6'}).ok,false);
 send({type:'console_game_buy',game:'marioKart'});
 assert.equal(s.money,85020-CONSOLE_GAMES.ufc6.price-CONSOLE_GAMES.marioKart.price);
 const dir=mkdtempSync(join(tmpdir(),'console-save-'));try{const f=openServerFiles(dir);f.save(s);const loaded=f.load();assert.deepEqual(loaded.consoleLibrary,s.consoleLibrary);assert.ok(consoleInstalled(loaded,'console-ps5'));}finally{rmSync(dir,{recursive:true,force:true});}
 assert.equal(validConsoleLibrary(['ufc6','ufc6']),false);assert.equal(validConsoleLibrary(['fake']),false);
});
test('Both actual 3D console models remain inside declared footprint',()=>{
 for(const sku of ['console-ps5','console-switch2'] as const){
  const g=buildFurnishingModel(sku,'ivory'),box=new THREE.Box3().setFromObject(g),size=box.getSize(new THREE.Vector3()),m=CONSOLES[sku];
  assert.ok(size.x<=m.width+.001&&size.y<=m.height+.001&&size.z<=m.depth+.001);assert.ok(Math.abs(box.min.y)<.001);
 }
});

import {Actor} from '../../src/game/Actor';
import {planTask,evaluateTask} from '../tasks';
import {usesHomeSession} from '../homeSessions';
import {pairScenes,cooperationDenial,completeTogether,socialDuration} from '../society';
import {SOCIAL_BY_ID} from '../../src/shared/socialLife';
import {homeSeat} from '../../src/shared/home';
function gamingState(){
 let s=initialState();s.money=100000;s.consoleLibrary=['ufc6','itTakesTwo','forza6','marioKart'];
 for(const [sku,x] of [['console-ps5',-.6],['console-switch2',.6]] as const){
  const id=s.furnishing.nextId++;s.furnishing.stored.push({id,sku,finish:'ivory'});
  const r=applyFurnishing(s,'vlad',{type:'furniture_place',id,x:HOME_PLACEMENTS.tv.x+x,z:HOME_PLACEMENTS.tv.z+.04,rotation:0},0);
  if(!r.ok)assert.fail(r.reason);s=r.state;
 }
 for(const r of ['vlad','alina'] as const)Object.assign(s.characters[r],{fun:10,mood:30,comfort:40,social:30});
 return s;
}
test('Console sessions require installed hardware and purchased title, share TV resource, no solo co-op',()=>{
 const s=gamingState(),cmd={type:'console_play',game:'ufc6'} as const;
 assert.equal(planTask(cmd)?.resource,'tv');assert.equal(planTask(cmd)?.durationMs,120000);assert.equal(usesHomeSession(cmd),true);
 assert.equal(planTask({type:'console_play',game:'itTakesTwo'}),null);
 assert.equal(evaluateTask(initialState(),'vlad',cmd).ok,false);
 assert.equal(evaluateTask(s,'vlad',{type:'console_play',game:'mk1'}).ok,false);
 const r=evaluateTask(s,'vlad',cmd);assert.ok(r.ok);assert.equal(r.state.characters.vlad.fun,75);assert.equal(r.state.money,s.money);
 const paired={type:'together',action:'consoleTogether',item:'ufc6'} as const;
 assert.equal(cooperationDenial(s,'vlad',paired),undefined);
 assert.ok(cooperationDenial(s,'vlad',{...paired,item:'forza6'}));
 assert.ok(cooperationDenial(s,'vlad',{...paired,item:'mk1'}));
 assert.equal(socialDuration(SOCIAL_BY_ID.get('consoleTogether')!,paired,s),120000);
 const homes=pairScenes(s,'vlad',paired);assert.ok(homes);for(const role of ['vlad','alina'] as const){assert.equal(homes[role].consoleGame,'ufc6');assert.equal(homes[role].pair?.motion,'console');}
 const both=completeTogether(s,'vlad',paired,['vlad','alina'],0,homes);assert.ok(both.ok);assert.match(both.message,/Победитель: (Влад|Алина)/);assert.deepEqual(homes.vlad.consoleMatch,homes.alina.consoleMatch);assert.ok(both.message.includes(homes.vlad.consoleMatch?.winner==='red'?'Влад':'Алина'));assert.ok(both.state.characters.alina.fun>70);
 const coop={...paired,item:'itTakesTwo'};const co=pairScenes(s,'vlad',coop)!;const result=completeTogether(s,'vlad',coop,['vlad','alina'],0,co);assert.ok(result.ok);assert.match(result.message,/Совместный уровень пройден/);
});
test('Both animated fallback character rigs reach two gamepad wrist anchors and release prop',()=>{
 for(const role of ['vlad','alina'] as const)for(const game of ['ufc6','marioKart'] as const){
  const actor=new Actor(role,[0,0]),seat=homeSeat('sofa',role);actor.setFurniturePose('sit',new THREE.Vector3().copy(seat.position),seat.yaw);actor.playConsole(game);
  let max=0;
  for(let f=0;f<90;f++){actor.update(1/30);if(f>15)max=Math.max(max,...actor.gamepadGripError()!);}
  assert.ok(max<.035,role+' '+game+' grip drift '+max);
  actor.finishActivity();assert.equal(actor.gamepadGripError(),null);
 }
});
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createBlenderCharacter} from '../../src/game/BlenderCharacter';
test('Actual shipped Blender skin rigs reach both controller wrist anchors',async()=>{
 for(const role of ['vlad','alina'] as const){
  const buffer=await readFile(new URL('../../src/assets/characters/'+role+'.glb',import.meta.url));
  const loader=new GLTFLoader().register(()=>({name:'HeadlessTexture',loadTexture:async()=>new THREE.Texture()}));
  const gltf=await loader.parseAsync(Uint8Array.from(buffer).buffer,'');
  const actor=new Actor(role,[0,0],createBlenderCharacter(gltf,role)),seat=homeSeat('sofa',role);
  for(const game of ['ufc6','marioKart'] as const){
   actor.setFurniturePose('sit',new THREE.Vector3().copy(seat.position),seat.yaw);actor.playConsole(game);
   let max=0;for(let f=0;f<90;f++){actor.update(1/30);if(f>15)max=Math.max(max,...actor.gamepadGripError()!);}
   assert.ok(max<.035,role+' '+game+' grip drift '+max);
   actor.finishActivity();assert.equal(actor.gamepadGripError(),null);
  }
 }
});
import {once} from 'node:events';
import WebSocket from 'ws';
import {startServer} from '../server';
import type {CharacterId,ServerPacket} from '../../src/shared/protocol';
test('Live console session is consented, TV-exclusive and rewards only completed games',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'console-network-')),files=openServerFiles(dir),s=gamingState();s.autonomy={vlad:'off',alina:'off'};files.save(s);
 const server=await startServer({port:0,dataDir:dir,taskTimeScale:.035,lifeClock:{now:()=>0,tickMs:600000},autonomyTiming:{idleMs:99999999,careCooldownMs:99999999,leisureCooldownMs:99999999}});
 const sockets:WebSocket[]=[];
 async function connect(role:CharacterId){
  const ws=new WebSocket('ws://127.0.0.1:'+server.port+'/sync');sockets.push(ws);const queue:ServerPacket[]=[];ws.on('message',m=>queue.push(JSON.parse(m.toString())));
  const send=(data:object)=>ws.send(JSON.stringify(data));
  async function take<T extends ServerPacket['type']>(type:T,cond:(p:Extract<ServerPacket,{type:T}>)=>boolean=()=>true){
   const end=Date.now()+12000;while(Date.now()<end){const i=queue.findIndex(p=>p.type===type&&cond(p as Extract<ServerPacket,{type:T}>));if(i>=0)return queue.splice(i,1)[0] as Extract<ServerPacket,{type:T}>;await new Promise(r=>setTimeout(r,10));}throw Error('Missing '+type+'; '+queue.map(p=>p.type).join(','));
  }
  await once(ws,'open');send({type:'auth',role,code:files.access[role]});await take('ready');return {send,take};
 }
 try{
  const v=await connect('vlad'),a=await connect('alina');
  v.send({type:'console_play',game:'ufc6'});const solo=await v.take('task_started',p=>p.role==='vlad'&&p.command.type==='console_play');
  assert.equal(solo.home?.consoleGame,'ufc6');
  a.send({type:'free_tv'});await a.take('error');
  v.send({type:'cancel_task',taskId:solo.taskId});await v.take('task_ended',p=>p.taskId===solo.taskId&&p.outcome==='cancelled');
  assert.equal(files.load().characters.vlad.fun,10);
  v.send({type:'social_propose',action:'consoleTogether',item:'ufc6'});const pending=await a.take('social_pending');assert.equal(files.load().characters.vlad.fun,10);
  a.send({type:'social_reply',inviteId:pending.offer.id,choice:0});
  const x=await v.take('task_started',p=>p.role==='vlad'&&p.command.type==='together'),y=await a.take('task_started',p=>p.role==='alina'&&p.command.type==='together');
  assert.equal(x.home?.consoleGame,'ufc6');assert.equal(y.home?.consoleGame,'ufc6');
  const result=await v.take('task_ended',p=>p.taskId===x.taskId&&p.outcome==='completed');
  await a.take('task_ended',p=>p.taskId===y.taskId&&p.outcome==='completed');
  assert.match(result.message,/Победитель/);assert.ok(files.load().characters.vlad.fun>=75);assert.ok(files.load().characters.alina.fun>=75);
 }finally{sockets.forEach(ws=>ws.terminate());await server.close();rmSync(dir,{recursive:true,force:true});}
});