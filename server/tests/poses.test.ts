import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { Actor } from '../../src/game/Actor';

function settle(actor: Actor, seconds = 1.1): void {
  for (let i = 0; i < seconds * 30; i++) actor.update(1 / 30);
}
function figurePosition(actor: Actor): THREE.Vector3 {
  const figure = actor.root.children[0];
  return figure.getWorldPosition(new THREE.Vector3());
}

test('Seated furniture pose places the model on sofa without moving its safe navigation root', () => {
  const actor = new Actor('alina', [-3.0, 0.6]);
  const anchor = new THREE.Vector3(-3.1, -0.25, 1.69);
  actor.setFurniturePose('sit', anchor, Math.PI);
  settle(actor);
  assert.ok(figurePosition(actor).distanceTo(anchor) < 0.04);
  assert.deepEqual(actor.root.position.toArray(), [-3, 0, 0.6]);
  assert.ok(Math.abs(actor.root.rotation.y - Math.PI) < 0.001);
});

test('Lying in bed rotates the body horizontally and walking restores upright pose', () => {
  const actor = new Actor('vlad', [-3.85, -0.76]);
  const bed = new THREE.Vector3(-3.85, 0.91, -1.76);
  actor.setFurniturePose('sleep', bed, 0);
  settle(actor);
  assert.ok(figurePosition(actor).distanceTo(bed) < 0.04);
  assert.ok(Math.abs(actor.root.children[0].rotation.x + Math.PI / 2) < 0.04);
  let finished = false;
  actor.walkPath([new THREE.Vector3(-3.3, 0, -0.3)], () => {
    actor.setPose('idle');
    finished = true;
  });
  settle(actor, 1.2);
  assert.ok(finished);
  assert.ok(Math.abs(actor.root.children[0].rotation.x) < 0.04);
  assert.ok(figurePosition(actor).distanceTo(actor.root.position) < 0.04);
});

test('Eating keeps the furniture anchor while the articulated arm moves', () => {
  const actor = new Actor('alina', [-0.80, 0.04]);
  const anchor = new THREE.Vector3(-0.84, -0.22, 0.05);
  actor.setFurniturePose('sit', anchor, -Math.PI / 2);
  actor.playActivity('eat');
  settle(actor);
  assert.ok(figurePosition(actor).distanceTo(anchor) < 0.001);
  const sleevesAndTrousers = actor.root.getObjectsByProperty('isSkinnedMesh', true) as THREE.SkinnedMesh[];
  assert.equal(sleevesAndTrousers.length, 4);
  const rightSleeve = sleevesAndTrousers[1];
  const flex = rightSleeve.skeleton.bones[1].rotation.x;
  assert.ok(flex < -0.25);
  settle(actor, 0.51);
  assert.ok(Math.abs(rightSleeve.skeleton.bones[1].rotation.x - flex) > 0.05);
  assert.deepEqual(actor.root.position.toArray(), [-0.80, 0, 0.04]);
  actor.finishActivity();
  settle(actor);
  assert.ok(figurePosition(actor).distanceTo(anchor) < 0.001);
});

test('A long frame walks through route corners and arrives exactly once', () => {
  const actor = new Actor('vlad', [0, 0]);
  let arrivals = 0;
  actor.walkPath([
    new THREE.Vector3(0.09, 0, 0),
    new THREE.Vector3(0.09, 0, 0.18),
    new THREE.Vector3(0.40, 0, 0.18),
  ], () => { arrivals++; });
  actor.update(0.2);
  assert.ok(actor.root.position.distanceTo(new THREE.Vector3(0.18, 0, 0.18)) < 0.001);
  assert.equal(arrivals, 0);
  actor.update(0.2);
  actor.update(0.2);
  assert.deepEqual(actor.root.position.toArray(), [0.4, 0, 0.18]);
  assert.equal(arrivals, 1);
});
