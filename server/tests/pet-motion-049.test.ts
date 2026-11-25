import assert from 'node:assert/strict';
import test from 'node:test';
import {Vector3} from 'three';
import {PetActor} from '../../src/game/PetActor';
import {petStepPace,petPaceBlend,perchBodyYaw} from '../../src/game/PetMotion';
import {PET_SPEED} from '../../src/shared/pets';

test('pet stride weight is bounded, speed-sensitive and frame independent',()=>{
 for(const dt of [1/60,.05,.2]){
  assert.equal(petStepPace(0,dt,1.27,.76),0);
  assert.equal(petStepPace(1.27*dt,dt,1.27,.76),.76);
  assert.ok(Math.abs(petStepPace(1.27*dt*.04,dt,1.27,.76)-.152)<1e-8);
 }
 for(const fps of [20,60]){
  let pace=0;
  for(let i=0;i<fps;i++)pace=petPaceBlend(pace,.76,1/fps);
  assert.ok(pace>.759);
  for(let i=0;i<fps;i++)pace=petPaceBlend(pace,0,1/fps);
  assert.ok(pace<.0001);
 }
});
test('new routes and stops do not reset foot phase or change movement speed',()=>{
 for(const id of ['verdell','simba'] as const){
  const pet=new PetActor(id);
  pet.root.position.set(0,0,0);
  const p=pet as unknown as {distance:number;gaitPace:number};
  pet.followRoute([new Vector3(10,0,0)],'wander');
  for(let i=0;i<60;i++)pet.update(1/60);
  assert.ok(Math.abs(p.distance-PET_SPEED[id])<1e-6);
  const before=p.distance;
  pet.followRoute([new Vector3(12,0,0)],'wander');
  assert.equal(p.distance,before);
  pet.stop();
  for(let i=0;i<30;i++)pet.update(1/60);
  assert.equal(p.distance,before);
  assert.ok(p.gaitPace<.001);
 }
});
test('park follow animation advances only when actual travel advances',()=>{
 const dog=new PetActor('verdell');
 const p=dog as unknown as {distance:number;gaitPace:number};
 dog.update(.05,.08,.8);
 assert.equal(p.distance,.08);
 assert.ok(p.gaitPace>0&&p.gaitPace<.8);
 for(let i=0;i<20;i++)dog.update(.05,.08,0);
 assert.equal(p.distance,.08);
 assert.ok(p.gaitPace<.001);
});
test('cat landing and descent share the same rest orientation, with continuous ground yaw',()=>{
 const delta=(a:number,b:number)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
 for(const yaw of [-3.1,-1.7,0,1.7,3.1])for(const rest of [0,Math.PI/2]){
  assert.ok(delta(perchBodyYaw(1,yaw,rest,false),perchBodyYaw(1,yaw,rest,true))<1e-8);
  for(const down of [false,true]){
   assert.equal(perchBodyYaw(0,yaw,rest,down),0);
   let previous=perchBodyYaw(0,yaw,rest,down);
   for(let i=1;i<=200;i++){
    const current=perchBodyYaw(i/200,yaw,rest,down);
    assert.ok(delta(previous,current)<.15);
    previous=current;
   }
  }
 }
});
