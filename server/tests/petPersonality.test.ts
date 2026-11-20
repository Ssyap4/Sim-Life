import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Vector3 } from 'three';
import { initialState } from '../../src/shared/protocol';
import { PETS } from '../../src/shared/pets';
import { petWish, petWishText } from '../../src/shared/petWishes';
import { PetActor } from '../../src/game/PetActor';
import { PET_IDLE_SECONDS, choosePetIdle, petIdleWeight } from '../../src/game/PetIdle';

test('Critical hunger with an empty bowl beats happy, sleepy and play status', () => {
  const state = initialState();
  state.pets.verdell.satiety = 9;
  state.pets.verdell.energy = 9;
  state.pets.verdell.happiness = 98;
  state.petBowls.verdell = 0;
  const urgent = petWish(state, 'verdell');
  assert.equal(urgent.kind, 'hungryEmpty');
  assert.equal(urgent.urgent, true);
  assert.match(urgent.advice, /миску/i);
  assert.match(urgent.message, /Верделл/);
  state.petBowls.verdell = 3;
  const ready = petWish(state, 'verdell');
  assert.equal(ready.kind, 'hungryReady');
  assert.equal(ready.urgent, false);
  assert.notEqual(urgent.message, ready.message);
  assert.equal(state.pets.verdell.satiety, 9, 'text did not fake an instant feed');
});

test('Rest, toilet, boredom and affection use real pet needs, not invented conditions', () => {
  const state = initialState();
  const pet = state.pets.simba;
  pet.satiety = 95;
  pet.energy = 22;
  assert.equal(petWish(state, 'simba').kind, 'rest');
  pet.energy = 90;
  pet.bladder = 12;
  assert.equal(petWish(state, 'simba').kind, 'needsToilet');
  pet.bladder = 90;
  pet.happiness = 16;
  assert.equal(petWish(state, 'simba').kind, 'play');
  pet.happiness = 74;
  pet.bond = 4;
  assert.equal(petWish(state, 'simba').kind, 'affection');
  pet.bond = 85;
  pet.happiness = 92;
  assert.equal(petWish(state, 'simba').kind, 'content');
  assert.equal(state.money, 10000);
});

test('Real routines override cosmetic wants while ordinary needs are not urgent', () => {
  const state = initialState();
  const pet = state.pets.verdell;
  pet.bond = 80;
  pet.happiness = 90;
  pet.satiety = 75;
  const route = { from: PETS.verdell.home, path: [] };
  for (const [kind, expected] of [
    ['eat', 'eating'], ['sleep', 'sleeping'], ['toilet', 'toilet'], ['wander', 'wander'],
  ] as const) {
    pet.routine = { kind, target: 0, startedAt: 100, until: 120, route };
    assert.equal(petWish(state, 'verdell').kind, expected, kind);
  }
});

test('Many distinct atmospheric phrases stay synchronized on both clients', () => {
  const state = initialState();
  const initial = structuredClone(state);
  const dog = new Set<string>();
  const cat = new Set<string>();
  for (let slot = 0; slot < 8; slot++) {
    state.clock.day = 4;
    state.clock.minute = slot * 30;
    const d = petWish(state, 'verdell');
    const c = petWish(state, 'simba');
    assert.equal(petWish(state, 'verdell').message, d.message, 'no random flicker');
    assert.equal(petWish(state, 'simba').message, c.message);
    assert.match(petWishText(state, 'verdell'), /Верделл/);
    assert.match(petWishText(state, 'simba'), /Симба/);
    dog.add(d.message);
    cat.add(c.message);
  }
  assert.ok(dog.size >= 3 && cat.size >= 3, 'several variants instead of a single fixed line');
  assert.equal(initial.money, state.money);
  assert.deepEqual(initial.petBowls, state.petBowls);
  assert.deepEqual(initial.pets, state.pets);
});

test('Dog is sociable while cat stretches, observes and grooms independently', () => {
  const context = {
    satiety: 72, energy: 87, happiness: 89, bond: 58, bowl: 1, personNearby: true,
  };
  assert.equal(choosePetIdle('verdell', context, 0), 'greet');
  assert.equal(choosePetIdle('verdell', { ...context, satiety: 15, bowl: 0 }, 0), 'hungryLook');
  assert.equal(choosePetIdle('simba', context, 0), 'groom');
  assert.equal(choosePetIdle('simba', context, 1), 'stretch');
  assert.equal(choosePetIdle('simba', { ...context, personNearby: false }, 2), 'groom');
  assert.equal(petIdleWeight(0), 0);
  assert.equal(petIdleWeight(PET_IDLE_SECONDS), 0);
  assert.ok(petIdleWeight(.3) > 0 && petIdleWeight(.3) < 1);
  assert.equal(petIdleWeight(1.3), 1);
});

test('Dog greeting animates only while idle and yields immediately to feeding or route', () => {
  const dog = new PetActor('verdell');
  dog.setAmbient({
    satiety: 82, energy: 90, happiness: 90, bond: 70, bowl: 2, personNearby: true,
  });
  for (let i = 0; i < 275; i++) dog.update(1 / 60);
  assert.equal(dog.currentIdleGesture(), 'greet');
  dog.followRoute([new Vector3(dog.root.position.x + 2, 0, dog.root.position.z)],
    'wander');
  dog.update(1 / 60);
  assert.equal(dog.currentIdleGesture(), null);
  dog.react('pet');
  dog.update(1 / 60);
  assert.equal(dog.currentIdleGesture(), null);
  assert.equal(dog.root.visible, true);
});

test('Cat grooming and stretching never override the authoritative sleep routine', () => {
  const cat = new PetActor('simba');
  cat.setAmbient({
    satiety: 85, energy: 80, happiness: 84, bond: 55, bowl: 2, personNearby: false,
  });
  for (let i = 0; i < 365; i++) cat.update(1 / 60);
  assert.equal(cat.currentIdleGesture(), 'groom');
  cat.followRoute([], 'sleep');
  cat.update(.4);
  assert.equal(cat.currentIdleGesture(), null);
  cat.stop();
  cat.react('brush');
  cat.update(.3);
  assert.equal(cat.currentIdleGesture(), null);
});

test('A roaming pet can perform a visible gesture once it reaches a stop', () => {
  const dog = new PetActor('verdell');
  dog.setAmbient({ satiety: 85, energy: 80, happiness: 90, bond: 72,
    bowl: 2, personNearby: true });
  dog.followRoute([new Vector3(dog.root.position.x + .12, 0, dog.root.position.z)], 'wander');
  for (let i = 0; i < 250; i++) dog.update(1 / 60);
  assert.equal(dog.currentIdleGesture(), 'greet',
    'wandering routine does not forbid idle animation at its endpoint');
  assert.ok(Math.abs(dog.root.position.x - (PETS.verdell.home.x + .12)) < .03,
    'gesture does not displace the pet or disrupt server path');
  dog.followRoute([], 'eat', Math.PI);
  dog.update(.1);
  assert.equal(dog.currentIdleGesture(), null, 'feeding immediately overrides idle gesture');
});

test('Cat brings a raised front paw near the face when grooming', () => {
  const cat = new PetActor('simba');
  cat.setAmbient({ satiety: 81, energy: 84, happiness: 78,
    bond: 45, bowl: 0, personNearby: false });
  // On the third idle cycle the cat chooses grooming.
  for (let i = 0; i < 2700 && cat.currentIdleGesture() !== 'groom'; i++) {
    cat.update(1 / 60);
  }
  assert.equal(cat.currentIdleGesture(), 'groom');
  for (let i = 0; i < 65; i++) cat.update(1 / 60);
  const paw = (cat as unknown as { paws: { position: Vector3; rotation: {x:number} }[] }).paws[0];
  assert.ok(paw.position.y > .48, 'front paw is visibly raised towards the muzzle');
  assert.ok(paw.rotation.x < -.8, 'raised front paw tilts inward towards face');
  cat.followRoute([new Vector3(cat.root.position.x + 1,0,cat.root.position.z)],'wander');
  cat.update(1 / 60);
  assert.equal(cat.currentIdleGesture(), null);
});

test('At an empty bowl a hungry pet has animated body language without faking a feed', () => {
  for (const id of ['verdell', 'simba'] as const) {
    const pet = new PetActor(id);
    pet.setAmbient({ satiety: 6, energy: 78, happiness: 52,
      bond: 54, bowl: 0, personNearby: false });
    pet.followRoute([], 'wander');
    for (let i = 0; i < (id === 'verdell' ? 270 : 380); i++) pet.update(1 / 60);
    assert.equal(pet.currentIdleGesture(), 'hungryLook', id);
    const head = (pet as unknown as { head: {rotation:{x:number}} }).head;
    assert.ok(head.rotation.x > .1, 'noticeable searching / head dip');
  }
});

test('Dog visibly wags while passing an owner, without stopping navigation', () => {
  const makeDog = (personNearby: boolean) => {
    const dog = new PetActor('verdell');
    dog.setAmbient({ satiety: 85, energy: 83, happiness: 85, bond: 64,
      bowl: 1, personNearby });
    dog.followRoute([new Vector3(PETS.verdell.home.x, 0, PETS.verdell.home.z + 10)], 'wander');
    return dog;
  };
  const near = makeDog(true);
  const far = makeDog(false);
  const sweep = (dog: PetActor) => {
    let angle = 0;
    for (let i = 0; i < 110; i++) {
      dog.update(1 / 60);
      const tail = (dog as unknown as {tail:{rotation:{y:number}}}).tail;
      angle = Math.max(angle, Math.abs(tail.rotation.y));
    }
    return angle;
  };
  assert.ok(sweep(near) > sweep(far) + .25, 'owner-near tail is substantially more expressive');
  assert.ok(near.root.position.z > PETS.verdell.home.z + 1, 'walking remains active');
});
