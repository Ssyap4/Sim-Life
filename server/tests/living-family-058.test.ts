import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,type TimedCommand} from '../../src/shared/protocol';
import {fullLeisureCandidates,autonomyCandidates} from '../../src/shared/autonomy';
import {autoPetAvailable,activityIdentity,rememberFull,rankFull,fullIdleChoices,type FullHistory} from '../../src/shared/fullAutonomy';
import {choosePetIdle} from '../../src/game/PetIdle';
test('recent activity history is bounded and prioritizes variety over repeating one device',()=>{
 const s=initialState();s.autonomy.vlad='full';s.clock.minute=780;
 let history:FullHistory=[];const kinds=new Set<string>();
 for(let i=0;i<24;i++){const c=rankFull(s,'vlad',fullLeisureCandidates(s,'vlad',i),history)[0];assert.ok(c);const id=activityIdentity(c);kinds.add(id.group);if(history.length)assert.notEqual(id.key,history.at(-1)?.key);history=rememberFull(history,id);}
 assert.ok(kinds.size>=5);assert.equal(history.length,6);
});
test('full leisure respects pet feeding, sleeping and toileting, while manual choices stay available',()=>{
 const s=initialState();s.autonomy.vlad='full';
 for(const kind of ['eat','sleep','toilet','bath','bedTogether','perch','toy'] as const){
  s.pets.simba.routine={kind,target:0,startedAt:0,until:20,route:{from:s.pets.simba.position,path:[]}};
  assert.equal(autoPetAvailable(s,'simba'),false);
  assert.ok(!rankFull(s,'vlad',fullLeisureCandidates(s,'vlad',0),[]).some(c=>c.type==='pet_action'&&c.pet==='simba'));
  assert.ok(!fullIdleChoices(s,'vlad',0,[]).includes('simba'));
 }
 delete s.pets.simba.routine;assert.ok(autoPetAvailable(s,'simba'));
 s.autonomy.vlad='needs';s.characters.vlad.bladder=45;assert.equal(autonomyCandidates(s,'vlad')[0].need,'bladder');assert.deepEqual(fullLeisureCandidates(s,'vlad',0),[]);
});
test('nighttime favors existing quiet activities and excludes outdoor idle strolls',()=>{
 const s=initialState();s.clock.minute=1380;s.autonomy.vlad='full';
 const options:TimedCommand[]=[{type:'act',actionId:'deskGames'},{type:'act',actionId:'sofaRest'}];
 assert.equal(rankFull(s,'vlad',options,[])[0],options[1]);assert.ok(!fullIdleChoices(s,'vlad',0,[]).includes('stroll'));
 assert.ok(fullIdleChoices(s,'vlad',0,['computer','computer','computer'])[0]!=='computer');
});
test('tired pets never perform energetic cosmetic gestures',()=>{
 for(const id of ['verdell','simba'] as const)for(let i=0;i<32;i++)assert.ok(['stretch','observe','slowBlink','yawn','downRest'].includes(choosePetIdle(id,{energy:18,satiety:80,bond:90,happiness:90,bowl:1,personNearby:true},i)));
});

import {urgentPhysicalNeed,foodSupplyProblem} from '../../src/shared/autonomy';
import {rankCareChoices} from '../../src/shared/fullAutonomy';
import {evaluateTask,planTask} from '../tasks';
import {ingredientList} from '../../src/shared/food';
import {addReadyFood} from '../../src/shared/readyFood';

test('Emergency care prioritizes the toilet and physical needs over leisure and sleep',()=>{
 const s=initialState();s.autonomy.vlad='full';
 Object.assign(s.characters.vlad,{bladder:15,energy:10,hunger:12,hygiene:9,fun:0,social:1,comfort:2});
 assert.equal(urgentPhysicalNeed(s,'vlad'),'bladder');
 assert.equal(autonomyCandidates(s,'vlad')[0].need,'bladder');
 s.characters.vlad.bladder=80;assert.equal(urgentPhysicalNeed(s,'vlad'),'hygiene');
 assert.equal(autonomyCandidates(s,'vlad')[0].need,'hygiene');
});
test('Full care remembers leisure choices but cannot move leisure ahead of ready food',()=>{
 const s=initialState();s.autonomy.vlad='full';s.clock.minute=780;
 Object.assign(s.characters.vlad,{hunger:10,fun:30,energy:90,hygiene:90,bladder:90,comfort:90,social:90});
 s.meals.omelette=1;addReadyFood(s,'meal','omelette',1,'table');
 const choices=autonomyCandidates(s,'vlad');
 const history=choices.filter(c=>c.need==='fun').slice(0,1).map(c=>activityIdentity(c.command));
 const ranked=rankCareChoices(s,'vlad',choices,history);
 assert.equal(ranked[0].command.type,'eat');
 assert.notEqual(activityIdentity(ranked.find(c=>c.need==='fun')!.command).key,history[0].key);
});
test('Need-driven music, reading, table rest and wash alternatives actually restore the requested need',()=>{
 const s=initialState();s.autonomy.vlad='needs';
 Object.assign(s.characters.vlad,{fun:30,comfort:30,hygiene:30,energy:90,hunger:90,bladder:90,social:90});
 const choices=autonomyCandidates(s,'vlad');
 for(const c of choices.filter(c=>['fun','comfort','hygiene'].includes(c.need))){
  const p=planTask(c.command);assert.ok(p);
  const result=evaluateTask(s,'vlad',p.command);
  if(result.ok)assert.ok(result.state.characters.vlad[c.need]>s.characters.vlad[c.need],JSON.stringify(c));
 }
 assert.ok(choices.some(c=>c.need==='comfort'&&c.command.type==='act'&&c.command.actionId==='tableRest'));
 assert.ok(choices.some(c=>c.need==='hygiene'&&c.command.type==='act'&&c.command.actionId==='bathWash'));
});
test('Having ingredients for a locked recipe does not falsely count as food supply',()=>{
 const s=initialState();s.autonomy.vlad='needs';s.characters.vlad.hunger=45;
 for(const id of Object.keys(s.pantry) as (keyof typeof s.pantry)[])s.pantry[id]=0;
 for(const [id,n] of ingredientList('beefWellington'))s.pantry[id]=n;
 assert.equal(foodSupplyProblem(s,'vlad'),true);
 s.meals.omelette=1;addReadyFood(s,'meal','omelette',1,'fridge');
 assert.equal(foodSupplyProblem(s,'vlad'),false);
});