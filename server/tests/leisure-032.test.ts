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
import { advanceLife } from '../life';
import { planTask } from '../tasks';
import { socialDuration, cooperationDenial, parkConversation } from '../society';
import { SOCIAL_BY_ID,PARK_TALK_TOPICS } from '../../src/shared/socialLife';
import { CAMP_RECIPES, campIngredients,PICNIC_SECONDS } from '../../src/shared/park';
test('camp requires packed fuel and ingredients and makes two distinct shared picnic servings',()=>{
 let s=initialState();s.world.picnic={portions:{vlad:[],alina:[]}};
 locate(s,'vlad','home','fridge');s.pantry.charcoal=2;s.pantry.lighterFluid=2;
 for(const [id,n] of campIngredients('campPotato'))s.pantry[id]=n;
 s=send(s,'vlad',{type:'camp_pack',item:'fuel'});s=send(s,'vlad',{type:'camp_pack',item:'campPotato'});
 assert.equal(s.pantry.charcoal,1);assert.equal(s.pantry.lighterFluid,1);assert.equal(s.pantry.potato,0);
 assert.equal(applyWorld(s,'vlad',{type:'camp_pack',item:'campPotato'}).ok,false);
 locate(s,'vlad','park','park-fire');assert.equal(localActivity(s,'vlad','campPotato','park-fire').ok,false);
 const ignite=localActivity(s,'vlad','campIgnite','park-fire');assert.ok(ignite.ok);s=ignite.state;
 assert.equal(s.world.campKit?.vlad?.fuel,0);assert.equal(localActivity(s,'vlad','campIgnite','park-fire').ok,false);
 const cooked=localActivity(s,'vlad','campPotato','park-fire');assert.ok(cooked.ok);s=cooked.state;
 assert.equal(picnicPortions(s,'vlad')[0].item,'campPotato');assert.equal(picnicPortions(s,'alina')[0].kind,'campfire');
 assert.equal(localActivity(s,'vlad','campPotato','park-fire').ok,false);assert.ok(validPicnicBasket(s.world.picnic));
 locate(s,'vlad','park','park-picnic');s.characters.vlad.hunger=0;const eaten=localActivity(s,'vlad','picnic','park-picnic');assert.ok(eaten.ok);assert.equal(eaten.state.characters.vlad.hunger,CAMP_RECIPES.campPotato.hunger);
});
test('park badminton is a real two-player session and picnic is ninety seconds',()=>{
 let s=initialState();for(const role of ['vlad','alina'] as const)locate(s,role,'park','park-badminton');
 const cmd={type:'together' as const,action:'parkBadminton'};
 assert.equal(cooperationDenial(s,'vlad',cmd),undefined);
 const homes=pairScenes(s,'vlad',cmd);assert.ok(homes);assert.equal(homes.vlad.pair?.motion,'badminton');
 const result=completeTogether(s,'vlad',cmd,['vlad','alina'],0,homes);assert.ok(result.ok,result.ok?'':result.reason);assert.equal(result.state.characters.vlad.pose,'idle');
 assert.equal(stationById('park','park-chess'),undefined);
 assert.equal(planTask({type:'local_activity',station:'park-picnic',action:'picnic'})?.durationMs,90000);
 assert.equal(socialDuration(SOCIAL_BY_ID.get('picnic')!,{type:'together',action:'picnic'}),PICNIC_SECONDS*1000);
});
test('dog can relieve itself twice per park visit and no more',()=>{
 let s=initialState();locate(s,'vlad','park','park-dog');s.world.dogWalker='vlad';s.pets.verdell.bladder=10;
 s=advanceLife(s,8,['vlad']);assert.equal(s.world.parkDog?.toilets,1);assert.equal(s.pets.verdell.bladder,100);
 s=advanceLife(s,37,['vlad']);assert.equal(s.world.parkDog?.toilets,2);
 s=advanceLife(s,60,['vlad']);assert.equal(s.world.parkDog?.toilets,2);
 assert.equal(localActivity(s,'vlad','dogToilet','park-dog').ok,false);
 s.pets.verdell.happiness=10;const play=localActivity(s,'vlad','dogFetch','park-dog');assert.ok(play.ok);assert.ok(play.state.pets.verdell.happiness>10);
});
test('park chat has real choices and independent rewards without consuming a picnic serving',()=>{
 const s=initialState();s.world.picnic={portions:{vlad:[{kind:'meal',item:'omelette',expiresAt:9999}],alina:[]}};
 assert.ok(PARK_TALK_TOPICS.length>15);
 const t=PARK_TALK_TOPICS.find(t=>!t.context)!;s.characters.vlad.social=0;
 const next=parkConversation(s,'vlad',t,0);
 assert.equal(next.world.picnic?.portions.vlad.length,1);assert.ok(next.characters.vlad.social>0);
});
