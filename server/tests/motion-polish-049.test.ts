import assert from 'node:assert/strict';
import test from 'node:test';
import { Vector3, Group } from 'three';
import { Actor } from '../../src/game/Actor';
import { walkMotionTarget } from '../../src/game/WalkingGait';
import { HOME_WALK_SPEED } from '../../src/shared/home';

test('walking animation responds to actual speed, without changing route speed',()=>{
  for(const dt of [1/60,.08,.2]){
    assert.equal(walkMotionTarget(HOME_WALK_SPEED*dt,dt,HOME_WALK_SPEED),1);
    assert.ok(Math.abs(walkMotionTarget(HOME_WALK_SPEED*dt*.04,dt,HOME_WALK_SPEED)-.2)<1e-8);
    assert.equal(walkMotionTarget(0,dt,HOME_WALK_SPEED),0);
  }
  for(const role of ['vlad','alina'] as const){
    const actor=new Actor(role,[0,0]);
    const probe=actor as unknown as {gaitBlend:number};
    const dt=1/60;
    actor.walkPath([new Vector3(10,0,0)],()=>{});
    for(let i=0;i<60;i++)actor.update(dt,(from,to)=>({x:from.x+(to.x-from.x)*.04,z:from.z+(to.z-from.z)*.04}));
    assert.ok(probe.gaitBlend>.15&&probe.gaitBlend<.24);
    assert.ok(Math.abs(actor.root.position.x-HOME_WALK_SPEED*.04)<1e-6);
    for(let i=0;i<60;i++)actor.update(dt,from=>from);
    assert.ok(probe.gaitBlend<.001);
    for(let i=0;i<60;i++)actor.update(dt);
    assert.ok(probe.gaitBlend>.99);
  }
});
test('coincident focus points do not turn a resident arbitrarily',()=>{
  const actor=new Actor('vlad',[3,4]);
  actor.root.rotation.y=1.2;
  actor.faceTowards(new Vector3(3,1,4));
  assert.equal(actor.root.rotation.y,1.2);
  actor.faceTowards(new Vector3(4,0,4));
  assert.ok(Math.abs(actor.root.rotation.y-Math.PI/2)<1e-8);
});
test('switching directly between activities releases former venue props',()=>{
  for(const role of ['vlad','alina'] as const){
    const actor=new Actor(role,[0,0]);
    const probe=actor as unknown as {venueProp?:Group};
    actor.playDomesticActivity('venueCue');
    const cue=probe.venueProp!;
    assert.ok(cue.parent);
    actor.playDomesticActivity('scrollPhone');
    assert.equal(cue.parent,null);
    assert.equal(probe.venueProp,undefined);
    actor.playDomesticActivity('venueCards');
    const cards=probe.venueProp!;
    actor.playActivity('eat');
    assert.equal(cards.parent,null);
    assert.equal(probe.venueProp,undefined);
  }
});
