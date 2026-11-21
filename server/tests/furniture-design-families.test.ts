import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FURNITURE_CATALOG,FURNITURE_STYLES,furnitureStyle } from '../../src/shared/furniture';
import { buildFurnishingModel } from '../../src/game/FurnishingArt';

test('the 75 products have stable unique IDs, five populated style families and six categories',()=>{
  assert.equal(FURNITURE_CATALOG.length,75);
  const ids=new Set(FURNITURE_CATALOG.map(item=>item.id));
  assert.equal(ids.size,75);
  assert.equal(new Set(FURNITURE_CATALOG.map(item=>item.name)).size,75);
  assert.equal(new Set(FURNITURE_CATALOG.map(item=>item.category)).size,6);
  const styles=new Map(Object.keys(FURNITURE_STYLES).map(k=>[k,0]));
  for(const item of FURNITURE_CATALOG){
    const style=furnitureStyle(item.id);
    assert.ok(styles.has(style),item.id);
    styles.set(style,styles.get(style)!+1);
    assert.ok(item.price>0 && item.width>0 && item.depth>0 && item.height>0,item.id);
  }
  for(const [style,count] of styles)
    assert.ok(count>=6,`${style}: ${count} items (expected a real range)`);
});

test('the distinct designs are not identical copies of an old base mesh',()=>{
  const families=[
    ['sofa-luna','sofa-nord','sofa-chester','sofa-futon','sofa-modular'],
    ['chair-nest','chair-cloud','chair-wicker','chair-wing'],
    ['bed-solo','bed-aurora','bed-canopy','bed-platform','bed-storage'],
    ['wardrobe-tall','wardrobe-mirror','wardrobe-sliding','wardrobe-vintage'],
    ['shelf-open','shelf-wide','shelf-ladder','shelf-asym'],
    ['table-round','table-family','table-glass','table-industrial'],
    ['floor-lamp','lamp-sphere','lamp-arc','lamp-paper'],
    ['plant-ficus','plant-monstera','plant-cactus','plant-palm']
  ];
  for(const items of families){
    const signatures=items.map(id=>{
      const model=buildFurnishingModel(id,'oak');
      let vertices=0,meshes=0,components=0;
      model.traverse(part=>{
        if(!(part instanceof THREE.Mesh))return;
        meshes++;
        const attr=part.geometry.getAttribute('position');
        vertices+=attr.count;
        components+=part.geometry.index?.count ?? attr.count;
      });
      return `${meshes}:${vertices}:${components}`;
    });
    assert.equal(new Set(signatures).size,items.length,
      'structural models must differ within '+items.join(', '));
  }
});
