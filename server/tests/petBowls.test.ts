import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket, { type RawData } from 'ws';
import { initialState, type CharacterId, type ServerPacket } from '../../src/shared/protocol';
import { PETS, PET_AUTO_EAT_BELOW, PET_BOWL_CAPACITY,
  PET_FOOD_REFILLS_PER_PACK, petDestination, type PetState } from '../../src/shared/pets';
import { applyPetAction, runPetRoutines, petCarePoint } from '../pets';
import { openServerFiles } from '../storage';
import { checkout } from '../market';
import { startServer } from '../server';

function updated(result:ReturnType<typeof applyPetAction>) {
  assert.ok(result.ok,!result.ok?result.reason:'');
  return result.state;
}
test('One priced pack gives ten bowl refills, each worth three distinct meal servings', () => {
  const s=initialState();
  s.petFood.verdell=0;
  const pack=updated(applyPetAction(s,'vlad','verdell','buyFood'));
  assert.equal(pack.money,10000-PETS.verdell.foodPrice);
  assert.equal(PETS.verdell.foodAmount,PET_FOOD_REFILLS_PER_PACK);
  assert.equal(pack.petFood.verdell,10);
  assert.equal(pack.petBowls.verdell,0);
  const filled=updated(applyPetAction(pack,'alina','verdell','feed'));
  assert.equal(filled.petFood.verdell,9);
  assert.equal(filled.petBowls.verdell,3);
  assert.equal(filled.pets.verdell.satiety,s.pets.verdell.satiety,
    'pouring into a bowl does not teleport food into the dog');
  assert.equal(filled.petBowls.simba,0);
  assert.equal(applyPetAction(filled,'vlad','verdell','feed').ok,false,
    'no waste or double-serving while the bowl is not empty');
  assert.equal(pack.petFood.verdell,10,'input state untouched');
  assert.equal(PET_BOWL_CAPACITY,3);
});

test('Verdell autonomously walks to his own bowl at 40%, eats one portion and not one refill',()=>{
  const s=initialState();
  s.pets.verdell.satiety=40.3;
  s.pets.verdell.bladder=95;
  s.pets.verdell.energy=99;
  s.petBowls.verdell=3;
  s.petBowls.simba=2;
  runPetRoutines(s,1,481,new Set(),()=>0);
  assert.notEqual(s.pets.verdell.routine?.kind,'eat');
  delete s.pets.verdell.routine;
  s.pets.verdell.satiety=PET_AUTO_EAT_BELOW-1;
  runPetRoutines(s,1,492,new Set(),()=>0);
  const routine=(s.pets.verdell as PetState).routine;
  assert.equal(routine?.kind,'eat');
  assert.deepEqual(routine?.route.path.at(-1),petDestination('verdell',{kind:'eat',target:0}));
  assert.equal(s.petBowls.verdell,3,'no early consumption during walk');
  const refills=s.petFood.verdell;
  runPetRoutines(s,5,497,new Set(),()=>0);
  assert.equal(s.petBowls.verdell,3,'still walking and eating');
  runPetRoutines(s,5,502,new Set(),()=>0);
  assert.equal(s.petBowls.verdell,2);
  assert.equal(s.petBowls.simba,2);
  assert.equal(s.petFood.verdell,refills);
  assert.ok(s.pets.verdell.satiety>45);
  assert.equal((s.pets.verdell as PetState).routine?.kind==='eat',false,'no repeated feeding at full satiety');
});

test('Simba only eats cat food, empty bowls never consume household refills',()=>{
  const s=initialState();
  s.pets.verdell.satiety=9;
  s.pets.simba.satiety=8;
  s.pets.verdell.bladder=90;
  s.pets.simba.bladder=90;
  s.petBowls.verdell=0;
  s.petBowls.simba=3;
  const before={...s.petFood};
  runPetRoutines(s,1,510,new Set(),()=>0);
  assert.notEqual(s.pets.verdell.routine?.kind,'eat');
  assert.equal(s.pets.simba.routine?.kind,'eat');
  runPetRoutines(s,11,521,new Set(),()=>0);
  assert.equal(s.petBowls.simba,2);
  assert.equal(s.petBowls.verdell,0);
  assert.deepEqual(s.petFood,before);
  assert.ok(s.pets.simba.satiety>40);
});

test('Pet refills and both bowls survive an old-save migration without resetting family data',()=>{
  const dir=mkdtempSync(join(tmpdir(),'sim-life-bowl-migration-'));
  try{
    const files=openServerFiles(dir);
    const old=initialState();
    old.money=47826;
    old.characters.alina.skill=78;
    old.pets.simba.bond=91;
    old.petFood.verdell=7;
    delete (old as unknown as Record<string,unknown>).petBowls;
    writeFileSync(join(dir,'household.json'),JSON.stringify(old));
    const loaded=files.load();
    assert.deepEqual(loaded.petBowls,{verdell:0,simba:0});
    assert.equal(loaded.petFood.verdell,7);
    assert.equal(loaded.money,47826);
    assert.equal(loaded.characters.alina.skill,78);
    assert.equal(loaded.pets.simba.bond,91);
    const filled=updated(applyPetAction(loaded,'vlad','simba','feed'));
    files.save(filled);
    const reopened=files.load();
    assert.equal(reopened.petBowls.simba,3);
    assert.equal(reopened.petFood.simba,1);
    assert.equal(reopened.petFood.verdell,7);
    assert.deepEqual(files.access,JSON.parse(readFileSync(join(dir,'access.json'),'utf8')));
    assert.deepEqual(files.load().petBowls,reopened.petBowls);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('Supermarket charges one pack per species; 10 refills in each and separate bowls',()=>{
  const s=initialState();
  s.petFood.verdell=0;
  s.petFood.simba=0;
  const bought=checkout(s,'alina',[{id:'pet:verdell',quantity:1},{id:'pet:simba',quantity:1}]);
  assert.ok(bought.ok);
  assert.equal(bought.state.money,10000-PETS.verdell.foodPrice-PETS.simba.foodPrice);
  assert.equal(bought.state.petFood.verdell,10);
  assert.equal(bought.state.petFood.simba,10);
  assert.equal(bought.state.petBowls.verdell,0);
  assert.equal(bought.state.petBowls.simba,0);
  assert.ok(petCarePoint(bought.state,'verdell','feed'));
  assert.ok(petCarePoint(bought.state,'simba','feed'));
});

function waitPacket(ws:WebSocket,check:(p:ServerPacket)=>boolean):Promise<ServerPacket> {
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{ws.off('message',onMessage);reject(new Error('Bowl sync timeout'))},3000);
    function onMessage(raw:RawData){
      const packet=JSON.parse(raw.toString()) as ServerPacket;
      if(!check(packet))return;
      ws.off('message',onMessage);clearTimeout(timer);resolve(packet);
    }
    ws.on('message',onMessage);
  });
}
async function connect(port:number,role:CharacterId,code:string):Promise<WebSocket>{
  const socket=new WebSocket('ws://127.0.0.1:'+port+'/sync');
  await once(socket,'open');
  const login=waitPacket(socket,p=>p.type==='ready'||p.type==='error');
  socket.send(JSON.stringify({type:'auth',role,code}));
  assert.equal((await login).type,'ready');
  return socket;
}

test('Two live players cannot refill the same bowl twice and both see the saved result',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'sim-life-bowl-online-'));
  const server=await startServer({port:0,dataDir:dir,taskTimeScale:.025});
  const sockets:WebSocket[]=[];
  try{
    const codes=openServerFiles(dir).access;
    const v=await connect(server.port,'vlad',codes.vlad),a=await connect(server.port,'alina',codes.alina);
    sockets.push(v,a);
    const first=waitPacket(v,p=>p.type==='task_started'&&p.command.type==='pet_action'&&p.command.action==='feed');
    a.send(JSON.stringify({type:'pet_action',pet:'verdell',action:'feed'}));
    const task=await first;
    assert.equal(task.type,'task_started');
    const second=waitPacket(v,p=>p.type==='error'&&p.reason.includes('занято'));
    v.send(JSON.stringify({type:'pet_action',pet:'verdell',action:'feed'}));
    assert.equal((await second).type,'error');
    const vDone=waitPacket(v,p=>p.type==='snapshot'&&p.state.petBowls.verdell===3);
    const aDone=waitPacket(a,p=>p.type==='snapshot'&&p.state.petBowls.verdell===3);
    const [vResult,aResult]=await Promise.all([vDone,aDone]);
    assert.deepEqual(vResult,aResult);
    assert.equal(vResult.type,'snapshot');
    if(vResult.type==='snapshot')assert.equal(vResult.state.petFood.verdell,1);
    const saved=openServerFiles(dir).load();
    assert.equal(saved.petBowls.verdell,3);
    assert.equal(saved.petFood.verdell,1);
  }finally{
    sockets.forEach(s=>s.terminate());
    await server.close();
    rmSync(dir,{recursive:true,force:true});
  }
});
