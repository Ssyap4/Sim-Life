import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildFurnishingModel } from '../../src/game/FurnishingArt';
import { FURNITURE_CATALOG, FINISH_IDS } from '../../src/shared/furniture';

test('all 75 shop models stay in their documented physical footprint',()=>{
  assert.equal(FURNITURE_CATALOG.length,75);
  for(const item of FURNITURE_CATALOG){
    const model=buildFurnishingModel(item.id,'oak');
    const bounds=new THREE.Box3().setFromObject(model);
    const size=new THREE.Vector3();
    bounds.getSize(size);
    assert.ok(size.x>0.02&&size.y>0.005&&size.z>0.005,item.id+': invisible model');
    assert.ok(size.x<=item.width+0.0001,item.id+': exceeds width');
    assert.ok(size.y<=item.height+0.0001,item.id+': exceeds height');
    assert.ok(size.z<=item.depth+0.0001,item.id+': exceeds depth');
    assert.ok(bounds.min.y>=-0.0001,item.id+': below floor');
  }
});

test('every finish is rendered from the same physical model as catalog preview',()=>{
  const samples=['table-round','sofa-arc','wardrobe-mirror','plant-monstera','mirror-arch'];
  for(const id of samples){
    const reference=buildFurnishingModel(id,'oak');
    const refBounds=new THREE.Box3().setFromObject(reference);
    const refSize=new THREE.Vector3();
    refBounds.getSize(refSize);
    for(const finish of FINISH_IDS){
      const model=buildFurnishingModel(id,finish);
      const bounds=new THREE.Box3().setFromObject(model);
      const size=new THREE.Vector3();
      bounds.getSize(size);
      assert.ok(size.distanceTo(refSize)<.00001,`${id}/${finish}: colour changed geometry`);
    }
  }
});
