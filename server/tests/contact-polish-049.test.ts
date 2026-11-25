import assert from 'node:assert/strict';
import test from 'node:test';
import { Vector3, Object3D } from 'three';
import { Actor } from '../../src/game/Actor';
import { stableElbowPlane, conversationEyeLead } from '../../src/game/ContactMotion';

test('elbow plane stays orthogonal and unit length even at singular reach directions',()=>{
 for(const x of [-.44,.44])for(const perturbation of [0,1e-8,1e-4,.02]){
  const preferred=new Vector3(x,-1,-.16);
  const direction=preferred.clone().add(new Vector3(perturbation,0,0)).normalize();
  const bend=stableElbowPlane(preferred.clone(),direction);
  assert.ok(Math.abs(bend.dot(direction))<1e-8);
  assert.ok(Math.abs(bend.length()-1)<1e-8);
 }
});
test('singular two-bone reach keeps wrist at a reachable target and joint rotations normalized',()=>{
 for(const role of ['vlad','alina'] as const){
  const actor=new Actor(role,[0,0]);
  const probe=actor as unknown as {rightArm:Object3D;rig:{chest:Object3D;wrists:Object3D[];upperArm:number;lowerArm:number};reach(index:1,goal:Vector3,alpha:number):void};
  const {rig,rightArm}=probe;
  const target=rig.chest.localToWorld(rightArm.position.clone().add(new Vector3(.44,-1,-.16).normalize().multiplyScalar((rig.upperArm+rig.lowerArm)*.7)));
  probe.reach(1,target,1);
  assert.ok(rig.wrists[1].getWorldPosition(new Vector3()).distanceTo(target)<.002);
  actor.root.traverse(n=>assert.ok(Math.abs(n.quaternion.length()-1)<1e-6));
 }
});
test('conversation eye lead is bounded and weaker during a task',()=>{
 assert.ok(conversationEyeLead(.4,false)>conversationEyeLead(.4,true));
 assert.equal(conversationEyeLead(10,false),.12);
 assert.equal(conversationEyeLead(-10,false),-.12);
 assert.equal(conversationEyeLead(NaN,false),0);
});
test('speech changes eye gaze but does not animate a reclining resident',()=>{
 for(const role of ['vlad','alina'] as const){
  const a=new Actor(role,[0,0]),b=new Actor(role,[0,0]);
  const samples=[0,0];
  for(const [i,actor] of [a,b].entries()){
   const rig=(actor as unknown as {rig:{animateFace?:(dt:number,asleep:boolean,expression:number,yaw:number)=>void}}).rig;
   rig.animateFace=(_dt,_sleep,_expression,yaw)=>{samples[i]=yaw;};
  }
  a.setConversation(.5,true);
  for(const actor of [a,b])actor.update(.05);
  assert.ok(samples[0]>samples[1]+.05);
  for(const actor of [a,b]){actor.playDomesticActivity('spaRecline');actor.update(.05);}
  assert.deepEqual(samples,[0,0]);
 }
});
