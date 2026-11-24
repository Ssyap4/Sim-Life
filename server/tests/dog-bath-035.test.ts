import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import WebSocket from 'ws';
import {initialState,type ServerPacket,type CharacterId} from '../../src/shared/protocol';
import {dogBathPlan,DOG_BATH_APPROACH,DOG_BATH_OWNER} from '../../src/shared/dogBath';
import {applyPetAction,runPetRoutines} from '../pets';
import {planTask,evaluateTask} from '../tasks';
import {openServerFiles} from '../storage';
import {startServer} from '../server';
import {grantStarterPetFurniture} from '../starterPets';
import {PetActor} from '../../src/game/PetActor';
import * as THREE from 'three';
const cmd={type:'pet_action' as const,pet:'verdell' as const,action:'bathe' as const};
test('only Verdell loses cleanliness, bath has real routes and grants rewards on completion',()=>{
 const s=initialState();grantStarterPetFurniture(s);s.pets.verdell.cleanliness=38;
 runPetRoutines(s,60,480,new Set(['verdell','simba']),()=>.99);
 assert.ok(s.pets.verdell.cleanliness<38);assert.equal(s.pets.simba.cleanliness,undefined);
 const plan=dogBathPlan(s,'vlad');assert.ok(plan);assert.deepEqual(plan.goal,DOG_BATH_APPROACH);
 assert.equal(planTask(cmd)?.resource,'bathtub');assert.equal(planTask({...cmd,pet:'simba'}),null);
 const r=evaluateTask(s,'vlad',cmd);assert.ok(r.ok);assert.equal(r.state.pets.verdell.cleanliness,100);
 assert.deepEqual(r.state.pets.verdell.position,DOG_BATH_APPROACH);assert.equal(r.state.characters.vlad.x,DOG_BATH_OWNER.x);
 assert.equal(applyPetAction(s,'vlad','simba','bathe').ok,false);
 assert.ok(s.pets.verdell.cleanliness<38);assert.equal(s.pets.simba.cleanliness,undefined);
});
test('dog bath raises the visible body, not the collision root, and resets after cancellation',()=>{
 const dog=new PetActor('verdell');dog.root.position.set(DOG_BATH_APPROACH.x,0,DOG_BATH_APPROACH.z);const p=dog.root.position.clone();
 dog.followRoute([],'bath');dog.setBath(true);for(let i=0;i<120;i++)dog.update(1/60);
 assert.ok(dog.root.position.distanceTo(p)<.001);
 const body=dog.root.children[0];assert.ok(body.position.y>.5);
 assert.equal(dog.bathPhase,'wet');for(let i=0;i<400;i++)dog.update(1/60);assert.equal(dog.bathPhase,'soap');
 for(let i=0;i<650;i++)dog.update(1/60);assert.equal(dog.bathPhase,'rinse');
 dog.setBath(false);for(let i=0;i<120;i++)dog.update(1/60);
 assert.ok(body.position.distanceTo(new THREE.Vector3(0,.081,0))<.05);
});
function waitPacket(ws:WebSocket,check:(p:ServerPacket)=>boolean):Promise<ServerPacket>{
 return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{ws.off('message',on);reject(Error('packet timeout'))},6000);function on(raw:WebSocket.RawData){const p=JSON.parse(raw.toString()) as ServerPacket;if(!check(p))return;clearTimeout(timer);ws.off('message',on);resolve(p);}ws.on('message',on);});
}
async function connect(port:number,role:CharacterId,code:string){const ws=new WebSocket('ws://127.0.0.1:'+port+'/sync');await once(ws,'open');const ready=waitPacket(ws,p=>p.type==='ready');ws.send(JSON.stringify({type:'auth',role,code}));await ready;return ws;}
test('live two-player bath reserves the dog and bathtub, cancellation does not clean, completion persists',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'dog-bath-035-'));const files=openServerFiles(dir),s=initialState();s.pets.verdell.cleanliness=27;s.autonomy.vlad=s.autonomy.alina='off';files.save(s);
 const server=await startServer({port:0,dataDir:dir,taskTimeScale:.07});const sockets:WebSocket[]=[];
 try{
  const v=await connect(server.port,'vlad',files.access.vlad),a=await connect(server.port,'alina',files.access.alina);sockets.push(v,a);
  const send=(w:WebSocket,c:object)=>w.send(JSON.stringify(c));
  let begun=waitPacket(v,p=>p.type==='task_started'&&p.command.type==='pet_action'&&p.command.action==='bathe');send(v,cmd);const b=await begun;assert.equal(b.type,'task_started');
  const rejected=waitPacket(a,p=>p.type==='error');send(a,{type:'pet_action',pet:'verdell',action:'toy'});assert.equal((await rejected).type,'error');
  const occupied=waitPacket(a,p=>p.type==='error');send(a,{type:'act',actionId:'bathSoak'});assert.equal((await occupied).type,'error');
  const cancelled=waitPacket(v,p=>p.type==='task_ended'&&p.outcome==='cancelled');send(v,{type:'cancel_task',taskId:b.type==='task_started'?b.taskId:0});await cancelled;
  assert.ok(files.load().pets.verdell.cleanliness!<100);
  begun=waitPacket(v,p=>p.type==='task_started'&&p.command.type==='pet_action'&&p.command.action==='bathe');send(v,cmd);await begun;
  const done=waitPacket(a,p=>p.type==='snapshot'&&p.state.pets.verdell.cleanliness===100);await done;
  assert.equal(files.load().pets.verdell.cleanliness,100);assert.equal(files.load().pets.simba.cleanliness,undefined);
 }finally{sockets.forEach(w=>w.terminate());await server.close();rmSync(dir,{recursive:true,force:true});}
});
