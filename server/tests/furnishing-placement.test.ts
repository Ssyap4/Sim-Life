import assert from 'node:assert/strict';
import test from 'node:test';
import {initialState} from '../../src/shared/protocol';
import {FURNITURE_BY_ID,FURNITURE_CATALOG} from '../../src/shared/furniture';
import {checkFurniturePlacement,suggestFurnitureSnap} from '../../src/shared/furnishingPlacement';
import {applyFurnishing} from '../furnishing';
import {placeObstacles} from '../../src/shared/locations';
import {HOME_FLOOR} from '../../src/shared/home';
import {findRoute} from '../../src/game/navigation';

const state=()=> {
  const state=initialState();
  state.money=400000;
  return state;
};
test('real-world corner snap allows wardrobes, a large sofa, shelves and a bed in wing',()=>{
  const household=state();
  for(const [sku,x,z,rotation] of [
    ['wardrobe-tall',14.99,-7.15,0],['wardrobe-wide',14.43,-7.12,0],
    ['sofa-nord',14.23,-7.00,0],['shelf-open',14.97,-7.15,0],
    ['plant-mini',15.41,-7.35,0],['bed-aurora',14.5,-6.3,1],
  ] as const) {
    const target=suggestFurnitureSnap({id:1,sku,finish:'sage',x,z,rotation});
    const validation=checkFurniturePlacement(household,target);
    assert.equal(validation.valid,true,sku+' / '+validation.reason);
    const purchased=structuredClone(household);
    purchased.furnishing.stored=[{id:1,sku,finish:'sage'}];
    purchased.furnishing.nextId=2;
    const applied=applyFurnishing(purchased,'vlad',{
      type:'furniture_place',id:1,x:target.x,z:target.z,rotation
    },120);
    assert.equal(applied.ok,true,sku+' should be accepted server-side');
  }
});
test('shared preview and server agree on corner walls, doors and furniture collisions',()=>{
  const base=state();
  for(const [sku,x,z] of [
    ['wardrobe-wide',12.62,-3.6],
    ['plant-mini',30,-4],
    ['sofa-luna',-2.36,2.02],
    ['plant-mini',.5,3.5],
    ['wardrobe-tall',14.99,-7.15],
  ] as const){
    const sample={id:1,sku,finish:'walnut' as const,x,z,rotation:0 as const};
    const preview=checkFurniturePlacement(base,sample);
    const withStored=structuredClone(base);
    withStored.furnishing.nextId=2;
    withStored.furnishing.stored=[{id:1,sku,finish:'walnut'}];
    const server=applyFurnishing(withStored,'vlad',
      {type:'furniture_place',id:1,x,z,rotation:0},200);
    assert.equal(server.ok,preview.valid,sku+' at '+x+'/'+z);
    if(!preview.valid && !server.ok)assert.equal(server.reason,preview.reason);
  }
});
test('new furniture stays physical while player pathfinding gets independent margins',()=>{
  const base=state();
  const chosen=suggestFurnitureSnap({
    id:1,sku:'wardrobe-wide',finish:'ivory' as const,x:14.43,z:-7.12,rotation:0 as const
  });
  assert.ok(checkFurniturePlacement(base,chosen).valid);
  base.furnishing.placed=[chosen];base.furnishing.nextId=2;
  const obstacles=placeObstacles('home',base.furnishing);
  assert.ok(findRoute({x:0,z:1.4},{x:12.5,z:-5.25},obstacles,HOME_FLOOR));
  const model=FURNITURE_BY_ID.get(chosen.sku)!;
  assert.ok(chosen.x+model.width/2<15.65);
});
test('all catalog products fit in a valid room somewhere (all four rotations tried)',()=>{
  const home=state();
  const spots=[] as Array<{x:number;z:number}>;
  for(let x=10.4;x<15;x+=.58)for(let z=-6.95;z<4.65;z+=.6)spots.push({x,z});
  for(const product of FURNITURE_CATALOG){
    let possible=false;
    for(const {x,z} of spots){
      if(possible)break;
      for(const rotation of [0,1,2,3] as const){
        const placement={id:1,sku:product.id,finish:'oak' as const,x,z,rotation};
        if(checkFurniturePlacement(home,placement).valid){possible=true;break;}
      }
    }
    assert.ok(possible,'No installable space for '+product.id);
  }
});
