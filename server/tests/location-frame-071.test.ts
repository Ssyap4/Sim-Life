import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createLocation} from '../../src/game/LocationScene';
import {portraitHomeFrame} from '../../src/game/HomeFrame';

test('indoor location overview fits full architecture on narrow phone screens',()=>{
 for(const place of ['grooming','buildshop','cafe','clothing','petshop','education','work-clinic','work-detail','work-it','work-marketing'] as const){
  const scene=createLocation(place);
  try{
   assert.deepEqual(scene.horizontal,scene.vertical,place);
   for(const [w,h] of [[320,568],[390,844],[360,780],[430,932]]){
    const band={top:100/h,bottom:1-66/h},aspect=w/h,fov=46;
    const frame=portraitHomeFrame(fov,aspect,band,scene.horizontal,scene.vertical,[.24,.98,1.10],88);
    const camera=new THREE.PerspectiveCamera(fov,aspect,.1,110);camera.position.copy(frame.position);camera.lookAt(frame.target);camera.updateMatrixWorld(true);
    for(const point of scene.vertical){const p=new THREE.Vector3(...point).project(camera);assert.ok(Math.abs(p.x)<.95&&p.z<1,place+' '+w+' '+JSON.stringify(p));assert.ok((1-p.y)/2>band.top&&(1-p.y)/2<band.bottom,place+' '+w);}
   }
  }finally{scene.dispose();}
 }
});
