import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {applyWorld,validWorld} from '../locations';
import {applyPetAction,runPetRoutines} from '../pets';
import {PET_SHOP_FOOD,discoverFoodPreference,validPetFoodExtras} from '../../src/shared/petShop';
import {districtArrival} from '../../src/shared/district';
import {STATIONS,approachFor,stationById,floorFor,placeObstacles,spawn} from '../../src/shared/locations';
import {findRoute,pointIsClear} from '../../src/game/navigation';
import {openServerFiles} from '../storage';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
test('Pet shop has reachable entrance, displays, checkout and exit for both players',()=>{
 for(const role of ['vlad','alina'] as const){
  const arrival=districtArrival('petshop',role);
  assert.ok(pointIsClear(arrival,placeObstacles('district'),floorFor('district')));
  assert.ok(findRoute(districtArrival('home',role),arrival,placeObstacles('district'),floorFor('district')));
  for(const st of STATIONS.petshop){const p=approachFor(st,role);assert.ok(pointIsClear(p,placeObstacles('petshop'),floorFor('petshop')),st.id);assert.ok(findRoute(spawn('petshop',role),p,placeObstacles('petshop'),floorFor('petshop')),st.id);}
 }
});
test('16 differentiated species-specific products; server validates price, location and capacity',()=>{
 assert.equal(PET_SHOP_FOOD.length,16);assert.equal(new Set(PET_SHOP_FOOD.map(p=>p.id)).size,16);
 let s=initialState();s.money=100000;
 const p=PET_SHOP_FOOD.find(p=>p.id==='simba-wet-3')!;
 assert.equal(applyWorld(s,'vlad',{type:'pet_food_buy',product:p.id}).ok,false);
 Object.assign(s.characters.vlad,approachFor(stationById('home','family-car')!,'vlad'));
 const trip=applyWorld(s,'vlad',{type:'car_travel',place:'petshop'});assert.ok(trip.ok);s=trip.state;assert.ok(validWorld(s.world));
 assert.equal(applyWorld(s,'vlad',{type:'pet_food_buy',product:p.id}).ok,false);
 Object.assign(s.characters.vlad,approachFor(stationById('petshop','pet-cash')!,'vlad'));
 assert.equal(applyWorld(s,'vlad',{type:'pet_food_buy',product:'fake'}).ok,false);
 const bought=applyWorld(s,'vlad',{type:'pet_food_buy',product:p.id});assert.ok(bought.ok);const b=bought.state;
 assert.equal(b.money,s.money-p.price);assert.equal(b.petFood.simba,12);assert.equal(b.petFood.verdell,2);
 assert.equal(b.pets.simba.foodQueue?.length,10);assert.equal(b.ledger.at(-1)?.category,'pets');
 const poor=structuredClone(s);poor.money=0;assert.equal(applyWorld(poor,'vlad',{type:'pet_food_buy',product:p.id}).ok,false);
 const full=structuredClone(s);full.petFood.simba=45;assert.equal(applyWorld(full,'vlad',{type:'pet_food_buy',product:p.id}).ok,false);
 Object.assign(b.characters.vlad,approachFor(stationById('petshop','pet-exit')!,'vlad'));
 const back=applyWorld(b,'vlad',{type:'travel',place:'district',via:'pet-exit'});assert.ok(back.ok);assert.equal(back.state.world.places.vlad,'home');
});
test('actual bowl meal consumes one portion, discovers persistent preference and gives nutrition bonus',()=>{
 const s=initialState();const p=PET_SHOP_FOOD.find(p=>p.id==='verdell-wet-3')!;
 s.pets.verdell.foodQueue=[p.id];s.petFood.verdell=2;
 const filled=applyPetAction(s,'alina','verdell','feed');assert.ok(filled.ok);const f=filled.state;
 assert.equal(f.petFood.verdell,1);assert.equal(f.petBowls.verdell,3);assert.equal(f.pets.verdell.bowlFood,p.id);
 assert.equal(f.pets.verdell.foodQueue?.length,0);assert.equal(f.pets.verdell.foodPreferences,undefined);
 Object.assign(f.pets.verdell,{satiety:39,energy:99,bladder:99,happiness:50});
 runPetRoutines(f,1,492,new Set(),()=>0);
 assert.equal(f.pets.verdell.routine?.kind,'eat');
 runPetRoutines(f,11,503,new Set(),()=>.99);
 assert.equal(f.petBowls.verdell,2);assert.ok(f.pets.verdell.satiety>=94);
 assert.equal(f.pets.verdell.foodPreferences?.[p.id],3);
 assert.equal(discoverFoodPreference(f.pets.verdell,p.id,()=>0),3);
 assert.equal(f.pets.verdell.foodFullUntil,503+p.lasting);
 assert.equal(f.pets.simba.foodPreferences,undefined);
 assert.ok(validPetFoodExtras(f.pets.verdell,'verdell',1,2));
 assert.ok(!validPetFoodExtras(f.pets.verdell,'simba',1,2));
 const dir=mkdtempSync(join(tmpdir(),'sim-pet035-'));
 try{const files=openServerFiles(dir);files.save(f);const reloaded=files.load();assert.equal(reloaded.pets.verdell.foodPreferences?.[p.id],3);assert.equal(reloaded.pets.verdell.bowlFood,p.id);}finally{rmSync(dir,{recursive:true,force:true});}
});
