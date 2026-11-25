import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {buildYard} from '../../src/game/YardArt';
import {LoungeHose} from '../../src/game/LoungeHose';
import {DINING_TOP,HOME_PLACEMENTS,LOUNGE_HOOKAH,LOUNGE_HOOKAH_BASE,HOME_FLOOR,homeSeat} from '../../src/shared/home';
import {placeObstacles} from '../../src/shared/locations';
import {pointIsClear,findRoute} from '../../src/game/navigation';
import {initialState} from '../../src/shared/protocol';

test('floor hookah is outside serving tabletop and is a real obstacle without blocking either resident',()=>{
 const yard=buildYard(new THREE.Scene());
 yard.hookah.updateMatrixWorld(true);yard.table.updateMatrixWorld(true);
 const b=new THREE.Box3().setFromObject(yard.hookah);
 assert.ok(b.min.y>=0&&Math.abs(b.max.y-.87)<.02);
 assert.ok(b.min.x>HOME_PLACEMENTS.yardTable.x+1.02,JSON.stringify(b));
 assert.ok(b.containsPoint(new THREE.Vector3(LOUNGE_HOOKAH.x,LOUNGE_HOOKAH.y,LOUNGE_HOOKAH.z)));
 for(const dx of [-.57,0,.57]){
  const hit=new THREE.Raycaster(new THREE.Vector3(HOME_PLACEMENTS.yardTable.x+dx,1.3,HOME_PLACEMENTS.yardTable.z),new THREE.Vector3(0,-1,0)).intersectObject(yard.table,true)[0];
  assert.ok(hit&&Math.abs(hit.point.y-DINING_TOP)<.012);
 }
 const s=initialState(),obs=placeObstacles('home',s.furnishing);
 assert.ok(!pointIsClear(LOUNGE_HOOKAH_BASE,obs,HOME_FLOOR));
 for(const role of ['vlad','alina'] as const)assert.ok(findRoute(s.characters[role],homeSeat('yardTable',role).approach,obs,HOME_FLOOR));
 assert.equal(yard.night.visible,false);
 assert.ok(yard.night.getObjectByName('Coral evening strip'));
});
test('hose mesh reuses buffer and its two ring centers follow both endpoints',()=>{
 const hose=new LoungeHose(),p=hose.geometry.attributes.position;
 const center=(start:number)=>{const a=new THREE.Vector3();for(let j=0;j<6;j++)a.add(new THREE.Vector3().fromBufferAttribute(p,start+j));return a.divideScalar(6);};
 const a=new THREE.Vector3(1,.32,0);
 for(let i=0;i<80;i++){
  const b=new THREE.Vector3(-1,.8+i*.004,1);
  hose.updatePath(a,new THREE.Vector3(1,.05,1),new THREE.Vector3(-1,.08,1.3),b);
  assert.equal(hose.geometry.attributes.position,p);
  assert.ok(center(0).distanceTo(a)<.00001);
  assert.ok(center(p.count-6).distanceTo(b)<.00001);
  assert.ok(Array.from(p.array).every(Number.isFinite));
 }
});