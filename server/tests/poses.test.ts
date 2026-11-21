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

test('A picked-up book follows the right hand until the actor opens it to read', () => {
  const actor = new Actor('vlad', [0, 0]);
  actor.carryBook('#ad8b61');
  actor.walkPath([new THREE.Vector3(1, 0, 0)], () => {});
  actor.update(.15);
  const book = actor.root.getObjectByName('Held book');
  assert.ok(book?.visible && book.parent);
  const wrist = book.parent;
  assert.notEqual(wrist, actor.root.children[0]);
  assert.ok(book.getWorldPosition(new THREE.Vector3()).distanceTo(wrist.getWorldPosition(new THREE.Vector3())) < .12);
  actor.playDomesticActivity('read');
  actor.update(.15);
  assert.equal(book.parent, actor.root.children[0]);
  actor.clearProps();
  assert.equal(book.visible, false);
});

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

test('Stance foot stays near the floor and moves slower than the walking body', () => {
  const actor = new Actor('vlad', [0, 0]);
  actor.walkPath([new THREE.Vector3(0, 0, 8)], () => {});
  settle(actor, 1);
  const foot = actor.root.getObjectByName('leftAnkle')!;
  let longestStance = 0;
  let consecutive = 0;
  let previous = foot.getWorldPosition(new THREE.Vector3());
  for (let i = 0; i < 36; i++) {
    actor.update(1 / 60);
    const current = foot.getWorldPosition(new THREE.Vector3());
    // The shorter-stride upright gait avoids the old knee collapse. Its foot
    // now drifts slightly during stance, but stays near the floor and moves
    // under half as far as the torso does in a 1/60-second walking frame.
    const planted = Math.abs(current.y - 0.084) < 0.011 && Math.abs(current.z - previous.z) < 0.014;
    consecutive = planted ? consecutive + 1 : 0;
    longestStance = Math.max(longestStance, consecutive);
    previous = current;
  }
  assert.ok(longestStance >= 10, 'stance foot should stay low and move slowly for at least ten frames');
});

test('Both hands reach the keyboard and the two high-five palms share a target', () => {
  const vlad = new Actor('vlad', [3.17, 3.65]);
  const alina = new Actor('alina', [3.17, 3.65]);
  const keyboard = [new THREE.Vector3(3.37, 1.116, 1.896), new THREE.Vector3(3.03, 1.116, 1.896)] as const;
  for (const [index, actor] of [vlad, alina].entries()) {
    actor.setFurniturePose('work', new THREE.Vector3(3.2, index === 0 ? -0.24 : -0.19, 2.47), Math.PI, keyboard);
    settle(actor, 1.5);
    for (const [side, key] of keyboard.entries()) {
      const wrist = actor.root.getObjectByName(side === 0 ? 'leftWrist' : 'rightWrist')!;
      assert.ok(wrist.getWorldPosition(new THREE.Vector3()).distanceTo(key) < 0.065);
    }
  }
  vlad.root.position.set(-0.42, 0, 2.38);
  alina.root.position.set(0.42, 0, 2.38);
  const contact = new THREE.Vector3(0, 1.64, 2.22);
  vlad.faceTowards(alina.root.position);
  alina.faceTowards(vlad.root.position);
  vlad.playGesture('highFive', contact);
  alina.playGesture('highFive', contact);
  settle(vlad, 0.5);
  settle(alina, 0.5);
  const palm = (actor: Actor, name: string) =>
    actor.root.getObjectByName(name)!.localToWorld(new THREE.Vector3(0, -0.062, 0));
  assert.ok(palm(vlad, 'rightWrist').distanceTo(palm(alina, 'leftWrist')) < 0.035);
  // The coordinated contact should persist beyond the first second, rather
  // than leaving both arms lowered for most of the social action.
  settle(vlad, 1.0);
  settle(alina, 1.0);
  assert.ok(palm(vlad, 'rightWrist').distanceTo(palm(alina, 'leftWrist')) < 0.055,
    'high-five palms must still be together 1.5s into the action');
});


test('A grooming brush follows the right wrist during visible repeated pet-care strokes and clears on cancel', () => {
  const actor = new Actor('vlad',[0,0]);
  const pet = new THREE.Vector3(.02,.48,.58);
  actor.faceTowards(pet);
  actor.playPetActivity('brush',pet);
  settle(actor,.9);
  const brush = actor.root.getObjectByName('Pet grooming brush');
  assert.ok(brush?.visible,'The grooming prop must actually be visible');
  assert.equal(brush.children.filter(child=>child instanceof THREE.Mesh).length,2,
    'The grooming brush should use two meshes/draw calls on mobile');
  const atStart = brush.getWorldPosition(new THREE.Vector3());
  settle(actor,.24);
  const atNext = brush.getWorldPosition(new THREE.Vector3());
  assert.ok(atStart.distanceTo(atNext) > .008,'Brushing must move the held brush, not freeze beside the animal');
  assert.deepEqual(actor.root.position.toArray(),[0,0,0],'Pet care never moves the navigation root');
  actor.finishActivity();
  settle(actor,.08);
  assert.equal(brush.visible,false,'Grooming brush must disappear after the action ends');
});
