import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {buildYard} from '../../src/game/YardArt';
import {lawnAt,pavingCells,YARD_PAVING,YARD_SURFACE} from '../../src/game/YardLandscape';
import {usesHomeSession} from '../homeSessions';
import {homeSeat,HOME_FLOOR} from '../../src/shared/home';
import {initialState} from '../../src/shared/protocol';
import {placeObstacles,CAR_APPROACH} from '../../src/shared/locations';
import {findRoute} from '../../src/game/navigation';
test('both solo lounge actions route through authoritative furniture presentation',()=>{
 for(const actionId of ['yardLounge','yardHookahSolo'] as const)assert.ok(usesHomeSession({type:'act',actionId}));
 for(const role of ['vlad','alina'] as const){const s=initialState(),obs=placeObstacles('home',s.furnishing);assert.ok(findRoute(s.characters[role],homeSeat('yardTable',role).approach,obs,HOME_FLOOR));assert.ok(findRoute(homeSeat('yardTable',role).approach,CAR_APPROACH,obs,HOME_FLOOR));}
});
test('lawn covers every side of house and excludes deck, driveway, interior and paths',()=>{
 for(const [x,z] of [[-12,-9],[19,-9],[0,-10],[-12,9],[18,10],[-10,15],[19,15]])assert.ok(lawnAt(x,z),x+','+z);
 for(const [x,z] of [[0,0],[12,-5],[-3.38,6.77],[14.2,8.63],[.48,12],[8,8.25]])assert.ok(!lawnAt(x,z),x+','+z);
 const scene=new THREE.Scene(),yard=buildYard(scene);scene.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(yard.landscape.turfMesh);assert.ok(Math.abs(bounds.min.x-YARD_SURFACE.minX)<.001);assert.ok(Math.abs(bounds.max.z-YARD_SURFACE.maxZ)<.001);
 const sectors=yard.landscape.sectors;assert.ok(sectors.length>=12&&sectors.length<=36);
 let count=0;const m=new THREE.Matrix4(),v=new THREE.Vector3();
 for(const sector of sectors){assert.ok(sector.parent?.parent&&sector instanceof THREE.InstancedMesh);assert.equal(sector.castShadow,false);for(let i=0;i<sector.count;i++){sector.getMatrixAt(i,m);v.setFromMatrixPosition(m);assert.ok(lawnAt(v.x,v.z));}count+=sector.count;}
 assert.ok(count>=6000&&count<=11000,'clumps '+count);assert.ok(count*6<=66000);
 const camera=new THREE.PerspectiveCamera();camera.position.set(0,100,0);yard.landscape.detail(camera,false);assert.ok(sectors.every(m=>!m.visible));camera.position.set(0,8,7);yard.landscape.detail(camera,false);assert.ok(sectors.some(m=>m.visible));
});
test('paving quads share no surface area and cover the connecting lane',()=>{
 const cells=pavingCells();for(const [i,a] of cells.entries())for(const b of cells.slice(i+1))assert.ok(Math.min(a.maxX,b.maxX)-Math.max(a.minX,b.minX)<=1e-8||Math.min(a.maxZ,b.maxZ)-Math.max(a.minZ,b.minZ)<=1e-8);
 for(const r of YARD_PAVING)assert.ok(cells.some(c=>c.minX<=(r.minX+r.maxX)/2&&c.maxX>=(r.minX+r.maxX)/2&&c.minZ<=(r.minZ+r.maxZ)/2&&c.maxZ>=(r.minZ+r.maxZ)/2));
});
