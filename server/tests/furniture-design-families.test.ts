import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FURNITURE_CATALOG,FURNITURE_STYLES,furnitureStyle } from '../../src/shared/furniture';
import { buildFurnishingModel } from '../../src/game/FurnishingArt';

test('the 0.28 catalogue has unique IDs, five style families and all seven categories',()=>{
  assert.equal(FURNITURE_CATALOG.length,78);
  const ids=new Set(FURNITURE_CATALOG.map(item=>item.id));
  assert.equal(ids.size,FURNITURE_CATALOG.length);
  assert.equal(new Set(FURNITURE_CATALOG.map(item=>item.name)).size,FURNITURE_CATALOG.length);
  assert.equal(new Set(FURNITURE_CATALOG.map(item=>item.category)).size,7);
  assert.deepEqual(FURNITURE_CATALOG.filter(item=>item.category==='pets').map(item=>item.id).sort(),
    ['pet-bed-simba','pet-bed-verdell','pet-scratcher-simba']);
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

import {
  SORTED_FURNITURE_CATALOG,FURNITURE_DISPLAY_GROUPS,FURNITURE_GROUP_LABELS,
  furnitureDisplayGroup,compareFurnitureProducts,compareFurnitureSkus,
} from '../../src/shared/furniture';

test('old and new models are interleaved by furniture type, never appended as separate batches',()=>{
  assert.equal(SORTED_FURNITURE_CATALOG.length,FURNITURE_CATALOG.length);
  assert.deepEqual(
    new Set(SORTED_FURNITURE_CATALOG.map(x=>x.id)),
    new Set(FURNITURE_CATALOG.map(x=>x.id))
  );
  assert.notEqual(SORTED_FURNITURE_CATALOG,FURNITURE_CATALOG);
  const order=new Map(FURNITURE_DISPLAY_GROUPS.map((group,i)=>[group,i]));
  let lastRank=-1;
  let lastItem=undefined as (typeof FURNITURE_CATALOG)[number]|undefined;
  for(const item of SORTED_FURNITURE_CATALOG){
    const group=furnitureDisplayGroup(item);
    const rank=order.get(group);
    assert.notEqual(rank,undefined,'Unexpected group '+group);
    assert.ok(FURNITURE_GROUP_LABELS[group].length>0,group);
    assert.ok(rank!>=lastRank,item.id+' appears after a later group');
    if(lastItem&&furnitureDisplayGroup(lastItem)===group)
      assert.ok(compareFurnitureProducts(lastItem,item)<=0,'Names not sorted: '+item.name);
    lastRank=rank!;
    lastItem=item;
  }
  const old=new Set(FURNITURE_CATALOG.slice(0,39).map(x=>x.id));
  const newOnes=new Set(FURNITURE_CATALOG.slice(39).map(x=>x.id));
  for(const group of ['sofa','bed','wardrobe','table','lamp','plant']){
    const items=SORTED_FURNITURE_CATALOG.filter(x=>furnitureDisplayGroup(x)===group);
    assert.ok(items.some(x=>old.has(x.id)),group+' has no original item');
    assert.ok(items.some(x=>newOnes.has(x.id)),group+' has no new item');
  }
  assert.equal(FURNITURE_CATALOG.find(x=>x.id==='nightstand')?.category,'storage');
});

test('sorting also applies to stored/installed items without modifying saved arrays',()=>{
  const skus=['mirror-window','sofa-chester','bed-aurora','sofa-luna','bed-canopy','table-round','sofa-arc'];
  const copy=skus.slice();
  const arranged=[...skus].sort(compareFurnitureSkus);
  assert.deepEqual(skus,copy);
  assert.deepEqual(arranged.slice(0,3),['sofa-arc','sofa-chester','sofa-luna'].sort(compareFurnitureSkus));
  const filtered=SORTED_FURNITURE_CATALOG.filter(x=>
    x.category==='tables'||x.category==='sleep');
  for(let i=1;i<filtered.length;i++)
    assert.ok(compareFurnitureProducts(filtered[i-1],filtered[i])<=0);
});
