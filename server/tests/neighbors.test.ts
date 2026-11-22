import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { NEIGHBORS, NEIGHBOR_PATH, NEIGHBOR_ROUTE_LENGTH, neighborPose, neighborVisits } from '../../src/shared/neighbors';
import { HOUSE, HOUSE_WING, HOME_FLOOR, HOME_PLACEMENTS, KITCHEN_WORK } from '../../src/shared/home';
import { buildFurniture } from '../../src/game/InteriorArt';
import { NeighborPeople } from '../../src/game/NeighborPeople';
import { neighborhoodOutline, portraitHomeFrame } from '../../src/game/HomeFrame';
import { GAME_MINUTES_PER_REAL_SECOND } from '../../src/shared/life';
import { buildNeighborhood } from '../../src/game/NeighborhoodArt';
import { homeStops, NEIGHBOR_HOMES } from '../../src/shared/neighborHomes';
import { buildHomeWing } from '../../src/game/HomeWing';
import { findRoute, pointIsClear, segmentIsClear } from '../../src/game/navigation';
import { placeObstacles } from '../../src/shared/locations';

test('three new rooms are connected to the original office by walkable doors', () => {
  const blocks = placeObstacles('home');
  const origin = { x: 7.50, z: -2.25 };
  const destinations = [
    { x: 12.55, z: -5.45 }, // back room
    { x: 12.55, z: -1.60 }, // central landing
    { x: 12.55, z: 2.15 }, // forward room
  ];
  assert.equal(HOUSE.maxX, HOUSE_WING.minX, 'the new wing must meet the old wall');
  for (const destination of destinations) {
    assert.ok(pointIsClear(destination, blocks, HOME_FLOOR), 'room must be free');
    assert.ok(findRoute(origin, destination, blocks, HOME_FLOOR), 'room door must be reachable');
  }
  assert.equal(segmentIsClear(origin, destinations[1], blocks, HOME_FLOOR), true,
    'office-to-wing doorway should not be blocked');
  assert.equal(segmentIsClear({ x: 10.4, z: -5.45 }, { x: 10.4, z: 2.15 }, blocks, HOME_FLOOR), false,
    'partitions should require doorways away from their openings');
});

test('tea and coffee machines have independent click geometry and clear counters', () => {
  const objects = new Map<string, THREE.Box3>();
  buildFurniture((id, root) => {
    root.updateMatrixWorld(true);
    objects.set(id, new THREE.Box3().setFromObject(root));
  });
  assert.ok(objects.get('kettle'));
  assert.ok(objects.get('coffeeMaker'));
  const kettle = objects.get('kettle')!;
  const coffee = objects.get('coffeeMaker')!;
  assert.equal(kettle.intersectsBox(coffee), false, 'the appliances must not overlap');
  assert.ok(Math.abs(HOME_PLACEMENTS.coffeeMaker.x - HOME_PLACEMENTS.kettle.x) > 1.4);
  assert.ok(pointIsClear(KITCHEN_WORK.tea.position, placeObstacles('home'), HOME_FLOOR));
  assert.ok(pointIsClear(KITCHEN_WORK.coffee.position, placeObstacles('home'), HOME_FLOOR));
});

test('neighbors remain deterministic, quiet at night and much rarer than constant foot traffic', () => {
  assert.equal(NEIGHBORS.length,14);
  assert.equal(new Set(NEIGHBORS.map(p=>p.name)).size,14);
  let activeMinutes=0, max=0, silent=0;
  for(let minute=0;minute<1440;minute++) {
    const poses=NEIGHBORS.map((_,i)=>neighborPose(i,minute));
    const active=poses.filter(p=>p.visible);
    max=Math.max(max,active.length);
    activeMinutes+=Number(active.length>0);
    silent+=Number(active.length===0);
    if(minute<450||minute>1320)assert.equal(active.length,0,'late-night suburb must be quiet');
    for(const [i,pose] of poses.entries()) {
      assert.deepEqual(pose,neighborPose(i,minute));
      if(!pose.visible)continue;
      assert.ok(pose.x < HOUSE.minX-.5 || pose.x>HOUSE_WING.maxX+.5 ||
        !(pose.x>-.65 && pose.x<9.3 && pose.z>-1.75 && pose.z<4.51),NEIGHBORS[i].name+' walked into the family house');
    }
  }
  assert.ok(max<=4,'rear gardens remain calm rather than a street crowd');
  assert.ok(activeMinutes>300&&activeMinutes<950,'real family routines now show throughout daytime');
  assert.ok(silent>500,'night and intermittent periods remain quiet');
});

test('two real residents meet face-to-face for eighteen game minutes', () => {
  const pair=neighborVisits(0,NEIGHBORS.length).filter(e=>e.kind==='chat').slice(0,2);
  assert.equal(pair.length,2);
  assert.equal(pair[0].start,pair[1].start);
  assert.equal(pair[0].companion,pair[1].resident);
  const conversationStart=pair[0].start+29.4;
  for(let minute=conversationStart;minute<conversationStart+17;minute+=.5) {
    const a=neighborPose(pair[0].resident,minute);
    const b=neighborPose(pair[1].resident,minute);
    assert.equal(a.action,'chat');assert.equal(b.action,'chat');
    assert.ok(Math.hypot(a.x-b.x,a.z-b.z)>1.25);
    assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<1.90);
    assert.ok(a.yaw>1 && b.yaw< -1,'face-to-face, without talking past one another');
    assert.ok(a.gestureBlend>.2 && b.gestureBlend>.2);
  }
  assert.equal(neighborPose(pair[0].resident,pair[0].start+49).action,'wave');
});

test('sidewalks and all 14 distinct articulated neighbors stay noninteractive', () => {
  const scene=new THREE.Scene();
  buildHomeWing(scene);buildNeighborhood(scene);
  assert.equal(scene.children.length,2);
  const crowd=new NeighborPeople();
  crowd.bindDoors(scene);
  assert.equal(crowd.group.children.length,NEIGHBORS.length);
  crowd.update(12*60+14);
  let shown=0,activeMeshes=0;
  for(const person of crowd.group.children) {
    if(!person.visible)continue;
    shown++;
    person.traverse(obj=>{if(obj instanceof THREE.Mesh && obj.visible)activeMeshes++});
    assert.equal(person.userData.interactable,undefined);
  }
  assert.ok(shown<=4 && shown>=1,'neighbors active on their plots at midday');
  assert.ok(activeMeshes<=250,'active NPC models remain practical for mobile');
  for(const home of NEIGHBOR_HOMES)assert.ok(scene.getObjectByName('neighbor-door-'+home.id));
});

test('scheduled NPCs actually stop for real chores and do not slide while gesturing', () => {
  const visit=neighborVisits(0,NEIGHBORS.length).find(v=>v.kind==='garden')!;
  let moment:number|undefined;
  for(let minute=visit.start;minute<visit.end;minute+=.15) {
    const pose=neighborPose(visit.resident,minute);
    if(pose.action==='water'&&pose.gestureBlend>.99){moment=minute;break;}
  }
  assert.ok(moment!==undefined,'water chore must include a visible real stop');
  const before=neighborPose(visit.resident,moment);
  const after=neighborPose(visit.resident,moment+.2);
  assert.equal(after.action,'water');
  assert.ok(Math.hypot(before.x-after.x,before.z-after.z)<.0001);
});

test('the new rear public walkway leaves a safe reserve and all four homes stay behind the family',()=>{
  const positions=NEIGHBOR_PATH;
  assert.ok(positions.every(p=>p.z===positions[0].z),'all walking happens on rear public lane');
  for(let i=1;i<positions.length;i++)assert.ok(positions[i].x>positions[i-1].x);
  assert.ok(HOUSE.minZ-positions[0].z>=7.5,'expansion strip behind main house');
  assert.ok(NEIGHBOR_ROUTE_LENGTH>=48,'rear paths span the neighborhood gardens');
  for(const home of NEIGHBOR_HOMES){
    assert.ok(home.side==='rear'&&home.z+home.depth/2+4<positions[0].z);
  }
  const scene=new THREE.Scene();
  buildNeighborhood(scene);
  const bounds=new THREE.Box3().setFromObject(scene);
  assert.ok(bounds.min.x<-24 && bounds.max.x>24);
  assert.ok(bounds.min.z<-28);
});

test('neighbors physically leave their own doors and return home without street teleportation', () => {
  const today=neighborVisits(0,NEIGHBORS.length);
  assert.ok(today.length>=9);
  for(const visit of today) {
    const door=homeStops(NEIGHBOR_HOMES[visit.home]).door;
    const early=neighborPose(visit.resident,visit.start+.5);
    const mid=neighborPose(visit.resident,(visit.start+visit.end)/2);
    const late=neighborPose(visit.resident,visit.end-.5);
    const gone=neighborPose(visit.resident,visit.end+.1);
    assert.ok(early.opacity>0 && early.opacity<1);
    assert.ok(mid.opacity>.98);
    assert.ok(late.opacity>0 && late.opacity<1);
    assert.ok(Math.hypot(early.x-door.x,early.z-door.z)<1.8,'exit through own door');
    assert.ok(Math.hypot(late.x-door.x,late.z-door.z)<1.8,'return through own door');
    assert.equal(gone.visible,false,'no eternal street NPC');
  }
  const tomorrow=neighborVisits(1440,NEIGHBORS.length);
  assert.ok(today.some((e,i)=>e.resident!==tomorrow[i].resident),
    'different family members should sometimes leave their homes');
});

async function fullCast() {
  const crowd=new NeighborPeople();
  const loader=new GLTFLoader();
  await Promise.all(NEIGHBORS.map(async (_,i)=>{
    const id=String(i+1).padStart(2,'0');
    const source=readFileSync(new URL('../../src/assets/neighbors/neighbor-'+id+'.glb',import.meta.url));
    const asset=await loader.parseAsync(Uint8Array.from(source).buffer,'');
    crowd.mount(i,asset);
  }));
  return crowd;
}

test('hair, coats, skirts and accessories are genuinely different geometric styles', async () => {
  assert.ok(new Set(NEIGHBORS.map(p=>p.hairStyle)).size >= 9);
  assert.ok(new Set(NEIGHBORS.map(p=>p.outfit)).size >= 7);
  assert.ok(new Set(NEIGHBORS.map(p=>p.accessory)).size >= 3);
  const crowd = await fullCast();
  const meshCount = crowd.group.children.map(root=>{
    let count=0;
    root.traverse(obj=>{if(obj instanceof THREE.Mesh)count++;});
    return count;
  });
  assert.ok(Math.max(...meshCount) - Math.min(...meshCount) <= 4,
    'variety should not blow up rig draw calls');
  // Alpha must not leak through the globally cached material to other NPCs.
  const getMaterial = (index:number) => {
    let material:THREE.Material|undefined;
    crowd.group.children[index].traverse(obj=>{
      if(!material && obj instanceof THREE.SkinnedMesh)material=obj.material as THREE.Material;
    });
    return material;
  };
  assert.notEqual(getMaterial(2),getMaterial(9));
});

test('desktop neighborhood overview frames moved sidewalks without shrinking mobile home view', () => {
  const frame = portraitHomeFrame(46,1440/900,{top:.08,bottom:.9},
    neighborhoodOutline,undefined,[.49,1.28,1.37]);
  const camera = new THREE.PerspectiveCamera(46,1440/900,.1,200);
  camera.position.copy(frame.position);
  camera.lookAt(frame.target);
  camera.updateMatrixWorld();
  for(const point of NEIGHBOR_PATH) {
    const projected=new THREE.Vector3(point.x,0,point.z).project(camera);
    assert.ok(Math.abs(projected.x)<.97, 'sidewalk horizontal overview');
    assert.ok(projected.z<1, 'sidewalk must be in front of far plane');
  }
});

test('smooth human-shaped NPCs walk with natural knees, eyes, head movement and blinking', async () => {
  const crowd=await fullCast();
  let samples=0,raisedKnee=false,tiltedHead=false,blinkSeen=false;
  for(let minute=455;minute<1280;minute+=.22) {
    crowd.update(minute);
    for(let i=0;i<NEIGHBORS.length;i++) {
      const pose=neighborPose(i,minute);
      if(!pose.visible||pose.opacity<.85)continue;
      const root=crowd.group.children[i];
      const head=root.getObjectByName('Head') as THREE.Group;
      const leftKnee=root.getObjectByName('KneeL') as THREE.Group;
      const rightKnee=root.getObjectByName('KneeR') as THREE.Group;
      const foot=root.getObjectByName('AnkleL') as THREE.Group;
      const eyelids=(root.getObjectsByProperty('isSkinnedMesh',true) as THREE.SkinnedMesh[])
        .find(mesh=>mesh.morphTargetDictionary?.CloseLids!==undefined);
      assert.ok(head&&leftKnee&&rightKnee&&foot&&eyelids);
      raisedKnee||=Math.max(leftKnee.rotation.x,rightKnee.rotation.x)>.12;
      tiltedHead||=Math.abs(head.rotation.y)>.035;
      blinkSeen||=(eyelids.morphTargetInfluences?.[eyelids.morphTargetDictionary!.CloseLids]??0)>.12;
      root.updateMatrixWorld(true);
      const world=new THREE.Vector3();
      foot.getWorldPosition(world);
      assert.ok(world.y>-.20&&world.y<.35,'feet respect lawn and stone elevations');
      assert.ok(Math.abs(head.rotation.x)<.27&&Math.abs(head.rotation.y)<.40);
      samples++;
    }
  }
  assert.ok(samples>100&&raisedKnee&&tiltedHead&&blinkSeen);
});

test('NPCs perform legible chores and gestures with deterministic rig motion on two clients', async () => {
  const crowd=await fullCast();
  const actions=['chat','phone','wave','look','adjust','stretch','water','sip','mail','carry'] as const;
  for(const action of actions) {
    let found:{minute:number;index:number}|undefined;
    for(let day=0;day<4&&!found;day++) {
      for(const event of neighborVisits(day*1440,NEIGHBORS.length)) {
        for(let minute=event.start+1;minute<event.end-.4;minute+=.65) {
          const global=day*1440+minute;
          const p=neighborPose(event.resident,global);
          if(p.visible && p.opacity>.7 && p.action===action && p.gestureBlend>.90) {
            found={minute:global,index:event.resident};break;
          }
        }
        if(found)break;
      }
    }
    assert.ok(found,action+' must be visible in a real daily event');
    const {minute,index}=found;
    crowd.update(minute);
    const root=crowd.group.children[index];
    const head=root.getObjectByName('Head') as THREE.Group;
    const leftArm=root.getObjectByName('ArmL') as THREE.Group;
    const rightArm=root.getObjectByName('ArmR') as THREE.Group;
    const rightElbow=root.getObjectByName('ElbowR') as THREE.Group;
    assert.ok(head&&leftArm&&rightArm&&rightElbow);
    if(action==='wave')assert.ok(rightArm.rotation.z< -1.4);
    if(action==='stretch')assert.ok(leftArm.rotation.z>.8&&rightArm.rotation.z<-.8);
    if(action==='phone')assert.ok(rightElbow.rotation.x<-.75);
    if(action==='water')assert.ok(root.getObjectByName('Head'));
    if(action==='sip')assert.ok(rightElbow.rotation.x<-.8);
    if(action==='mail')assert.ok(rightElbow.rotation.x<-.6);
    if(action==='adjust')assert.ok(leftArm.rotation.z>.2);
    const first=[leftArm.rotation.x,rightArm.rotation.z,rightElbow.rotation.x,head.rotation.y];
    crowd.update(minute);
    const second=[leftArm.rotation.x,rightArm.rotation.z,rightElbow.rotation.x,head.rotation.y];
    assert.deepEqual(second,first,'both players see the same gestures');
  }
});

test('neighbor animations blend smoothly across idle, conversation and chores', async () => {
  const crowd=await fullCast();
  const frame=GAME_MINUTES_PER_REAL_SECOND/60;
  let checked=0;
  for(let minute=456;minute<1280;minute+=.34) {
    const visible=NEIGHBORS.map((_,i)=>i).filter(i=>{
      const a=neighborPose(i,minute),b=neighborPose(i,minute+frame);
      return a.visible&&b.visible&&a.opacity>.75&&b.opacity>.75;
    });
    for(const index of visible) {
      const root=crowd.group.children[index];
      crowd.update(minute);
      const arm=root.getObjectByName('ArmR') as THREE.Group;
      const knee=root.getObjectByName('KneeL') as THREE.Group;
      const head=root.getObjectByName('Head') as THREE.Group;
      const before=[arm.rotation.x,arm.rotation.z,knee.rotation.x,head.rotation.x,head.rotation.y];
      crowd.update(minute+frame);
      const after=[arm.rotation.x,arm.rotation.z,knee.rotation.x,head.rotation.x,head.rotation.y];
      const delta=Math.max(...before.map((v,i)=>Math.abs(v-after[i])));
      assert.ok(delta<.24,'one-frame joint snap '+delta);
      checked++;
    }
  }
  assert.ok(checked>100,'cover actual visible activity transitions');
});

test('oncoming neighbors use separate lanes and never overlap on a simulated full day', () => {
  let closest=Infinity,checked=0;
  for(let minute=0;minute<1440;minute+=.25) {
    const poses=NEIGHBORS.map((_,i)=>neighborPose(i,minute));
    for(let i=0;i<poses.length;i++) for(let j=i+1;j<poses.length;j++) {
      if(poses[i].opacity<.60 || poses[j].opacity<.60)continue;
      const distance=Math.hypot(poses[i].x-poses[j].x,poses[i].z-poses[j].z);
      closest=Math.min(closest,distance);
      assert.ok(distance>.57,NEIGHBORS[i].name+' and '+NEIGHBORS[j].name+' intersected');
      checked++;
    }
  }
  assert.ok(checked>300 && closest<2,'must actually test nearby oncoming traffic');
});

test('pedestrians fade independently instead of changing shared apartment materials', async () => {
  const crowd=await fullCast();
  let picked:number|undefined,personA=-1,personB=-1;
  for(let minute=540;minute<1100 && picked===undefined;minute+=.2) {
    const poses=NEIGHBORS.map((_,i)=>neighborPose(i,minute));
    for(let i=0;i<poses.length;i++)for(let j=i+1;j<poses.length;j++) {
      if(poses[i].opacity>.08 && poses[i].opacity<.66 && poses[j].opacity>.98) {
        picked=minute;personA=i;personB=j;break;
      }
      if(picked!==undefined)break;
    }
  }
  assert.ok(picked!==undefined,'must find two different fade phases');
  crowd.update(picked);
  const material=(index:number) => {
    let first:THREE.MeshStandardMaterial|undefined;
    crowd.group.children[index].traverse(obj=>{
      if(!first&&obj instanceof THREE.SkinnedMesh&&obj.visible)first=obj.material as THREE.MeshStandardMaterial;
    });
    return first!;
  };
  const a=material(personA),c=material(personB);
  assert.notEqual(a,c);
  assert.ok(a.opacity<.67 && a.transparent && a.depthWrite===false);
  assert.ok(c.opacity>.98 && !c.transparent && c.depthWrite===true);
});
