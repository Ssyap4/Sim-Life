import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createLocation} from '../../src/game/LocationScene';
import {addShopDetail} from '../../src/game/ShopDetail061';
import {STATIONS,CAFE_MENU} from '../../src/shared/locations';
import {PET_SHOP_FOOD} from '../../src/shared/petShop';
import {ELECTRONICS,electronicsFor,ELECTRONICS_KINDS} from '../../src/shared/electronics';
test('four shop interiors retain every interactive fixture and use one batched catalog atlas',()=>{
 for(const place of ['cafe','petshop','electronics','clothing'] as const){
  const scene=createLocation(place);
  try{
   assert.deepEqual([...scene.stations.keys()],STATIONS[place].map(s=>s.id));
   for(const station of STATIONS[place]){
    const p=scene.stations.get(station.id)!.position;
    assert.equal(p.x,station.center.x);assert.equal(p.z,station.center.z);
   }
   const detail=scene.root.getObjectByName('Shop detail 061 '+place)!;
   assert.ok(detail);
   const meshes:THREE.Mesh[]=[];detail.traverse(o=>{if(o instanceof THREE.Mesh)meshes.push(o);assert.ok(!(o instanceof THREE.Light));});
   assert.ok(meshes.length<=3,place+' '+meshes.length);
   for(const m of meshes){assert.equal(m.castShadow,false);const hits:THREE.Intersection[]=[];m.raycast(new THREE.Raycaster(),hits);assert.equal(hits.length,0);}
   assert.equal(meshes.filter(m=>m.name==='Shop detail catalog atlas').length,1);
   const labels=detail.userData.labels as {title:string;lines:string[]}[];
   const prices=(p:number)=>p.toLocaleString('ru-RU')+' ₽';
   if(place==='cafe')for(const v of Object.values(CAFE_MENU))assert.ok(labels.some(l=>l.lines.includes(v.name+'  '+prices(v.price))));
   if(place==='petshop')for(const p of PET_SHOP_FOOD)assert.ok(labels.some(l=>l.title===prices(p.price)));
   if(place==='electronics')for(const k of ELECTRONICS_KINDS)for(const id of electronicsFor(k))assert.ok(labels.some(l=>l.title===prices(ELECTRONICS[id].price)));
  }finally{scene.dispose();}
 }
 assert.equal(addShopDetail(new THREE.Group(),'home',{textures:[],materials:[]}),undefined);
});