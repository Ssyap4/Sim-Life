import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {initialElectronics} from '../../src/shared/electronics';
import {COFFEE_DRINKS,sharedCoffeeOptions,coffeeCupsToday} from '../../src/shared/coffee';
import {familyAutonomyReady,familyAutoTopics,familyAutoLeisure} from '../../src/shared/familyAutonomy';
import {pairScenes,completeTogether,cooperationDenial} from '../society';
import {recordCompletedActivity,recordEmotion,activeEmotions} from '../../src/shared/emotions';
import {gameMinutes} from '../../src/shared/life';
import {wishesFor} from '../../src/shared/wishes';

test('coffee on veranda uses real seats, two portions, each personal limit and machine bonus',()=>{
 for(const id of ['coffeeBasic','coffeeCapsule','coffeePremium'] as const){
  const s=initialState();s.world.electronics={...initialElectronics(),coffee:id};s.pantry.beansJardin=2;
  for(const r of ['vlad','alina'] as const)s.characters[r].energy=35;
  const item='beansJardin:'+COFFEE_DRINKS[0],command={type:'together' as const,action:'yardCoffee',item};
  const opt=sharedCoffeeOptions(s,'vlad').find(o=>o.id===item)!;assert.ok(opt);
  const homes=pairScenes(s,'vlad',command);assert.ok(homes);
  assert.equal(homes.vlad.pair?.seat,'yardTable');assert.equal(homes.alina.pair?.seat,'yardTable');
  assert.notDeepEqual(homes.vlad.route.path.at(-1),homes.alina.route.path.at(-1));
  const result=completeTogether(s,'vlad',command,['vlad','alina'],0,homes);assert.ok(result.ok);
  assert.equal(result.state.pantry.beansJardin,0);assert.equal(s.pantry.beansJardin,2);assert.equal(result.state.money,s.money);
  for(const r of ['vlad','alina'] as const){
   assert.equal(result.state.characters[r].energy,35+opt.energy);assert.equal(coffeeCupsToday(result.state,r),1);assert.equal(result.state.characters[r].pose,'sit');
   recordCompletedActivity(result.state,r,command);assert.equal(activeEmotions(result.state,r)[0]?.kind,'familyCoffee');
  }
  assert.ok(cooperationDenial(result.state,'vlad',command));
  s.coffeeDaily.alina={day:s.clock.day,cups:3};assert.equal(sharedCoffeeOptions(s,'vlad').length,0);
  assert.equal(completeTogether(s,'vlad',command,['vlad','alina'],0,homes).ok,false);
  assert.equal(s.pantry.beansJardin,2);
 }
});
test('instant coffee remains possible without machine and invalid bean or forged selections fail',()=>{
 const s=initialState();s.pantry.coffeeEgoiste=2;s.pantry.beansJardin=2;
 assert.ok(sharedCoffeeOptions(s,'vlad').some(o=>o.id==='coffeeEgoiste'));
 assert.ok(!sharedCoffeeOptions(s,'vlad').some(o=>o.blend==='beansJardin'));
 assert.ok(cooperationDenial(s,'vlad',{type:'together',action:'yardCoffee',item:'beansJardin:fake'}));
});
test('family autonomy requires both full modes, same home, high essential needs and cooldown',()=>{
 const s=initialState();s.autonomy={vlad:'full',alina:'full'};
 for(const r of ['vlad','alina'] as const)Object.assign(s.characters[r],{hunger:80,energy:80,bladder:80,hygiene:80,pose:'idle'});
 assert.ok(familyAutonomyReady(s));assert.ok(familyAutoTopics(s,'vlad').length);assert.ok(familyAutoLeisure(s,'vlad').length);
 assert.ok(familyAutoLeisure(s,'vlad').every(id=>['yardRest','musicTogether','sofaTalk'].includes(id)));
 s.autonomy.alina='needs';assert.equal(familyAutoTopics(s,'vlad').length,0);s.autonomy.alina='full';
 s.characters.alina.hunger=50;assert.equal(familyAutoLeisure(s,'vlad').length,0);s.characters.alina.hunger=80;
 s.world.places.alina='park';assert.ok(!familyAutonomyReady(s));s.world.places.alina='home';
 s.relationship.recent=[{action:'nearTalk:day',at:gameMinutes(s.clock)}];assert.ok(!familyAutonomyReady(s));
 s.relationship.recent=[];recordEmotion(s,'alina','mealBad');s.characters.alina.mood=40;
 assert.ok(['nearTalk:listen','nearTalk:compliment','nearTalk:day'].includes(familyAutoTopics(s,'vlad')[0]));
 assert.ok(wishesFor(s,'vlad').length<=3);
});