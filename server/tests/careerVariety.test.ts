import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CAREERS, CAREER_IDS, shiftWindow, type CareerId } from '../../src/shared/careers';
import { WORK_CHECKS, WORK_EVENTS, WORK_EVENT_BY_ID } from '../../src/shared/careerCatalog';
import { deepCheckCount, DEEP_WORK_CHECKS } from '../../src/shared/workChallenges';
import { WORK_OUTCOMES } from '../../src/shared/workOutcomes';
import { levelXP } from '../../src/shared/education';
import { clockAt, gameMinutes } from '../../src/shared/life';
import { initialState, type GameState, type CharacterId } from '../../src/shared/protocol';
import { applyCareer, advanceCareers, validCareers } from '../careers';
import { openServerFiles } from '../storage';

const now = (s: GameState) => gameMinutes(s.clock);
const action = (s: GameState, role: CharacterId, command: Record<string,unknown>) => {
  const response = applyCareer(s,role,command,now(s));
  if (!response.ok) assert.fail(response.reason);
  return response.state;
};
const tick = (s: GameState, minutes: number) => {
  const before = now(s); s.clock = clockAt(minutes);
  advanceCareers(s,before,minutes,['vlad','alina']);
};
function hired(id: CareerId) {
  const role=CAREERS[id].owner,s=initialState(),day=CAREERS[id].days[0];
  s.clock=clockAt(shiftWindow(id,day).start);
  return action(s,role,{type:'career_hire',career:id});
}
function active(id: CareerId, eventId?: string) {
  const role=CAREERS[id].owner;
  let state=action(hired(id),role,{type:'career_start'});
  if (eventId) {
    assert.ok(WORK_EVENT_BY_ID.has(eventId));
    const task=state.careers.residents[role].shift!.task!;
    task.event=eventId;task.phase='ready';task.readyAt=now(state);
  }
  return state;
}
function finishDirect(state:GameState,role:CharacterId,selection=0) {
  const shift=state.careers.residents[role].shift!,task=shift.task!,nonce=task.nonce;
  if (task.phase==='new') {
    state=action(state,role,{type:'career_approach',nonce});
    tick(state,state.careers.residents[role].shift!.task!.readyAt);
  }
  state=action(state,role,{type:'career_choose',nonce,choice:selection});
  const checks=WORK_CHECKS[task.event]??[];
  for(let i=0;i<checks.length;i++){
    state=action(state,role,{type:'career_verify',nonce,choice:checks[i].answer,step:i});
  }
  tick(state,state.careers.residents[role].shift!.task!.readyAt);
  return state;
}

test('61 tasks have 109 actual checks and all four careers gain distinct challenge families',()=>{
  assert.equal(deepCheckCount,96);
  assert.equal(Object.keys(WORK_CHECKS).length,61);
  assert.equal(Object.values(WORK_CHECKS).reduce((sum,a)=>sum+a.length,0),109);
  assert.equal(WORK_EVENT_BY_ID.size,199);
  const prompts=new Set<string>();
  for (const career of CAREER_IDS) {
    const deep=Object.keys(DEEP_WORK_CHECKS).filter(k=>k.startsWith(career+'-'));
    assert.equal(deep.length,12,career);
    assert.ok(WORK_EVENTS[career].filter(e=>e.choices.length>=3).length>=20,career);
    for (const [id,questions] of Object.entries(WORK_CHECKS).filter(([id])=>id.startsWith(career+'-'))) {
      assert.ok(WORK_EVENT_BY_ID.has(id));
      assert.ok(questions.length>=1&&questions.length<=2);
      for(const check of questions){
        assert.equal(check.options.length,3);
        assert.ok(check.answer>=0&&check.answer<3);
        assert.ok(check.prompt.length>30);
        assert.ok(check.explanation.length>18);
        prompts.add(check.prompt);
      }
    }
    for(const topic of Object.keys(WORK_OUTCOMES[career])){
      const [first,second,third,thirdResult]=WORK_OUTCOMES[career][topic as keyof typeof WORK_OUTCOMES[typeof career]];
      assert.ok([first,second,third,thirdResult].every(s=>s.length>16));
      assert.notEqual(first,second);
    }
  }
  assert.equal(prompts.size,109,'all checks need distinctive prompts');
});

test('Each workplace has a fully server-owned two-step professional case with persistent quality consequences',()=>{
  for(const [id,eventId] of [['it','it-3'],['detail','detail-2'],['marketing','marketing-3'],['clinic','clinic-3']] as const){
    const role=CAREERS[id].owner;
    let state=active(id,eventId);
    const nonce=state.careers.residents[role].shift!.task!.nonce;
    const questions=WORK_CHECKS[eventId];
    state=action(state,role,{type:'career_choose',nonce,choice:0});
    assert.equal(state.careers.residents[role].shift!.task!.phase,'checking');
    state=action(state,role,{type:'career_verify',nonce,choice:questions[0].answer,step:0});
    assert.equal(state.careers.residents[role].shift!.task!.checkStep,1);
    assert.equal(applyCareer(state,role,{type:'career_verify',nonce,choice:questions[0].answer,step:0},now(state)).ok,false,
      'replayed first step must never answer step two');
    state=action(state,role,{type:'career_verify',nonce,choice:questions[1].answer,step:1});
    assert.equal(state.careers.residents[role].shift!.task!.phase,'working');
    assert.equal(state.money,10000,'work task should not grant wages before shift payout');
    tick(state,state.careers.residents[role].shift!.task!.readyAt);
    const progress=state.careers.residents[role].progress[id]!;
    assert.equal(progress.duties,1);
    assert.ok(progress.workplace && progress.workplace.trust>=50);
    assert.match(progress.history.at(-1)!.text,/Проверено шагов: 2/);
    assert.equal(applyCareer(state,role,{type:'career_verify',nonce,choice:0,step:1},now(state)).ok,false);
    assert.ok(validCareers(state.careers));
  }
});

test('Wrong answer teaches the correct reasoning, costs quality, and cannot skip the next stage',()=>{
  let s=active('it','it-3');
  const nonce=s.careers.residents.vlad.shift!.task!.nonce;
  s=action(s,'vlad',{type:'career_choose',nonce,choice:0});
  s=action(s,'vlad',{type:'career_verify',nonce,choice:0,step:0});
  const first=s.careers.residents.vlad.shift!.task!;
  assert.equal(first.attempts,1);
  assert.equal(first.checkStep??0,0);
  assert.match(first.hint??'',/трёх часов/);
  assert.equal(applyCareer(s,'vlad',{type:'career_verify',nonce,choice:1,step:1},now(s)).ok,false);
  s=action(s,'vlad',{type:'career_verify',nonce,choice:1,step:0});
  assert.equal(s.careers.residents.vlad.shift!.task!.checkStep,1);
  s=action(s,'vlad',{type:'career_verify',nonce,choice:0,step:1});
  tick(s,s.careers.residents.vlad.shift!.task!.readyAt);
  assert.equal(s.careers.residents.vlad.shift!.score,78);
  assert.ok(validCareers(s.careers));
});

test('A backlog creates a meaningful recovery assignment and is reduced by completing it',()=>{
  for (const id of CAREER_IDS) {
    const role=CAREERS[id].owner;
    let s=hired(id);
    s.careers.residents[role].progress[id]!.workplace={trust:47,backlog:3,improvements:0,recoveries:0};
    s=action(s,role,{type:'career_start'});
    assert.equal(s.careers.residents[role].shift!.task!.event,id+'-recovery');
    s=finishDirect(s,role,0);
    const w=s.careers.residents[role].progress[id]!.workplace!;
    assert.ok(w.backlog<3,id);
    assert.equal(w.recoveries,1,id);
    assert.ok(validCareers(s.careers));
  }
});

test('Strong results unlock rare, nonrepeating recognition moments',()=>{
  for(const id of CAREER_IDS){
    const role=CAREERS[id].owner;
    let s=hired(id);
    s.careers.residents[role].progress[id]!.workplace={trust:76,backlog:0,improvements:4,recoveries:0};
    s=action(s,role,{type:'career_start'});
    assert.equal(s.careers.residents[role].shift!.task!.event,id+'-recognition');
    s=finishDirect(s,role,0);
    const p=s.careers.residents[role].progress[id]!;
    assert.ok(p.workplace!.trust>=76);
    assert.equal(p.workplace!.improvements,2);
    assert.equal(p.seen[id+'-recognition'],s.careers.residents[role].shift!.day+1);
  }
});

test('New career outcomes survive reload, while older draft saves without metrics remain valid',()=>{
  let state=active('it','it-3');
  state=finishDirect(state,'vlad',0);
  const dir=mkdtempSync(join(tmpdir(),'sim-life-career-depth-'));
  try{
    const store=openServerFiles(dir);
    store.save(state);
    let restored=store.load();
    const p=restored.careers.residents.vlad.progress.it!;
    assert.ok(p.workplace && p.workplace.improvements>=0);
    assert.equal(p.workplace!.trust,state.careers.residents.vlad.progress.it!.workplace!.trust);
    delete p.workplace;
    store.save(restored);
    restored=store.load();
    assert.ok(validCareers(restored.careers));
    assert.equal(restored.careers.residents.vlad.progress.it!.workplace,undefined);
  }finally{rmSync(dir,{recursive:true,force:true})}
});

test('Specialist solution needs actual knowledge, never a forged client command',()=>{
  let state=active('it','it-3');
  const nonce=state.careers.residents.vlad.shift!.task!.nonce;
  assert.equal(WORK_EVENT_BY_ID.get('it-3')!.choices.length,3);
  assert.equal(applyCareer(state,'vlad',{type:'career_choose',nonce,choice:2},now(state)).ok,false);
  state.education.characters.vlad.xp.attention=levelXP(2);
  state=action(state,'vlad',{type:'career_choose',nonce,choice:2});
  assert.equal(state.careers.residents.vlad.shift!.task!.choice,2);
});
