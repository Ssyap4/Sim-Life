import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {initialState,type CharacterId,type GameState} from '../../src/shared/protocol';
import {applyWeekend,creditWeekendTogether,creditWeekendSpa,validWeekendState,weekendEstimate} from '../../src/shared/weekends';
import {openServerFiles} from '../storage';
function apply(s:GameState,r:CharacterId,type:string,extra:Record<string,unknown>={}){
 const x=applyWeekend(s,r,{type,version:s.weekends?.version??0,...extra});assert.ok(x.ok,x.ok?'':x.reason);return x.state;
}
function proposal(s=initialState()){return apply(s,'vlad','weekend_propose',{preset:'custom',items:['ufc','hookah','spa','breakfast','dog']});}
test('real shared consent, stale and malformed packets rejected without money or rewards',()=>{
 const old=initialState(),s=proposal(old);
 assert.equal(old.weekends?.version,0);assert.equal(s.money,old.money);
 assert.equal(applyWeekend(s,'vlad',{type:'weekend_accept',version:1}).ok,false);
 assert.equal(applyWeekend(s,'alina',{type:'weekend_accept',version:0}).ok,false);
 assert.equal(applyWeekend(s,'alina',{type:'weekend_propose',version:1,preset:'custom',items:['ufc','ufc']}).ok,false);
 assert.equal(applyWeekend(s,'alina',{type:'weekend_propose',version:1,preset:'custom',items:['__proto__']}).ok,false);
 assert.equal(applyWeekend(s,'alina',{type:'weekend_finish',version:1}).ok,false);
 creditWeekendTogether(s,'consoleTogether','ufc6');assert.deepEqual(s.weekends?.plan?.done,[]);
 const accepted=apply(s,'alina','weekend_accept');assert.ok(validWeekendState(accepted.weekends));
 creditWeekendTogether(accepted,'consoleTogether','gta6');creditWeekendTogether(accepted,'eat','borscht');
 assert.deepEqual(accepted.weekends?.plan?.done,[]);
 creditWeekendTogether(accepted,'consoleTogether','ufc6');creditWeekendTogether(accepted,'consoleTogether','ufc6');
 assert.deepEqual(accepted.weekends?.plan?.done,['ufc']);
 assert.equal(accepted.money,old.money);assert.deepEqual(accepted.characters,old.characters);
});
test('editing retains real included activities, resets consent, cancellation is free',()=>{
 let s=apply(proposal(),'alina','weekend_accept');creditWeekendTogether(s,'yardHookah');
 s=apply(s,'alina','weekend_propose',{preset:'home',items:['hookah','pool']});
 assert.deepEqual(s.weekends?.plan?.done,['hookah']);assert.deepEqual(s.weekends?.plan?.approved,['alina']);
 assert.equal(applyWeekend(s,'vlad',{type:'weekend_accept',version:1}).ok,false);
 s=apply(s,'vlad','weekend_accept');s=apply(s,'vlad','weekend_cancel');
 assert.equal(s.weekends?.plan,undefined);assert.equal(s.money,10000);assert.equal(s.relationship.memories.length,0);
});
test('partial day closes only after two finish votes and memory contains only real completed steps',()=>{
 let s=apply(proposal(),'alina','weekend_accept');creditWeekendTogether(s,'yardHookah');
 s=apply(s,'vlad','weekend_finish');assert.equal(s.relationship.memories.length,0);
 s=apply(s,'alina','weekend_finish');assert.equal(s.weekends?.plan,undefined);
 assert.equal(s.relationship.memories.length,1);assert.equal(s.relationship.memories[0].action,'familyWeekend:custom');
 assert.match(s.relationship.memories[0].description,/кальяном/);assert.doesNotMatch(s.relationship.memories[0].description,/UFC/);
 assert.equal(s.money,10000);assert.equal(applyWeekend(s,'alina',{type:'weekend_finish',version:1}).ok,false);
});
test('park walk needs real dog and both present; SPA needs actual procedures for both',()=>{
 const s=apply(proposal(),'alina','weekend_accept');
 creditWeekendTogether(s,'walk');assert.deepEqual(s.weekends?.plan?.done,[]);
 s.world.places={vlad:'park',alina:'park'};s.world.dogWalker='vlad';creditWeekendTogether(s,'walk');assert.deepEqual(s.weekends?.plan?.done,['dog']);
 s.world.places={vlad:'spa',alina:'spa'};s.world.spa={vlad:{pass:'pair',used:['spaPool']},alina:{pass:'pair',used:[]}};
 creditWeekendSpa(s);assert.deepEqual(s.weekends?.plan?.done,['dog']);
 s.world.spa.alina!.used.push('spaLounge');creditWeekendSpa(s);assert.deepEqual(s.weekends?.plan?.done,['dog','spa']);
});
test('planner persisted on reconnect, older saves migrate, prices match real activities',()=>{
 const dir=mkdtempSync(join(tmpdir(),'weekends-051-'));
 try{const files=openServerFiles(dir),old=initialState();delete old.weekends;files.save(old);
 assert.deepEqual(files.load().weekends,{version:0});
 const s=apply(proposal(),'alina','weekend_accept');creditWeekendTogether(s,'yardHookah');files.save(s);assert.deepEqual(files.load().weekends,s.weekends);
 assert.deepEqual(weekendEstimate(['bowling','billiards','hockey']),{min:2700,max:2700});
 assert.equal(validWeekendState({version:1,plan:{...s.weekends!.plan,done:['pool']}}),false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('062 legacy plan activities cannot be credited when the participants are at different places',()=>{
 const s=apply(proposal(),'alina','weekend_accept');
 s.world.places.alina='park';creditWeekendTogether(s,'yardHookah');creditWeekendTogether(s,'consoleTogether','ufc6');
 assert.deepEqual(s.weekends?.plan?.done,[]);
 s.world.places.alina='home';creditWeekendTogether(s,'yardHookah');assert.deepEqual(s.weekends?.plan?.done,['hookah']);
});
