import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Vector3 } from 'three';
import { Actor } from '../../src/game/Actor';
import { chooseResidentIdle, residentIdleAllowed, residentIdleWeight,
  residentIdleEase, residentIdleTouchWeight,
  RESIDENT_IDLE_SECONDS, type ResidentIdleContext, type ResidentIdleGesture } from '../../src/game/ResidentIdle';
import type { ReactionNeeds } from '../../src/game/NeedReactions';

const healthy: ReactionNeeds = { energy: 89, hunger: 87, bladder: 92, hygiene: 88, mood: 85 };
const alone: ResidentIdleContext = { petYaw: null, partnerYaw: null };

test('Vlad and Alina have different rotating habits without inventing game actions', () => {
  const vlad = Array.from({ length: 8 }, (_, turn) => chooseResidentIdle('vlad', alone, turn));
  const alina = Array.from({ length: 8 }, (_, turn) => chooseResidentIdle('alina', alone, turn));
  assert.equal(vlad[0], 'think');
  assert.equal(alina[0], 'fixHair');
  assert.ok(new Set(vlad).size >= 5);
  assert.ok(new Set(alina).size >= 5);
  assert.ok(!vlad.includes('fixHair'));
  assert.ok(!alina.includes('think'));
});

test('Nearby people and pets cause only contextual glances, never phantom greetings', () => {
  const near: ResidentIdleContext = { petYaw: 0.45, partnerYaw: -0.3 };
  assert.equal(chooseResidentIdle('vlad', near, 2), 'noticePet');
  assert.equal(chooseResidentIdle('alina', near, 4), 'noticePartner');
  assert.notEqual(chooseResidentIdle('vlad', alone, 2), 'noticePet');
  assert.notEqual(chooseResidentIdle('alina', alone, 4), 'noticePartner');
  assert.equal(residentIdleAllowed('noticePet', alone), false);
  assert.equal(residentIdleAllowed('noticePartner', near), true);
  assert.equal(residentIdleAllowed('noticePet', { ...near, petYaw: Number.NaN }), false);
  assert.ok(Number.isFinite(residentIdleWeight(1.3)));
});

test('Idle movements blend in and fade out rather than snap', () => {
  assert.equal(residentIdleWeight(-1), 0);
  assert.equal(residentIdleWeight(0), 0);
  assert.equal(residentIdleWeight(RESIDENT_IDLE_SECONDS), 0);
  assert.equal(residentIdleWeight(Number.NaN), 0);
  assert.equal(residentIdleWeight(1.4), 1);
  assert.ok(residentIdleWeight(.23) > 0 && residentIdleWeight(.23) < 1);
  assert.ok(residentIdleWeight(RESIDENT_IDLE_SECONDS - .22) < 1);
});

test('Distinct visible hand/head animation remains cosmetic; feet and root are untouched', () => {
  for (const id of ['vlad', 'alina'] as const) {
    const resident = new Actor(id, [1.2, 3.4]);
    resident.setNeeds(healthy);
    const count = resident.root.children.length;
    const initial = { ...healthy };
    for (let n = 0; n < (id === 'vlad' ? 390 : 465); n++) resident.update(1/60);
    assert.equal(resident.currentIdleGesture(), id === 'vlad' ? 'think' : 'fixHair');
    const rig = (resident as unknown as { rig: { head: { rotation: { x: number } } };
      leftArm: { rotation: { x: number } }; rightArm: { rotation: { x: number } } });
    assert.ok(Math.abs(rig.rig.head.rotation.x) > .017, 'idle head has a noticeable tilt');
    assert.ok(Math.max(Math.abs(rig.leftArm.rotation.x), Math.abs(rig.rightArm.rotation.x)) > .20,
      'one hand moves distinctly while idle');
    assert.equal(resident.root.position.x, 1.2);
    assert.equal(resident.root.position.z, 3.4);
    assert.equal(resident.root.children.length, count, 'no extra 3D objects allocated');
    assert.deepEqual(healthy, initial, 'cosmetic idle cannot change server needs');
  }
});

test('Walking, interactions, furniture and critical need reactions always override habits', () => {
  const actor = new Actor('vlad', [0, 0]);
  actor.setNeeds(healthy);
  for (let i = 0; i < 390; i++) actor.update(1/60);
  assert.equal(actor.currentIdleGesture(), 'think');

  actor.walkPath([new Vector3(3, 0, 0)], () => {});
  actor.update(1/60);
  assert.equal(actor.currentIdleGesture(), null);
  assert.ok(actor.root.position.x > 0);

  actor.playActivity('eat');
  actor.update(1/60);
  assert.equal(actor.currentIdleGesture(), null);
  actor.setPose('sit');
  for (let i = 0; i < 750; i++) actor.update(1/60);
  assert.equal(actor.currentIdleGesture(), null);

  actor.setPose('idle');
  for (let i = 0; i < 900 && actor.currentIdleGesture() === null; i++) actor.update(1/60);
  for (let i = 0; i < 40; i++) actor.update(1/60);
  assert.notEqual(actor.currentIdleGesture(), null);
  actor.setNeeds({ ...healthy, energy: 6 });
  actor.update(1/60);
  assert.equal(actor.currentIdleGesture(), null, 'real urgent need wins immediately');
  for (let i = 0; i < 240; i++) actor.update(1/60);
  const motion = actor as unknown as { needReaction: string | null };
  assert.ok(['yawn','tired'].includes(motion.needReaction??''));
});

test('Pet glance stops as soon as pet leaves; partner glance requires proximity', () => {
  const actor = new Actor('alina', [0, 0]);
  actor.setNeeds(healthy);
  const motion = actor as unknown as { idleTurn: number; idleCooldown: number };
  motion.idleTurn = 2;
  motion.idleCooldown = 0;
  actor.setIdleSurroundings(0.35, null);
  actor.update(.2);
  assert.equal(actor.currentIdleGesture(), 'noticePet');
  actor.setIdleSurroundings(null, null);
  actor.update(.1);
  assert.equal(actor.currentIdleGesture(), null);
  motion.idleTurn = 4;
  motion.idleCooldown = 0;
  actor.setIdleSurroundings(null, -0.5);
  actor.update(.2);
  assert.equal(actor.currentIdleGesture(), 'noticePartner');
  actor.setIdleSurroundings(null, null);
  actor.update(.1);
  assert.equal(actor.currentIdleGesture(), null);
});

test('Contact gestures have anticipation, sustained touch and a smooth release', () => {
  assert.equal(residentIdleEase(-1, 0, 2), 0);
  assert.equal(residentIdleEase(0, 0, 2), 0);
  assert.equal(residentIdleEase(2, 0, 2), 1);
  assert.equal(residentIdleEase(Number.NaN, 0, 2), 0);
  assert.equal(residentIdleEase(1, 2, 2), 0);
  assert.equal(residentIdleTouchWeight(0), 0);
  assert.ok(residentIdleTouchWeight(0.8) > 0 && residentIdleTouchWeight(0.8) < 1);
  assert.equal(residentIdleTouchWeight(1.75), 1);
  assert.ok(residentIdleTouchWeight(3.25) > 0 && residentIdleTouchWeight(3.25) < 1);
  assert.equal(residentIdleTouchWeight(3.8), 0);
});

test('Three reaching habits move a physical wrist toward head or cuff targets', () => {
  const cases: Array<['vlad' | 'alina', ResidentIdleGesture, 0 | 1]> = [
    ['vlad', 'think', 1],
    ['alina', 'fixHair', 0],
    ['alina', 'adjustSleeve', 1],
  ];
  for (const [id, kind, wristIndex] of cases) {
    const actor = new Actor(id, [2, 3]);
    actor.setNeeds(healthy);
    const motion = actor as unknown as {
      idleGesture: ResidentIdleGesture | null;
      idleGestureTime: number;
      idleCooldown: number;
      needReactionCooldown: number;
      rig: {
        head: { localToWorld: (v: Vector3) => Vector3 };
        chest: { localToWorld: (v: Vector3) => Vector3 };
        wrists: [{ getWorldPosition: (v: Vector3) => Vector3 }, { getWorldPosition: (v: Vector3) => Vector3 }];
      };
    };
    motion.idleGesture = kind;
    motion.idleGestureTime = 0;
    motion.idleCooldown = 10000;
    motion.needReactionCooldown = 10000;
    for (let i = 0; i < 132; i++) actor.update(1/60);
    const wrist = motion.rig.wrists[wristIndex].getWorldPosition(new Vector3());
    const touch = kind === 'think'
      ? motion.rig.head.localToWorld(new Vector3(.108, -.151, .180))
      : kind === 'fixHair'
        ? motion.rig.head.localToWorld(new Vector3(-.165, .105, .123))
        : motion.rig.chest.localToWorld(new Vector3(-.085, 1.225, .337));
    assert.ok(wrist.distanceTo(touch) < .20,
      kind + ': hand should approach its real rig target, not float beside the body');
    if (kind === 'adjustSleeve') {
      const cuff = motion.rig.wrists[0].getWorldPosition(new Vector3());
      const cuffTarget = motion.rig.chest.localToWorld(new Vector3(-.13, 1.21, .29));
      assert.ok(cuff.distanceTo(cuffTarget) < .20,
        'left cuff must be held in front of the torso, not behind the back');
    }
    assert.equal(actor.root.position.x, 2);
    assert.equal(actor.root.position.z, 3);
    assert.equal(actor.currentIdleGesture(), kind);
  }
});

test('Scanning left/right produces distinct controlled head positions', () => {
  const actor = new Actor('vlad', [0, 0]);
  actor.setNeeds(healthy);
  const internals = actor as unknown as {
    idleGesture: ResidentIdleGesture | null;
    idleCooldown: number;
    needReactionCooldown: number;
    rig: { head: { rotation: { y: number } }; chest: { rotation: { y: number } } };
  };
  internals.idleGesture = 'lookAround';
  internals.idleCooldown = 10000;
  internals.needReactionCooldown = 10000;
  let left = 0;
  let right = 0;
  for (let n = 0; n < 150; n++) {
    actor.update(1/60);
    if (n === 88) left = internals.rig.head.rotation.y;
    if (n === 144) right = internals.rig.head.rotation.y;
  }
  assert.ok(left > .12, 'first glance reaches one side');
  assert.ok(right < -.09, 'second glance reaches the opposite side');
  assert.ok(Math.abs(internals.rig.chest.rotation.y) < .17,
    'chest follows slightly instead of rotating the whole person');
});
