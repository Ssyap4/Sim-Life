import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {CAT_DIRECTIONS,PET_TOYS,catManualToys,validToyExtras} from '../../src/shared/petToys';
import {applyCatPlay,runPetRoutines,applyPetAction} from '../pets';
import {homeToysFor} from '../../src/shared/pets';
import {grantStarterPetFurniture} from '../starterPets';
import {openServerFiles} from '../storage';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pointIsClear,segmentIsClear} from '../../src/game/navigation';
import {petNavigationGeometry} from '../../src/game/PetNavigation';
import {placeObstacles} from '../../src/shared/locations';
import {HOME_FLOOR} from '../../src/shared/home';
const manual=PET_TOYS.filter(t=>t.manual);
function fixture(){const s=initialState();grantStarterPetFurniture(s);s.pets.simba.ownedToys=manual.map(t=>t.id);s.pets.simba.happiness=40;s.pets.simba.bond=30;Object.assign(s.characters.vlad,{x:-.96,z:10.28,pose:'idle'});Object.assign(s.characters.alina,{x:-.96,z:10.28,pose:'idle'});return s;}
function play(s:ReturnType<typeof fixture>,id:string,now=480){for(const dir of CAT_DIRECTIONS){const r=applyCatPlay(s,'vlad',id,dir,now);if(r.ok)return r;}throw Error('No usable target for '+id);}
test('manual toys are distinct purchased items; none become autonomous toys',()=>{
 const s=fixture();assert.equal(manual.length,4);assert.equal(catManualToys(s.pets.simba).length,4);assert.ok(validToyExtras(s.pets.simba,'simba'));assert.equal(validToyExtras(s.pets.simba,'verdell'),false);
 assert.equal(applyPetAction(s,'vlad','simba','toy').ok,false);
 runPetRoutines(s,0,480,new Set(['verdell']),()=>.2);assert.notEqual(s.pets.simba.routine?.kind,'toy');
});
test('all four owner toys choose a reachable target, persist, grant reward only after contact',()=>{
 for(const t of manual){const s=fixture(),r=play(s,t.id),p=r.state.pets.simba,route=p.routine!;
 assert.equal(route.manualToy?.owner,'vlad');assert.equal(route.kind,'toy');assert.equal((homeToysFor('simba')[route.target] as typeof t).id,t.id);
 assert.equal(p.happiness,40);assert.equal(p.bond,30);assert.equal(r.state.money,s.money);
 const g=petNavigationGeometry(placeObstacles('home',r.state.furnishing),HOME_FLOOR);assert.ok(pointIsClear(route.manualToy!.point,g.obstacles,g.floor));assert.ok(pointIsClear(route.goal!,g.obstacles,g.floor));
 assert.ok(route.route.path.every((q,i)=>segmentIsClear(route.route.path[i-1]??route.route.from,q,g.obstacles,g.floor)));
 const dir=mkdtempSync(join(tmpdir(),'cat069-'));try{const f=openServerFiles(dir);f.save(r.state);assert.deepEqual(f.load().pets.simba.routine,route);}finally{rmSync(dir,{recursive:true,force:true});}
 runPetRoutines(r.state,0,route.until,new Set(['verdell']),()=>.99);assert.equal(p.happiness,40+t.joy+6);assert.equal(p.bond,33);assert.equal(p.toyPreferences?.[t.id],3);assert.ok(p.energy<81);
 }
});
test('unowned or invalid input, busy cat and second owner cannot hijack a manual route',()=>{
 const s=fixture();assert.equal(applyCatPlay(s,'vlad','dog-ring','north').ok,false);assert.equal(applyCatPlay(s,'vlad','cat-laser','invalid').ok,false);
 s.pets.simba.ownedToys=['cat-wand'];assert.equal(applyCatPlay(s,'vlad','cat-laser','north').ok,false);
 const r=play(s,'cat-wand'),p=r.state.pets.simba;assert.equal(applyCatPlay(r.state,'alina','cat-wand','north').ok,false);
 const old=p.routine!;r.state.world.places.vlad='park';runPetRoutines(r.state,0,old.until,new Set(['verdell']),()=>.99);assert.equal(p.happiness,40);assert.equal(p.toyPreferences,undefined);
 const a=fixture();a.pets.simba.energy=10;assert.equal(applyCatPlay(a,'vlad','cat-wand','north').ok,false);
});
test('changing target grants no immediate rewards and urgent hunger interrupts play',()=>{
 const s=fixture(),r=play(s,'cat-wand'),p=r.state.pets.simba,old=p.routine!;
 const redirected=play(r.state,'cat-string-mouse',481);assert.equal(redirected.state.pets.simba.happiness,40);assert.equal(redirected.state.pets.simba.bond,30);
 p.satiety=10;r.state.petBowls.simba=1;runPetRoutines(r.state,0,old.startedAt+1,new Set(['verdell']),()=>.99);assert.equal(p.routine?.kind,'eat');assert.equal(p.toyPreferences,undefined);
});

test('direct floor touch keeps exact point and rejects impossible coordinates or remote targets',()=>{
 const s=fixture(),r=play(s,'cat-laser'),point=r.state.pets.simba.routine!.manualToy!.point;
 const touched=applyCatPlay(s,'vlad','cat-laser',point,480);assert.ok(touched.ok);assert.deepEqual(touched.state.pets.simba.routine?.manualToy?.point,point);
 for(const p of [{x:Infinity,z:0},{x:NaN,z:0},{x:999,z:999},{x:s.characters.vlad.x,z:s.characters.vlad.z},{x:'0',z:1}])assert.equal(applyCatPlay(s,'vlad','cat-laser',p,480).ok,false);
});
import {once} from 'node:events';
import WebSocket from 'ws';
import {startServer} from '../server';
import type {ServerPacket} from '../../src/shared/protocol';
test('two actual clients receive same directed toy and reject second owner',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cat-play-net-069-')),files=openServerFiles(dir),s=fixture();s.autonomy={vlad:'off',alina:'off'};
 const direction=CAT_DIRECTIONS.find(d=>applyCatPlay(s,'vlad','cat-wand',d).ok)!;assert.ok(direction);files.save(s);
 const server=await startServer({port:0,dataDir:dir,testNoCodes:true,lifeClock:{now:()=>0,tickMs:600000},autonomyTiming:{idleMs:99999999,careCooldownMs:99999999,leisureCooldownMs:99999999}});const sockets:WebSocket[]=[];
 async function connect(role:'vlad'|'alina'){
  const ws=new WebSocket('ws://127.0.0.1:'+server.port+'/sync');sockets.push(ws);const inbox:ServerPacket[]=[];ws.on('message',m=>inbox.push(JSON.parse(m.toString())));
  const send=(o:object)=>ws.send(JSON.stringify(o));
  async function take<K extends ServerPacket['type']>(kind:K,predicate:(p:Extract<ServerPacket,{type:K}>)=>boolean=()=>true){
   const end=Date.now()+7000;while(Date.now()<end){const i=inbox.findIndex(p=>p.type===kind&&predicate(p as Extract<ServerPacket,{type:K}>));if(i>=0)return inbox.splice(i,1)[0] as Extract<ServerPacket,{type:K}>;await new Promise(r=>setTimeout(r,5));}throw Error('Missing '+kind);
  }
  await once(ws,'open');send({type:'auth',role,code:'TEST-LOCAL-NO-CODES'});await take('ready');return {send,take};
 }
 try{
 const v=await connect('vlad'),a=await connect('alina');v.send({type:'cat_play',toy:'cat-wand',direction});
 const received=await v.take('snapshot',p=>!!p.state.pets.simba.routine?.manualToy);
 const peer=await a.take('snapshot',p=>p.state.revision===received.state.revision);
 assert.deepEqual(received.state.pets.simba.routine,peer.state.pets.simba.routine);
 a.send({type:'cat_play',toy:'cat-laser',direction});await a.take('error');assert.equal(files.load().pets.simba.routine?.manualToy?.owner,'vlad');
 }finally{sockets.forEach(ws=>ws.terminate());await server.close();rmSync(dir,{recursive:true,force:true});}
});
