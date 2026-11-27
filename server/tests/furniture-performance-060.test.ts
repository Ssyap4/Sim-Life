import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {reconcileFurnitureModels,disposeFurnitureModel} from '../../src/game/FurnitureModels';
import {cube,plane,torus,finish} from '../../src/game/ArtKit';
import {createLocation} from '../../src/game/LocationScene';
import type {PlacedFurniture} from '../../src/shared/furniture';

test('Move one of 50 furniture items without recreating or disposing any of their models',()=>{
 const models=new Map<number,THREE.Group>(),created:number[]=[],removed:THREE.Group[]=[];
 const items:PlacedFurniture[]=Array.from({length:50},(_,i)=>({id:i+1,sku:'bed-aurora',finish:'sage',x:i,z:0,rotation:0}));
 const reconcile=(placed:PlacedFurniture[])=>reconcileFurnitureModels(models,placed,item=>{created.push(item.id);return new THREE.Group();},model=>removed.push(model),(model,item)=>{model.position.set(item.x,.01,item.z);model.rotation.y=item.rotation*Math.PI/2;});
 reconcile(items);const original=[...models.values()];created.length=0;
 reconcile(items.map(item=>item.id===17?{...item,x:32,z:5,rotation:1}:item));
 assert.equal(created.length,0);assert.equal(removed.length,0);assert.deepEqual([...models.values()],original);
 assert.equal(models.get(17)!.position.x,32);assert.equal(models.get(17)!.rotation.y,Math.PI/2);
 reconcile(items.filter(item=>item.id!==17));
 assert.equal(removed.length,1);assert.equal(removed[0],original[16]);assert.equal(created.length,0);
 reconcile(items);
 assert.deepEqual(created,[17]);assert.equal(models.get(1),original[0]);
});
test('Furniture cleanup deduplicates owned buffers and never frees shared geometry/materials',()=>{
 const g=new THREE.Group(),owned=new THREE.BoxGeometry(),mat=finish(0xffffff),shader=new THREE.ShaderMaterial();
 let released=0,sharedReleased=0,materials=0,shaderReleased=0;
 owned.addEventListener('dispose',()=>released++);for(const shape of [cube,plane,torus])shape.addEventListener('dispose',()=>sharedReleased++);
 mat.addEventListener('dispose',()=>materials++);shader.addEventListener('dispose',()=>shaderReleased++);
 g.add(new THREE.Mesh(owned,mat),new THREE.Mesh(owned,mat),new THREE.Mesh(cube,mat),new THREE.Mesh(plane,shader),new THREE.Mesh(torus,mat));
 disposeFurnitureModel(g);assert.equal(released,1);assert.equal(sharedReleased,0);assert.equal(materials,0);assert.equal(shaderReleased,1);
});
test('Park, lake and SPA release their instance buffers and clear station references on exit',()=>{
 for(const place of ['park','lake','spa'] as const){
  const scene=createLocation(place);let count=0,released=0;
  scene.root.traverse(o=>{if(o instanceof THREE.InstancedMesh){count++;o.addEventListener('dispose',()=>released++);}});
  assert.ok(count>0,place);scene.dispose();assert.equal(released,count,place);assert.equal(scene.stations.size,0);assert.equal(scene.root.children.length,0);
  scene.dispose();assert.equal(released,count);
 }
});