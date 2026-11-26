import assert from 'node:assert/strict';
import test from 'node:test';
import {Vector3, Object3D, Raycaster} from 'three';
import {Actor} from '../../src/game/Actor';
import {initialState} from '../../src/shared/protocol';
import {furnitureUseLocation} from '../../src/shared/furnitureUse';
import {buildFurnishingModel} from '../../src/game/FurnishingArt';

test('catalog upholstery anchors face the open side and rest on the actual cushion geometry',()=>{
 for(const sku of ['sofa-luna','sofa-nord','sofa-futon','sofa-chester','sofa-micro','sofa-arc','sofa-modular','chair-cloud','chair-nest','chair-wing','chair-wicker']){
  const s=initialState();
  const item={id:1,sku,x:-2.36,z:2.02,rotation:0 as const,finish:'sage' as const};
  s.furnishing.soldFixtures=['sofa'];s.furnishing.placed=[item];
  const art=buildFurnishingModel(sku,'sage');art.updateMatrixWorld(true);
  for(const role of ['vlad','alina'] as const){
   const loc=furnitureUseLocation(s,role,1,sku.startsWith('sofa')?'sofaRest':'officeChairSit');
   assert.ok(loc,sku+' missing route');
   assert.equal(loc.pose.yaw,0,sku+' faces backrest');
   const p=loc.pose;
   const hit=new Raycaster(new Vector3(p.x-item.x,2,p.z-item.z),new Vector3(0,-1,0)).intersectObject(art,true)[0];
   assert.ok(hit,sku+' missing cushion');
   const support=p.y+(role==='vlad'?.905:.852)-.055;
   assert.ok(Math.abs(support-hit.point.y)<.105,sku+' '+role+' anchor '+support+' actual '+hit.point.y);
  }
  for(const rotation of [1,2,3] as const){
   s.furnishing.placed[0].rotation=rotation;
   const loc=furnitureUseLocation(s,'vlad',1,sku.startsWith('sofa')?'sofaRest':'officeChairSit');
   if(loc)assert.equal(loc.pose.yaw,rotation*Math.PI/2);
  }
 }
});

test('low seat rises without horizontal offset leaking onto the walking route',()=>{
 for(const role of ['vlad','alina'] as const)for(const dt of [1/60,.08,.2]){
  const a=new Actor(role,[0,0]);const body=new Vector3();
  a.setFurniturePose('sit',new Vector3(.65,-.35,0),0);
  for(let i=0;i<60;i++)a.update(1/60);
  assert.ok(a.bodyPosition(body).y<-.32);
  a.walkPath([new Vector3(0,0,3)],()=>{});
  a.bodyPosition(body);
  assert.ok(Math.hypot(body.x,body.z)<1e-6);
  assert.ok(body.y<-.32,'vertical rise must not snap');
  const rig=(a as unknown as {rig:{ankles:Object3D[]}}).rig;
  const steps=Math.round(.8/dt);
  for(let frame=0;frame<steps;frame++){
   a.update(dt);
   for(const ankle of rig.ankles)assert.ok(ankle.getWorldPosition(new Vector3()).y>-.06,'feet sank through floor '+role+' '+dt);
  }
  assert.ok(a.bodyPosition(body).y>-.055,'returns to standing height');
  assert.ok(Math.abs(a.root.position.z-1.8*steps*dt)<.001,'route speed unchanged');
 }
});

test('tall sofa seat retains visibly bent knees instead of a straight-leg perch',()=>{
 for(const role of ['vlad','alina'] as const){
  const a=new Actor(role,[0,0]);
  a.setFurniturePose('sit',new Vector3(0,.08,0),0);
  for(let f=0;f<80;f++)a.update(1/60);
  const rig=(a as unknown as {rig:{knees:Object3D[];ankles:Object3D[]}}).rig;
  assert.ok(rig.knees.every(k=>Math.abs(k.rotation.x)>.7));
  assert.ok(rig.ankles.every(k=>k.getWorldPosition(new Vector3()).y>0));
 }
});
