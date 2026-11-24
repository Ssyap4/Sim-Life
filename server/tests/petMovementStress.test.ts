import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Vector3 } from 'three';
import { PETS, PET_ROAM, PET_SPEED, petDestination } from '../../src/shared/pets';
import { HOME_FLOOR } from '../../src/shared/home';
import { placeObstacles } from '../../src/shared/locations';
import { petNavigationGeometry, planPetRoute } from '../../src/game/PetNavigation';
import { PetActor } from '../../src/game/PetActor';
import { PET_PET_CLEARANCE, petGap, separatePetBodies } from '../../src/game/PetTraffic';
import { pointIsClear, segmentIsClear, type FloorPoint } from '../../src/game/navigation';

const nav = petNavigationGeometry(placeObstacles('home'), HOME_FLOOR);
type Scenario = {
  name: string;
  fromDog: FloorPoint;
  toDog: FloorPoint;
  fromCat: FloorPoint;
  toCat: FloorPoint;
  blockedAt?: FloorPoint;
  unblockAfter?: number;
};
function simulate(s: Scenario, fps: number) {
  const dog = new PetActor('verdell');
  const cat = new PetActor('simba');
  const dogRoute = planPetRoute(s.fromDog, s.toDog, nav);
  const catRoute = planPetRoute(s.fromCat, s.toCat, nav);
  assert.ok(dogRoute && catRoute, 'Both routes must be planned: ' + s.name);
  dog.root.position.set(s.fromDog.x, 0, s.fromDog.z);
  cat.root.position.set(s.fromCat.x, 0, s.fromCat.z);
  dog.followRoute(dogRoute.path.map(p => new Vector3(p.x, 0, p.z)), 'wander');
  cat.followRoute(catRoute.path.map(p => new Vector3(p.x, 0, p.z)), 'wander');
  let minGap = Infinity, maxStep = 0, waitingSeconds = 0, arrivedAt = 0;
  for (let frame = 0; frame < fps * 65; frame++) {
    const beforeDog = dog.root.position.clone();
    const beforeCat = cat.root.position.clone();
    const people = s.blockedAt && frame < fps * (s.unblockAfter ?? 65) ? [s.blockedAt] : [];
    dog.update(1 / fps, 0, 0, {
      ...nav, blockers: [cat.root.position, ...people], otherPet: cat.root.position,
    });
    cat.update(1 / fps, 0, 0, {
      ...nav, blockers: [dog.root.position, ...people], otherPet: dog.root.position,
    });
    const [a, b] = separatePetBodies(dog.root.position, cat.root.position, nav.obstacles, nav.floor);
    dog.root.position.set(a.x, 0, a.z);
    cat.root.position.set(b.x, 0, b.z);
    assert.ok(pointIsClear(a, nav.obstacles, nav.floor), s.name + ': dog not inside wall');
    assert.ok(pointIsClear(b, nav.obstacles, nav.floor), s.name + ': cat not inside wall');
    minGap = Math.min(minGap, petGap(a, b));
    const step = Math.max(dog.root.position.distanceTo(beforeDog),
      cat.root.position.distanceTo(beforeCat));
    maxStep = Math.max(maxStep, step);
    if (people.length && frame > fps * 3 && step < .0001) waitingSeconds += 1 / fps;
    const done = petGap(a, s.toDog) < .045 && petGap(b, s.toCat) < .045;
    if (done) { arrivedAt = frame / fps; break; }
  }
  assert.ok(minGap >= PET_PET_CLEARANCE - .015,
    s.name + ': pets may not intersect, observed distance=' + minGap);
  assert.ok(maxStep < Math.max(PET_SPEED.verdell, PET_SPEED.simba) / fps + .014,
    s.name + ': avoid large abrupt teleportation of pet positions');
  assert.ok(arrivedAt > 0 && arrivedAt < 32,
    s.name + ': both should reach their target after a temporary blockage, dog=' +
    JSON.stringify(dog.root.position) + ', cat=' + JSON.stringify(cat.root.position));
  if (s.blockedAt) {
    assert.ok(waitingSeconds > 3.5, s.name + ': should stop and wait, not twitch continuously');
    assert.ok(arrivedAt > (s.unblockAfter ?? 0), 'must not pass through a blocked corridor');
  }
}
test('Continuous segment testing rejects tiny furniture corners between sampled points', () => {
  const floor = { minX: -1, maxX: 1, minZ: -1, maxZ: 1 };
  const obstacle = { minX: .045, maxX: .055, minZ: .045, maxZ: .055 };
  assert.ok(pointIsClear({ x: 0, z: 0 }, [obstacle], floor));
  assert.ok(pointIsClear({ x: .1, z: .1 }, [obstacle], floor));
  assert.equal(segmentIsClear({ x: 0, z: 0 }, { x: .1, z: .1 }, [obstacle], floor), false);
  assert.equal(segmentIsClear({ x: 0, z: 0 }, { x: -.1, z: .1 }, [obstacle], floor), true);
});

const lawn = [...PET_ROAM.slice(-4)];
for (const fps of [20, 60]) {
  test('Paired pet journeys stay clear at ' + fps + ' FPS across lawn and meal routes', () => {
    const scenarios: Scenario[] = [];
    for (let index = 0; index < lawn.length; index++) {
      scenarios.push({
        name: 'both-to-lawn-' + index,
        fromDog: PETS.verdell.home, toDog: lawn[index],
        fromCat: PETS.simba.home, toCat: lawn[(index + 2) % lawn.length],
      }, {
        name: 'cross-lawn-' + index,
        fromDog: lawn[index], toDog: PETS.verdell.home,
        fromCat: PETS.simba.home, toCat: lawn[(index + 2) % lawn.length],
      });
    }
    scenarios.push({
      name: 'both-meals', fromDog: PETS.verdell.home, fromCat: PETS.simba.home,
      toDog: petDestination('verdell', { kind: 'eat', target: 0 }),
      toCat: petDestination('simba', { kind: 'eat', target: 0 }),
    });
    for (const scenario of scenarios) simulate(scenario, fps);
  });
}
for (const fps of [20, 30, 60]) {
  test('Blocked corridor quietly yields then resumes after person leaves at ' + fps + ' FPS', () => {
    const scenarios: Scenario[] = [
      { name: 'garden-entry-' + fps, fromDog: PETS.verdell.home,
        toDog: lawn[0], fromCat: PETS.simba.home, toCat: lawn[2],
        blockedAt: { x: .45, z: 4.6 }, unblockAfter: 12 },
      { name: 'kitchen-entry-' + fps, fromDog: PETS.verdell.home,
        toDog: petDestination('verdell', { kind: 'eat', target: 0 }),
        fromCat: PETS.simba.home,
        toCat: petDestination('simba', { kind: 'eat', target: 0 }),
        blockedAt: { x: -.56, z: 1.5 }, unblockAfter: 12 },
    ];
    for (const scenario of scenarios) simulate(scenario, fps);
  });
}
