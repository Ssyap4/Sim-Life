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
import { DISTRICT_SITES, DISTRICT_OBSTACLES, DISTRICT_FLOOR, sitePoint } from '../../src/shared/district';
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

test('four cottage owners and ten independent walkers keep the neighborhood active', () => {
  assert.equal(NEIGHBORS.length,14);
  assert.equal(new Set(NEIGHBORS.map(p=>p.name)).size,14);
  const events=neighborVisits(0,14);
  assert.ok(events.length>=35,'a few short outings should not leave an empty district');
  for(let i=0;i<14;i++) {
    const mine=events.filter(e=>e.resident===i);
    assert.ok(mine.length>=2,NEIGHBORS[i].name+' never goes out');
    assert.ok(mine.every(e=>i<4?e.home===i:e.home===-1),'public walkers must not own the cottages');
  }
  const venues=new Set(events.map(e=>e.venue).filter(Boolean));
  for(const site of DISTRICT_SITES)assert.ok(venues.has(site.place),'no traffic at '+site.place);
  let occupied=0,peak=0,visibleTotal=0;
  for(let minute=0;minute<1440;minute+=2){
    const poses=NEIGHBORS.map((_,i)=>neighborPose(i,minute));
    const active=poses.filter(p=>p.visible).length;
    visibleTotal+=active;
    peak=Math.max(peak,active);
    if(active>=3)occupied++;
    if(minute<440||minute>1335)assert.equal(active,0,'keep overnight streets quiet');
    for(const [i,pose] of poses.entries())assert.deepEqual(pose,neighborPose(i,minute));
  }
  assert.ok(peak>=4&&peak<=10,'visible activity with sane mobile crowd limits');
  assert.ok(occupied>100,'neighborhood should have people during most daytime checks');
  assert.ok(visibleTotal>800,'not another mostly-invisible daily schedule');
});

test('visitors chat face-to-face near the park and the square',()=>{
  const visits=neighborVisits(0,14).filter(v=>v.kind==='chat'&&v.home===-1);
  assert.ok(visits.length>=2);
  for(const first of visits.filter(v=>v.resident%2===0)) {
    const second=visits.find(v=>v.resident===first.companion&&v.start===first.start);
    assert.ok(second,'conversation needs a synchronized companion');
    let saw=false;
    for(let minute=first.start;minute<Math.min(first.end,second.end);minute+=.5){
      const a=neighborPose(first.resident,minute),b=neighborPose(second.resident,minute);
      if(a.action!=='chat'||b.action!=='chat'||a.opacity<.85||b.opacity<.85)continue;
      assert.ok(Math.hypot(a.x-b.x,a.z-b.z)>1.2);
      assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<2);
      saw=true;break;
    }
    assert.ok(saw,'meet in the same place rather than talking from different streets');
  }
});

test('all fourteen visual avatars render individually without interaction hitboxes',()=>{
  const scene=new THREE.Scene();
  buildHomeWing(scene);buildNeighborhood(scene);
  assert.equal(scene.children.length,2);
  const crowd=new NeighborPeople();
  crowd.bindDoors(scene);
  assert.equal(crowd.group.children.length,NEIGHBORS.length);
  crowd.update(12*60+14);
  let shown=0;
  for(const person of crowd.group.children){
    if(!person.visible)continue;
    shown++;
    assert.equal(person.userData.interactable,undefined);
  }
  const lunchtime=Array.from({length:61},(_,i)=>690+i*2)
    .map(minute=>NEIGHBORS.filter((_,i)=>neighborPose(i,minute).visible).length);
  assert.ok(Math.max(...lunchtime)>=3,'lunchtime should have multiple passers-by');
  assert.ok(shown>=1&&shown<=10,'somebody should be out even between busy waves');
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

test('cottage owners leave by their own doors; public visitors fade at street edges',()=>{
  const today=neighborVisits(0,14);
  for(const visit of today){
    const origin=visit.home<0?undefined:homeStops(NEIGHBOR_HOMES[visit.home]).door;
    const early=neighborPose(visit.resident,visit.start+.5);
    const late=neighborPose(visit.resident,visit.end-.5);
    assert.ok(early.opacity>0&&early.opacity<1,'smooth departure');
    assert.ok(late.opacity>0&&late.opacity<1,'smooth return');
    if(origin){
      assert.ok(Math.hypot(early.x-origin.x,early.z-origin.z)<1.8);
      assert.ok(Math.hypot(late.x-origin.x,late.z-origin.z)<1.8);
    }
  }
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
      assert.ok(distance>.57,NEIGHBORS[i].name+' and '+NEIGHBORS[j].name+
        ' intersected at '+minute.toFixed(2)+' positions '+
        JSON.stringify([poses[i].x,poses[i].z,poses[j].x,poses[j].z]));
      checked++;
    }
  }
  assert.ok(checked>300 && closest<2,'must actually test nearby oncoming traffic');
});


test('public visitors fade at all eight real doors and reappear without crossing world obstacles',()=>{
  const visits=neighborVisits(0,NEIGHBORS.length).filter(v=>v.home===-1&&v.venue&&v.kind!=='chat');
  for(const site of DISTRICT_SITES) {
    const visit=visits.find(v=>v.venue===site.place);
    assert.ok(visit,'must physically visit '+site.place);
    const front=sitePoint(site,0,site.d/2+.48);
    let disappeared=false,reappeared=false;
    for(let minute=visit.start+1;minute<visit.end-1;minute+=.35) {
      const pose=neighborPose(visit.resident,minute);
      const atDoor=Math.hypot(pose.x-front.x,pose.z-front.z)<.18;
      if(atDoor&&pose.opacity<.02)disappeared=true;
      if(disappeared&&atDoor&&pose.opacity>.85)reappeared=true;
      if(pose.visible&&pose.opacity>.65){
        assert.ok(pointIsClear(pose,DISTRICT_OBSTACLES,DISTRICT_FLOOR),
          site.place+' pedestrian should not cross any obstacle');
      }
    }
    assert.ok(disappeared,'visitor must fade on entering '+site.place);
    assert.ok(reappeared,'visitor must return through '+site.place+' door');
  }
});

test('deterministic pedestrians stay apart across three different daily schedules',()=>{
  for(let day=0;day<3;day++)for(let minute=450;minute<1330;minute+=.36) {
    const poses=NEIGHBORS.map((_,i)=>neighborPose(i,day*1440+minute));
    for(let i=0;i<poses.length;i++)for(let j=i+1;j<poses.length;j++) {
      if(poses[i].opacity<.6||poses[j].opacity<.6)continue;
      const d=Math.hypot(poses[i].x-poses[j].x,poses[i].z-poses[j].z);
      assert.ok(d>.57,'day '+day+' minute '+minute.toFixed(2)+' '+NEIGHBORS[i].name+
        ' and '+NEIGHBORS[j].name+' got too close: '+d);
    }
  }
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
