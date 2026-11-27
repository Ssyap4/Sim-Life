import test from 'node:test';
import assert from 'node:assert/strict';
import {Actor} from '../../src/game/Actor';
import {Vector3} from 'three';
import {seatTransfer,taskCadence,chewPulse,phoneStroke} from '../../src/game/MotionPolish';
test('weight transfer is smooth, bounded and stronger on rising',()=>{
 for(const sit of [true,false]){
  assert.equal(seatTransfer(0,sit).lean,0);assert.equal(seatTransfer(1,sit).lean,0);
  assert.ok(seatTransfer(.5,sit).lean>.1);
 }
 assert.ok(seatTransfer(.5,false).lean>seatTransfer(.5,true).lean);
});
test('task cadence stays monotonic and separate by personality',()=>{
 for(const role of ['vlad','alina'] as const)for(const rate of [2.3,3.7,6.2,7.4]){
  let last=0;
  for(let i=1;i<600;i++){const t=i/60,next=taskCadence(t,role,rate);assert.ok(next>last);assert.ok(Math.abs(next-t*rate)<.65);last=next;}
 }
 assert.notEqual(taskCadence(3,'vlad',3.7),taskCadence(3,'alina',3.7));
});
test('phone rests every fourth cycle, mouth pulse disappears outside chewing',()=>{
 for(const role of ['vlad','alina'] as const){
  const period=role==='vlad'?4.2:4.7;
  assert.ok(phoneStroke(1.3,role).contact>.9);assert.equal(phoneStroke(period*3+1.3,role).contact,0);
  for(let t=0;t<25;t+=.08){const f=phoneStroke(t,role);assert.ok(f.contact>=0&&f.contact<=1&&Math.abs(f.z)<=.036);assert.equal(chewPulse(t,0,role),0);assert.ok(chewPulse(t,.8,role)<=.8);}
 }
});
test('path catchup uses actual elapsed movement time instead of exaggerated stride',()=>{
 const a=new Actor('vlad',[0,0]);a.walkPath([new Vector3(20,0,0)],()=>{});
 for(let i=0;i<6;i++)a.update(.1,(from,to)=>({x:from.x+(to.x-from.x)*.25,z:from.z}),.4);
 const p=a as unknown as {gaitBlend:number};
 assert.ok(p.gaitBlend>.45&&p.gaitBlend<.55);
});
