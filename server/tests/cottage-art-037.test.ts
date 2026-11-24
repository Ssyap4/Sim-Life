import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {cottageRooms,cottageFloor,timberWall} from '../../src/game/CottageArt';
import {HOUSE,HOUSE_WING} from '../../src/shared/home';
test('room finish atlas covers the original house once, without gaps or overlaps',()=>{
 const area=cottageRooms.reduce((a,r)=>a+(r.x2-r.x1)*(r.z2-r.z1),0);
 assert.ok(Math.abs(area-(HOUSE.maxX-HOUSE.minX)*(HOUSE.maxZ-HOUSE.minZ))<1e-6);
 for(let i=0;i<cottageRooms.length;i++)for(let j=i+1;j<cottageRooms.length;j++){
  const a=cottageRooms[i],b=cottageRooms[j];assert.ok(Math.min(a.x2,b.x2)<=Math.max(a.x1,b.x1)||Math.min(a.z2,b.z2)<=Math.max(a.z1,b.z1));
 }
 assert.ok(new Set(cottageRooms.map(r=>r.style)).size>=5);
});
test('floor is a single mesh per atlas and retains original extents',()=>{
 for(const wing of [false,true]){
  const group=new THREE.Group(),m=cottageFloor(group,wing),bounds=new THREE.Box3().setFromObject(group),b=wing?HOUSE_WING:HOUSE;
  assert.equal(group.children.length,1);assert.equal(m.geometry.getAttribute('position').count,4);
  for(const [a,v] of [[bounds.min.x,b.minX],[bounds.max.x,b.maxX],[bounds.min.z,b.minZ],[bounds.max.z,b.maxZ]])assert.ok(Math.abs(a-v)<1e-5);
 }
});
test('timber courses retain wall dimensions, shared material and aligned UVs',()=>{
 const g=new THREE.Group(),a=timberWall(g,[3,2,.24],[0,1,0]),b=timberWall(g,[.19,.43,4],[2,.215,2]);
 assert.equal(a.material,b.material);
 assert.ok(Array.from(a.geometry.getAttribute('uv').array).every(Number.isFinite));
 const box=new THREE.Box3().setFromObject(a);assert.ok(Math.abs(box.max.y-2)<1e-6&&Math.abs(box.min.x+1.5)<1e-6);
});
