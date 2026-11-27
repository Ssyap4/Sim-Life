import assert from 'node:assert/strict';
import test from 'node:test';
import {Vector3} from 'three';
import {PetActor} from '../../src/game/PetActor';
import {petStepPace,petPaceBlend,perchBodyYaw,samplePetStride,dogLegAngles} from '../../src/game/PetMotion';
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

test('floor sleep enters and exits continuously without displacing either navigation root',()=>{
 for(const id of ['verdell','simba'] as const){
  const pet=new PetActor(id),anchor=pet.root.position.clone();
  const probe=pet as unknown as {napWeight:number;body:{position:Vector3;scale:Vector3}};
  pet.followRoute([],'sleep');
  for(let i=0;i<120;i++)pet.update(1/60);
  assert.ok(probe.napWeight>.99);
  const height=probe.body.position.y;
  pet.stop();pet.update(1/60);
  assert.ok(probe.napWeight>.8,'waking should blend rather than pop');
  assert.ok(Math.abs(probe.body.position.y-height)<.07);
  for(let i=0;i<120;i++)pet.update(1/60);
  assert.ok(probe.napWeight<.0001);
  assert.deepEqual(pet.root.position.toArray(),anchor.toArray());
 }
});
test('inactive house toys are not rewritten every render frame',()=>{
 const pet=new PetActor('verdell');
 const toy=pet.homeToys.children[0];
 toy.position.x+=.003;
 const before=toy.position.x;
 for(let i=0;i<60;i++)pet.update(1/60);
 assert.equal(toy.position.x,before);
});
test('stance cancels forward body travel and swing clears the floor at 20 to 60fps',()=>{
 for(const duty of [.52,.67]){
  const cycle=.46,p={y:0,z:0,swing:0};
  for(let i=1;i<40;i++){
   const distance=cycle*duty*i/40;
   samplePetStride(distance,cycle,duty,0,.1,p);
   assert.ok(Math.abs(distance+p.z-cycle*duty/2)<1e-8);
   assert.equal(p.y,0);
  }
  samplePetStride(cycle*(duty+(1-duty)/2),cycle,duty,0,.1,p);
  assert.ok(p.y>.099);
  samplePetStride(cycle,cycle,duty,0,.1,p);
  assert.ok(Math.abs(p.z-cycle*duty/2)<1e-8&&p.y===0);
 }
});
test('Verdell two-bone angles reach a real local toe target for both leg types',()=>{
 const out={hip:0,knee:0};
 for(const front of [true,false]){
  const len=front?.225:.268,upper=len*.52,lower=len-upper;
  for(const z of [-.11,-.06,0,.06,.11]){
   const y=-len+.065;
   dogLegAngles(y,z,len,front,out);
   const py=-upper*Math.cos(out.hip)-lower*Math.cos(out.hip+out.knee);
   const pz=-upper*Math.sin(out.hip)-lower*Math.sin(out.hip+out.knee);
   assert.ok(Math.hypot(py-y,pz-z)<1e-7);
  }
 }
});