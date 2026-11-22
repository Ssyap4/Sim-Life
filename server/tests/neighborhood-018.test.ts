import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { NEIGHBOR_PATH, NEIGHBORS, neighborVisits, neighborDoorOpen, neighborPose } from '../../src/shared/neighbors';
import { NeighborPeople } from '../../src/game/NeighborPeople';
import { buildNeighborhood, NEIGHBOR_HOMES } from '../../src/game/NeighborhoodArt';
import { HOUSE, HOUSE_WING } from '../../src/shared/home';

test('0.19: four distinct homes are all behind the family home and have individual yards',()=>{
 assert.equal(NEIGHBOR_HOMES.length,4);
 assert.ok(NEIGHBOR_HOMES.every(h=>h.side==='rear'&&h.yaw===0));
 assert.equal(new Set(NEIGHBOR_HOMES.map(h=>h.id)).size,4);
 assert.equal(new Set(NEIGHBOR_HOMES.map(h=>h.plaster)).size,4);
 assert.equal(new Set(NEIGHBOR_HOMES.map(h=>h.roof)).size,4);
 const sorted=[...NEIGHBOR_HOMES].sort((a,b)=>a.x-b.x);
 for(const h of sorted)assert.ok(h.z+h.depth/2+4<NEIGHBOR_PATH[0].z, 'cottage stays behind its walkway');
 for(let i=1;i<sorted.length;i++)
  assert.ok(sorted[i].x-sorted[i].width/2-(sorted[i-1].x+sorted[i-1].width/2)>4,
   'neighbor houses have spaced gardens, not one continuous building');
 assert.ok(HOUSE.minZ-NEIGHBOR_PATH[0].z>=7.5,'future home extension strip');
 assert.ok(HOUSE_WING.maxX<sorted[3].x+sorted[3].width/2);
});

test('rear footpath and scenery are one batched noninteractive scene without shadow casting',()=>{
 const scene=new THREE.Scene();
 buildNeighborhood(scene);
 assert.equal(scene.children.length,1);
 const root=scene.children[0];
 assert.match(root.name,/neighboring homes/i);
 const homes=root.children.filter(ch=>ch.name.startsWith('Фоновый дом'));
 assert.equal(homes.length,4);
 let meshes=0;
 root.traverse(object=>{
  if(!(object instanceof THREE.Mesh))return;
  meshes++;
  assert.equal(object.userData.interactable,undefined);
  assert.equal(object.castShadow,false);
 });
 assert.ok(meshes<75,'batching retains affordable draw calls: '+meshes);
 const box=new THREE.Box3().setFromObject(root);
 assert.ok(box.min.x < -24 && box.max.x > 24);
 assert.ok(box.min.z < -28);
});

test('each real home opens its independent 3D hinge as a family NPC emerges and returns',()=>{
 const scene=new THREE.Scene();
 buildNeighborhood(scene);
 const crowd=new NeighborPeople();
 crowd.bindDoors(scene);
 const events=neighborVisits(0,NEIGHBORS.length);
 assert.equal(new Set(events.map(e=>e.home)).size,4);
 for(let home=0;home<NEIGHBOR_HOMES.length;home++){
   const first=events.find(e=>e.home===home)!;
   const door=scene.getObjectByName('neighbor-door-'+NEIGHBOR_HOMES[home].id) as THREE.Group;
   assert.ok(door && door.children.length>=1);
   crowd.update(first.start);
   assert.ok(door.rotation.y<-.9);
   assert.ok(neighborDoorOpen(home,first.start,NEIGHBORS.length)>.85);
   crowd.update(first.end-1.3);
   assert.ok(door.rotation.y<-.55);
   crowd.update(first.end+8);
   assert.ok(Math.abs(door.rotation.y)<.001);
 }
});

test('neighbors actually appear across morning, afternoon and evening, with garden routines more common than street trips',()=>{
 const visits=neighborVisits(0,NEIGHBORS.length);
 assert.ok(visits.length>=27,'dozens of small household scenes across the day');
 const homeRoutines=visits.filter(v=>['garden','tea','mail','exercise'].includes(v.kind));
 const trips=visits.filter(v=>['errand','stroll'].includes(v.kind));
 assert.ok(homeRoutines.length>trips.length*6);
 let active=0,quietAtNight=0;
 const periods=[[500,570],[790,900],[1110,1250]];
 for(const [start,end] of periods){
   let visible=0;
   for(let minute=start;minute<end;minute++)if(NEIGHBORS.some((_,i)=>neighborPose(i,minute).visible))visible++;
   assert.ok(visible>10,'actual NPCs should be visible in each daytime period '+start);
 }
 for(let m=0;m<1440;m++){
   const current=NEIGHBORS.filter((_,i)=>neighborPose(i,m).visible);
   active+=Number(current.length>0);
   if(m<448||m>1320){assert.equal(current.length,0);quietAtNight++;}
   assert.ok(current.length<=4,'small village, not a crowded city');
 }
 assert.ok(active>300 && active<950,'local lives should be visible but leave quiet gaps');
 assert.ok(quietAtNight>500);
});

test('fourteen unique NPC models still have articulated heads and real textured-eye geometry',()=>{
 const crowd=new NeighborPeople();
 assert.equal(crowd.group.children.length,14);
 let faces=0,eyes=0;
 for(const rig of crowd.group.children){
   const head=rig.getObjectByName('neighbor-head') as THREE.Group;
   assert.ok(head);
   let face=false,eye=false;
   head.traverse(part=>{
    if(!(part instanceof THREE.Mesh))return;
    const verts=part.geometry.getAttribute('position')?.count??0;
    if(verts>450)face=true;
    if(verts===85)eye=true;
   });
   faces+=Number(face);eyes+=Number(eye);
 }
 assert.equal(faces,14);assert.equal(eyes,14);
});
