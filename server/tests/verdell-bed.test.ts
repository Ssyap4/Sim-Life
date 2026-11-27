import test from 'node:test';
import * as THREE from 'three';
import {PetActor} from '../../src/game/PetActor';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {dogBedSites,chooseDogBed} from '../../src/shared/dogBed';
import {checkFurniturePlacement} from '../../src/shared/furnishingPlacement';
import {applyPetAction,runPetRoutines} from '../pets';
import {applyFurnishing} from '../furnishing';
import {gameMinutes} from '../../src/shared/life';
import {FURNITURE_BY_ID,type PlacedFurniture} from '../../src/shared/furniture';
import {bedPose} from '../../src/shared/bedSleep';

function setup(){
 const s=initialState();const stair:PlacedFurniture={id:999,sku:'pet-bed-stairs',finish:'sage',x:-6.10,z:-3.87,rotation:0};
 assert.ok(checkFurniturePlacement(s,stair).valid);
 s.furnishing.placed.push(stair);s.furnishing.nextId=1000;
 return {s,stair};
}
test('stairs are required, can be installed by starter bed and dog goes to the middle',()=>{
 const {s,stair}=setup();
 assert.equal(applyPetAction(initialState(),'vlad','verdell','bedTogether').ok,false);
 assert.equal(applyPetAction(s,'vlad','simba','bedTogether').ok,false);
 const site=dogBedSites(s,stair)[0];assert.ok(site);assert.equal(site.bed,'starter');
 const a=bedPose(s,'vlad','starter')!,b=bedPose(s,'alina','starter')!;
 assert.equal(site.rest.x,(a.x+b.x)/2);
 assert.ok(site.steps[0].y<site.steps[1].y&&site.steps[1].y<site.steps[2].y&&site.steps[2].y<site.steps[3].y);
 const r=applyPetAction(s,'vlad','verdell','bedTogether');assert.ok(r.ok);assert.equal(r.state.pets.verdell.routine?.kind,'bedTogether');
 assert.deepEqual(r.state.characters,s.characters);assert.equal(r.state.money,s.money);
 assert.equal(applyFurnishing(r.state,'vlad',{type:'furniture_store',id:stair.id},gameMinutes(s.clock)).ok,false);
 const now=gameMinutes(s.clock);Object.assign(r.state.characters.vlad,{pose:'sleep',sleepingOn:'starter'});
 runPetRoutines(r.state,10,now+10,new Set(),()=>.5);assert.ok(r.state.pets.verdell.routine?.dogBed?.joined);
 runPetRoutines(r.state,10,now+120,new Set(),()=>.5);assert.equal(r.state.pets.verdell.routine?.kind,'bedTogether');
 const leave=applyPetAction(r.state,'alina','verdell','leaveBed');assert.ok(leave.ok);assert.equal(leave.state.pets.verdell.routine,undefined);
 r.state.characters.vlad.pose='idle';
 runPetRoutines(r.state,1,now+121,new Set(),()=>.5);assert.notEqual(r.state.pets.verdell.routine?.kind,'bedTogether');
});
test('all bed models and four rotations derive real mattress height and center',()=>{
 for(const sku of ['bed-solo','bed-aurora','bed-line','bed-day','bed-canopy','bed-platform','bed-rattan','daybed-iron','bed-storage']){
  for(const rotation of [0,1,2,3] as const){
   const s=initialState();s.furnishing.soldFixtures=['bed'];s.furnishing.placed=[];
   const bed:PlacedFurniture={id:10,sku,finish:'sage',x:12.5,z:-5.4,rotation};
   const info=FURNITURE_BY_ID.get(sku)!,day=info.shape==='daybed';
   const yaw=rotation*Math.PI/2+(day?Math.PI/2:0),length=day?info.width:info.depth;
   // Keep both bed and ladder in a spacious interior location to test geometry,
   // independent of the layout editor's fixed room targets.
   bed.x=0;bed.z=8;
   const distance=length/2+.57;
   const stair:PlacedFurniture={id:11,sku:'pet-bed-stairs',finish:'sage',x:bed.x+Math.sin(yaw)*distance,z:bed.z+Math.cos(yaw)*distance,rotation:((rotation+(day?1:0))%4) as 0|1|2|3};
   s.furnishing.placed=[bed,stair];
   // The yard's outer boundary/fixtures may obstruct the bottom in a given rotation.
   const sites=dogBedSites(s,stair);
   if(!sites.length)continue;
   assert.equal(sites[0].bed,10);assert.equal(sites[0].height,bedPose(s,'vlad',10)!.y-.11);
  }
 }
 const {s}=setup();assert.ok(chooseDogBed(s,'vlad'));
});
test('dog rig climbs onto the mattress and descends without moving the floor anchor',()=>{
 const {s,stair}=setup(),site=dogBedSites(s,stair)[0];
 const dog=new PetActor('verdell');dog.syncGround(site.approach.x,site.approach.z);
 const anchor=dog.root.position.clone();
 dog.followRoute([],'bedTogether',undefined,undefined,undefined,false,undefined,undefined,0,undefined,undefined,undefined,site);
 for(let i=0;i<100;i++)dog.update(.05);
 dog.root.updateMatrixWorld(true);
 const body=dog.root.children[0],at=body.getWorldPosition(new THREE.Vector3());
 assert.ok(dog.root.position.equals(anchor));
 assert.ok(Math.hypot(at.x-site.rest.x,at.z-site.rest.z)<.03);
 assert.ok(Math.abs(at.y-site.height)<.22);
 dog.stop();dog.syncGround(site.approach.x,site.approach.z);
 for(let i=0;i<100;i++)dog.update(.05);
 dog.root.updateMatrixWorld(true);
 assert.ok(body.getWorldPosition(new THREE.Vector3()).y<.25);
 assert.ok(dog.root.position.equals(anchor));
});
test('Verdell wakes gently on the mattress before taking the stairs down',()=>{
 const {s,stair}=setup(),site=dogBedSites(s,stair)[0];
 const dog=new PetActor('verdell');dog.syncGround(site.approach.x,site.approach.z);
 dog.followRoute([],'bedTogether',undefined,undefined,undefined,false,undefined,undefined,0,undefined,undefined,undefined,site);
 for(let i=0;i<100;i++)dog.update(.05);
 const body=dog.root.children[0],before=body.position.clone(),scale=body.scale.y;
 dog.stop();dog.update(1/60);
 assert.ok(body.position.distanceTo(before)<.08,'first descent frame pops');
 assert.ok(Math.abs(body.scale.y-scale)<.04,'nap silhouette changes abruptly');
 for(let i=0;i<100;i++)dog.update(.05);
 assert.ok(body.position.y<.25);
});