
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {applyWorld} from '../locations';
import {approachFor,stationById} from '../../src/shared/locations';
import {contextualLook,validWardrobe,outfitPrice,PREVIEW_LOOKS,defaultWardrobe} from '../../src/shared/previewWardrobe';
import {residentLook} from '../../src/shared/lake';
test('new clothes are individual owned outfits with nonzero prices and validated purchases',()=>{
 let s=initialState();s.money=100000;s.world.places.vlad='clothing';
 Object.assign(s.characters.vlad,approachFor(stationById('clothing','clothes-cash')!,'vlad'));
 const bought=applyWorld(s,'vlad',{type:'clothing_buy',look:'robeNavy'});assert.ok(bought.ok);s=bought.state;
 assert.equal(s.money,100000-outfitPrice('robeNavy'));assert.equal(applyWorld(s,'vlad',{type:'clothing_buy',look:'pajamaRose'}).ok,false);
 assert.equal(applyWorld(s,'vlad',{type:'clothing_buy',look:'robeNavy'}).ok,false);
 for(const role of ['vlad','alina'] as const)for(const [id] of PREVIEW_LOOKS[role])if(id!=='signature')assert.ok(outfitPrice(id)>0);
});
test('owned situation outfits are opt in, never purchase, manual wear disables automatic, water and lake override',()=>{
 let s=initialState();s.world.wardrobe=defaultWardrobe();s.world.wardrobe.vlad.owned.push('robeNavy','trackNavy','teeRetro');
 Object.assign(s.characters.vlad,approachFor(stationById('home','wardrobe-vlad')!,'vlad'));
 function send(command:Record<string,unknown>){const r=applyWorld(s,'vlad',command);assert.ok(r.ok);s=r.state;}
 send({type:'clothing_context',context:'home',look:'robeNavy'});send({type:'clothing_context',context:'sport',look:'trackNavy'});send({type:'clothing_context',context:'outdoor',look:'teeRetro'});send({type:'clothing_context',context:'sleep',look:'robeNavy'});
 assert.equal(contextualLook(s,'vlad'),'signature');
 send({type:'clothing_auto',enabled:true});assert.equal(contextualLook(s,'vlad'),'robeNavy');
 assert.equal(applyWorld(s,'vlad',{type:'clothing_context',context:'date',look:'pajamaRose'}).ok,false);
 assert.equal(applyWorld(s,'vlad',{type:'clothing_context',context:'unknown',look:'robeNavy'}).ok,false);
 s.world.places.vlad='fitness';assert.equal(contextualLook(s,'vlad'),'trackNavy');
 s.world.places.vlad='park';assert.equal(contextualLook(s,'vlad'),'teeRetro');
 s.world.places.vlad='lake';assert.equal(residentLook(s,'vlad'),'lake-visit');assert.equal(residentLook(s,'vlad',true),'spa-visit');
 s.world.places.vlad='home';send({type:'clothing_wear',look:'teeRetro'});assert.equal(contextualLook(s,'vlad'),'teeRetro');
 assert.equal(s.world.wardrobe!.vlad.auto,false);assert.equal(s.world.wardrobe!.alina.auto,undefined);assert.ok(validWardrobe(s.world.wardrobe));
});
