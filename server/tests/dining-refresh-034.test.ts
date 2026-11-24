
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {FURNITURE_CATALOG,FURNITURE_BY_ID,PURCHASABLE_FURNITURE,RETIRED_DINING,diningSeatTop} from '../../src/shared/furniture';
import {buildFurnishingModel} from '../../src/game/FurnishingArt';
import {initialState} from '../../src/shared/protocol';
import {applyFurnishing} from '../furnishing';
import {diningLocation,furnitureUseLocation} from '../../src/shared/furnitureUse';
import {diningSurface} from '../../src/shared/diningSurface';
import {evaluateTask} from '../tasks';
import {RECIPES} from '../../src/shared/food';
import {addReadyFood} from '../../src/shared/readyFood';
test('all twelve previous dining products are retired; 18 fresh designs are orderable',()=>{
 const s=initialState();s.money=100000;
 for(const p of RETIRED_DINING){assert.ok(FURNITURE_BY_ID.has(p.id));assert.ok(!PURCHASABLE_FURNITURE.some(x=>x.id===p.id));assert.equal(applyFurnishing(s,'vlad',{type:'furniture_order',sku:p.id,finish:'oak',shipping:'regular',quantity:1},0).ok,false);}
 const models=FURNITURE_CATALOG.filter(x=>['table','chair','stool'].includes(x.shape));
 assert.equal(models.length,18);
 const signatures=new Set();
 for(const p of models){
  assert.ok(applyFurnishing(s,'vlad',{type:'furniture_order',sku:p.id,finish:'oak',shipping:'regular',quantity:1},0).ok);
  const model=buildFurnishingModel(p.id,'oak'),b=new THREE.Box3().setFromObject(model);
  assert.ok(b.max.y<=p.height+.001,p.id);
  assert.ok(b.max.x<=p.width/2+.001&&b.min.x>=-p.width/2-.001,p.id);
  assert.ok(b.max.z<=p.depth/2+.001&&b.min.z>=-p.depth/2-.001,p.id);
  if(p.shape==='table'&&p.height>.63)assert.ok(Math.abs(b.max.y-p.height)<.01,p.id+' food height');
  let n=0;model.traverse(o=>{if(o instanceof THREE.Mesh)n+=o.geometry.getAttribute('position').count;});signatures.add([p.width,p.depth,n].join(':'));
 }
 assert.equal(signatures.size,18);
});
test('new dining chairs face the actual table and match the seat surface; no invisible seating',()=>{
 const s=initialState();s.furnishing.soldFixtures=['table'];s.furnishing.placed=[
 {id:1,sku:'table-haven',finish:'oak',x:2.39,z:-2.22,rotation:0},
 {id:2,sku:'chair-mellow',finish:'oak',x:2.39,z:-.91,rotation:2}
 ];s.furnishing.nextId=3;
 assert.equal(diningSurface(s).height,.76);
 const seated=diningLocation(s,'vlad',1);assert.ok(seated?.seated);
 assert.equal(seated.pose.yaw,Math.PI);assert.equal(seated.pose.y,.45-.905);
 assert.equal(diningSeatTop('chair-mellow'),.45);
 const recipe=Object.keys(RECIPES)[0] as keyof typeof RECIPES;s.meals[recipe]=2;addReadyFood(s,'meal',recipe,2,'table');
 const ate=evaluateTask(s,'vlad',{type:'eat',recipe,furnitureId:1});assert.ok(ate.ok);assert.equal(ate.state.characters.vlad.pose,'sit');
 assert.ok(evaluateTask(s,'vlad',{type:'furniture_use',furnitureId:1,action:'tableRest'}).ok);
 s.furnishing.placed[1].rotation=0;assert.equal(diningLocation(s,'vlad',1)?.seated,false);
 assert.equal(evaluateTask(s,'vlad',{type:'furniture_use',furnitureId:1,action:'tableRest'}).ok,false);
 const seat=furnitureUseLocation(s,'alina',2,'officeChairSit');assert.ok(seat);assert.equal(seat.pose.y,.45-.852);
});

