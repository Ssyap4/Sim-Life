import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {HOME_DOORS,HOUSE,HOUSE_WING} from '../../src/shared/home';
import {addPassageFinish,addRearFinish,batchPassageFinishes,DOOR_CLEAR_HEIGHT} from '../../src/game/HomeFinish';

test('all eight passages retain their opening and clear a standing character',()=>{
 const passages=[...Object.values(HOME_DOORS).map(p=>({p,axis:'x' as const})),
  {p:{x:HOUSE.maxX,...HOUSE_WING.connector},axis:'x' as const},
  ...HOUSE_WING.crossWalls.map(z=>({p:{x:HOUSE_WING.crossDoor.x,z,width:HOUSE_WING.crossDoor.width},axis:'z' as const}))];
 for(const {p,axis} of passages){
  const g=new THREE.Group(),frame=addPassageFinish(g,p,axis);
  g.updateMatrixWorld(true);
  assert.equal(frame.children.length,1,'one batched draw per frame');
  const mesh=frame.children[0] as THREE.Mesh;
  const pos=mesh.geometry.getAttribute('position'),v=new THREE.Vector3();
  for(let i=0;i<pos.count;i++){
   v.fromBufferAttribute(pos,i);
   if(v.y>.025&&v.y<DOOR_CLEAR_HEIGHT-.001)assert.ok(Math.abs(v.z)>=p.width/2-.001,'jamb intrudes into opening');
  }
  assert.ok(new THREE.Box3().setFromObject(frame).max.y>2.3);
  assert.equal(new THREE.Raycaster(new THREE.Vector3(p.x,1.7,p.z),new THREE.Vector3(0,1,0)).intersectObject(frame,true).length,0);
 }
});
test('rear detailing stays mounted within the rear wall strip',()=>{
 const g=new THREE.Group(),root=addRearFinish(g),box=new THREE.Box3().setFromObject(root);
 assert.ok(box.min.x>=HOUSE.minX&&box.max.x<=HOUSE_WING.maxX);
 assert.ok(box.min.z>=HOUSE.minZ&&box.max.z<HOUSE.minZ+.24);
 assert.ok(root.children.length<=3);
});
test('static doorway batching preserves all triangles, world bounds and pass-through picking',()=>{
 const g=new THREE.Group();
 for(const [x,z,axis] of [[-2,-3,'x'],[3,1,'z'],[5,4,'x']] as const)addPassageFinish(g,{x,z,width:1.2},axis);
 g.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(g);
 const originals=g.children.map(f=>(f.children[0] as THREE.Mesh).geometry);
 const triangles=originals.reduce((sum,geo)=>sum+geo.index!.count/3,0);
 let releases=0;originals.forEach(geo=>geo.addEventListener('dispose',()=>releases++));
 batchPassageFinishes(g);
 assert.equal(g.children.length,1);
 const mesh=g.children[0] as THREE.Mesh;
 assert.equal(mesh.geometry.index!.count/3,triangles);
 assert.equal(releases,3);
 const after=new THREE.Box3().setFromObject(g);
 assert.ok(after.min.distanceTo(bounds.min)<1e-5&&after.max.distanceTo(bounds.max)<1e-5);
 assert.equal(new THREE.Raycaster(new THREE.Vector3(-2,1.7,-3),new THREE.Vector3(0,1,0)).intersectObject(g,true).length,0);
 batchPassageFinishes(g);assert.equal(g.children[0],mesh);
});