import assert from 'node:assert/strict';
import test from 'node:test';
import { initialState } from '../../src/shared/protocol';
import { selectSleepBed, bedCapacity, bedPose, isSleepBed } from '../../src/shared/bedSleep';
import { FURNITURE_BY_ID, type PlacedFurniture } from '../../src/shared/furniture';
import { applyFurnishing } from '../furnishing';
import { recoverSleep } from '../timeControl';

function placed(sku:string,id=1,x=-6.97,z=-5.88,rotation=0):PlacedFurniture{
 return {sku,id,x,z,finish:'sage',rotation:rotation as 0|1|2|3};
}
test('every catalog bed is a real sleep target, with correct double/single occupancy',()=>{
 const beds=[...FURNITURE_BY_ID.values()].filter(info=>info.shape==='bed'||info.shape==='daybed');
 assert.ok(beds.length>=9);
 for(const info of beds){
   assert.equal(isSleepBed(placed(info.id)),true);
   assert.equal(bedCapacity(placed(info.id)),info.shape==='bed'&&info.width>=1.55?2:1);
   const state=initialState();
   state.furnishing.soldFixtures=['bed'];
   state.furnishing.placed=[placed(info.id)];
   state.furnishing.nextId=2;
   const anchor=bedPose(state,'vlad',1);
   assert.ok(anchor,'pose for '+info.id);
   assert.ok(Number.isFinite(anchor!.y));
   assert.ok(anchor!.y>=.45 && anchor!.y<.9,info.id+' mattress elevation');
 }
});
test('replacing the starter bed offers a safe approach and two distinct reclining lanes',()=>{
 const state=initialState();
 state.furnishing.soldFixtures=['bed'];
 state.furnishing.placed=[placed('bed-aurora')];state.furnishing.nextId=2;
 const vlad=selectSleepBed(state,'vlad');
 assert.ok(vlad.ok);
 const alina=selectSleepBed(state,'alina');
 assert.ok(alina.ok);
 assert.equal(vlad.bed.id,1);
 assert.equal(alina.bed.id,1);
 assert.ok(Math.hypot(vlad.bed.pose.x-alina.bed.pose.x,vlad.bed.pose.z-alina.bed.pose.z)>.65);
 assert.ok(Math.hypot(vlad.bed.approach.x-vlad.bed.pose.x,vlad.bed.approach.z-vlad.bed.pose.z)>.3);
 state.characters.vlad.pose='sleep';
 state.characters.vlad.sleepingOn=1;
 const alinaStillAllowed=selectSleepBed(state,'alina',1);
 assert.ok(alinaStillAllowed.ok,'double bed supports both partners simultaneously');
});
test('rotated purchased bed anchor follows the mattress rotation',()=>{
 const state=initialState();state.furnishing.soldFixtures=['bed'];
 for(const turn of [0,1,2,3] as const){
   state.furnishing.placed=[placed('bed-platform',1,12.2,-5.3,turn)];
   const anchor=bedPose(state,'vlad',1);
   assert.ok(anchor);
   assert.equal(anchor.yaw,turn*Math.PI/2);
   assert.ok(Math.hypot(anchor.x-12.2,anchor.z+5.3)<1.0);
 }
 state.furnishing.placed=[placed('bed-day',1,12.2,-5.3,1)];
 assert.equal(bedPose(state,'alina',1)?.yaw,Math.PI);
});
test('single bed rejects simultaneous occupancy and another bed remains selectable',()=>{
 const state=initialState();
 state.furnishing.soldFixtures=['bed'];
 state.furnishing.placed=[placed('bed-solo',1,13,-5.7)];state.furnishing.nextId=2;
 const single=selectSleepBed(state,'vlad',1);
 assert.ok(single.ok);
 state.characters.vlad.pose='sleep';state.characters.vlad.sleepingOn=1;
 const rejected=selectSleepBed(state,'alina',1);
 assert.equal(rejected.ok,false);
 if(!rejected.ok)assert.match(rejected.reason,/занята/);
 state.furnishing.placed.push(placed('bed-day',2,12.4,-1.5,0));state.furnishing.nextId=3;
 const second=selectSleepBed(state,'alina',2);
 if(second.ok)assert.equal(second.bed.id,2);
});
test('selling an occupied purchased bed is rejected until wake-up and sleep increases energy',()=>{
 const state=initialState();
 state.furnishing.soldFixtures=['bed'];
 state.furnishing.placed=[placed('bed-aurora')];state.furnishing.nextId=2;
 state.characters.vlad.pose='sleep';state.characters.vlad.sleepingOn=1;
 state.characters.vlad.energy=10;
 const blocked=applyFurnishing(state,'alina',{type:'furniture_sell',id:1},230);
 assert.equal(blocked.ok,false);
 const stored=applyFurnishing(state,'alina',{type:'furniture_store',id:1},230);
 assert.equal(stored.ok,false);
 const res=recoverSleep(state,5,new Map([['vlad','full']]));
 assert.equal(res.length,0);
 assert.ok(state.characters.vlad.energy>10);
 recoverSleep(state,1000,new Map([['vlad','full']]));
 assert.equal(state.characters.vlad.energy,100);
 assert.equal(state.characters.vlad.pose,'idle');
 assert.equal(state.characters.vlad.sleepingOn,undefined);
 const sold=applyFurnishing(state,'alina',{type:'furniture_sell',id:1},240);
 assert.ok(sold.ok);
});

test('real buy → unbox → replace old bedroom bed → sleep uses the purchased item',()=>{
 const starting=initialState();
 starting.money=120000;
 const sold=applyFurnishing(starting,'vlad',{type:'furniture_sell_static',fixture:'bed'},100);
 assert.ok(sold.ok);
 const ordered=applyFurnishing(sold.state,'alina',
   {type:'furniture_order',sku:'bed-aurora',finish:'sage',shipping:'express',quantity:1},110);
 assert.ok(ordered.ok);
 const received=applyFurnishing(ordered.state,'vlad',{type:'furniture_unbox',id:1},125);
 assert.ok(received.ok);
 const placed=applyFurnishing(received.state,'alina',
   {type:'furniture_place',id:1,x:-6.97,z:-5.88,rotation:0},125);
 assert.ok(placed.ok,'the original bed footprint must accept a bought double bed');
 assert.equal(placed.state.furnishing.placed[0].sku,'bed-aurora');
 const sleeping=selectSleepBed(placed.state,'vlad',1);
 assert.ok(sleeping.ok,'the player must be able to use the replacement immediately');
});
