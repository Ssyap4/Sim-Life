import assert from 'node:assert/strict';
import test from 'node:test';
import {initialState} from '../../src/shared/protocol';
import {FURNITURE_BY_ID,FURNITURE_CATALOG,PURCHASABLE_FURNITURE} from '../../src/shared/furniture';
import {checkFurniturePlacement,suggestFurnitureSnap} from '../../src/shared/furnishingPlacement';
import {isSurfaceDevice} from '../../src/shared/consoleCatalog';
import {speakerSurfaces} from '../../src/shared/speakerPlacement';
import {applyFurnishing} from '../furnishing';
import {placeObstacles} from '../../src/shared/locations';
import {HOME_FLOOR} from '../../src/shared/home';
import {findRoute,pointIsClear} from '../../src/game/navigation';

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
test('all catalog products fit in a valid room or yard somewhere (all four rotations tried)',()=>{
  const home=state();
  const spots=[] as Array<{x:number;z:number}>;
  for(let x=10.4;x<15;x+=.58)for(let z=-6.95;z<4.65;z+=.6)spots.push({x,z});
  for(const product of FURNITURE_CATALOG){
    if(isSurfaceDevice(product.id)){
      const p=structuredClone(home);p.furnishing.placed.push({id:9,sku:'dresser-nora',finish:'oak',x:14,z:-6,rotation:0});p.furnishing.nextId=10;
      assert.ok(speakerSurfaces(p.furnishing).some(x=>x.id==='item:9'));
      assert.ok(checkFurniturePlacement(p,{id:1,sku:product.id,finish:'oak',x:14,z:-6,rotation:0}).valid,product.id);continue;
    }
    let possible=false;
    for(const {x,z} of (product.id.startsWith('oasis-')?[{x:-9.95,z:8.1},{x:9.5,z:10.2},...spots]:spots)){
      if(possible)break;
      for(const rotation of [0,1,2,3] as const){
        const placement={id:1,sku:product.id,finish:'oak' as const,x,z,rotation};
        if(checkFurniturePlacement(home,placement).valid){possible=true;break;}
      }
    }
    assert.ok(possible,'No installable space for '+product.id);
  }
});

test('placing furniture ignores temporary occupants and routes, safely releases blocked pet activities',()=>{
  const base=state(),item={id:1,sku:'stool-basic',finish:'sage' as const,x:13.5,z:-5.5,rotation:0 as const};
  base.furnishing.nextId=2;base.furnishing.stored=[{id:1,sku:item.sku,finish:item.finish}];
  const free=checkFurniturePlacement(base,item);assert.ok(free.valid);
  Object.assign(base.characters.vlad,{x:item.x,z:item.z,pose:'idle'});
  Object.assign(base.characters.alina,{x:12.0,z:-5.5,pose:'work'});
  base.pets.verdell.position={x:12.6,z:-5.5};
  base.pets.verdell.routine={kind:'wander',target:0,startedAt:480,until:500,route:{from:{x:12.6,z:-5.5},path:[{x:14.4,z:-5.5}]}};
  assert.deepEqual(checkFurniturePlacement(base,item),free);
  const result=applyFurnishing(base,'vlad',{type:'furniture_place',id:1,x:item.x,z:item.z,rotation:0},480);
  assert.ok(result.ok);
  const after=result.state;
  assert.ok(pointIsClear(after.characters.vlad,placeObstacles('home',after.furnishing),HOME_FLOOR));
  assert.equal(after.characters.alina.pose,'work');
  assert.equal(after.pets.verdell.routine,undefined);
  assert.equal(after.pets.verdell.happiness,base.pets.verdell.happiness);
});
test('decor is no longer sold; already owned items can still be sold without losing money or other possessions',()=>{
  const base=state();
  const decor=FURNITURE_CATALOG.filter(p=>p.category==='decor');
  assert.equal(decor.length,13);
  assert.equal(PURCHASABLE_FURNITURE.length,FURNITURE_CATALOG.length-decor.length);
  for(const product of decor){
    const result=applyFurnishing(base,'vlad',{type:'furniture_order',sku:product.id,finish:'sage',shipping:'regular',quantity:1},480);
    assert.equal(result.ok,false);
  }
  base.furnishing.nextId=2;base.furnishing.stored=[{id:1,sku:'plant-mini',finish:'sage'}];
  const sale=applyFurnishing(base,'vlad',{type:'furniture_sell',id:1},480);assert.ok(sale.ok);
  assert.equal(sale.state.money,base.money+660);assert.equal(sale.state.furnishing.stored.length,0);
});
