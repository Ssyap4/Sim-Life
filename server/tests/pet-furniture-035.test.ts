import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {initialState} from '../../src/shared/protocol';
import {FURNITURE_CATALOG,RETIRED_PET_PRODUCTS,STARTER_PET_PRODUCTS,isValidFurnishing} from '../../src/shared/furniture';
import {buildFurnishingModel} from '../../src/game/FurnishingArt';
import {catPerchCandidates} from '../../src/shared/CatPerches';
import {isPetBed,isPetScratcher} from '../../src/shared/petFurniture';
import {applyWorld} from '../locations';
import {approachFor,stationById} from '../../src/shared/locations';
import {applyFurnishing} from '../furnishing';
test('all nine new pet products have bounded physical models; old SKUs cannot be purchased',()=>{
 const catalog=FURNITURE_CATALOG.filter(p=>p.category==='pets');assert.equal(catalog.length,9);
 const signatures=new Set<string>();
 for(const p of [...catalog,...STARTER_PET_PRODUCTS]){
  const m=buildFurnishingModel(p.id,'sage'),box=new THREE.Box3().setFromObject(m),size=box.getSize(new THREE.Vector3());
  assert.ok(size.x<=p.width+.025&&size.z<=p.depth+.025&&size.y<=p.height+.025,p.id+' '+size.toArray());
  signatures.add(size.toArray().map(x=>x.toFixed(3)).join(','));
  if(p.id.startsWith('pet-house-')){
   const s=initialState();s.furnishing.placed=[{id:1,sku:p.id,finish:'sage',x:3.85,z:1.9,rotation:1}];
   const anchors=catPerchCandidates(s.furnishing).filter(v=>v.key.startsWith('placed:1:'));
   assert.equal(anchors.length,2);assert.ok(anchors.every(v=>v.surface.y<=p.height+.10));
  }
 }
 assert.ok(signatures.size>=8);
 for(const p of RETIRED_PET_PRODUCTS){assert.ok(!catalog.some(v=>v.id===p.id));assert.equal(applyFurnishing(initialState(),'vlad',{type:'furniture_order',sku:p.id,finish:'sage',quantity:1,shipping:'regular'},480).ok,false);}
 assert.equal(catalog.filter(p=>isPetBed(p.id,'verdell')).length,2);
 assert.equal(catalog.filter(p=>isPetBed(p.id,'simba')).length,2);
 assert.equal(catalog.filter(p=>isPetScratcher(p.id)).length,3);
});
test('pet furniture purchase requires real checkout, deducts exact price, and can be placed at home',()=>{
 let s=initialState();s.money=100000;
 const p=FURNITURE_CATALOG.find(p=>p.id==='pet-bed-dog-nest')!;
 assert.equal(applyWorld(s,'vlad',{type:'pet_furniture_buy',sku:p.id}).ok,false);
 Object.assign(s.characters.vlad,approachFor(stationById('home','family-car')!,'vlad'));
 const trip=applyWorld(s,'vlad',{type:'car_travel',place:'petshop'});assert.ok(trip.ok);s=trip.state;
 Object.assign(s.characters.vlad,approachFor(stationById('petshop','pet-cash')!,'vlad'));
 for(const sku of ['pet-bed-verdell','pet-house-nook','sofa-nord'])assert.equal(applyWorld(s,'vlad',{type:'pet_furniture_buy',sku}).ok,false);
 const buy=applyWorld(s,'vlad',{type:'pet_furniture_buy',sku:p.id});assert.ok(buy.ok);s=buy.state;
 assert.equal(s.money,100000-p.price);assert.ok(isValidFurnishing(s.furnishing));const item=s.furnishing.stored[0];
 Object.assign(s.characters.vlad,approachFor(stationById('petshop','pet-exit')!,'vlad'));
 const back=applyWorld(s,'vlad',{type:'travel',place:'district',via:'pet-exit'});assert.ok(back.ok);
 const placed=applyFurnishing(back.state,'vlad',{type:'furniture_place',id:item.id,x:-2.90,z:3.34,rotation:0},480);assert.ok(placed.ok);
 assert.equal(placed.state.furnishing.placed[0].sku,p.id);
});
