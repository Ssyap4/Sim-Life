import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {DINING_TOP, HOME_PLACEMENTS, KITCHEN_WORK} from '../../src/shared/home';
import {diningSurface,tabletopPoint,dishPickupPoint} from '../../src/shared/diningSurface';
import {dirtyDishStops} from '../../src/shared/dirtyDishes';
import {FURNITURE_BY_ID} from '../../src/shared/furniture';

test('original dining table, installed replacement and kitchen counter have consistent ready-food anchors',()=>{
  const s=initialState();
  assert.equal(diningSurface(s).kind,'starter');
  assert.equal(diningSurface(s).height,DINING_TOP);
  s.furnishing.soldFixtures=['table'];
  s.furnishing.placed=[{id:4,sku:'table-oval',finish:'oak',
    x:3.25,z:-2.2,rotation:0}];
  s.furnishing.nextId=5;
  const newer=diningSurface(s);
  assert.equal(newer.kind,'purchased');
  assert.equal(newer.furnitureId,4);
  assert.equal(newer.height,FURNITURE_BY_ID.get('table-oval')!.height);
  for(const turn of [0,1,2,3]as const){
    s.furnishing.placed[0].rotation=turn;
    const top=diningSurface(s);
    assert.equal(top.rotation,turn);
    const point=tabletopPoint(top,.22,-.13);
    assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.z));
    assert.ok(Math.hypot(point.x-top.x,point.z-top.z)<.3);
  }
  s.furnishing.placed=[];
  const counter=diningSurface(s);
  assert.equal(counter.kind,'counter');
  assert.ok(Math.hypot(counter.x-HOME_PLACEMENTS.table.x,
    counter.z-HOME_PLACEMENTS.table.z)>2);
  assert.ok(counter.height>.85);
});

test('washing dirty dishes follows new table and does not return to old sold-table coordinates',()=>{
 const s=initialState();
 s.dirtyDishes.table=3;
 let route=dirtyDishStops(s.dirtyDishes,'vlad',s);
 assert.equal(route.length,1);
 assert.deepEqual(route[0],dirtyDishStops(s.dirtyDishes,'vlad')[0]);
 s.furnishing.soldFixtures=['table'];
 s.furnishing.placed=[{id:1,sku:'table-family',finish:'sage',
   x:3.25,z:-2.2,rotation:0}];
 s.furnishing.nextId=2;
 route=dirtyDishStops(s.dirtyDishes,'vlad',s);
 assert.equal(route.length,1);
 const table=diningSurface(s);
 assert.ok(Math.hypot(route[0].x-table.x,route[0].z-table.z)<2.1);
 s.furnishing.placed=[];
 assert.deepEqual(dishPickupPoint(s,'alina'),KITCHEN_WORK.dishes.position);
 assert.deepEqual(dirtyDishStops(s.dirtyDishes,'alina',s)[0],KITCHEN_WORK.dishes.position);
});
