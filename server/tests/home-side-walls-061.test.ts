import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {HOUSE,HOUSE_WING,HOME_WALLS,HOME_STRUCTURE_OBSTACLES,HOME_FLOOR} from '../../src/shared/home';
import {buildHomeSideWalls,HOME_WALL_HEIGHT,SIDE_CUT_HEIGHT,sideWallCutaway} from '../../src/game/HomeSideWalls';
import {timberWall} from '../../src/game/CottageArt';
import {segmentIsClear} from '../../src/game/navigation';

test('both actual outer walls match rear timber and height without closing the wing connector',()=>{
 const scene=new THREE.Scene(),walls=buildHomeSideWalls(scene);
 const ref=timberWall(new THREE.Group(),[1,HOME_WALL_HEIGHT,.24],[0,HOME_WALL_HEIGHT/2,0]);
 for(const wall of walls.walls){
  const box=new THREE.Box3().setFromObject(wall.root);
  const x=wall.side==='west'?HOUSE.minX:HOUSE_WING.maxX;
  assert.ok(Math.abs((box.min.x+box.max.x)/2-x)<.001);
  assert.ok(Math.abs(box.max.y-(HOME_WALL_HEIGHT+.05))<.001);
  assert.ok(Math.abs(box.max.z-HOUSE.maxZ)<.001);
  assert.ok(wall.upper.children.some(o=>o instanceof THREE.Mesh&&o.material===ref.material));
 }
 const z=HOUSE_WING.connector.z;
 assert.ok(!HOME_WALLS.some(w=>w.minX<=HOUSE.maxX&&w.maxX>=HOUSE.maxX&&w.minZ<=z&&w.maxZ>=z));
 assert.ok(segmentIsClear({x:HOUSE.maxX-.8,z},{x:HOUSE.maxX+.8,z},HOME_STRUCTURE_OBSTACLES,HOME_FLOOR));
});
test('camera reveals far timber wall and keeps the foreground cutaway independently',()=>{
 const {walls,update}=buildHomeSideWalls(new THREE.Scene());
 const check=(eye:number,target:number,west:boolean,east:boolean)=>{
  update(eye,target);
  assert.deepEqual(walls.map(w=>w.upper.visible),[west,east]);
  assert.deepEqual(walls.map(w=>w.cutCap.visible),[!west,!east]);
 };
 check(3,3,true,true);check(-21,-5,false,true);check(26,11,true,false);check(-7,-6,true,true);
 assert.equal(sideWallCutaway('west',-21,-25),false);
 assert.ok(SIDE_CUT_HEIGHT<1);
});