import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildCottageLights} from '../../src/game/CottageLights';
import {buildFurniture} from '../../src/game/InteriorArt';
import {DINING_TOP} from '../../src/shared/home';
test('practicals are batched and add only one shadowless night light',()=>{
 const scene=new THREE.Scene(),lamps=buildCottageLights(scene);
 assert.equal(lamps.bedroom.visible,false);
 lamps.setLevel(1);
 assert.equal(lamps.bedroom.visible,true);
 assert.equal(lamps.bedroom.castShadow,false);
 assert.equal(lamps.bedroom.intensity,10);
 let meshes=0;lamps.group.traverse(p=>{if(p instanceof THREE.Mesh)meshes++});
 assert.ok(meshes<=3);
 lamps.setLevel(0);assert.equal(lamps.bedroom.visible,false);
 assert.equal(lamps.bedroom.intensity,0);
});
test('dark tempered tabletop retains the existing food surface height',()=>{
 let found=false;
 buildFurniture((id,model)=>{
  if(id!=='table')return;
  model.updateMatrixWorld(true);
  model.traverse(p=>{
   if(!(p instanceof THREE.Mesh)||!(p.material instanceof THREE.MeshPhysicalMaterial))return;
   found=true;const bounds=new THREE.Box3().setFromObject(p);
   assert.ok(Math.abs(bounds.max.y-DINING_TOP)<1e-5);
   assert.equal(p.material.transmission,0);
   assert.equal(p.material.transparent,true);
  });
 });
 assert.equal(found,true);
});
