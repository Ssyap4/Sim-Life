import test from 'node:test';
import assert from 'node:assert/strict';
import {Actor} from '../../src/game/Actor';
import {createShopToy} from '../../src/game/PetToys';
import {Vector3,Group,Line,Object3D,BufferAttribute} from 'three';
test('both resident rigs grip each manual toy exactly and tether ends meet the actual target',()=>{
 for(const id of ['vlad','alina'] as const){
  const actor=new Actor(id,[1,2]),rig=actor as unknown as {rig:{wrists:Object3D[]};catToyLine:Line;catToyGrip:Group};
  for(const kind of ['wand','string','laser','bell'] as const)for(const angle of [0,1.3,-2.5]){
   actor.update(1/30);
   const target=new Vector3(1+Math.sin(angle)*1.6,.2,2+Math.cos(angle)*1.6);
   actor.manualCatToy(kind,target,true);
   const qa=actor.catToyQA();
   assert.equal(qa.held,kind!=='bell');assert.equal(qa.line,kind==='wand'||kind==='string');
   if(qa.held)assert.ok(rig.catToyGrip.getWorldPosition(new Vector3()).distanceTo(rig.rig.wrists[1].localToWorld(new Vector3(0,-.055,0)))<.001);
   if(qa.line){const a=rig.catToyLine.geometry.getAttribute('position') as BufferAttribute;const end=actor.root.localToWorld(new Vector3().fromBufferAttribute(a,2));assert.ok(end.distanceTo(target)<.001);}
  }
  actor.manualCatToy('wand',new Vector3(1,.2,3),false);assert.equal(actor.catToyQA().line,false);
  actor.manualCatToy();assert.equal(actor.catToyQA().held,false);
  actor.playDomesticActivity('read');actor.manualCatToy('laser',new Vector3(1,0,3),true);assert.equal(actor.catToyQA().held,false);
 }
});
test('shop laser is a handheld object; floor laser is a small distinct dot; floor wand has no duplicate shaft',()=>{
 const shop=createShopToy('mouse','laser'),floor=createShopToy('mouse','laser',true);assert.equal(shop.children.length,2);assert.equal(floor.children.length,1);
 assert.equal(createShopToy('feather','wand').children.length,2);assert.equal(createShopToy('feather','wand',true).children.length,1);
});
