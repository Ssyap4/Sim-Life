import test from 'node:test';
import assert from 'node:assert/strict';
import {Group} from 'three';
import {GARMENTS, WARDROBE_LOOKS, fitWardrobe, outfitChoices} from '../../src/game/Wardrobe';

test('complete looks use the correct character and hide forearms only for long sleeves',()=>{
 for(const id of ['alina','vlad'] as const){
  const model=new Group();
  const arm=new Group();arm.userData.bodyRegion='forearms';model.add(arm);
  for(const g of GARMENTS.filter(g=>g.fit===id+'-021')){
   const part=new Group();part.userData={garmentId:g.id,garmentFit:g.fit,garmentSlot:g.slot,garmentDefault:g.id.includes('-signature-')};model.add(part);
  }
  for(const look of WARDROBE_LOOKS){
   const choice=fitWardrobe(model,id,outfitChoices(look));
   assert.equal(choice.get('upper'),id+'-'+look+'-upper');
   assert.equal(choice.get('lower'),id+'-'+look+'-lower');
   assert.equal(choice.get('footwear'),id+'-signature-footwear');
   assert.equal(arm.visible,!(look==='cozy'||look==='street'||(look==='signature'&&id==='alina')));
   assert.equal(model.children.filter(p=>p.visible&&p.userData.garmentId).length,3);
  }
 }
 assert.deepEqual(outfitChoices('invalid'),[]);
});
