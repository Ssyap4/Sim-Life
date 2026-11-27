import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {addLocationFinish,finishedLocations} from '../../src/game/LocationFinish061';
import {STATIONS} from '../../src/shared/locations';
import {cube,plane} from '../../src/game/ArtKit';
test('each indoor location gets lightweight trim and a flush, noninteractive exit marker where applicable',()=>{
 for(const place of finishedLocations){
  const root=new THREE.Group(),resources={textures:[],materials:[]};
  const g=addLocationFinish(root,place,resources)!;
  assert.ok(g&&g.parent===root);
  const meshes:THREE.Mesh[]=[];g.traverse(o=>{if(o instanceof THREE.Mesh)meshes.push(o);});
  assert.ok(meshes.length<=3,place+' draw calls '+meshes.length);
  assert.ok(meshes.every(m=>!m.castShadow));
  for(const m of meshes){const hits:THREE.Intersection[]=[];m.raycast(new THREE.Raycaster(),hits);assert.equal(hits.length,0);}
  const exit=STATIONS[place].find(s=>s.action.kind==='door'&&s.action.destination==='district');
  const mat=g.getObjectByName('Exit approach mat');
  assert.equal(!!mat,!!exit);
  if(mat&&exit){assert.equal(mat.position.x,exit.center.x);assert.ok(mat.position.y<.04);assert.ok(mat.position.z<exit.center.z);}
  for(const m of meshes)if(m.geometry!==cube&&m.geometry!==plane)m.geometry.dispose();
  for(const m of resources.materials as THREE.Material[])m.dispose();
 }
 for(const place of ['home','park','lake','industrial','district'] as const)assert.equal(addLocationFinish(new THREE.Group(),place,{textures:[],materials:[]}),undefined);
});