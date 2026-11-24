import {homeExtensions} from '../../src/game/LocationScene';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildFamilyCar} from '../../src/game/FamilyCarArt';
import {CAR_PARKING,stationById} from '../../src/shared/locations';

test('SUV geometry fits parking collision, rests on four wheels, clean roof and low mobile mesh budget',()=>{
 const car=buildFamilyCar();car.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(car);
 const size=box.getSize(new THREE.Vector3()),station=stationById('home','family-car')!;
 assert.ok(size.x<=station.width+.001, 'width '+size.x);
 assert.ok(size.z<=station.depth+.001,'length '+size.z);
 assert.ok(size.z>4.7&&size.y>1.85&&size.y<1.95);
 assert.ok(box.min.y>=-.001&&box.min.y<.03);
 assert.ok(Math.abs((box.min.x+box.max.x)/2-CAR_PARKING.x)<.01);
 let meshes=0,triangles=0;
 car.traverse(obj=>{if(obj instanceof THREE.Mesh){meshes++;triangles+=(obj.geometry.index?.count??obj.geometry.attributes.position.count)/3;}});
 assert.ok(meshes<=4,'draw calls '+meshes);
 assert.ok(triangles<18000,'triangles '+triangles);
 // The roof is a single continuous surface at the highest point.
 const ray=new THREE.Raycaster(new THREE.Vector3(CAR_PARKING.x,3,CAR_PARKING.z-1),new THREE.Vector3(0,-1,0));
 const hits=ray.intersectObject(car,true);assert.ok(hits.length);assert.ok(Math.abs(hits[0].point.y-1.94)<.015);
 for(const side of [-1,1])for(const axle of [-1.53,1.53]){
  const wheelRay=new THREE.Raycaster(new THREE.Vector3(CAR_PARKING.x+side*2,.1,CAR_PARKING.z+axle),new THREE.Vector3(-side,0,0));
  assert.ok(wheelRay.intersectObject(car,true).length,'wheel '+side+'/'+axle);
 }
 console.log('SUV dimensions',size.toArray().map(n=>n.toFixed(2)).join(' x '),'meshes',meshes,'triangles',triangles);
});

test('car station is exclusively rendered by World, never a floating cupboard',()=>{
 const extensions=homeExtensions();
 assert.equal(extensions.stations.has('family-car'),false);
 assert.equal(extensions.doors.has('family-car'),false);
 assert.equal(extensions.stock.has('family-car'),false);
 assert.ok(extensions.stations.has('cupboard'));
 assert.ok(extensions.stations.has('fridge'));
});
