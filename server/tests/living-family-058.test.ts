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
 for(const id of ['verdell','simba'] as const)for(let i=0;i<32;i++)assert.ok(['stretch','observe','slowBlink'].includes(choosePetIdle(id,{energy:18,satiety:80,bond:90,happiness:90,bowl:1,personNearby:true},i)));
});
