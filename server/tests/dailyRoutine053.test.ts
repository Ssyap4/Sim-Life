import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {dailyRoutineChoices,companionChoices} from '../../src/shared/dailyRoutine';
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
