import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Vector3 } from 'three';
import { PETS } from '../../src/shared/pets';
import { HOME_FLOOR } from '../../src/shared/home';
import { placeObstacles } from '../../src/shared/locations';
import { initialState } from '../../src/shared/protocol';
import { runPetRoutines } from '../pets';
import { PetActor } from '../../src/game/PetActor';
import { Actor } from '../../src/game/Actor';
import { residentStepAroundBodies, RESIDENT_CLEARANCE } from '../../src/game/residentCollision';
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
  // v0.27 can choose a legal furniture perch before ordinary wandering.
  // Keep this test focused on shared roaming destinations by selecting a
  // deterministic roll outside the optional cat-perch probability.
  runPetRoutines(state,0,480,new Set(),()=>.71);
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

test('A walking resident goes around a resting dog without sliding or pushing the dog', () => {
  const dog = new PetActor('verdell');
  dog.root.position.set(0, 0, 0);
  const player = new Actor('vlad', [-2, 0]);
  let arrived = 0;
  player.walkPath([new Vector3(2, 0, 0)], () => { arrived++; });
  const dogBefore = dog.root.position.clone();
  let minDistance = Infinity;
  for (let frame = 0; frame < 850; frame++) {
    player.update(1 / 60, (from, target) =>
      residentStepAroundBodies(from, target, [
        { position: dog.root.position, clearance: PET_PERSON_CLEARANCE },
      ], empty, area));
    minDistance = Math.min(minDistance, petGap(player.root.position, dog.root.position));
    if (arrived) break;
  }
  assert.ok(minDistance >= PET_PERSON_CLEARANCE - .008, 'resident must not intersect dog');
  assert.equal(arrived, 1, 'resident should reach the destination, not freeze behind the dog');
  assert.ok(player.root.position.distanceTo(new Vector3(2, 0, 0)) < .03);
  assert.ok(dog.root.position.distanceTo(dogBefore) < .0001, 'dog must remain stationary');
});

test('Resident steering considers both pets and another person in the same step', () => {
  const player = new Actor('alina', [-2.5, 0]);
  const dog = { x: -.05, z: .1 };
  const cat = { x: .9, z: -.2 };
  const other = { x: 1.6, z: .3 };
  const before = structuredClone([dog,cat,other]);
  let arrived = false;
  player.walkPath([new Vector3(2.8, 0, 0)], () => { arrived = true; });
  let minDog = Infinity, minCat = Infinity, minOther = Infinity;
  for (let frame = 0; frame < 1100; frame++) {
    player.update(1 / 60, (from,target) =>
      residentStepAroundBodies(from,target,[
        {position: dog, clearance: PET_PERSON_CLEARANCE},
        {position: cat, clearance: PET_PERSON_CLEARANCE},
        {position: other, clearance: RESIDENT_CLEARANCE},
      ],empty,area));
    const pos = player.root.position;
    minDog = Math.min(minDog,petGap(pos,dog));
    minCat = Math.min(minCat,petGap(pos,cat));
    minOther = Math.min(minOther,petGap(pos,other));
    if (arrived) break;
  }
  assert.equal(arrived,true,'player can navigate among all three bodies');
  assert.ok(minDog >= PET_PERSON_CLEARANCE - .008);
  assert.ok(minCat >= PET_PERSON_CLEARANCE - .008);
  assert.ok(minOther >= RESIDENT_CLEARANCE - .008);
  assert.deepEqual([dog,cat,other],before,'neither the pets nor the other resident moved');
});

test('Static pet is not displaced just because a person overlaps its location', () => {
  const pet = new PetActor('simba');
  pet.root.position.set(.1,0,.1);
  const before = pet.root.position.clone();
  // When no route is active, the pet's update can animate a paw but must not
  // move its root away from a person that walks close.
  for (let i = 0; i < 240; i++) pet.update(1 / 60,0,0,{
    blockers: [{x:.2,z:.1}], obstacles: empty, floor: area,
  });
  assert.ok(pet.root.position.distanceTo(before) < .0001);
});

test('071 a lone home pet avoids people even when its companion is away',()=>{
 for(const id of ['verdell','simba'] as const){
  const pet=new PetActor(id);pet.root.position.set(-1.5,0,0);
  pet.followRoute([new Vector3(1.5,0,0)],'wander');
  const person={x:0,z:0};let closest=Infinity;
  for(let i=0;i<800;i++){
   pet.update(1/60,0,0,{blockers:[person],obstacles:empty,floor:area});
   closest=Math.min(closest,petGap(pet.root.position,person));
  }
  assert.ok(closest>=PET_PERSON_CLEARANCE-.002,id+' person clearance '+closest);
  assert.ok(pet.root.position.x>.6,id+' reaches goal');
 }
});
