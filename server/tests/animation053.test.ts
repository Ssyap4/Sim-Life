import assert from 'node:assert/strict';
import test from 'node:test';
import {Vector3, Quaternion, Object3D, Group} from 'three';
import {Actor} from '../../src/game/Actor';

test('cup handle stays in the palm and cup stays upright through turns and walking',()=>{
 for(const id of ['vlad','alina'] as const){
  const actor=new Actor(id,[0,0]);
  const rig=actor as unknown as {teaCup:Group;rig:{wrists:Object3D[]}};
  actor.walkPath([new Vector3(1,0,0),new Vector3(1,0,2)],()=>{});
  actor.carryWorkCoffee();
  for(let f=0;f<120;f++){
   actor.update(1/30);
   assert.ok(actor.workCoffeeQA().visible);
   const handle=rig.teaCup.localToWorld(new Vector3(.051,0,0));
   const palm=rig.rig.wrists[1].localToWorld(new Vector3(0,-.055,0));
   assert.ok(handle.distanceTo(palm)<.002,id+' mug handle detached');
   const axis=new Vector3(0,1,0).applyQuaternion(rig.teaCup.getWorldQuaternion(new Quaternion()));
   assert.ok(axis.distanceTo(new Vector3(0,1,0))<.002,id+' cup tilted');
  }
  actor.finishActivity();
  assert.equal(actor.workCoffeeQA().visible,false);
 }
});
test('coffee route catches up in bounded movement steps without repeating arrival',()=>{
 const actor=new Actor('vlad',[0,0]);let arrived=0;let calls=0;
 actor.walkPath([new Vector3(0,0,1.8)],()=>arrived++);
 actor.carryWorkCoffee();
 actor.update(.2,(from,to)=>{calls++;assert.ok(Math.hypot(to.x-from.x,to.z-from.z)<=.36+1e-8);return to;},.8);
 assert.ok(Math.abs(actor.root.position.z-1.44)<1e-6);
 assert.equal(arrived,0);assert.ok(calls>=4);
 actor.update(.2,undefined,.4);actor.update(.2);
 assert.equal(arrived,1);
});
test('work hands alternate between actual keyboard and right-side mouse',()=>{
 for(const id of ['vlad','alina'] as const){
  const actor=new Actor(id,[0,0]);
  const keys=[new Vector3(.17,1.116,-.622),new Vector3(-.17,1.116,-.622),new Vector3(-.47,1.10,-.67)] as const;
  actor.setFurniturePose('work',new Vector3(0,id==='vlad'?-.24:-.19,0),Math.PI,keys);
  const rig=(actor as unknown as {rig:{wrists:Object3D[]}}).rig;
  let mouse=Infinity,key=Infinity;
  for(let f=0;f<420;f++){
   actor.update(1/30);
   const wrist=rig.wrists[1].getWorldPosition(new Vector3());
   mouse=Math.min(mouse,wrist.distanceTo(keys[2]));key=Math.min(key,wrist.distanceTo(keys[1]));
  }
  assert.ok(key<.10,id+' key '+key);
  assert.ok(mouse<.15,id+' mouse '+mouse);
 }
});


test('gift handoff follows the authoritative active phase even on slow or replayed frames',()=>{
 for(const sender of ['vlad','alina'] as const){
  const actors={vlad:new Actor('vlad',[0,0]),alina:new Actor('alina',[.8,0])};
  for(const [role,a] of Object.entries(actors))a.playGift('giftBear',role===sender,new Vector3(.4,1.06,0));
  for(const t of [0,2,9.95,10.05,15,19]){for(const a of Object.values(actors)){a.syncGiftElapsed(t);a.update(.001);}const other=sender==='vlad'?'alina':'vlad';assert.equal(actors[sender].careQA().gift?.visible,t<10);assert.equal(actors[other].careQA().gift?.visible,t>=10);}
  for(const a of Object.values(actors)){a.clearProps();assert.equal(a.careQA().gift,null);}
 }
});
