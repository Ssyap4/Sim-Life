import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {gameDate,calendarSlot,GAME_DAYS_PER_MONTH,GAME_DAYS_PER_YEAR,GAME_MINUTES_PER_REAL_SECOND} from '../../src/shared/life';
import {occasionsAhead,creditCelebration,familyLife} from '../../src/shared/familyLife';
import {weatherAt} from '../../src/shared/weather';
import {recipeAvailability,holidayRecipeOpen} from '../../src/shared/recipeAvailability';
import {ingredientList,RECIPES} from '../../src/shared/food';
import {levelXP} from '../../src/shared/education';
import {applyFoodAction} from '../food';
test('every month has three days, and all four seasons have nine days per cycle',()=>{
 assert.equal(GAME_DAYS_PER_MONTH,3);assert.equal(GAME_DAYS_PER_YEAR,36);assert.equal(GAME_MINUTES_PER_REAL_SECOND,.5);
 for(let start=1;start<=73;start+=36){const seasons=new Map<string,number>(),months=new Map<number,number>();for(let d=start;d<start+36;d++){const x=gameDate(d);seasons.set(x.season,(seasons.get(x.season)??0)+1);months.set(x.month,(months.get(x.month)??0)+1);}
 assert.deepEqual([...seasons.values()],[9,9,9,9]);assert.equal(months.size,12);assert.ok([...months.values()].every(n=>n===3));}
 assert.deepEqual([1,4,10,11,14,20,21,25,31].map(calendarSlot),[1,1,1,2,2,2,3,3,3]);
 assert.equal(weatherAt({day:10,minute:0}).season,'summer');assert.equal(weatherAt({day:28,minute:0}).snow,1);
});
test('birthdays preserve real dates; Easter and Christmas recur once per short year',()=>{
 const s=initialState(),all=occasionsAhead(s);
 const event=(id:string)=>all.find(e=>e.id===id)!;
 assert.equal(event('vladBirthday').day,33);assert.equal(event('vladBirthday').date,25);
 assert.equal(event('alinaBirthday').day,34);assert.equal(event('alinaBirthday').date,4);
 assert.equal(event('christmas').day,31);assert.equal(event('christmas').date,7);
 assert.equal(event('newYear').day,30);assert.equal(event('easter').day,5);
 assert.equal(event('spring').day,1);assert.equal(event('valentines').day,35);
 s.familyLife={dates:{},celebrated:{},hobbies:{vlad:{},alina:{}}};assert.equal(familyLife(s).dates.vladBirthday?.day,25);
 s.clock.day=5;assert.deepEqual(creditCelebration(s,'eat'),['Пасха']);assert.deepEqual(creditCelebration(s,'eat'),[]);
 s.clock.day=41;assert.deepEqual(creditCelebration(s,'eat'),['Пасха']);
});
test('holiday dishes are server-gated, consume ingredients, and leftovers remain edible',()=>{
 for(const [id,day] of [['easterBerryPancakes',5],['easterHoneyPancakes',5],['christmasApples',31]] as const){
  const s=initialState();s.education.characters.vlad.xp.cooking=levelXP(3);
  for(const [ingredient,count] of ingredientList(id))s.pantry[ingredient]=count;
  assert.equal(holidayRecipeOpen(s,id),false);assert.equal(recipeAvailability(s,'vlad',id).available,false);
  assert.equal(applyFoodAction(s,'vlad',{type:'cook',recipe:id}).ok,false);
  s.clock={day,minute:1430};assert.equal(holidayRecipeOpen(s,id),true);
  const cooked=applyFoodAction(s,'vlad',{type:'cook',recipe:id},()=>.99);assert.ok(cooked.ok,cooked.ok?'':cooked.reason);
  assert.equal(cooked.state.meals[id],RECIPES[id].servings);
  for(const [ingredient] of ingredientList(id))assert.equal(cooked.state.pantry[ingredient],0);
  cooked.state.clock={day:day+1,minute:0};assert.equal(holidayRecipeOpen(cooked.state,id),false);
  assert.equal(applyFoodAction(cooked.state,'vlad',{type:'eat',recipe:id},()=>.99).ok,true);
 }
});