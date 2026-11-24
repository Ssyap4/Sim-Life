import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, type GameState, type CharacterId } from '../../src/shared/protocol';
import { applyWorld, localActivity } from '../locations';
import { stationById, approachFor, type PlaceId } from '../../src/shared/locations';
import { addReadyFood } from '../../src/shared/readyFood';
import { RECIPES, type RecipeId } from '../../src/shared/food';
import { gameMinutes } from '../../src/shared/life';
import { picnicPortions, validPicnicBasket } from '../../src/shared/picnic';
import { pairScenes, completeTogether } from '../society';
import { LEISURE } from '../../src/shared/leisure';
import { buildFurnishingModel } from '../../src/game/FurnishingArt';
import { Box3 } from 'three';
const locate=(s:GameState,r:CharacterId,p:PlaceId,id:string)=>{s.world.places[r]=p;Object.assign(s.characters[r],approachFor(stationById(p,id)!,r));};
const send=(s:GameState,r:CharacterId,c:Record<string,unknown>)=>{const res=applyWorld(s,r,c);assert.ok(res.ok, res.ok?'':res.reason);return res.state;};
test('picnic uses real portions, one household basket, independent portions and no duplication',()=>{
 let s=initialState();locate(s,'vlad','market','checkout');
 const money=s.money;s=send(s,'vlad',{type:'picnic_buy'});assert.equal(s.money,money-900);
 assert.equal(applyWorld(s,'vlad',{type:'picnic_buy'}).ok,false);
 const item=Object.keys(RECIPES)[0] as RecipeId;
 s.meals[item]=2;addReadyFood(s,'meal',item,2,'fridge');
 for(const r of ['vlad','alina'] as const){locate(s,r,'home','fridge');s=send(s,r,{type:'picnic_pack',kind:'meal',item});}
 assert.equal(s.meals[item],0);assert.equal(s.readyFood.filter(b=>b.item===item).length,0);
 assert.equal(picnicPortions(s,'vlad').length,1);assert.equal(picnicPortions(s,'alina').length,1);
 assert.ok(validPicnicBasket(s.world.picnic));assert.ok(picnicPortions(s,'vlad')[0].expiresAt-gameMinutes(s.clock)<=480);
 assert.equal(applyWorld(s,'vlad',{type:'picnic_pack',kind:'meal',item}).ok,false);
 locate(s,'vlad','park','park-picnic');locate(s,'alina','park','park-picnic');
 const cmd={type:'together' as const,action:'picnic'};
 const homes=pairScenes(s,'vlad',cmd);assert.ok(homes);
 const res=completeTogether(s,'vlad',cmd,['vlad','alina'],0,homes);
 assert.ok(res.ok,res.ok?'':res.reason);assert.equal(picnicPortions(res.state,'vlad').length,0);assert.equal(picnicPortions(res.state,'alina').length,0);
 assert.equal(localActivity(res.state,'vlad','picnic','park-picnic').ok,false);
});
test('expired basket food cannot be consumed and returning a portion preserves expiry',()=>{
 let s=initialState();locate(s,'vlad','market','checkout');s=send(s,'vlad',{type:'picnic_buy'});
 const item=Object.keys(RECIPES)[0] as RecipeId;s.meals[item]=1;addReadyFood(s,'meal',item,1,'fridge');
 locate(s,'vlad','home','fridge');s=send(s,'vlad',{type:'picnic_pack',kind:'meal',item});
 const expiry=picnicPortions(s,'vlad')[0].expiresAt;s=send(s,'vlad',{type:'picnic_unpack',kind:'meal',item});assert.equal(s.meals[item],1);
 assert.equal(s.readyFood.find(b=>b.item===item)?.expiresAt,expiry);
 s=send(s,'vlad',{type:'picnic_pack',kind:'meal',item});
 s.world.picnic!.portions.vlad[0].expiresAt=gameMinutes(s.clock);
 locate(s,'vlad','park','park-picnic');assert.equal(localActivity(s,'vlad','picnic','park-picnic').ok,false);
});
test('all seven leisure products have real nonempty 3D models',()=>{
 for(const spec of Object.values(LEISURE)){const model=buildFurnishingModel(spec.sku,'oak');const box=new Box3().setFromObject(model);assert.ok(!box.isEmpty(),spec.sku);assert.ok(box.max.y>0.3,spec.sku);}
});
