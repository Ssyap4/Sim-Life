import assert from 'node:assert/strict';
import test from 'node:test';
import {Group} from 'three';
import {StableModelParts} from '../../src/game/StableModelParts';
import {buildFurnishingModel} from '../../src/game/FurnishingArt';

test('named animation pivots are searched once per root including absent parts',()=>{
 const cache=new StableModelParts(),root=new Group(),child=new Group();
 child.name='moving part';root.add(child);
 const original=root.getObjectByName.bind(root);let searches=0;
 root.getObjectByName=(name)=>{searches++;return original(name);};
 for(let i=0;i<600;i++){
  assert.equal(cache.get(root,'moving part'),child);
  assert.equal(cache.get(root,'absent part'),undefined);
 }
 assert.equal(searches,2);
 assert.equal(cache.get(undefined,'moving part'),undefined);
 const replacement=new Group(),next=new Group();next.name=child.name;replacement.add(next);
 assert.equal(cache.get(replacement,'moving part'),next);
});
test('cached table-tennis pivots retain actual mesh identity and independent state',()=>{
 const cache=new StableModelParts(),a=buildFurnishingModel('leisure-tennis','oak'),b=buildFurnishingModel('leisure-tennis','oak');
 const ball=cache.get(a,'Table tennis live ball')!;
 const resting=cache.get(a,'Table tennis resting equipment')!;
 assert.ok(ball&&resting);
 ball.visible=true;resting.visible=false;ball.position.y=1.1;
 assert.equal(cache.get(a,ball.name)?.position.y,1.1);
 assert.notEqual(cache.get(b,ball.name),ball);
 assert.equal(cache.get(b,ball.name)?.visible,false);
});
