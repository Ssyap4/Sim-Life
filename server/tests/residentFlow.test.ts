import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Vector3 } from 'three';
import { Actor } from '../../src/game/Actor';
import { smoothResidentTrafficStep, residentTraffic, type TrafficBody } from '../../src/game/ResidentFlow';
import { RESIDENT_CLEARANCE } from '../../src/game/residentCollision';
import { pointIsClear, type FloorRect } from '../../src/game/navigation';
import { PET_PERSON_CLEARANCE } from '../../src/game/PetTraffic';

const floor:FloorRect={minX:-3,maxX:3,minZ:-2,maxZ:2};
const doorway:FloorRect[]=[
  {minX:-.19,maxX:.19,minZ:-2,maxZ:-.68},
  {minX:-.19,maxX:.19,minZ:.68,maxZ:2},
];

function crossing(dt:number,walls:FloorRect[],stationary=false) {
 const vlad=new Actor('vlad',[-2,0]);
 const alina=new Actor('alina',stationary?[0,0]:[2,0]);
 const states={vlad:residentTraffic(),alina:residentTraffic()};
 let finishedV=0,finishedA=0,freeze=0,maxFreeze=0,directionReversals=0,lateralReversals=0,minDistance=Infinity,lastSign=0,lastLateralSign=0;
 vlad.walkPath([new Vector3(2,0,0)],()=>finishedV++);
 if(!stationary)alina.walkPath([new Vector3(-2,0,0)],()=>finishedA++);
 for(let elapsed=0;elapsed<22&&(!finishedV||(!stationary&&!finishedA));elapsed+=dt){
  const prev=vlad.root.position.clone(),otherPrev=alina.root.position.clone();
  for(const [role,actor,other] of [['vlad',vlad,alina],['alina',alina,vlad]] as const){
   if(!actor.isWalking()) continue;
   actor.update(dt,(from,to)=>{
    const dx=to.x-from.x,dz=to.z-from.z,sep=Math.hypot(other.root.position.x-from.x,other.root.position.z-from.z);
    const facing={x:Math.sin(other.root.rotation.y),z:Math.cos(other.root.rotation.y)};
    const oppose=dx*facing.x+dz*facing.z<-.35*Math.hypot(dx,dz);
    const forward=dx*(other.root.position.x-from.x)+dz*(other.root.position.z-from.z)>0;
    return smoothResidentTrafficStep(from,to,[{position:other.root.position,clearance:RESIDENT_CLEARANCE,person:true,moving:other.isWalking()}],
      walls,floor,states[role],dt,role==='vlad'&&other.isWalking()&&sep<1.15&&oppose&&forward);
   });
   assert.ok(pointIsClear(actor.root.position,walls,floor),'A resident must never cross a wall');
  }
  const sep=vlad.root.position.distanceTo(alina.root.position);
  minDistance=Math.min(minDistance,sep);
  if(sep<.48)throw Error('Body overlap beyond emergency soft clearance: '+sep);
  const shiftV=vlad.root.position.distanceTo(prev),shiftA=alina.root.position.distanceTo(otherPrev);
  if(shiftV<.001&&shiftA<.001){freeze+=dt;maxFreeze=Math.max(maxFreeze,freeze);}else freeze=0;
  const sign=Math.sign(vlad.root.position.x-prev.x);
  if(sign&&lastSign&&sign!==lastSign&&sep<1.7)directionReversals++;
  if(sign)lastSign=sign;
  const lateralShift=vlad.root.position.z-prev.z;
  const lateralSign=Math.abs(lateralShift)>.004?Math.sign(lateralShift):0;
  if(lateralSign&&lastLateralSign&&lateralSign!==lastLateralSign&&sep<1.7)lateralReversals++;
  if(lateralSign)lastLateralSign=lateralSign;
 }
 return {finishedV,finishedA,maxFreeze,directionReversals,lateralReversals,minDistance,posV:vlad.root.position.toArray(),posA:alina.root.position.toArray()};
}

test('Two adults meeting head-on in a tight doorway pass without wall clipping, freezing, or jitter',()=>{
 for(const dt of [1/60,.08,.2]){
  const result=crossing(dt,doorway);
  assert.equal(result.finishedV,1,'Vlad should arrive at dt='+dt+' '+JSON.stringify(result));
  assert.equal(result.finishedA,1,'Alina should arrive at dt='+dt+' '+JSON.stringify(result));
  assert.ok(result.maxFreeze<1.3,'Deadlock duration '+JSON.stringify(result));
  assert.ok(result.minDistance>=.48,'Adults should never merge while passing '+JSON.stringify(result));
  assert.ok(result.directionReversals<3,'No back-and-forth oscillation '+JSON.stringify(result));
  assert.ok(result.lateralReversals<3,'Too many side-to-side corrections '+JSON.stringify(result));
 }
});

test('A moving adult passes a stationary adult in a tight doorway',()=>{
 for(const dt of [1/60,.08,.2]){
  const result=crossing(dt,doorway,true);
  assert.equal(result.finishedV,1,'Vlad should pass at dt='+dt+' '+JSON.stringify(result));
  assert.ok(result.maxFreeze<1.3,'Avoid freezing next to stationary resident '+JSON.stringify(result));
  assert.ok(result.minDistance>=.48,'Emergency clearance remains visible '+JSON.stringify(result));
  assert.ok(result.lateralReversals<3,'No repeated sidestep jitter '+JSON.stringify(result));
 }
});

test('Soft passing never relaxes animal separation or wall collision',()=>{
 const state=residentTraffic(),pet={x:0,z:.13},human={x:.08,z:-.38};
 let position={x:-.83,z:0},minPet=Infinity;
 for(let i=0;i<650;i++){
  const to={x:Math.min(position.x+.023,2),z:0};
  const bodies:TrafficBody[]=[
   {position:pet,clearance:PET_PERSON_CLEARANCE},
   {position:human,clearance:RESIDENT_CLEARANCE,person:true}
  ];
  position=smoothResidentTrafficStep(position,to,bodies,[],floor,state,1/60);
  minPet=Math.min(minPet,Math.hypot(position.x-pet.x,position.z-pet.z));
  assert.ok(pointIsClear(position,[],floor));
 }
 assert.ok(minPet>=PET_PERSON_CLEARANCE-.01,'Pet separation must stay firm');
});
