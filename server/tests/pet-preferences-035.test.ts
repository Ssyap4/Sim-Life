import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {initialState} from '../../src/shared/protocol';
import {PetActor} from '../../src/game/PetActor';
import {catPerchCandidates} from '../../src/shared/CatPerches';
import {discoverFurniture,validFurniturePreferences,housePreferenceKey} from '../../src/shared/petPreferences';
import {petWish} from '../../src/shared/petWishes';
import {runPetRoutines,applyPetAction} from '../pets';
import {openServerFiles} from '../storage';
import {type PetId} from '../../src/shared/pets';
test('preferences are discovered on completed furniture use and never rerolled',()=>{
 const s=initialState(),p=s.pets.verdell;const item={id:1,sku:'pet-bed-dog-nest',finish:'sage' as const,x:-2.9,z:3.34,rotation:0 as const};
 s.furnishing.placed=[item];s.furnishing.nextId=2;p.energy=30;p.happiness=50;
 const r=applyPetAction(s,'vlad','verdell','mat');assert.ok(r.ok);const next=r.state,d=next.pets.verdell,lesson=d.routine!;
 assert.equal(d.furniturePreferences,undefined);
 runPetRoutines(next,0,lesson.until,new Set(['simba']),()=>.99);
 assert.equal(d.furniturePreferences?.[item.sku],3);assert.equal(d.favoriteBedId,1);
 assert.equal(discoverFurniture(d,item.sku,()=>0),3);assert.ok(d.energy>60);
 const dir=mkdtempSync(join(tmpdir(),'pet-fav-'));try{const f=openServerFiles(dir);f.save(next);assert.deepEqual(f.load().pets.verdell.furniturePreferences,d.furniturePreferences);}finally{rmSync(dir,{recursive:true,force:true});}
 assert.equal(validFurniturePreferences({...d,furniturePreferences:{'pet-bed-cat-shell':3}},'verdell'),false);
});
test('cat can separately like the roof and dislike the interior; unknown beds get a chance',()=>{
 const s=initialState(),p=s.pets.simba;
 const item={id:1,sku:'pet-house-loft',finish:'sage' as const,x:-2.9,z:3.34,rotation:0 as const};s.furnishing.placed=[item];s.furnishing.nextId=2;
 const sites=catPerchCandidates(s.furnishing).filter(v=>v.entry);
 const inside=sites.find(v=>v.entry==='inside')!,roof=sites.find(v=>v.entry==='jump')!;
 for(const [site,roll] of [[inside,0],[roof,.99]] as const){p.position=site.approach;p.routine={kind:'perch',target:0,startedAt:480,until:500,perch:site,route:{from:site.approach,path:[]}};runPetRoutines(s,0,500,new Set(['verdell']),()=>roll);}
 assert.equal(p.furniturePreferences?.[housePreferenceKey(s.furnishing,inside)!],0);assert.equal(p.furniturePreferences?.[housePreferenceKey(s.furnishing,roof)!],3);
 assert.ok(validFurniturePreferences(p,'simba'));
 const d=s.pets.verdell;const bed1={...item,id:2,sku:'pet-bed-dog-nest'},bed2={...item,id:3,sku:'pet-bed-dog-sofa',x:-6.26,z:-3.71};
 s.furnishing.placed=[bed1,bed2];d.furniturePreferences={[bed1.sku]:0,[bed2.sku]:3};d.favoriteBedId=2;d.energy=35;d.bladder=d.satiety=99;delete d.routine;
 runPetRoutines(s,0,520,new Set(['simba']),()=>.99);assert.equal((d as import('../../src/shared/pets').PetState).routine?.equipment?.id,3);
});
test('rare events are saved server routines, animate, respect cooldown and urgent needs',()=>{
 for(const id of ['verdell','simba'] as const){
  const s=initialState(),p=s.pets[id],other:PetId=id==='simba'?'verdell':'simba';
  p.satiety=p.energy=p.bladder=95;p.bond=0;p.happiness=50;
  p.routine={kind:'wander',target:0,startedAt:600,until:610,route:{from:p.position,path:[]}};
  // Force ordinary selection to skip autonomous toys/perches, then take event roll.
  let chosen=false;
  for(let trial=0;trial<12&&!chosen;trial++){
   const q=structuredClone(s);let n=0;runPetRoutines(q,0,610,new Set([other]),()=>++n===trial+1?.01:.99);
   if(q.pets[id].routine?.kind==='event'){Object.assign(s,q);chosen=true;}
  }
  assert.ok(chosen,id);const live=s.pets[id],ev=live.routine!;assert.equal(ev.event,id==='verdell'?'sniff':'groom');
  assert.equal(live.lastEventAt,610);assert.equal(petWish(s,id).kind,'play');
  const actor=new PetActor(id);actor.followRoute([],'event',undefined,undefined,undefined,false,undefined,undefined,0,undefined,undefined,ev.event);
  for(let i=0;i<75;i++)actor.update(1/60);assert.equal(actor.currentIdleGesture(),ev.event);
  runPetRoutines(s,0,ev.until,new Set([other]),()=>.99);assert.equal(live.happiness,53);
  live.satiety=5;s.petBowls[id]=3;live.routine={...ev,startedAt:650,until:670};
  runPetRoutines(s,0,651,new Set([other]),()=>.99);assert.equal(live.routine?.kind,'eat');assert.equal(live.happiness,53);
 }
});
