
import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildElectronicsModel,electronicsDisplay,electronicsVariants,electronicsIds} from '../../src/game/ElectronicsArt';
import {ELECTRONICS,ELECTRONICS_KINDS,electronicsFor} from '../../src/shared/electronics';
import {createLocation,homeExtensions} from '../../src/game/LocationScene';
import {HOME_LAPTOP} from '../../src/shared/locations';
test('all showroom and household devices use the same shared authored geometry',()=>{
 for(const kind of ELECTRONICS_KINDS){
  const variants=electronicsVariants(kind);
  for(const id of electronicsIds(kind)){
   const home=variants.select(id),shop=buildElectronicsModel(id);
   assert.equal(home.userData.electronicsId,id);assert.equal(shop.userData.electronicsId,id);
   assert.equal(variants.group.children.filter(x=>x.visible).length,1);
   const bounds=new THREE.Box3().setFromObject(home),shopBounds=new THREE.Box3().setFromObject(shop);
   assert.deepEqual(bounds.min.toArray(),shopBounds.min.toArray());assert.deepEqual(bounds.max.toArray(),shopBounds.max.toArray());
   assert.ok(bounds.getSize(new THREE.Vector3()).length()>0);
   if(kind!=='phone'){const screen=electronicsDisplay(home);assert.ok(screen);assert.ok(screen.scale.x>0&&screen.scale.y>0);}
   let meshes=0;home.traverse(o=>{if(o instanceof THREE.Mesh)meshes++;});assert.ok(meshes<=12,id+' draw calls '+meshes);
  }
 }
});
test('every showroom display includes its three corresponding devices and price labels',()=>{
 const shop=createLocation('electronics');
 try{
  for(const [kind,station] of [['desktop','tech-desktop'],['laptop','tech-laptop'],['tv','tech-tv'],['phone','tech-phone'],['coffee','tech-coffee']] as const){
   const root=shop.stations.get(station)!;
   const models=root.children.filter(o=>o.userData.electronicsId);
   assert.deepEqual(models.map(o=>o.userData.electronicsId),electronicsFor(kind));
   for(const m of models){
    const box=new THREE.Box3().setFromObject(m),size=box.getSize(new THREE.Vector3());
    assert.ok(size.x<.74+1e-3,kind+' display width '+size.x);
    assert.ok(box.min.y>=.90,kind+' floats or sinks');
   }
  }
 }finally{shop.dispose();}
});
test('larger televisions differ in dimensions, and compact Mac Studio differs from tower',()=>{
 const width=(id:keyof typeof ELECTRONICS)=>new THREE.Box3().setFromObject(buildElectronicsModel(id)).getSize(new THREE.Vector3()).x;
 assert.ok(width('tvHD')<width('tv4k')&&width('tv4k')<width('tvOLED'));
 const a=buildElectronicsModel('pcCreator'),b=buildElectronicsModel('pcPro');
 const sig=(o:THREE.Group)=>{const rows:string[]=[];o.traverse(x=>{if(x instanceof THREE.Mesh){rows.push(x.geometry.getAttribute('position').count+':'+x.position.toArray().join(','));}});return rows.join('|');};
 assert.notEqual(sig(a),sig(b));
 const laptop=homeExtensions().stations.get(HOME_LAPTOP)!;assert.ok(!laptop.getObjectByName('Laptop display surface'),'no old overlapping laptop');
});
