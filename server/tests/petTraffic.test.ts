import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Vector3 } from 'three';
import { PETS } from '../../src/shared/pets';
import { HOME_FLOOR } from '../../src/shared/home';
import { placeObstacles } from '../../src/shared/locations';
import { initialState } from '../../src/shared/protocol';
import { runPetRoutines } from '../pets';
import { PetActor } from '../../src/game/PetActor';
import { pointIsClear, segmentIsClear } from '../../src/game/navigation';
import {
  PET_PET_CLEARANCE, PET_PERSON_CLEARANCE,
  petGap, petTrafficStep, separatePetBodies, separatePetFromFixed,
} from '../../src/game/PetTraffic';

const area = { minX: -4, maxX: 4, minZ: -4, maxZ: 4 };
const empty: {minX:number;maxX:number;minZ:number;maxZ:number}[] = [];

test('Identical old pet positions are immediately separated without crossing a wall', () => {
  const a = { x: 0, z: 0 };
  const [first, second] = separatePetBodies(a, a, empty, area);
  assert.ok(petGap(first, second) >= PET_PET_CLEARANCE);
  assert.ok(pointIsClear(first, empty, area));
  assert.ok(pointIsClear(second, empty, area));
  const nearWall = [{ minX: -.8, maxX: -.02, minZ: -2, maxZ: 2 }];
  const [one, two] = separatePetBodies({x: 0,z:0}, {x: .1,z:0}, nearWall, area);
  assert.ok(petGap(one, two) >= PET_PET_CLEARANCE - .001);
  assert.ok(segmentIsClear({x:0,z:0},one,nearWall,area));
  assert.ok(segmentIsClear({x:.1,z:0},two,nearWall,area));
});

test('Two animals approaching head-on steer around one another instead of ghosting', () => {
  const dog = new PetActor('verdell'), cat = new PetActor('simba');
  dog.root.position.set(-1.3,0,0);
  cat.root.position.set(1.3,0,0);
  dog.followRoute([new Vector3(1.5,0,0)],'wander');
  cat.followRoute([new Vector3(-1.5,0,0)],'wander');
  let closest = Infinity;
  for (let i = 0; i < 800; i++) {
    dog.update(1 / 60, 0, 0, {
      blockers: [cat.root.position], obstacles: empty, floor: area,
    });
    cat.update(1 / 60, 0, 0, {
      blockers: [dog.root.position], obstacles: empty, floor: area,
    });
    const [a,b] = separatePetBodies(dog.root.position,cat.root.position,empty,area);
    dog.root.position.set(a.x,0,a.z);
    cat.root.position.set(b.x,0,b.z);
    closest = Math.min(closest, petGap(dog.root.position,cat.root.position));
  }
  assert.ok(closest >= PET_PET_CLEARANCE - .002, 'pets never occupy the same space');
  assert.ok(dog.root.position.x > .6, 'dog made progress after collision');
  assert.ok(cat.root.position.x < -.6, 'cat made progress after collision');
});

test('Pet sidesteps a person while avoiding furniture and does not move outside home', () => {
  const fixed = {x:0,z:0};
  const pet = {x:.1,z:0};
  const pushed = separatePetFromFixed(pet,fixed,empty,area);
  assert.ok(petGap(pushed,fixed) >= PET_PERSON_CLEARANCE);
  assert.ok(segmentIsClear(pet,pushed,empty,area));
  const step = petTrafficStep({x:-1.4,z:0},{x:1,z:0},[fixed],empty,area,.04);
  assert.ok(pointIsClear(step,empty,area));
  assert.ok(petGap(step,{x:-1.4,z:0}) <= .041);
});

test('Shared roaming targets differ, while feeding routes and supplies remain authoritative', () => {
  const state = initialState();
  state.pets.verdell.energy=90;
  state.pets.simba.energy=90;
  state.pets.verdell.bladder=90;
  state.pets.simba.bladder=90;
  state.pets.verdell.satiety=90;
  state.pets.simba.satiety=90;
  runPetRoutines(state,0,480,new Set(),()=>.31);
  assert.equal(state.pets.verdell.routine?.kind,'wander');
  assert.equal(state.pets.simba.routine?.kind,'wander');
  assert.notEqual(state.pets.verdell.routine?.target,state.pets.simba.routine?.target);
  assert.deepEqual(state.petBowls,{verdell:0,simba:0});
  assert.deepEqual(state.petFood,initialState().petFood);
});

test('Actual home furniture allows a safe gap between pet bodies at the pictured lawn', () => {
  const obstacles = placeObstacles('home');
  const a = { x: .36,z: 5.8 };
  const b = { x: .45,z: 5.8 };
  const [one,two] = separatePetBodies(a,b,obstacles,HOME_FLOOR);
  assert.ok(petGap(one,two) >= PET_PET_CLEARANCE - .003);
  assert.ok(pointIsClear(one,obstacles,HOME_FLOOR));
  assert.ok(pointIsClear(two,obstacles,HOME_FLOOR));
});

test('Interacting with pets overrides emotional gestures and never creates an item', () => {
  const cat = new PetActor('simba');
  cat.setAmbient({satiety:0,energy:75,happiness:75,bond:50,bowl:0,personNearby:false});
  for(let i=0;i<365;i++) cat.update(1/60);
  assert.ok(cat.currentIdleGesture());
  cat.react('pet');
  cat.update(1/60);
  assert.equal(cat.currentIdleGesture(),null);
  assert.equal(cat.root.visible,true);
  assert.equal(PETS.simba.name,'Симба');
});
