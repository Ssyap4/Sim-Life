import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openServerFiles} from '../storage';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {dailyRoutineChoices,companionChoices,dailyCompleted,recordDailyCompletion,validDailyHistory} from '../../src/shared/dailyRoutine';
import {planTask,evaluateTask} from '../tasks';
import {homeSeat} from '../../src/shared/home';
function seed(){const s=initialState();s.autonomy.vlad='full';s.autonomy.alina='full';for(const r of ['vlad','alina'] as const)Object.assign(s.characters[r],{hunger:80,energy:75,hygiene:80,bladder:80,pose:'idle'});return s;}
test('morning priorities use actual stocks and are not repeated',()=>{const s=seed();s.clock.minute=480;s.pantry.coffeeNescafeGold=1;const before=structuredClone(s);
 const choices=dailyRoutineChoices(s,'vlad',new Set());assert.equal(choices[0].key,'morningTeeth');assert.ok(choices.some(c=>c.key==='morningCoffee'));assert.deepEqual(s,before);
 const remaining=dailyRoutineChoices(s,'vlad',new Set(['morningTeeth','morningCoffee']));assert.equal(remaining.length,0);
 const coffee=choices.find(c=>c.key==='morningCoffee')!;const result=evaluateTask(s,'vlad',coffee.command);assert.ok(result.ok);assert.equal(result.state.pantry.coffeeNescafeGold,0);assert.equal(result.state.money,s.money);
});
test('routine only full, home, noncritical, actual bed and dishes',()=>{const s=seed();s.autonomy.alina='needs';assert.deepEqual(dailyRoutineChoices(s,'alina',new Set()),[]);s.autonomy.alina='full';s.characters.alina.bladder=50;assert.deepEqual(dailyRoutineChoices(s,'alina',new Set()),[]);s.characters.alina.bladder=80;s.furnishing.soldFixtures=['bed'];assert.ok(!dailyRoutineChoices(s,'alina',new Set()).some(c=>c.key==='makeBed'));s.clock.minute=780;assert.deepEqual(dailyRoutineChoices(s,'alina',new Set()),[]);s.dirtyDishes.table=1;assert.equal(dailyRoutineChoices(s,'alina',new Set())[0].key,'clearDishes');s.world.places.alina='park';assert.deepEqual(dailyRoutineChoices(s,'alina',new Set()),[]);});
test('evening is distinct and does not invent morning coffee',()=>{const s=seed();s.clock.minute=1260;assert.deepEqual(dailyRoutineChoices(s,'vlad',new Set()).map(c=>c.key),['eveningWash','eveningTeeth']);});
test('independent sofa companion uses a separate seat and does not reserve the TV',()=>{const s=seed();const partner={type:'console_play',game:'ufc6'} as const;const choices=companionChoices(s,'alina',partner);assert.ok(choices.length);for(const command of choices)assert.equal(planTask(command)?.resource,null);assert.notDeepEqual(homeSeat('sofa','vlad').position,homeSeat('sofa','alina').position);s.autonomy.alina='needs';assert.deepEqual(companionChoices(s,'alina',partner),[]);s.autonomy.alina='full';s.furnishing.soldFixtures=['sofa'];assert.deepEqual(companionChoices(s,'alina',partner),[]);});


test('completed morning steps survive a real save and reopen; next day resets only the checklist',()=>{
 const s=seed();s.clock.minute=480;const dir=mkdtempSync(join(tmpdir(),'simlife-routine053-'));
 try{
  const file=openServerFiles(dir);file.save(s);
  assert.equal(dailyCompleted(file.load(),'vlad').size,0);
  recordDailyCompletion(s,'vlad',{type:'act',actionId:'bathTeeth'});
  recordDailyCompletion(s,'vlad',{type:'act',actionId:'bathTeeth'});
  assert.equal(validDailyHistory(s.dailyHistory),true);
  file.save(s);const saved=openServerFiles(dir).load();
  assert.deepEqual([...dailyCompleted(saved,'vlad')],['morningTeeth']);
  assert.equal(dailyCompleted(saved,'alina').size,0);
  assert.ok(!dailyRoutineChoices(saved,'vlad',dailyCompleted(saved,'vlad')).some(c=>c.key==='morningTeeth'));
  saved.clock.day++;assert.equal(dailyCompleted(saved,'vlad').size,0);
  assert.ok(dailyRoutineChoices(saved,'vlad',dailyCompleted(saved,'vlad')).some(c=>c.key==='morningTeeth'));
  assert.equal(validDailyHistory({vlad:{day:1,keys:['bad']}}),false);
  assert.equal(validDailyHistory({vlad:{day:1,keys:['morningTeeth','morningTeeth']}}),false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('breakfast goes from real ingredients to cooking to eating; cooking alone never marks meal finished',()=>{
 const s=seed();s.clock.minute=480;s.characters.vlad.hunger=65;s.pantry.milk=1;s.pantry.eggs=2;
 const select=(state:typeof s)=>dailyRoutineChoices(state,'vlad',new Set(['morningTeeth','morningCoffee'])).find(c=>c.key==='breakfast');
 const cook=select(s);assert.deepEqual(cook?.command,{type:'cook',recipe:'omelette'});
 const cooked=evaluateTask(s,'vlad',cook!.command);assert.ok(cooked.ok);recordDailyCompletion(cooked.state,'vlad',cook!.command);
 assert.ok(!dailyCompleted(cooked.state,'vlad').has('breakfast'));
 const eat=select(cooked.state);assert.deepEqual(eat?.command,{type:'eat',recipe:'omelette'});
 const eaten=evaluateTask(cooked.state,'vlad',eat!.command);assert.ok(eaten.ok);
 recordDailyCompletion(eaten.state,'vlad',eat!.command);assert.ok(dailyCompleted(eaten.state,'vlad').has('breakfast'));
 assert.equal(eaten.state.money,s.money);assert.equal(eaten.state.pantry.eggs,0);assert.equal(eaten.state.meals.omelette,1);
});
test('kitchen and desktop company use independent resources and reject unavailable fixtures',()=>{
 const s=seed();
 const cook={type:'cook',recipe:'omelette'} as const;
 const desk={type:'act',actionId:'vladStudy'} as const;
 const kitchen=companionChoices(s,'alina',cook);assert.ok(kitchen.length);
 assert.ok(kitchen.every(c=>planTask(c)?.resource!==planTask(cook)?.resource));
 const office=companionChoices(s,'alina',desk);assert.ok(office.length);
 assert.ok(office.every(c=>planTask(c)?.resource!==planTask(desk)?.resource));
 s.furnishing.soldFixtures=['table','officeChair'];assert.deepEqual(companionChoices(s,'alina',cook),[]);assert.deepEqual(companionChoices(s,'alina',desk),[]);
 s.characters.vlad.pose='sleep';assert.ok(!dailyRoutineChoices(s,'alina',new Set()).some(c=>c.key==='makeBed'));
});
