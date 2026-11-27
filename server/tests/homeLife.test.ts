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
    [{type:'act',actionId:'bathFoam'},75,100,0,35],
    [{type:'act',actionId:'bathShower'},38,80,0,0],
    [{type:'free_tv'},60,0,5,0],
    [{type:'youtube'},40,0,20,10],
    ...Object.keys(GENRES).map(genre=>[{type:'movie',genre},120,0,80,15] as const),
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
  assert.equal(Object.keys(BOOKS).length,16);
  assert.equal(planTask({type:'read_book',book:'toString'}),null);
  assert.equal(planTask({type:'movie',genre:'unknown'}),null);
});

test('Both library approaches and all reading seats are navigable inside the home', () => {
  const obstacles=placeObstacles('home');
  for(const role of ['vlad','alina'] as const) {
    assert.ok(findRoute(spawn('home',role),LIBRARY_APPROACH,obstacles,HOME_FLOOR));
    for(const id of ['sofa','officeChair','table','yardTable'] as const) {
      const {approach}=homeSeat(id,role);
      assert.ok(pointIsClear(approach,obstacles,HOME_FLOOR),role+' '+id);
      assert.ok(findRoute(LIBRARY_APPROACH,approach,obstacles,HOME_FLOOR),role+' '+id);
    }
  }
  const a=homeSeat('sofa','vlad').position,b=homeSeat('sofa','alina').position;
  assert.ok(Math.abs(a.x-b.x)>=1);
});

import {readingReward,viewingReward,type BookId} from '../../src/shared/homeLife';
import {initialElectronics} from '../../src/shared/electronics';
import {SOCIAL_BY_ID,type SocialIntent} from '../../src/shared/socialLife';
import {pairScenes,completeTogether,socialDuration} from '../society';

test('TV menus and both joint invitation paths share one reward formula, including upgraded hardware',()=>{
  let state=initialState();
  for(const service of ['netflix','youtube'] as const){
    const r=applyServiceCommand(state,'vlad',{type:'service_connect',service});assert.ok(r.ok);state=r.state;
  }
  state.world.electronics={...initialElectronics(),tv:'tvOLED'};
  for(const role of ['vlad','alina'] as const)Object.assign(state.characters[role],{fun:0,social:0,comfort:0});
  for(const [command,social] of [
    [{type:'movie',genre:'comedy'},{type:'together',action:'film',item:'comedy'}],
    [{type:'youtube'},{type:'together',action:'youtube'}],
    [{type:'free_tv'},{type:'together',action:'tv'}],
  ] as const){
    const expected=viewingReward(command,true,12,9);
    const solo=evaluateTask(state,'vlad',command,true);assert.ok(solo.ok);
    const homes=pairScenes(state,'vlad',social);assert.ok(homes);
    const together=completeTogether(state,'vlad',social,['vlad','alina'],0,homes);assert.ok(together.ok);
    for(const role of ['vlad','alina'] as const)for(const key of ['fun','social','comfort'] as const){
      assert.equal(together.state.characters[role][key],expected[key]??0);
      assert.equal(solo.state.characters.vlad[key],expected[key]??0);
    }
  }
});
test('Every shared book takes its actual reading time; shorter books earn proportionately less fun',()=>{
  const state=initialState();
  for(const book of Object.keys(BOOKS) as BookId[]){
    const command:SocialIntent={type:'together',action:'read',item:book};
    assert.equal(socialDuration(SOCIAL_BY_ID.get('read')!,command,state),BOOKS[book][3]*1000);
    assert.equal(readingReward(book).fun,Math.round(BOOKS[book][3]/2));
  }
  assert.equal(readingReward('prince').fun,20);assert.equal(readingReward('master').fun,60);
});