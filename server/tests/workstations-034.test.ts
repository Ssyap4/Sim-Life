
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {FURNITURE_CATALOG,FURNITURE_BY_ID,PURCHASABLE_FURNITURE,RETIRED_DESKS,workstationLayout,isNotebookDesk} from '../../src/shared/furniture';
import {buildFurnishingModel} from '../../src/game/FurnishingArt';
import {initialState} from '../../src/shared/protocol';
import {laptopWorkplace,laptopApproach,furnitureUseLocation} from '../../src/shared/furnitureUse';
import {applyFurnishing} from '../furnishing';
import {completeComputerGame} from '../computers';
import {COMPUTER_GAMES} from '../../src/shared/computerGames';
test('only eight new desks are purchasable, old four are retained for placed saves',()=>{
 const state=initialState();state.money=100000;
 const desks=FURNITURE_CATALOG.filter(p=>p.shape==='desk');assert.equal(desks.length,8);
 for(const p of RETIRED_DESKS){assert.ok(FURNITURE_BY_ID.has(p.id));assert.ok(!PURCHASABLE_FURNITURE.some(x=>x.id===p.id));assert.equal(applyFurnishing(state,'vlad',{type:'furniture_order',sku:p.id,finish:'oak',shipping:'regular',quantity:1},0).ok,false);}
 for(const p of desks){assert.ok(workstationLayout(p.id));assert.ok(applyFurnishing(state,'vlad',{type:'furniture_order',sku:p.id,finish:'oak',shipping:'regular',quantity:1},0).ok);}
});
test('eight workstation geometries differ and seat/tabletop remain inside bounds',()=>{
 const signatures=new Set<string>();
 for(const p of FURNITURE_CATALOG.filter(p=>p.shape==='desk')){
  const model=buildFurnishingModel(p.id,'oak');const bounds=new THREE.Box3().setFromObject(model);
  assert.ok(bounds.max.x<=p.width/2+.001&&bounds.min.x>=-p.width/2-.001);
  assert.ok(bounds.max.z<=p.depth/2+.001&&bounds.min.z>=-p.depth/2-.001);
  assert.ok(bounds.max.y<=p.height+.001);
  assert.ok(model.scale.y>.99,p.id+' tabletop is distorted');
  let n=0,mesh=0;model.traverse(o=>{if(o instanceof THREE.Mesh){mesh++;n+=o.geometry.getAttribute('position').count;}});
  signatures.add([p.width,p.depth,mesh,n].join(':'));
 }
 assert.equal(signatures.size,8);
});
test('new laptop desk moves the laptop action to its physical approach and rotated seat',()=>{
 const s=initialState();s.furnishing.placed=[{sku:'desk-air',id:1,finish:'ivory',x:7.18,z:-6.72,rotation:1}];s.furnishing.nextId=2;
 assert.ok(isNotebookDesk('desk-air'));assert.ok(!isNotebookDesk('desk-gamer'));
 const loc=laptopWorkplace(s,'alina');assert.ok(loc);assert.equal(loc.item.id,1);assert.equal(loc.pose.yaw,Math.PI*1.5);
 assert.deepEqual(laptopApproach(s,'alina'),loc.route.path.at(-1)??loc.route.from);
 const game=completeComputerGame(s,'alina',COMPUTER_GAMES[0].id,'laptop');assert.ok(game.ok);assert.equal(game.state.characters.alina.x,laptopApproach(s,'alina').x);
 for(const sku of FURNITURE_CATALOG.filter(x=>x.shape==='desk').map(x=>x.id)){
  s.furnishing.placed[0].sku=sku;s.furnishing.placed[0].rotation=0;
  assert.ok(furnitureUseLocation(s,'alina',1,'deskJournal'),sku);
 }
});

