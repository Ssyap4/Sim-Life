import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {initialState,type GameState,type CharacterId} from '../../src/shared/protocol';
import {gameMinutes,VITAL_NEEDS} from '../../src/shared/life';
import {autonomyCandidates} from '../../src/shared/autonomy';
import {budgetPeriod} from '../../src/shared/familyBudget';
import {LEDGER_LIMIT} from '../../src/shared/economy';
import {expireReadyFood} from '../../src/shared/readyFood';
import {advancePetHealth} from '../../src/shared/health';
import {advanceLife} from '../life';
import {advanceCareers} from '../careers';
import {beginShift,settleCompletedShifts,expireHomeQuests} from '../jobs';
import {settleFamilyServices,applyServiceCommand} from '../services';
import {checkout} from '../market';
import {evaluateTask} from '../tasks';
import {runPetRoutines,applyPetAction} from '../pets';
import {openServerFiles} from '../storage';

const roles=['vlad','alina'] as const;
const pets=['verdell','simba'] as const;
function simulate(days:number,working:boolean,onePlayer:boolean){
  const dir=mkdtempSync(join(tmpdir(),'simourhome-long-play-'));
  let state=initialState();
  state.autonomy={vlad:'full',alina:'needs'};
  const stats={days,working,onePlayer,income:0,expense:0,shifts:0,care:0,petCare:0,purchases:0,reloads:0,failedCare:0,lowestCash:state.money,checkpoints:[] as object[]};
  let seed=123456;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  // Every mutation uses the real server function; use the rolling ledger's
  // monotonic IDs to account for every transaction even after it trims to 40.
  function adopt(next:GameState){
    const previous=state.ledger.at(-1)?.id??0;
    const entries=next.ledger.filter(row=>row.id>previous);
    let delta=0;
    for(const row of entries){
      if(row.kind==='income'){stats.income+=row.amount;delta+=row.amount;}
      else {stats.expense+=row.amount;delta-=row.amount;}
    }
    assert.equal(next.money-state.money,delta,'cash delta must match real ledger transactions');
    assert.ok(next.revision>=state.revision);
    state=next;
    assert.ok(Number.isSafeInteger(state.money)&&state.money>=0);
    stats.lowestCash=Math.min(stats.lowestCash,state.money);
  }
  function checkpoint(){
    const files=openServerFiles(dir);
    files.save(state);
    const restored=files.load();
    assert.equal(restored.money,state.money);
    assert.deepEqual(restored.ledger,state.ledger);
    assert.deepEqual(restored.billing,state.billing);
    assert.deepEqual(restored.savings,state.savings);
    assert.deepEqual(restored.pantry,state.pantry);
    assert.deepEqual(restored.meals,state.meals);
    assert.deepEqual(restored.petFood,state.petFood);
    assert.deepEqual(restored.petBowls,state.petBowls);
    assert.deepEqual(restored.furnishing,state.furnishing);
    assert.deepEqual(restored.personalCollections,state.personalCollections);
    assert.deepEqual(restored.activeShifts,state.activeShifts);
    stats.reloads++;
    state=restored;
  }
  try{
    if(working){
      for(const service of ['netflix','youtube']){
        const result=applyServiceCommand(state,'vlad',{type:'service_connect',service});
        assert.ok(result.ok);adopt(result.state);
      }
    }
    const start=gameMinutes(state.clock);
    for(let elapsed=0;elapsed<days*1440;elapsed+=30){
      const online:readonly CharacterId[]=onePlayer&&state.clock.day%3===0?['vlad']:roles;
      const before=gameMinutes(state.clock);
      if(state.clock.minute===480){
        if(working&&state.clock.day%2===1){
          for(const role of online){
            const shift=beginShift(state,role,role==='vlad'?'taxi':'petsitter');
            if(shift.ok)adopt(shift.state);
          }
        }
        // Explicit player shopping, never an autonomous purchase.
        if(working&&state.money>2500&&state.pantry.eggs<=4&&state.pantry.milk<3){
          const bought=checkout(state,'vlad',[{id:'grocery:eggs',quantity:2},{id:'grocery:milk',quantity:2}]);
          if(bought.ok){adopt(bought.state);stats.purchases++;}
        }
        for(const pet of pets){
          if(working&&state.petFood[pet]<2){
            const bought=applyPetAction(state,'vlad',pet,'buyFood');
            if(bought.ok){adopt(bought.state);stats.purchases++;}
          }
        }
      }
      for(const role of online){
        if(state.activeShifts[role])continue;
        // An accelerated completion-level audit, not a real-time navigation
        // or animation test. At most one successful care action per half-hour.
        const choices=autonomyCandidates(state,role);
        for(const choice of choices){
          const result=evaluateTask(state,role,choice.command);
          if(!result.ok){stats.failedCare++;continue;}
          assert.equal(result.state.money,state.money,'autonomy must not spend cash');
          adopt(result.state);stats.care++;break;
        }
      }
      for(const pet of pets){
        if(state.petBowls[pet]===0&&state.petFood[pet]>0){
          const result=applyPetAction(state,'vlad',pet,'feed');
          if(result.ok){adopt(result.state);stats.petCare++;}
        }
      }
      const advanced=advanceLife(state,30,online);
      expireHomeQuests(advanced);
      const settled=settleCompletedShifts(advanced);
      stats.shifts+=settled.completed.length;
      const next=settled.state;
      advanceCareers(next,before,gameMinutes(next.clock),online);
      expireReadyFood(next);
      runPetRoutines(next,30,gameMinutes(next.clock),new Set(),random);
      advancePetHealth(next,30);
      settleFamilyServices(next,next.money>state.money);
      adopt(next);
      assert.equal(gameMinutes(state.clock),start+elapsed+30);
      assert.equal(state.savings.period,budgetPeriod(state.clock));
      assert.ok(state.ledger.length<=LEDGER_LIMIT);
      for(const role of roles)for(const need of VITAL_NEEDS){
        const n=state.characters[role][need];assert.ok(Number.isFinite(n)&&n>=0&&n<=100,role+':'+need);
      }
      for(const pet of pets){
        for(const n of [state.pets[pet].satiety,state.pets[pet].energy,state.pets[pet].bladder,state.pets[pet].happiness])assert.ok(Number.isFinite(n)&&n>=0&&n<=100);
        assert.ok(state.petFood[pet]>=0&&state.petBowls[pet]>=0);
      }
      if((elapsed+30)%(5*1440)===0||elapsed+30===days*1440){
        checkpoint();
        if((elapsed+30)%(30*1440)===0||elapsed+30===days*1440){
          stats.checkpoints.push({elapsedDays:(elapsed+30)/1440,cash:state.money,unpaid:state.billing.bills.filter(b=>b.paidAt===null).length,petSatiety:pets.map(p=>state.pets[p].satiety)});
        }
      }
    }
    assert.equal(state.money,10000+stats.income-stats.expense);
    assert.equal(new Set(state.billing.bills.map(b=>b.id)).size,state.billing.bills.length);
    assert.ok(stats.care>0);
    if(working){assert.ok(stats.shifts>0);assert.ok(stats.purchases>0);}
    else assert.ok(state.billing.bills.some(b=>b.paidAt===null),'no-income scenario must accrue actual debt');
    console.log('LONG_PLAY '+JSON.stringify(stats));
  }finally{rmSync(dir,{recursive:true,force:true});}
}

test('064 smoke: two days of real server transactions',()=>simulate(2,true,false));
test('064 30 days: no income, real debt and no autonomous spending',()=>simulate(30,false,false));
test('064 60 days: shared routine, shifts, food, pet supplies and reloads',()=>simulate(60,true,false));
test('064 100 days: mixed online presence, recurring bills, jobs and persistence',()=>simulate(100,true,true));
