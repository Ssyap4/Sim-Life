import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {adjustHeight,protectCameraFloor,CAMERA_FLOOR} from '../../src/game/CameraHeight';
test('vertical controls preserve zoom and azimuth at every distance',()=>{
 for(const r of [2,10,20,50,100]){
  const target=new THREE.Vector3(2,.9,4),eye=target.clone().add(new THREE.Vector3(.4,.6,.8).normalize().multiplyScalar(r));
  const original=eye.clone(),azimuth=Math.atan2(eye.x-target.x,eye.z-target.z);
  adjustHeight(eye,target,-1,.1);
  assert.ok(eye.y<original.y);
  assert.ok(Math.abs(eye.distanceTo(target)-r)<1e-8);
  assert.ok(Math.abs(Math.atan2(eye.x-target.x,eye.z-target.z)-azimuth)<1e-8);
  adjustHeight(eye,target,1,.1);
  assert.ok(eye.distanceTo(original)<1e-8);
 }
});
test('held arrows reach safe endpoints without passing through the floor',()=>{
 for(const r of [3.4,10,20,100]){
  const target=new THREE.Vector3(0,1,0),eye=new THREE.Vector3(0,1+r*.6,r*.8);
  for(let i=0;i<600;i++)adjustHeight(eye,target,-1,1/60);
  assert.ok(eye.y>=1.55-1e-8&&eye.y<1.6);
  assert.ok(Math.abs(eye.distanceTo(target)-r)<1e-7);
  for(let i=0;i<600;i++)adjustHeight(eye,target,1,1/60);
  assert.ok(eye.y>1+r*.9);
  assert.ok(Math.abs(eye.distanceTo(target)-r)<1e-7);
 }
});
test('floor correction preserves the complete view vector',()=>{
 const eye=new THREE.Vector3(0,-2,3),target=new THREE.Vector3(0,-3,0);
 const offset=eye.clone().sub(target);
 protectCameraFloor(eye,target);
 assert.ok(eye.y>=CAMERA_FLOOR-1e-8);
 assert.ok(eye.clone().sub(target).distanceTo(offset)<1e-8);
});
