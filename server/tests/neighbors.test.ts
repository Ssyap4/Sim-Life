import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { NEIGHBORS, NEIGHBOR_PATH, NEIGHBOR_ROUTE_LENGTH, NEIGHBOR_TRIP_SECONDS, NEIGHBOR_SLOT_COUNT, neighborPose } from '../../src/shared/neighbors';
import { HOUSE, HOUSE_WING, HOME_FLOOR, HOME_PLACEMENTS, KITCHEN_WORK } from '../../src/shared/home';
import { buildFurniture } from '../../src/game/InteriorArt';
import { NeighborPeople } from '../../src/game/NeighborPeople';
import { neighborhoodOutline, portraitHomeFrame } from '../../src/game/HomeFrame';
import { GAME_MINUTES_PER_REAL_SECOND } from '../../src/shared/life';
import { buildNeighborhood } from '../../src/game/NeighborhoodArt';
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

test('neighbors are distinct, deterministic, safe outside the private property and capped by time of day', () => {
  assert.equal(NEIGHBORS.length, 14);
  assert.equal(new Set(NEIGHBORS.map(p => p.name)).size, 14);
  for (const minute of [8*60, 12*60, 17*60, 19*60, 23*60, 25*60, 28*60]) {
    const poses = NEIGHBORS.map((_,index) => neighborPose(index, minute));
    const hour = minute % 1440 / 60;
    const cap = hour < 6 || hour >= 22 ? 1 : hour < 9 ? 4 : hour < 18 ? 7 : 5;
    assert.ok(poses.filter(p => p.visible).length <= cap);
    for (const [index, pose] of poses.entries()) {
      assert.deepEqual(pose, neighborPose(index,minute));
      if (!pose.visible) continue;
      assert.ok(pose.x < HOUSE.minX - .5 || pose.x > HOUSE_WING.maxX + .5
        || pose.z < HOUSE.minZ - .5, NEIGHBORS[index].name + ' entered private property');
    }
  }
});

test('two residents meet, face each other and talk before resuming their paths', () => {
  // Day one, 08:30: the paired wanderers meet on the public rear sidewalk.
  const a = neighborPose(0, 525);
  const b = neighborPose(1, 525);
  assert.equal(a.action, 'chat');
  assert.equal(b.action, 'chat');
  assert.equal(a.visible, true);
  assert.equal(b.visible, true);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 1.7);
  assert.ok(a.yaw > 1 && b.yaw < -1);
  assert.equal(neighborPose(0, 530).action, 'walk');
});

test('sidewalks, wing and all 14 articulated NPCs remain lightweight and noninteractive', () => {
  const scene = new THREE.Scene();
  buildHomeWing(scene);
  buildNeighborhood(scene);
  assert.equal(scene.children.length, 2);
  const crowd = new NeighborPeople();
  assert.equal(crowd.group.children.length, NEIGHBORS.length);
  crowd.update(12 * 60);
  let shown = 0, activeMeshes = 0;
  for (const person of crowd.group.children) {
    if (!person.visible) continue;
    shown++;
    person.traverse(obj => { if (obj instanceof THREE.Mesh && obj.visible) activeMeshes++; });
    assert.equal(person.userData.interactable, undefined);
  }
  assert.equal(shown, 7);
  assert.ok(activeMeshes <= 90, 'articulated crowd must stay at or below 90 visible meshes: ' + activeMeshes);
});

test('idling NPCs genuinely pause rather than sliding while using their phone', () => {
  let stop: number | undefined;
  for (let minute = 12 * 60; minute < 14 * 60; minute += .1) {
    if (neighborPose(3, minute).visible && neighborPose(3, minute + .2).visible &&
        neighborPose(3, minute).gestureBlend > .999 &&
        neighborPose(3, minute + .2).gestureBlend > .999 &&
        neighborPose(3, minute).action !== 'walk' &&
        neighborPose(3, minute + .2).action !== 'walk') {
      stop = minute; break;
    }
  }
  assert.ok(stop !== undefined, 'should encounter a scheduled stop');
  const before = neighborPose(3, stop);
  const after = neighborPose(3, stop + .2);
  assert.ok(Math.hypot(before.x - after.x, before.z - after.z) < .0001);
});

test('public paths and all neighboring props leave a generous expansion reserve', () => {
  const [west,rearWest,rearEast,east] = NEIGHBOR_PATH;
  assert.ok(HOUSE.minX-west.x >= 7.5, 'west future expansion reserve');
  assert.ok(east.x-HOUSE_WING.maxX >= 7.5, 'east future expansion reserve');
  assert.ok(HOUSE.minZ-rearWest.z >= 7.5, 'rear future expansion reserve');
  assert.equal(west.x,rearWest.x);
  assert.equal(rearWest.z,rearEast.z);
  assert.equal(rearEast.x,east.x);
  assert.ok(NEIGHBOR_ROUTE_LENGTH > 80);
  const scene = new THREE.Scene();
  buildNeighborhood(scene);
  const box = new THREE.Box3().setFromObject(scene);
  assert.ok(box.min.x < west.x - 2 && box.max.x > east.x + 2);
  assert.ok(box.min.z < rearWest.z - 7);
});

test('every pedestrian completes one way only, fades at the ends and is replaced by a different profile', () => {
  assert.equal(NEIGHBORS.length, NEIGHBOR_SLOT_COUNT * 2);
  const offset = 2 * 13.9;
  const sample = (index:number, cycle:number, second:number) =>
    neighborPose(index, (cycle*NEIGHBOR_TRIP_SECONDS + second - offset) *
      GAME_MINUTES_PER_REAL_SECOND);
  const firstEarly = sample(2,14,2);
  const firstMiddle = sample(2,14,50);
  const firstLate = sample(2,14,98);
  const firstGone = sample(2,14,99.9);
  const secondEarly = sample(9,15,2);
  const secondMiddle = sample(9,15,50);
  assert.ok(firstEarly.opacity > 0 && firstEarly.opacity < 1);
  assert.ok(firstMiddle.opacity > .99);
  assert.ok(firstLate.opacity > 0 && firstLate.opacity < 1);
  assert.ok(firstGone.opacity < firstLate.opacity);
  assert.equal(sample(9,14,50).visible,false,'replacement must wait offstage');
  assert.equal(sample(2,15,50).visible,false,'old profile must remain offstage');
  assert.ok(secondEarly.opacity > 0 && secondEarly.opacity < 1);
  assert.ok(secondMiddle.opacity > .99);
  assert.notEqual(NEIGHBORS[2].name,NEIGHBORS[9].name);
  // One-way travel: no sudden reverse at an endpoint.
  assert.ok(Math.hypot(firstEarly.x-firstMiddle.x,firstEarly.z-firstMiddle.z) > 20);
  assert.ok(Math.hypot(secondEarly.x-secondMiddle.x,secondEarly.z-secondMiddle.z) > 20);
});

test('hair, coats, skirts and accessories are genuinely different geometric styles', () => {
  assert.ok(new Set(NEIGHBORS.map(p=>p.hairStyle)).size >= 9);
  assert.ok(new Set(NEIGHBORS.map(p=>p.outfit)).size >= 7);
  assert.ok(new Set(NEIGHBORS.map(p=>p.accessory)).size >= 3);
  const crowd = new NeighborPeople();
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
      if(!material && obj instanceof THREE.Mesh)material=obj.material as THREE.Material;
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

test('new neighbor joints animate walking without squatting or sinking into the ground', () => {
  const crowd = new NeighborPeople();
  let samples=0, raisedKnee=false, tiltedHead=false, blinkSeen=false;
  for(let minute=720; minute<782; minute+=.26) {
    crowd.update(minute);
    for(let index=0; index<NEIGHBORS.length; index++) {
      const pose=neighborPose(index,minute);
      if(!pose.visible || pose.opacity<.85)continue;
      const root=crowd.group.children[index];
      const head=root.getObjectByName('neighbor-head') as THREE.Group;
      const leftKnee=root.getObjectByName('neighbor-leftKnee') as THREE.Group;
      const rightKnee=root.getObjectByName('neighbor-rightKnee') as THREE.Group;
      const leftFoot=root.getObjectByName('neighbor-leftFoot') as THREE.Group;
      const rightFoot=root.getObjectByName('neighbor-rightFoot') as THREE.Group;
      const eyelids=root.getObjectByName('neighbor-eyelids') as THREE.Mesh;
      assert.ok(head && leftKnee && rightKnee && leftFoot && rightFoot && eyelids);
      if(pose.gestureBlend<.01) {
        raisedKnee ||= Math.max(leftKnee.rotation.x,rightKnee.rotation.x)>.12;
        for(const foot of [leftFoot,rightFoot]) {
          root.updateMatrixWorld(true);
          const world=new THREE.Vector3();
          foot.getWorldPosition(world);
          assert.ok(world.y>-.04, 'foot joint must not sink below floor: '+world.y);
          assert.ok(world.y<.35, 'walking must not lift the leg excessively');
        }
      }
      tiltedHead ||= Math.abs(head.rotation.y)>.035;
      blinkSeen ||= eyelids.visible;
      assert.ok(Math.abs(head.rotation.x)<.27 && Math.abs(head.rotation.y)<.40);
      samples++;
    }
  }
  assert.ok(samples>40 && raisedKnee && tiltedHead && blinkSeen);
});

test('all visual gestures are readable and deterministic across two clients', () => {
  const crowd=new NeighborPeople();
  const actions=['chat','phone','wave','look','adjust','stretch'] as const;
  for(const action of actions) {
    let found:{minute:number;index:number}|undefined;
    for(let minute=540;minute<1320 && !found;minute+=.18) {
      for(let index=0;index<NEIGHBORS.length;index++) {
        const pose=neighborPose(index,minute);
        if(pose.visible && pose.opacity>.75 && pose.action===action && pose.gestureBlend>.96) {
          found={minute,index};break;
        }
      }
    }
    assert.ok(found,action+' must be observable in daytime');
    const {minute,index}=found;
    crowd.update(minute);
    const root=crowd.group.children[index];
    const head=root.getObjectByName('neighbor-head') as THREE.Group;
    const leftArm=root.getObjectByName('neighbor-leftArm') as THREE.Group;
    const rightArm=root.getObjectByName('neighbor-rightArm') as THREE.Group;
    const leftElbow=root.getObjectByName('neighbor-leftElbow') as THREE.Group;
    const rightElbow=root.getObjectByName('neighbor-rightElbow') as THREE.Group;
    assert.ok(head && leftArm && rightArm && leftElbow && rightElbow);
    if(action==='wave')assert.ok(rightArm.rotation.z< -1.4);
    if(action==='stretch')assert.ok(leftArm.rotation.z>.8 && rightArm.rotation.z<-.8);
    if(action==='phone')assert.ok(rightElbow.rotation.x<-.75 && head.rotation.x>.08);
    if(action==='adjust')assert.ok(leftElbow.rotation.x<-.65);
    if(action==='chat')assert.ok(Math.abs(rightElbow.rotation.x)>.18);
    if(action==='look')assert.ok(Math.abs(head.rotation.y)<.4);
    const first=new THREE.Vector3(rightArm.rotation.x,rightArm.rotation.y,rightArm.rotation.z);
    crowd.update(minute);
    const second=new THREE.Vector3(rightArm.rotation.x,rightArm.rotation.y,rightArm.rotation.z);
    assert.deepEqual(first.toArray(),second.toArray(),'animation must be deterministic');
  }
});

test('arm and leg gestures blend across starts and stops without one-frame snapping', () => {
  const crowd=new NeighborPeople();
  const gameFrame=GAME_MINUTES_PER_REAL_SECOND/60;
  let pairs=0;
  for(const index of [0,2,3,4,5,6]) {
    for(let minute=630;minute<820;minute+=gameFrame*2) {
      const now=neighborPose(index,minute);
      const next=neighborPose(index,minute+gameFrame);
      if(!now.visible || !next.visible || now.opacity<.75 || next.opacity<.75)continue;
      const root=crowd.group.children[index];
      crowd.update(minute);
      const arm=root.getObjectByName('neighbor-rightArm') as THREE.Group;
      const knee=root.getObjectByName('neighbor-leftKnee') as THREE.Group;
      const head=root.getObjectByName('neighbor-head') as THREE.Group;
      const before=[arm.rotation.x,arm.rotation.z,knee.rotation.x,head.rotation.x,head.rotation.y];
      crowd.update(minute+gameFrame);
      const after=[arm.rotation.x,arm.rotation.z,knee.rotation.x,head.rotation.x,head.rotation.y];
      const delta=Math.max(...before.map((v,i)=>Math.abs(v-after[i])));
      assert.ok(delta<.24, 'visible one-frame joint snap: '+delta.toFixed(3));
      pairs++;
    }
  }
  assert.ok(pairs>200,'transition samples must cover enough visible frames');
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

test('pedestrians fade independently instead of changing shared apartment materials', () => {
  const crowd=new NeighborPeople();
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
      if(!first&&obj instanceof THREE.Mesh&&obj.visible)first=obj.material as THREE.MeshStandardMaterial;
    });
    return first!;
  };
  const a=material(personA),c=material(personB);
  assert.notEqual(a,c);
  assert.ok(a.opacity<.67 && a.transparent && a.depthWrite===false);
  assert.ok(c.opacity>.98 && !c.transparent && c.depthWrite===true);
});
