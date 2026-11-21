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
  assert.ok(activeMeshes < 85, 'animated crowd should have a small draw-call budget');
});

test('idling NPCs genuinely pause rather than sliding while using their phone', () => {
  let stop: number | undefined;
  for (let minute = 12 * 60; minute < 14 * 60; minute += .1) {
    if (neighborPose(3, minute).visible && neighborPose(3, minute + .2).visible &&
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
