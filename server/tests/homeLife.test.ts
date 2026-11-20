import { applyServiceCommand } from '../services';
import assert from 'node:assert/strict';
import test from 'node:test';
import { planTask, evaluateTask } from '../tasks';
import { initialState } from '../../src/shared/protocol';
import { BOOKS, GENRES } from '../../src/shared/homeLife';
import { HOME_FLOOR, homeSeat, LIBRARY_APPROACH } from '../../src/shared/home';
import { placeObstacles, spawn } from '../../src/shared/locations';
import { findRoute, pointIsClear } from '../../src/game/navigation';

test('Home activity durations and exact gains are independent of the shared calendar', () => {
  const seed=initialState();
  seed.money=5000;
  const withNetflix=applyServiceCommand(seed,'vlad',{type:'service_connect',service:'netflix'});
  assert.ok(withNetflix.ok);
  const withYouTube=applyServiceCommand(withNetflix.state,'alina',{type:'service_connect',service:'youtube'});
  assert.ok(withYouTube.ok);
  const state=withYouTube.state;
  Object.assign(state.characters.vlad,{fun:0,hygiene:0,comfort:0,social:0});
  const cases=[
    [{type:'act',actionId:'bathTeeth'},18,20,0,0],
    [{type:'act',actionId:'bathFoam'},75,100,0,15],
    [{type:'act',actionId:'bathShower'},38,75,0,0],
    [{type:'free_tv'},60,0,5,0],
    [{type:'youtube'},40,0,20,10],
    ...Object.keys(GENRES).map(genre=>[{type:'movie',genre},120,0,100,15] as const),
  ] as const;
  for(const [command,seconds,hygiene,fun,comfort] of cases) {
    const plan=planTask(command);
    assert.ok(plan);
    assert.equal(plan.durationMs,seconds*1000);
    const result=evaluateTask(state,'vlad',plan.command);
    assert.ok(result.ok);
    const person=result.state.characters.vlad;
    assert.deepEqual([person.hygiene,person.fun,person.comfort,person.social],[hygiene,fun,comfort,0]);
    assert.deepEqual(result.state.clock,state.clock);
  }
  assert.equal(planTask({type:'act',actionId:'sofaMovie'})?.durationMs,120_000);
  assert.equal(planTask({type:'act',actionId:'sofaRead'})?.durationMs,40_000);
  assert.equal(Object.keys(BOOKS).length,12);
  assert.equal(planTask({type:'read_book',book:'toString'}),null);
  assert.equal(planTask({type:'movie',genre:'unknown'}),null);
});

test('Both library approaches and all reading seats are navigable inside the home', () => {
  const obstacles=placeObstacles('home');
  for(const role of ['vlad','alina'] as const) {
    assert.ok(findRoute(spawn('home',role),LIBRARY_APPROACH,obstacles,HOME_FLOOR));
    for(const id of ['sofa','officeSofa','table','yardBench','spareSeat'] as const) {
      const {approach}=homeSeat(id,role);
      assert.ok(pointIsClear(approach,obstacles,HOME_FLOOR),role+' '+id);
      assert.ok(findRoute(LIBRARY_APPROACH,approach,obstacles,HOME_FLOOR),role+' '+id);
    }
  }
  const a=homeSeat('sofa','vlad').position,b=homeSeat('sofa','alina').position;
  assert.ok(Math.abs(a.x-b.x)>=1);
});
