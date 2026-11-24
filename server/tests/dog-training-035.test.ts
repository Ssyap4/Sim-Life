import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {initialState} from '../../src/shared/protocol';
import {DOG_COMMANDS,commandSkill,trainingChance,validTraining} from '../../src/shared/dogTraining';
import {applyPetAction,runPetRoutines} from '../pets';
import {openServerFiles} from '../storage';
import {PetActor} from '../../src/game/PetActor';
import * as THREE from 'three';

test('each of seven commands starts an independent server-owned lesson; successful completion gains XP exactly once',()=>{
 for(const command of DOG_COMMANDS){
  const s=initialState(),before=structuredClone(s.characters.vlad);
  const r=applyPetAction(s,'vlad','verdell','train-'+command,undefined,()=>0);
  assert.ok(r.ok,r.ok?'':r.reason);const next=r.state,p=next.pets.verdell,lesson=p.routine!;
  assert.deepEqual(next.characters.vlad,before);assert.equal(lesson.training?.command,command);
  assert.equal(lesson.training?.success,true);assert.equal(commandSkill(p,command).xp,0);
  assert.equal(lesson.kind,command==='fetch'?'fetch':'train');
  assert.equal(applyPetAction(next,'alina','verdell','train-sit').ok,false);
  const dir=mkdtempSync(join(tmpdir(),'dog-lesson-'));
  try{const files=openServerFiles(dir);files.save(next);assert.equal(files.load().pets.verdell.routine?.training?.command,command);}finally{rmSync(dir,{recursive:true,force:true});}
  runPetRoutines(next,0,lesson.until,new Set(['simba']),()=>.99);
  assert.deepEqual(commandSkill(p,command),{xp:10,attempts:1,successes:1},command);
  for(const other of DOG_COMMANDS.filter(c=>c!==command))assert.equal(commandSkill(p,other).xp,0);
  runPetRoutines(next,0,lesson.until,new Set(['simba']),()=>.99);
  assert.equal(commandSkill(p,command).attempts,1);assert.ok(validTraining(p,'verdell'));
 }
});
test('failure teaches a little, increases subsequent probability; interruptions and invalid commands give no XP',()=>{
 const s=initialState(),chance=trainingChance(s.pets.verdell,'paw');
 const r=applyPetAction(s,'vlad','verdell','train-paw',undefined,()=>.999);assert.ok(r.ok);
 const p=r.state.pets.verdell,lesson=p.routine!;assert.equal(lesson.training?.success,false);
 runPetRoutines(r.state,0,lesson.until,new Set(['simba']),()=>.99);
 assert.deepEqual(commandSkill(p,'paw'),{xp:5,attempts:1,successes:0});assert.ok(trainingChance(p,'paw')>chance);
 const next=applyPetAction(s,'vlad','verdell','train-sit',undefined,()=>0);assert.ok(next.ok);
 next.state.pets.verdell.satiety=10;next.state.petBowls.verdell=1;
 runPetRoutines(next.state,0,next.state.pets.verdell.routine!.startedAt+1,new Set(['simba']),()=>.99);
 assert.equal(next.state.pets.verdell.routine?.kind,'eat');assert.equal(commandSkill(next.state.pets.verdell,'sit').xp,0);
 assert.equal(applyPetAction(s,'vlad','simba','train-paw').ok,false);
 assert.equal(applyPetAction(s,'vlad','verdell','train-fly').ok,false);
});
test('six stationary commands and failure produce distinct dog poses, no owner or dog teleport',()=>{
 const signatures=new Set<string>();
 for(const command of DOG_COMMANDS.filter(c=>c!=='fetch')){
  const dog=new PetActor('verdell'),start=dog.root.position.clone();
  dog.followRoute([],'train',0,undefined,undefined,false,undefined,undefined,0,undefined,{command,success:true,role:'vlad',yaw:0,practice:true});
  const values:string[]=[];
  for(let i=0;i<150;i++){dog.update(1/60);if(i%10===0){const parts:number[]=[];dog.root.traverse(o=>{if(o instanceof THREE.Group||o instanceof THREE.Bone)parts.push(o.position.y,o.position.z,o.rotation.x,o.rotation.z);});values.push(parts.map(v=>v.toFixed(3)).join(','));}}
  signatures.add(values.join('|'));assert.ok(dog.root.position.distanceTo(start)<.001);
 }
 assert.equal(signatures.size,6);
});
