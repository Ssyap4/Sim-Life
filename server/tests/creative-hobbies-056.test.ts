import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {initialState} from '../../src/shared/protocol';
import {FURNITURE_BY_ID} from '../../src/shared/furniture';
import {furnitureUseLocation,furnitureActionList} from '../../src/shared/furnitureUse';
import {checkFurniturePlacement} from '../../src/shared/furnishingPlacement';
import {creditHobby,validFamilyLife} from '../../src/shared/familyLife';
import {planTask,evaluateTask} from '../tasks';
import {buildFurnishingModel} from '../../src/game/FurnishingArt';
import {LEISURE} from '../../src/shared/leisure';
import {openServerFiles,retirePainting} from '../storage';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const actions=['buildCottage','buildCar'] as const;
test('creative stations have real geometry, accessible front, named results and no pair action',()=>{
 const s=initialState();
 for(const [i,sku] of ['hobby-workbench'].entries()){
  const item={id:i+1,sku,finish:'oak' as const,x:i===0?10.5:13.7,z:-6.4,rotation:0 as const};
  const check=checkFurniturePlacement(s,item);assert.ok(check.valid,JSON.stringify(check));
  s.furnishing.placed.push(item);s.furnishing.nextId=i+2;
  const def=FURNITURE_BY_ID.get(sku)!,model=buildFurnishingModel(sku,'oak'),box=new THREE.Box3().setFromObject(model);
  assert.ok(box.max.y<=def.height+.001);assert.ok(box.max.y>.9);assert.ok(box.max.x-box.min.x<=def.width+.001);
  assert.equal(furnitureActionList(item).length,2);
  for(const action of furnitureActionList(item)){
   assert.equal(LEISURE[action as keyof typeof LEISURE].paired,false);
   const result=model.getObjectByName('Hobby result '+action);assert.ok(result);assert.equal(result.visible,false);assert.ok(result.children.length>0);
   for(const role of ['vlad','alina'] as const){const loc=furnitureUseLocation(s,role,item.id,action);assert.ok(loc);assert.ok(loc.pose.z>item.z+def.depth/2);}
  }
 }
});
test('completed creative tasks grant real benefits and a personal collection, not duplicate works',()=>{
 let s=initialState();s.furnishing.placed=[{id:1,sku:'hobby-workbench',finish:'oak',x:10.5,z:-6.4,rotation:0},{id:2,sku:'hobby-workbench',finish:'oak',x:13.7,z:-6.4,rotation:0}];s.furnishing.nextId=3;s.characters.vlad.fun=20;
 for(const action of actions){
  const cmd={type:'furniture_use' as const,furnitureId:2,action};
  assert.ok(planTask(cmd));assert.equal(planTask({...cmd,action:'paintFake'}),null);
  const wrong=evaluateTask(s,'vlad',{...cmd,furnitureId:99});assert.equal(wrong.ok,false);
  const done=evaluateTask(s,'vlad',cmd);assert.ok(done.ok,done.ok?'':done.reason);s=done.state;
  assert.match(creditHobby(s,'vlad',cmd),/В коллекции/);assert.equal(creditHobby(s,'vlad',cmd),'');
 }
 assert.ok(s.characters.vlad.fun>20);assert.equal(s.familyLife?.hobbies.vlad.modeling?.sessions,1);
 assert.deepEqual(s.familyLife?.hobbies.vlad.modeling?.unique,actions);assert.ok(validFamilyLife(s.familyLife));
 const dir=mkdtempSync(join(tmpdir(),'hobbies-056-'));try{const files=openServerFiles(dir);files.save(s);assert.deepEqual(files.load().familyLife,s.familyLife);}finally{rmSync(dir,{recursive:true,force:true});}
});

test('works stay on their actual station and modeling is preserved',()=>{
 const s=initialState();s.furnishing.placed=[{id:1,sku:'hobby-workbench',finish:'oak',x:10.5,z:-6.4,rotation:0},{id:2,sku:'hobby-workbench',finish:'oak',x:13.7,z:-6.4,rotation:0}];s.furnishing.nextId=3;
 const work=(role:'vlad'|'alina',id:number,action:'buildCottage'|'buildCar')=>creditHobby(s,role,{type:'furniture_use',furnitureId:id,action});
 work('vlad',1,'buildCottage');work('alina',2,'buildCar');assert.deepEqual(s.familyLife?.displayWorks,{'1':'buildCottage','2':'buildCar'});
 work('vlad',1,'buildCar');assert.equal(work('vlad',1,'buildCottage'),'');assert.equal(s.familyLife?.displayWorks?.['1'],'buildCottage');assert.equal(s.familyLife?.hobbies.vlad.modeling?.unique.length,2);
 for(const a of actions){const model=buildFurnishingModel('hobby-workbench','oak');const result=model.getObjectByName('Hobby result '+a)!;for(let i=0;i<3;i++){const stage=result.getObjectByName('Hobby stage '+i);assert.ok(stage&&stage.children.length>0);}}
});
test('retired art is not in the catalogue or actions, and old saves keep unrelated progress',()=>{
 assert.equal(FURNITURE_BY_ID.has('hobby-easel'),false);
 assert.equal(planTask({type:'furniture_use',furnitureId:1,action:'paintLandscape'} as any),null);
 const s=initialState();const raw=s as any;
 raw.furnishing.placed.push({id:1,sku:'hobby-easel',finish:'oak',x:10.5,z:-6.4,rotation:0});
 raw.furnishing.stored.push({id:2,sku:'hobby-easel',finish:'oak'});
 raw.furnishing.orders.push({id:3,sku:'hobby-easel',finish:'oak',readyAt:100,shipping:'regular'});
 raw.furnishing.placed.push({id:4,sku:'hobby-workbench',finish:'oak',x:13.7,z:-6.4,rotation:0});raw.furnishing.nextId=5;
 raw.familyLife.hobbies.vlad.painting={sessions:1,unique:['paintLandscape'],lastDay:1};
 raw.familyLife.hobbies.vlad.modeling={sessions:1,unique:['buildCar'],lastDay:1};
 raw.familyLife.displayWorks={'1':'paintLandscape','4':'buildCar'};
 raw.familyLife.event={id:'creativeDay',day:1,status:'accepted'};
 const before=s.money;retirePainting(raw);retirePainting(raw);
 assert.equal(s.money,before);assert.equal(s.furnishing.placed.length,1);assert.equal(s.furnishing.orders.length,0);assert.equal(s.furnishing.stored.length,0);
 assert.deepEqual(s.familyLife?.displayWorks,{'4':'buildCar'});assert.equal(raw.familyLife.hobbies.vlad.painting,undefined);assert.equal(s.familyLife?.hobbies.vlad.modeling?.sessions,1);assert.equal(s.familyLife?.event,undefined);assert.ok(validFamilyLife(s.familyLife));
 const dir=mkdtempSync(join(tmpdir(),'retired-art-'));try{const files=openServerFiles(dir);files.save(s);assert.deepEqual(files.load().familyLife,s.familyLife);}finally{rmSync(dir,{recursive:true,force:true});}
});
