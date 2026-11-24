import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {autonomyCandidates,foodSupplyProblem,fullLeisureCandidates} from '../../src/shared/autonomy';
import {addReadyFood} from '../../src/shared/readyFood';
test('50 percent is the care threshold for all seven needs and fridge portions are served',()=>{
 const state=initialState();state.autonomy.alina='needs';
 const needs=['hunger','energy','hygiene','bladder','social','fun','comfort'] as const;
 for(const need of needs)state.characters.alina[need]=80;
 for(const need of needs){
   state.characters.alina[need]=50;assert.ok(autonomyCandidates(state,'alina').some(c=>c.need===need),need);
   state.characters.alina[need]=51;assert.ok(!autonomyCandidates(state,'alina').some(c=>c.need===need),need);
   state.characters.alina[need]=80;
 }
 state.characters.alina.hunger=50;
 for(const key of Object.keys(state.pantry) as (keyof typeof state.pantry)[])state.pantry[key]=0;
 state.readyFood=[];assert.equal(foodSupplyProblem(state,'alina'),true);
 state.meals.omelette=1;addReadyFood(state,'meal','omelette',1,'fridge');
 assert.equal(foodSupplyProblem(state,'alina'),false);
 assert.ok(autonomyCandidates(state,'alina').some(c=>c.command.type==='act'&&c.command.actionId==='kitchenServe'));
 state.autonomy.alina='full';assert.ok(fullLeisureCandidates(state,'alina',0).length>=12);
 assert.equal(fullLeisureCandidates(state,'alina',0).some(c=>c.type==='play_game'&&c.device==='laptop'),true);
});

import * as THREE from 'three';
import {furnitureComfort,sleepRecoveryMultiplier} from '../../src/shared/furnitureComfort';
import {catPerchCandidates,currentCatPerch} from '../../src/shared/CatPerches';
import {FURNITURE_BY_ID,type PlacedFurniture} from '../../src/shared/furniture';
import {buildFurnishingModel} from '../../src/game/FurnishingArt';
import {petScratchers,petScratchPoint} from '../../src/shared/petFurniture';
import {recoverSleep} from '../timeControl';
test('furniture comfort affects real sleep recovery',()=>{
  const state=initialState();state.characters.vlad.energy=30;state.characters.vlad.sleepingOn=1;
  const item={id:1,sku:'bed-solo',x:0,z:0,rotation:0,finish:'oak'} as PlacedFurniture;
  state.furnishing.placed=[item];const better=structuredClone(state);better.furnishing.placed[0].sku='bed-canopy';
  const sleepers=new Map([['vlad','full']] as const);recoverSleep(state,20,sleepers);recoverSleep(better,20,sleepers);
  assert.ok(furnitureComfort('bed-canopy')>furnitureComfort('bed-solo'));
  assert.ok(sleepRecoveryMultiplier('bed-canopy')>sleepRecoveryMultiplier('bed-solo'));
  assert.ok(better.characters.vlad.energy>state.characters.vlad.energy);
  assert.ok(better.characters.vlad.comfort>state.characters.vlad.comfort);
});
test('each cat house has two real rotated sockets, bounded model, stale references invalidated',()=>{
  const state=initialState();
  for(const [i,sku] of ['pet-house-cabin','pet-house-soft','pet-house-tower'].entries()){
    const info=FURNITURE_BY_ID.get(sku)!;
    const model=buildFurnishingModel(sku,'oak');const size=new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    assert.ok(size.x<=info.width+.03&&size.y<=info.height+.04&&size.z<=info.depth+.03,sku);
    const item={id:i+1,sku,x:2,z:3,rotation:1,finish:'oak'} as PlacedFurniture;
    state.furnishing.placed=[item];
    const sockets=catPerchCandidates(state.furnishing).filter(p=>p.key.startsWith('placed:'+item.id+':'));
    assert.equal(sockets.length,2);assert.ok(sockets.some(p=>p.entry==='inside'));assert.ok(sockets.some(p=>p.entry==='jump'));
    assert.ok(sockets.every(p=>p.approach.x>item.x&&currentCatPerch(state.furnishing,p)));
    if(sku==='pet-house-tower'){assert.equal(petScratchers(state.furnishing).length,1);assert.notDeepEqual(petScratchPoint(item),{x:item.x,z:item.z});}
    item.x+=.5;assert.ok(sockets.every(p=>!currentCatPerch(state.furnishing,p)));
  }
});
