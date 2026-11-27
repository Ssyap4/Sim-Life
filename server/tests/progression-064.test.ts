import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {initialState} from '../../src/shared/protocol';
import {SKILL_IDS,skillRank,levelXP,maximumXP,educationalXP} from '../../src/shared/education';
import {MATERIALS,MATERIAL_BY_ID} from '../../src/shared/educationCatalog';
import {gameMinutes} from '../../src/shared/life';
import {wishesFor} from '../../src/shared/wishes';
import {completeStudy,studyDenial,validEducation} from '../education';
import {wishAtStart,fulfillWish,rewardCommand} from '../happiness';
import {activeReward,REWARDS,validHappiness} from '../../src/shared/happiness';
import {advanceLife} from '../life';
import {openServerFiles} from '../storage';

test('064 all nine skills for both residents have a viable free route from level zero to twenty',()=>{
 const dir=mkdtempSync(join(tmpdir(),'progression-064-'));
 const files=openServerFiles(dir);
 let s=initialState();
 const report=[];
 try{
  for(const role of ['vlad','alina'] as const)for(const skill of SKILL_IDS){
   let sessions=0,minutes=0;
   const milestones=[];
   for(let tier=0;tier<5;tier++){
    const item=MATERIALS.find(m=>m.channel==='practice'&&m.skill===skill&&m.min===tier*4&&!m.price);
    assert.ok(item,skill+':'+tier);
    while(skillRank(s.education.characters[role].xp[skill]).level<item.max){
     assert.equal(studyDenial(s,role,item,gameMinutes(s.clock)),undefined);
     const before=s.education.characters[role].xp[skill];
     const other=role==='vlad'?'alina':'vlad';
     const otherXP=s.education.characters[other].xp[skill];
     assert.ok(educationalXP(item,role,s.education.characters[role])>0);
     completeStudy(s,role,item,gameMinutes(s.clock));
     assert.ok(s.education.characters[role].xp[skill]>before);
     assert.equal(s.education.characters[other].xp[skill],otherXP);
     sessions++;minutes+=item.minutes;
     assert.ok(sessions<10000,'free route stalled');
    }
    assert.ok(validEducation(s.education));
    files.save(s);const restored=files.load();assert.deepEqual(restored.education,s.education);s=restored;
    milestones.push({level:skillRank(s.education.characters[role].xp[skill]).level,sessions,minutes});
   }
   assert.equal(s.education.characters[role].xp[skill],maximumXP);
   report.push({role,skill,sessions,minutes,milestones});
  }
  assert.equal(s.money,10000);
  console.log('PROGRESSION_064 '+JSON.stringify(report));
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('064 a real study completion fulfills the existing level wish once, without affecting partner or cash',()=>{
 for(const [role,skill] of [['vlad','technology'],['alina','practical']] as const){
  const s=initialState();s.education.characters[role].xp[skill]=levelXP(1)-1;
  const item=MATERIAL_BY_ID.get('practice:'+skill+':0:project')!;
  const goal='goal-'+skill+'-1';
  assert.ok(wishesFor(s,role).some(w=>w.id===goal));
  const wish=wishAtStart(s,role,{type:'study',material:item.id});
  assert.equal(wish?.id,goal);
  const next=structuredClone(s);
  assert.equal(fulfillWish(next,role,wish,s),'','unfinished learning has no reward');
  completeStudy(next,role,item,gameMinutes(next.clock));
  assert.ok(fulfillWish(next,role,wish,s));
  assert.equal(next.happiness[role].points,75);
  assert.equal(fulfillWish(next,role,wish,s),'');
  assert.equal(next.happiness[role==='vlad'?'alina':'vlad'].points,0);
  assert.equal(next.money,s.money);
 }
});

test('064 ordinary learning wishes require actual XP and cannot reward exhausted study',()=>{
 for(const [role,skill,id] of [['vlad','technology','learn-dev'],['alina','practical','learn-hair']] as const){
  const s=initialState();
  const item=MATERIAL_BY_ID.get('tv:'+skill+':0')!;
  assert.ok(item);
  let wish;
  for(let minute=0;minute<1440;minute+=180){
   s.clock.minute=minute;
   const selected=wishAtStart(s,role,{type:'study',material:item.id});
   if(selected?.id===id){wish=selected;break;}
  }
  assert.ok(wish,id+' should be obtainable in the daily rotation');
  const next=structuredClone(s);
  completeStudy(next,role,item,gameMinutes(next.clock));
  assert.ok(fulfillWish(next,role,wish,s));
  assert.equal(next.happiness[role].points,15);
  for(let n=0;n<3;n++)completeStudy(next,role,item,gameMinutes(next.clock));
  next.clock.day+=1;
  const before=structuredClone(next);
  completeStudy(next,role,item,gameMinutes(next.clock));
  assert.equal(next.education.characters[role].xp[skill],before.education.characters[role].xp[skill]);
  assert.equal(fulfillWish(next,role,wish,before),'');
  assert.equal(next.happiness[role].points,15);
 }
});

test('064 earned points buy a personal reward with exact duration and no double activation',()=>{
 let s=initialState();
 const item=MATERIAL_BY_ID.get('practice:technology:0:project')!;
 // Earn each reward from a separate eligible daily learning wish.
 let count=0;
 for(let day=1;day<=100&&s.happiness.vlad.points<REWARDS.hygiene.price;day++){
  s.clock.day=day;
  const level=skillRank(s.education.characters.vlad.xp.technology).level;
  const material=MATERIALS.find(m=>m.channel==='practice'&&m.skill==='technology'&&m.min<=level&&m.max>level)??item;
  for(let minute=0;minute<1440;minute+=180){
   s.clock.minute=minute;
   const wish=wishAtStart(s,'vlad',{type:'study',material:material.id});
   if(!wish)continue;
   const before=structuredClone(s);
   completeStudy(s,'vlad',material,gameMinutes(s.clock));
   if(fulfillWish(s,'vlad',wish,before)){count++;break;}
  }
 }
 assert.ok(count>0);
 assert.ok(s.happiness.vlad.points>=REWARDS.hygiene.price,'reachable reward on a 100-day learning path');
 const points=s.happiness.vlad.points;
 const bought=rewardCommand(s,'vlad','happiness_buy','hygiene');assert.ok(bought.ok);s=bought.state;
 assert.equal(s.happiness.vlad.points,points-REWARDS.hygiene.price);
 assert.equal(rewardCommand(s,'alina','happiness_activate','hygiene').ok,false);
 const activated=rewardCommand(s,'vlad','happiness_activate','hygiene');assert.ok(activated.ok);s=activated.state;
 assert.equal(activeReward(s,'vlad','hygiene'),gameMinutes(s.clock)+1440);
 assert.equal(rewardCommand(s,'vlad','happiness_activate','hygiene').ok,false);
 s=advanceLife(s,1440,['vlad','alina']);
 assert.equal(activeReward(s,'vlad','hygiene'),0);
 assert.ok(validHappiness(s.happiness));assert.equal(s.money,10000);
 console.log('REWARD_064 '+JSON.stringify({day:s.clock.day,earned:points,count}));
});

test('064 learning wish uses the current free project, not the sold desktop or a mastered skill',()=>{
 for(const [role,skill] of [['vlad','technology'],['alina','practical']] as const){
  const s=initialState();
  s.furnishing.soldFixtures=['desk'];
  s.education.characters[role].xp[skill]=levelXP(5)-1;
  const goal='goal-'+skill+'-5';
  const wish=wishesFor(s,role).find(w=>w.id===goal);
  assert.deepEqual(wish?.command,{type:'study',material:'practice:'+skill+':1:project'});
  s.education.characters[role].xp[skill]=maximumXP;
  for(let minute=0;minute<1440;minute+=180){
   s.clock.minute=minute;
   assert.ok(wishesFor(s,role).every(w=>!w.id.startsWith('goal-')&&!w.id.startsWith('learn-')));
  }
 }
});
