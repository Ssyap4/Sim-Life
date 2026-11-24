import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildFamilyCar} from '../../src/game/FamilyCarArt';
import {finishSurface} from '../../src/game/ArtKit';
import {CAR_APPROACH,CAR_PARKING,placeObstacles} from '../../src/shared/locations';
import {HOME_FLOOR,HOME_STROLL_STOPS,GRILL_WORK,homeSeat} from '../../src/shared/home';
import {findRoute,pointIsClear,segmentIsClear} from '../../src/game/navigation';
import {initialState} from '../../src/shared/protocol';
import {planLeisure} from '../home';
test('windshield is the first front-facing surface across the full glass, not the body',()=>{
 const car=buildFamilyCar();car.updateMatrixWorld(true);
 for(const x of [-.65,-.32,0,.32,.65])for(const y of [1.30,1.52,1.73]){
  const from=car.localToWorld(new THREE.Vector3(x,y,3.3));
  const direction=new THREE.Vector3(0,0,-1).transformDirection(car.matrixWorld);
  const hit=new THREE.Raycaster(from,direction).intersectObject(car,true)[0];
  assert.ok(hit,x+'/'+y);
  assert.equal(finishSurface((hit.object as THREE.Mesh).material as THREE.Material),'screen',x+'/'+y);
 }
});
test('parking on right, access and grill remain reachable from inside and yard',()=>{
 const s=initialState(),obstacles=placeObstacles('home',s.furnishing);
 assert.ok(CAR_PARKING.x>6);
 for(const target of [CAR_APPROACH,GRILL_WORK.position,homeSeat('yardTable','vlad').approach,homeSeat('yardTable','alina').approach,...HOME_STROLL_STOPS]){
  assert.ok(pointIsClear(target,obstacles,HOME_FLOOR),JSON.stringify(target));
  for(const start of [s.characters.vlad,{x:.48,z:6.3}]){
   const path=findRoute(start,target,obstacles,HOME_FLOOR);assert.ok(path,JSON.stringify(target));
  }
 }
 assert.ok(segmentIsClear({x:5.1,z:8.1},{x:6.95,z:8.1},obstacles,HOME_FLOOR));
});
test('full autonomy alone can choose a real garden stroll with valid segments',()=>{
 const s=initialState();
 for(const role of ['vlad','alina'] as const){
  assert.equal(planLeisure(s,role,'stroll'),null);
  s.autonomy[role]='needs';assert.equal(planLeisure(s,role,'stroll'),null);
  s.autonomy[role]='full';const route=planLeisure(s,role,'stroll');assert.ok(route);
  let prev=route.from;
  for(const p of route.path){assert.ok(segmentIsClear(prev,p,placeObstacles('home',s.furnishing),HOME_FLOOR));prev=p;}
  assert.ok(HOME_STROLL_STOPS.some(p=>Math.hypot(p.x-prev.x,p.z-prev.z)<.02));
 }
});
