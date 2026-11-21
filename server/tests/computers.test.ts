import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computerDevice, computerResource } from '../../src/shared/computer';
import { MATERIALS } from '../../src/shared/educationCatalog';
import { shiftWindow } from '../../src/shared/careers';
import { clockAt, gameMinutes } from '../../src/shared/life';
import { HOME_LAPTOP, stationById } from '../../src/shared/locations';
import { initialState, points } from '../../src/shared/protocol';
import { applyCareer } from '../careers';
import { evaluateTask, planTask } from '../tasks';

test('Both home computers host the logged-in resident actions without swapping profiles', () => {
  for (const [device, resource] of [['laptop','career-laptop'], ['desktop','desk']] as const) {
    assert.equal(computerDevice(device), true);
    assert.equal(computerResource(device), resource);
    for (const actionId of ['vladStudy','vladOrder','alinaStudy','alinaConsult','deskGames','deskJournal']) {
      const plan = planTask({type:'act', actionId, computer:device});
      assert.equal(plan?.resource, resource, actionId);
      assert.deepEqual(plan?.command, {type:'act',actionId,computer:device});
      const owner = actionId.startsWith('vlad') ? 'vlad' : actionId.startsWith('alina') ? 'alina' : null;
      if (owner) {
        const other = owner === 'vlad' ? 'alina' : 'vlad';
        assert.equal(evaluateTask(initialState(),other,plan!.command).ok,false);
      }
    }
  }
  assert.equal(planTask({type:'act',actionId:'deskGames',computer:'tablet'}),null);
  assert.equal(planTask({type:'act',actionId:'bedMake',computer:'laptop'}),null);
  assert.equal(planTask({type:'act',actionId:'deskGames'})?.resource,'desk','old clients keep working');
});

test('Academy sessions reserve the chosen computer and reject spoofed devices', () => {
  const lesson = MATERIALS.find(row => row.channel === 'academy')!;
  assert.ok(lesson);
  for (const device of ['laptop','desktop'] as const) {
    const plan=planTask({type:'study',material:lesson.id,computer:device});
    assert.equal(plan?.resource,computerResource(device));
    assert.deepEqual(plan?.command,{type:'study',material:lesson.id,computer:device});
  }
  assert.equal(planTask({type:'study',material:lesson.id})?.resource,'desk');
  assert.equal(planTask({type:'study',material:lesson.id,computer:'tablet'}),null);
  const book = MATERIALS.find(row=>row.channel==='book')!;
  assert.equal(planTask({type:'study',material:book.id,computer:'laptop'}),null);
});

test('Remote marketing work accepts either computer and old shifts default to the laptop', () => {
  const begin = () => {
    const initial=initialState();
    initial.clock=clockAt(shiftWindow('marketing',0).start);
    const hire=applyCareer(initial,'alina',{type:'career_hire',career:'marketing'},gameMinutes(initial.clock));
    assert.equal(hire.ok,true);
    if (!hire.ok) throw new Error('Hiring failed');
    const start=applyCareer(hire.state,'alina',{type:'career_start'},gameMinutes(hire.state.clock));
    assert.equal(start.ok,true);
    if (!start.ok) throw new Error('Shift failed');
    return start.state;
  };
  for (const device of ['laptop','desktop'] as const) {
    const current=begin();
    const nonce=current.careers.residents.alina.shift!.task!.nonce;
    const before=structuredClone(current);
    const bad=applyCareer(current,'alina',{type:'career_approach',nonce,device:'tablet'},gameMinutes(current.clock));
    assert.equal(bad.ok,false);
    assert.deepEqual(current,before,'Rejected commands cannot mutate the source state');
    const result=applyCareer(current,'alina',{type:'career_approach',nonce,device},gameMinutes(current.clock));
    assert.equal(result.ok,true);
    if (!result.ok) throw new Error('Approach failed');
    const shift=result.state.careers.residents.alina.shift!;
    assert.equal(shift.homeDevice,device);
    const destination=device==='laptop' ? stationById('home',HOME_LAPTOP)!.approach : points.desk;
    const position=result.state.characters.alina;
    assert.ok(Math.hypot(position.x-destination.x,position.z-destination.z)<1.25);
  }
  const legacy=begin();
  const nonce=legacy.careers.residents.alina.shift!.task!.nonce;
  const response=applyCareer(legacy,'alina',{type:'career_approach',nonce},gameMinutes(legacy.clock));
  assert.equal(response.ok,true);
  if (response.ok) assert.equal(response.state.careers.residents.alina.shift?.homeDevice,'laptop');
});
