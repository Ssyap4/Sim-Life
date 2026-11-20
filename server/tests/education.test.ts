import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import WebSocket from 'ws';
import { initialState, type CharacterId, type GameState, type ServerPacket } from '../../src/shared/protocol';
import { SKILL_IDS, educationalXP, levelXP, nextClassSlots, skillRank, talent, type SkillId } from '../../src/shared/education';
import { MATERIALS, MATERIAL_BY_ID, studyQuestions } from '../../src/shared/educationCatalog';
import { CAREER_EVENTS, careerEducation } from '../../src/shared/careerEducation';
import { approachFor, floorFor, placeObstacles, spawn, STATIONS } from '../../src/shared/locations';
import { findRoute } from '../../src/game/navigation';
import { answerMatches, applyEducation, awardActivity, completeStudy, saveBookMinutes, studyDenial, studyMinutes } from '../education';
import { openServerFiles } from '../storage';
import { startServer } from '../server';

const item = (id: string) => {
  const value = MATERIAL_BY_ID.get(id);
  assert.ok(value, id);
  return value;
};
const update = (state: GameState, role: CharacterId, command: object) => {
  const result = applyEducation(state, role, command as Record<string, unknown>);
  if (!result.ok) assert.fail(result.reason);
  return result.state;
};

test('The curriculum is unique and every skill reaches mastery through multiple free channels', () => {
  assert.equal(new Set(MATERIALS.map(row => row.id)).size, MATERIALS.length);
  for (const id of SKILL_IDS) {
    for (const strategy of ['free', 'mixed', 'paid', 'practice'] as const) {
      const result = simulate(id, strategy);
      assert.equal(Object.keys(result.milestones).length, 4, id + ' ' + strategy);
      assert.ok(result.minutes > 100);
      if (strategy === 'free' || strategy === 'practice') assert.equal(result.cost, 0);
    }
    assert.ok(simulate(id, 'paid').minutes < simulate(id, 'free').minutes, id);
  }
  for (let level = 2; level <= 20; level++)
    assert.ok(levelXP(level) - levelXP(level - 1) > levelXP(level - 1) - levelXP(level - 2));
  assert.equal(talent('vlad', 'technology'), 10);
  assert.equal(talent('alina', 'technology'), 0);
  assert.equal(talent('alina', 'communication'), 10);
});

function simulate(skill: SkillId, strategy: 'free' | 'mixed' | 'paid' | 'practice') {
  const state = initialState();
  const profile = state.education.characters.vlad;
  const milestones: Record<number, number> = {};
  let minutes = 0, cost = 0;
  const channels = MATERIALS.filter(row => row.skill === skill && !row.sessions && !row.program && !row.certificate);
  for (let step = 0; step < 150 && skillRank(profile.xp[skill]).level < 20; step++) {
    const available = channels.filter(row => educationalXP(row, 'vlad', profile) > 0 &&
      (strategy === 'paid' || strategy === 'mixed' && (!row.price || row.channel === 'tv') ||
        !row.price && (strategy !== 'practice' || row.channel === 'practice')));
    const chosen = available.sort((a, b) => {
      const rate = (row: typeof a) => educationalXP(row, 'vlad', profile) / row.minutes;
      return rate(b) - rate(a);
    })[0];
    assert.ok(chosen, JSON.stringify({ skill, strategy, xp: profile.xp[skill] }));
    if (!profile.studied[chosen.id]) cost += chosen.price;
    minutes += chosen.minutes;
    completeStudy(state, 'vlad', chosen, 480 + minutes);
    for (const level of [5, 10, 15, 20]) if (!(level in milestones) && skillRank(profile.xp[skill]).level >= level)
      milestones[level] = minutes;
  }
  return { milestones, minutes, cost };
}
test('Progression simulation records active study minutes and ruble costs', () => {
  const results = Object.fromEntries((['free','mixed','paid','practice'] as const).map(key => [key, simulate('logic', key)]));
  assert.ok(results.free.minutes >= 3000, 'Mastering one skill must take sustained free study, not minutes');
  assert.ok(results.paid.minutes >= 1200, 'Even paid learning must not grant instant mastery');
  assert.ok(results.paid.minutes < results.free.minutes * .7, 'Paid study must save meaningful time');
  assert.ok(results.practice.minutes > results.free.minutes, 'Practical-only learning should take longer');
  console.log('EDUCATION_BALANCE ' + JSON.stringify(results));
});

test('Licenses are family-wide, XP is personal, and repeat rewards are finite', () => {
  const original = initialState(), tv = item('tv:logic:0:plus');
  assert.match(studyDenial(original, 'vlad', tv, 480) ?? '', /купи/);
  let state = update(original, 'vlad', { type: 'education_buy', id: tv.id });
  assert.equal(original.money - state.money, tv.price);
  assert.equal(state.ledger.at(-1)?.category, 'education');
  assert.equal(applyEducation(state, 'alina', { type: 'education_buy', id: tv.id }).ok, false);
  assert.equal(studyDenial(state, 'alina', tv, 480), undefined);
  const rewards = [];
  for (let n = 0; n < 5; n++) {
    rewards.push(educationalXP(tv, 'vlad', state.education.characters.vlad));
    completeStudy(state, 'vlad', tv, 480);
  }
  const nominal = tv.xp * 1.1;
  assert.deepEqual(rewards, [nominal, nominal * .30, nominal * .10, 0, 0].map(Math.round));
  assert.equal(state.education.characters.alina.xp.logic, 0);
  assert.match(studyDenial(state, 'vlad', item('tv:logic:4'), 480) ?? '', /16/);
  // Capital and legacy XP remain independent of the education mint.
  state = update(state, 'vlad', { type: 'education_goal', id: 'skill-5' });
  assert.ok(state.education.characters.vlad.goals.includes('skill-5'));
});

test('Enrollment, missed classes, refund, included exam and qualification all preserve money rules', () => {
  const source = initialState();
  source.money = 50_000;
  const entry = item('center:logic:2'), exam = item('exam:logic');
  source.education.characters.vlad.xp.logic = levelXP(8);
  const slot = nextClassSlots(480)[0];
  assert.equal(applyEducation({ ...source, money: 0 }, 'vlad', { type: 'education_buy', id: entry.id, slot }).ok, false);
  let state = update(source, 'vlad', { type: 'education_buy', id: entry.id, slot });
  assert.equal(state.money, source.money - entry.price);
  assert.equal(applyEducation(state, 'vlad', { type: 'education_buy', id: entry.id, slot }).ok, false);
  const refund = update(state, 'vlad', { type: 'education_cancel', id: entry.id });
  assert.equal(refund.money, source.money);
  assert.equal(applyEducation(refund, 'vlad', { type: 'education_cancel', id: entry.id }).ok, false);
  state.world.places.vlad = 'education';
  assert.match(studyDenial(state, 'vlad', entry, slot - 1) ?? '', /не началось/);
  assert.match(studyDenial(state, 'vlad', entry, slot + 90) ?? '', /закрыто/);
  state.clock.minute = slot + 90;
  state = update(state, 'vlad', { type: 'education_reschedule', id: entry.id, slot: nextClassSlots(slot + 90)[0] });
  const enrollment = state.education.characters.vlad.enrollments[entry.id];
  for (const at of enrollment.dates) {
    assert.equal(studyDenial(state, 'vlad', entry, at), undefined);
    completeStudy(state, 'vlad', entry, at);
  }
  assert.equal(enrollment.attended, 3);
  const funded = update(state, 'vlad', { type: 'education_buy', id: exam.id });
  assert.equal(funded.money, state.money);
  assert.equal(studyQuestions(exam).length, 3);
  completeStudy(funded, 'vlad', exam, 3000);
  assert.deepEqual(funded.education.characters.vlad.certificates, ['logic']);
  assert.equal(funded.education.characters.alina.certificates.length, 0);
  assert.ok(CAREER_EVENTS.length >= 20);
  assert.ok(careerEducation(funded.education.characters.vlad,
    { professionId: 'example', positionId: 'trainee', certificates: ['logic'] }, 0, new Set()).eligible);
});

test('Older saves preserve money and legacy skill while restoring books, module checkpoints and program awards', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sim-life-education-save-'));
  try {
    const { education: _old, ...legacy } = initialState();
    legacy.money = 5540;
    legacy.characters.vlad.skill = 41;
    legacy.readBooks.vlad = ['prince'];
    writeFileSync(join(dir, 'household.json'), JSON.stringify(legacy));
    const files = openServerFiles(dir), state = files.load();
    assert.equal(state.money, 5540);
    assert.equal(state.characters.vlad.skill, 41);
    assert.equal(state.education.characters.vlad.studied['life:book:prince'].completions, 1);
    const book = item('book:logic:0');
    saveBookMinutes(state, 'vlad', book, 5);
    saveBookMinutes(state, 'vlad', book, 5);
    files.save(state);
    const restored = files.load();
    const profile = restored.education.characters.vlad;
    assert.equal(profile.studied[book.id].minutes, 5);
    assert.equal(studyMinutes(profile, book), book.minutes - 5);
    assert.equal(profile.xp.logic, 0);
    const program = item('program:tablica');
    profile.xp.technology = levelXP(4); profile.xp.logic = levelXP(2);
    assert.match(studyDenial(restored, 'vlad', program, 480) ?? '', /освоить/);
    completeStudy(restored, 'vlad', item('academy:technology:0'), 480);
    assert.equal(studyDenial(restored, 'vlad', program, 480), undefined);
    completeStudy(restored, 'vlad', program, 480);
    assert.deepEqual(profile.programs, ['tablica']);
    for (let i = 0; i < 8; i++) awardActivity(restored, 'alina', { type: 'act', actionId: 'bedStretch' }, 'Зарядка');
    assert.equal(restored.education.characters.alina.studied['life:action:bedStretch'].completions, 8);
    assert.ok(restored.education.characters.alina.xp.fitness > 0,
      'Everyday practice still gains a little experience after repeated actions');
    files.save(restored);
    assert.deepEqual(files.load().education, restored.education);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('Personal skill milestones can be replaced and completed independently for each resident', () => {
  let state = initialState();
  state = update(state, 'vlad', { type: 'education_goal', id: 'logic-10' });
  state = update(state, 'vlad', { type: 'education_goal', id: 'logic-5' });
  assert.deepEqual(state.education.characters.vlad.goals, ['logic-5']);
  assert.deepEqual(state.education.characters.alina.goals, []);
  state.education.characters.vlad.xp.logic = levelXP(5) - 5;
  completeStudy(state, 'vlad', item('book:logic:1'), 480);
  assert.ok(state.education.characters.vlad.achievements.includes('logic-5'));
  assert.equal(applyEducation(state, 'vlad', { type: 'education_goal', id: 'logic-5' }).ok, false);
  state = update(state, 'vlad', { type: 'education_goal', id: 'logic-10' });
  assert.deepEqual(state.education.characters.vlad.goals, ['logic-5', 'logic-10']);
});

test('Every education station and the plaza entrance are reachable from both spawns', () => {
  for (const place of ['street', 'education'] as const) for (const role of ['vlad', 'alina'] as const) {
    const positions = [spawn(place, role), ...STATIONS[place].map(station => approachFor(station, role))];
    for (const from of positions) for (const to of positions)
      assert.ok(findRoute(from, to, placeObstacles(place), floorFor(place)), JSON.stringify({ place, from, to }));
  }
});

async function connect(port: number, role: CharacterId, code: string) {
  const socket = new WebSocket('ws://127.0.0.1:' + port + '/sync');
  const inbox: ServerPacket[] = [];
  socket.on('message', raw => inbox.push(JSON.parse(raw.toString()) as ServerPacket));
  await once(socket, 'open');
  function send(message: object) { socket.send(JSON.stringify(message)); }
  async function take<T extends ServerPacket['type']>(type: T, match: (p: Extract<ServerPacket, { type: T }>) => boolean = () => true) {
    const until = Date.now() + 5000;
    while (Date.now() < until) {
      const index = inbox.findIndex(p => p.type === type && match(p as Extract<ServerPacket, { type: T }>));
      if (index >= 0) return inbox.splice(index, 1)[0] as Extract<ServerPacket, { type: T }>;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error('Missing ' + type + ' for ' + role + ': ' + inbox.map(p => p.type).join(','));
  }
  send({ type: 'auth', role, code });
  await take('ready');
  return { socket, send, take };
}

test('Two live players resume a book and submit a real academy exercise with separate XP', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sim-life-education-wire-'));
  const files = openServerFiles(dir);
  let now = 0;
  const server = await startServer({ dataDir: dir, port: 0, taskTimeScale: .06, lifeClock: { now: () => now, tickMs: 15 } });
  try {
    let vlad = await connect(server.port, 'vlad', files.access.vlad);
    const alina = await connect(server.port, 'alina', files.access.alina);
    const book = item('book:logic:0'), exercise = item('academy:attention:0');
    vlad.send({ type: 'study', material: book.id });
    const original = await vlad.take('task_started');
    await vlad.take('task_active');
    now += 400;
    const closed = once(vlad.socket, 'close');
    vlad.socket.close();
    await closed;
    vlad = await connect(server.port, 'vlad', files.access.vlad);
    const partial = files.load().education.characters.vlad.studied[book.id];
    assert.ok(partial.minutes > 0 && partial.minutes < book.minutes);
    assert.equal(partial.completions, 0);
    vlad.send({ type: 'study', material: book.id });
    alina.send({ type: 'study', material: exercise.id });
    const resumed = await vlad.take('task_started', p => p.role === 'vlad');
    const quiz = await alina.take('task_started', p => p.role === 'alina');
    assert.ok(resumed.durationMs < original.durationMs);
    await vlad.take('task_active', p => p.taskId === resumed.taskId);
    await alina.take('task_active', p => p.taskId === quiz.taskId);
    for (const [index, question] of studyQuestions(exercise).entries()) {
      if (index) await new Promise(resolve => setTimeout(resolve, 920));
      const choice = [0, 1, 2].find(i => answerMatches(question, i));
      assert.notEqual(choice, undefined);
      alina.send({ type: 'education_answer', taskId: quiz.taskId, choice });
      assert.ok((await alina.take('education_feedback')).correct);
    }
    const correct = [0, 1, 2].find(i => answerMatches(quiz.home!.question!, i));
    // Scale the fake-clock jump to the actual curriculum duration, not a fixed short lesson.
    now += Math.ceil(Math.max(book.minutes, exercise.minutes) / .5 * .06 * 1000) + 1000;
    await vlad.take('task_ended', p => p.taskId === resumed.taskId && p.outcome === 'completed');
    await alina.take('task_ended', p => p.taskId === quiz.taskId && p.outcome === 'completed');
    const saved = files.load();
    assert.ok(saved.education.characters.vlad.xp.logic > 0);
    assert.ok(saved.education.characters.alina.xp.attention > 0);
    assert.equal(saved.education.characters.alina.xp.logic, 0);
    assert.equal(saved.education.characters.vlad.studied[book.id].completions, 1);
    alina.send({ type: 'education_answer', taskId: quiz.taskId, choice: correct });
    await alina.take('error');
    assert.equal(files.load().education.characters.alina.studied[exercise.id].completions, 1);
  } finally { await server.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('Two learners attend the same classroom; a self-taught player earns a certificate by passing three questions', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sim-life-education-center-'));
  const files = openServerFiles(dir);
  const initial = initialState(), course = item('center:logic:0'), exam = item('exam:logic');
  initial.clock = { day: 1, minute: 610 };
  for (const role of ['vlad', 'alina'] as const) {
    initial.education.characters[role].enrollments[course.id] = { dates: [600, 2040, 3480], attended: 0, paid: course.price };
  }
  initial.education.characters.alina.xp.logic = levelXP(exam.min);
  files.save(initial);
  let now = 0;
  const server = await startServer({ dataDir: dir, port: 0, taskTimeScale: .06, lifeClock: { now: () => now, tickMs: 15 } });
  try {
    const vlad = await connect(server.port, 'vlad', files.access.vlad);
    const alina = await connect(server.port, 'alina', files.access.alina);
    vlad.send({ type: 'travel', place: 'education' });
    alina.send({ type: 'travel', place: 'education' });
    await vlad.take('snapshot', p => Object.values(p.state.world.places).every(place => place === 'education'));
    vlad.send({ type: 'study', material: course.id });
    alina.send({ type: 'study', material: course.id });
    const classVlad = await vlad.take('task_started', p => p.role === 'vlad');
    const classAlina = await alina.take('task_started', p => p.role === 'alina');
    assert.equal(classVlad.home?.station, course.station);
    assert.notDeepEqual(classVlad.home?.route.path.at(-1), classAlina.home?.route.path.at(-1));
    for (const [client, task] of [[vlad, classVlad], [alina, classAlina]] as const) {
      await client.take('task_active', p => p.taskId === task.taskId);
      for (const [index, question] of studyQuestions(course, 0).entries()) {
        if (index) await new Promise(resolve => setTimeout(resolve, 920));
        client.send({ type: 'education_answer', taskId: task.taskId,
          choice: [0, 1, 2].find(i => answerMatches(question, i)) });
        assert.ok((await client.take('education_feedback')).correct);
      }
    }
    now += 6_000;
    await vlad.take('task_ended', p => p.taskId === classVlad.taskId && p.outcome === 'completed');
    await alina.take('task_ended', p => p.taskId === classAlina.taskId && p.outcome === 'completed');
    for (const role of ['vlad', 'alina'] as const) assert.equal(files.load().education.characters[role].enrollments[course.id].attended, 1);
    alina.send({ type: 'education_buy', id: exam.id });
    await alina.take('education_notice');
    alina.send({ type: 'study', material: exam.id });
    const sitting = await alina.take('task_started', p => p.role === 'alina');
    await alina.take('task_active', p => p.taskId === sitting.taskId);
    for (const [index, question] of studyQuestions(exam).entries()) {
      if (index) await new Promise(resolve => setTimeout(resolve, 920));
      alina.send({ type: 'education_answer', taskId: sitting.taskId, choice: [0, 1, 2].find(i => answerMatches(question, i)) });
      assert.ok((await alina.take('education_feedback')).correct);
      assert.equal(files.load().education.characters.alina.certificates.length, 0);
    }
    now += 6_000;
    await alina.take('task_ended', p => p.taskId === sitting.taskId && p.outcome === 'completed');
    assert.deepEqual(files.load().education.characters.alina.certificates, ['logic']);
    assert.equal(files.load().money, initial.money - exam.price);
  } finally { await server.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('An ongoing study advances at the agreed shift rate and pauses with no players', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sim-life-education-speed-'));
  const files = openServerFiles(dir);
  let now = 0;
  const server = await startServer({ dataDir: dir, port: 0, taskTimeScale: .1, lifeClock: { now: () => now, tickMs: 15 } });
  try {
    const vlad = await connect(server.port, 'vlad', files.access.vlad);
    const alina = await connect(server.port, 'alina', files.access.alina);
    vlad.send({ type: 'study', material: 'book:logic:0' });
    const task = await vlad.take('task_started');
    await vlad.take('task_active', p => p.taskId === task.taskId);
    now += 600;
    const normal = await vlad.take('study_progress', p => p.elapsed > 0);
    assert.equal(normal.elapsed, 3);
    alina.send({ type: 'job_start', job: 'ozon' });
    await alina.take('job_event', p => p.outcome === 'started');
    vlad.send({ type: 'shift_speed', enabled: true });
    alina.send({ type: 'shift_speed', enabled: true });
    await vlad.take('time_status', p => p.status.multiplier === 1.5);
    now += 600;
    const fast = await vlad.take('study_progress', p => p.elapsed > normal.elapsed);
    assert.equal(fast.elapsed, 7.5);
    const closed = [vlad, alina].map(player => once(player.socket, 'close'));
    vlad.socket.close(); alina.socket.close();
    await Promise.all(closed);
    // A client's close event may precede the server-side disconnect handler.
    // Wait until both roles have been removed before advancing the fake clock.
    let online = 2;
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      const response = await fetch('http://127.0.0.1:' + server.port + '/health');
      online = ((await response.json()) as { online: number }).online;
      if (online === 0) break;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.equal(online, 0);
    const before = files.load();
    now += 300_000;
    const back = await connect(server.port, 'vlad', files.access.vlad);
    assert.deepEqual(files.load().clock, before.clock);
    assert.equal(files.load().education.characters.vlad.studied['book:logic:0'].minutes, 7);
    assert.equal(files.load().education.characters.vlad.xp.logic, 0);
    back.socket.close();
  } finally { await server.close(); rmSync(dir, { recursive: true, force: true }); }
});
