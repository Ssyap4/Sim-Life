import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../../src/shared/protocol';
import { applyWorld, validWorld } from '../locations';
import { stationById, approachFor, placeObstacles, floorFor, spawn } from '../../src/shared/locations';
import { districtArrival } from '../../src/shared/district';
import { findRoute, pointIsClear } from '../../src/game/navigation';
import { outfitPrice } from '../../src/shared/previewWardrobe';
test('new shop and home cabinets are accessible and purchases are validated',()=>{
 const s=initialState();s.money=100000;
 for(const role of ['alina','vlad'] as const){
   const home=stationById('home','wardrobe-'+role)!;
   assert.ok(findRoute(spawn('home',role),approachFor(home,role),placeObstacles('home',s.furnishing),floorFor('home')),role+' wardrobe route');
   assert.ok(findRoute(districtArrival('home',role),districtArrival('clothing',role),placeObstacles('district'),floorFor('district')),role+' district route');
   for(const id of ['clothes-alina','clothes-vlad','clothes-fitting','clothes-cash']){
     const st=stationById('clothing',id)!;assert.ok(pointIsClear(approachFor(st,role),placeObstacles('clothing'),floorFor('clothing')),id);
     assert.ok(findRoute(spawn('clothing',role),approachFor(st,role),placeObstacles('clothing'),floorFor('clothing')),id);
   }
 }
 const role='vlad',look='track';
 assert.equal(applyWorld(s,role,{type:'clothing_buy',look}).ok,false);
 Object.assign(s.characters.vlad,approachFor(stationById('home','family-car')!,role));
 const travel=applyWorld(s,role,{type:'car_travel',place:'clothing'});assert.ok(travel.ok);
 const atShop=travel.state;assert.equal(atShop.world.places.vlad,'clothing');assert.ok(validWorld(atShop.world));
 Object.assign(atShop.characters.vlad,approachFor(stationById('clothing','clothes-cash')!,role));
 const buy=applyWorld(atShop,role,{type:'clothing_buy',look});assert.ok(buy.ok);
 assert.equal(buy.state.money,s.money-outfitPrice(look));
 assert.equal(buy.state.world.wardrobe!.vlad.worn,'signature');
 assert.equal(applyWorld(buy.state,role,{type:'clothing_buy',look}).ok,false);
 assert.equal(applyWorld(buy.state,role,{type:'clothing_buy',look:'summer'}).ok,false);
 Object.assign(buy.state.characters.vlad,approachFor(stationById('clothing','clothes-exit')!,role));
 const home=applyWorld(buy.state,role,{type:'travel',place:'district',via:'clothes-exit'});assert.ok(home.ok);assert.equal(home.state.world.places.vlad,'home');
 Object.assign(home.state.characters.vlad,approachFor(stationById('home','wardrobe-vlad')!,role));
 const wear=applyWorld(home.state,role,{type:'clothing_wear',look});assert.ok(wear.ok);
 assert.equal(wear.state.world.wardrobe!.vlad.worn,look);assert.ok(validWorld(wear.state.world));
 assert.equal(applyWorld(wear.state,role,{type:'clothing_wear',look:'city'}).ok,false);
});
