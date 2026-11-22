import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../../src/shared/protocol';
import { thoughtFor } from '../../src/shared/autonomy';
import { THOUGHT_VARIANTS, CALM_VARIANTS } from '../../src/shared/thoughtNarrative';
import { thoughtLessons, thoughtStateLabel } from '../../src/shared/thoughtHelp';
import { appendThought, parseThoughtHistory, validThoughtPreferences } from '../../src/thoughtUI';

test('Both characters have a broad, human-authored thought bank without character crossover',()=>{
  const count=Object.values(THOUGHT_VARIANTS).flatMap(group=>
    Object.values(group).flat()).length+
    CALM_VARIANTS.vlad.length+CALM_VARIANTS.alina.length;
  assert.ok(count>=190,'At least 190 new contextual variations');
  for(const group of Object.values(THOUGHT_VARIANTS)){
    assert.ok(group.vlad.length>=10);
    assert.ok(group.alina.length>=10);
  }
  const state=initialState();
  state.characters.vlad.hunger=17;
  state.characters.alina.fun=16;
  for(let i=0;i<8;i++){
    state.clock.minute=480+i*75;
    assert.equal(thoughtFor(state,'vlad').need,'hunger');
    assert.equal(thoughtFor(state,'alina').need,'fun');
    assert.notEqual(thoughtFor(state,'vlad').text,thoughtFor(state,'alina').text);
  }
});

test('Micro-tutorials describe real household supplies and player control',()=>{
  const state=initialState();
  state.characters.vlad.hunger=15;
  let lessons=thoughtLessons(state,'vlad');
  assert.equal(lessons[0].id,'hunger');
  assert.match(lessons[1].body,/0\.16/);
  assert.ok(lessons.some(t=>t.id==='priority'));
  assert.ok(lessons.every(t=>t.body.length>30&&t.body.length<300));
  for(const ingredient of Object.keys(state.pantry) as (keyof typeof state.pantry)[]){
    state.pantry[ingredient]=0;
  }
  lessons=thoughtLessons(state,'vlad');
  assert.match(lessons[0].body,/не хватает продуктов/i);
  state.autonomy.vlad='full';
  assert.match(thoughtLessons(state,'vlad')[1].body,/не покупают/);
  assert.match(thoughtStateLabel(state,'vlad'),/15%/);
});

test('Thought history is bounded, consecutive repeats collapse, and corrupt local data is discarded',()=>{
  assert.equal(validThoughtPreferences({show:true,hints:false,pin:true}),true);
  assert.equal(validThoughtPreferences({show:'yes',hints:true,pin:false}),false);
  const entry=(n:number)=>({time:'1 марта · 08:'+String(n).padStart(2,'0'),
    emoji:'💭',text:'Мысль '+n});
  let history=Array.from({length:7},(_,i)=>entry(i));
  assert.deepEqual(parseThoughtHistory(history).map(item=>item.text),
    ['Мысль 2','Мысль 3','Мысль 4','Мысль 5','Мысль 6']);
  history=appendThought(parseThoughtHistory(history),entry(7));
  assert.equal(history.length,5);
  assert.equal(history.at(-1)?.text,'Мысль 7');
  assert.equal(appendThought(history,entry(7)).length,5);
  assert.deepEqual(parseThoughtHistory([{time:11,text:'wrong',emoji:'x'},null,[]]),[]);
  assert.deepEqual(parseThoughtHistory({vlad:'not an array'}),[]);
});
