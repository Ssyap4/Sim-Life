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
import {completeTogether,pairScenes} from '../society';
import {applyWorld,venueTogetherTrip,spaTogetherTrip,localActivity} from '../locations';
import {applyFurnishing} from '../furnishing';
import {VENUE_GAMES} from '../../src/shared/venue';
import {SPA_PASSES} from '../../src/shared/spa';

const roles=['vlad','alina'] as const;
const pets=['verdell','simba'] as const;
function simulate(days:number,working:boolean,onePlayer:boolean,leisure=false,initialCash=10000){
  const dir=mkdtempSync(join(tmpdir(),'simourhome-long-play-'));
  let state=initialState();state.money=initialCash;
  state.autonomy={vlad:'full',alina:'needs'};
  const stats={days,working,onePlayer,leisure,income:0,workMinutes:0,venueVisits:0,spaVisits:0,furnitureOrders:0,takeoutOrders:0,expenseByCategory:{} as Record<string,number>,criticalNeedTicks:0,criticalByNeed:{} as Record<string,number>,criticalByContext:{} as Record<string,number>,expense:0,shifts:0,care:0,petCare:0,purchases:0,petPurchases:0,shared:0,mealsCooked:0,mealsEaten:0,reloads:0,failedCare:0,lowestCash:state.money,checkpoints:[] as object[]};
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
      else {stats.expense+=row.amount;delta-=row.amount;stats.expenseByCategory[row.category]=(stats.expenseByCategory[row.category]??0)+row.amount;}
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
    assert.deepEqual(restored.relationship,state.relationship);
    assert.deepEqual(restored.education,state.education);
    assert.deepEqual(restored.world.deliveries,state.world.deliveries);
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
            if(shift.ok){adopt(shift.state);const job=state.activeShifts[role]!;stats.workMinutes+=job.endsAt-job.startedAt;}
          }
        }
        // Explicit player shopping, never an autonomous purchase.
        if(working){
          // Replenish independently: an excess of eggs must not block milk.
          for(const [item,minimum,quantity] of [['eggs',4,1],['milk',3,4]] as const){
            if(state.pantry[item]<minimum){
              const bought=checkout(state,'vlad',[{id:'grocery:'+item,quantity}]);
              if(bought.ok){adopt(bought.state);stats.purchases++;}
            }
          }
          // The historical pet_action buyFood is deliberately retired.
          // Refill through the same market catalogue as the actual UI.
          for(const pet of pets){
            if(state.petFood[pet]<2){
              const bought=checkout(state,'vlad',[{id:'pet:'+pet,quantity:1}]);
              if(bought.ok){adopt(bought.state);stats.petPurchases++;}
            }
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
          adopt(result.state);stats.care++;
          if(choice.command.type==='cook')stats.mealsCooked++;
          if(choice.command.type==='eat'||choice.command.type==='eat_takeout')stats.mealsEaten++;
          break;
        }
      }
      for(const pet of pets){
        if(state.petBowls[pet]===0&&state.petFood[pet]>0){
          const result=applyPetAction(state,'vlad',pet,'feed');
          if(result.ok){adopt(result.state);stats.petCare++;}
        }
      }
      // Explicit simulated player choices, not new autonomous behavior.
      if(working&&state.clock.minute===1200&&!state.activeShifts.vlad){
        for(const action of ['kitchenDishes','kitchenTidy'] as const){
          const result=evaluateTask(state,'vlad',{type:'act',actionId:action});
          if(result.ok)adopt(result.state);
        }
        for(const pet of pets){
          const result=applyPetAction(state,'vlad',pet,'pet');
          if(result.ok){adopt(result.state);stats.petCare++;}
        }
        if(online.length===2&&!state.activeShifts.alina){
          const cmd={type:'together' as const,action:'softHug' as const};
          const scenes=pairScenes(state,'vlad',cmd);
          if(scenes){
            const result=completeTogether(state,'vlad',cmd,[...roles],0,scenes);
            if(result.ok){adopt(result.state);stats.shared++;}
          }
        }
      }
      // The spending policy is only a simulated player's choice, not a new
      // rule in the actual game. Keep 8k cash for essentials before luxuries.
      if(leisure&&!state.activeShifts.vlad&&state.world.places.vlad==='home'){
        const now=gameMinutes(state.clock);
        if(state.clock.minute===720&&state.clock.day%6===2&&state.money>=8000+1000){
          const order=checkout(state,'vlad',[{id:'takeout:pizzaCheese',quantity:1}]);
          if(order.ok){adopt(order.state);stats.takeoutOrders++;}
        }
        if(state.clock.minute===780&&state.clock.day%20===2&&state.money>=8000+2490){
          const bought=applyFurnishing(state,'vlad',{type:'furniture_order',sku:'stool-cube',finish:'sage',shipping:'regular',quantity:1},now);
          if(bought.ok){adopt(bought.state);stats.furnitureOrders++;}
        }
        for(const order of [...state.furnishing.orders])if(order.readyAt<=now){
          const result=applyFurnishing(state,'vlad',{type:'furniture_unbox',id:order.id},now);
          if(result.ok)adopt(result.state);
        }
        if(state.clock.minute===900&&online.length===2&&!state.activeShifts.alina&&
           state.clock.day%2===0&&state.world.places.alina==='home'&&!state.world.carDriver){
          const game={type:'together' as const,action:'venueBowling' as const};
          let place:'venue'|'spa'|undefined;
          if(state.clock.day%10===4&&state.money>=8000+VENUE_GAMES.venueBowling.price){
            const trip=venueTogetherTrip(state,'vlad');
            if(trip.ok){adopt(trip.state);place='venue';
              const scenes=pairScenes(state,'vlad',game);
              if(scenes){const result=completeTogether(state,'vlad',game,[...roles],0,scenes);
                if(result.ok){adopt(result.state);stats.venueVisits++;}}
            }
          }else if(state.clock.day%10===8&&state.money>=8000+SPA_PASSES.pair.price){
            const trip=spaTogetherTrip(state,'vlad','pair');
            if(trip.ok){adopt(trip.state);place='spa';stats.spaVisits++;
              for(const role of roles){
                // Pair pass does not include massage; use the free lounge instead.
                const lounge='spa-lounge-'+role[0];
                const approach=applyWorld(state,role,{type:'approach',place:'spa',station:lounge},true);
                if(approach.ok){adopt(approach.state);
                  const result=localActivity(state,role,'spaLounge',lounge);
                  if(result.ok)adopt(result.state);
                }
              }
            }
          }
          if(place)for(const role of roles){
            const exit=place+'-exit';
            const approach=applyWorld(state,role,{type:'approach',place,station:exit},true);
            assert.ok(approach.ok);adopt(approach.state);
            const back=applyWorld(state,role,{type:'travel',place:'district',via:exit},true);
            assert.ok(back.ok);adopt(back.state);
          }
          if(place){assert.deepEqual(state.world.places,{vlad:'home',alina:'home'});assert.equal(state.world.carDriver,undefined);}
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
        const n=state.characters[role][need];
        if(n<15&&online.includes(role)){
          stats.criticalNeedTicks++;
          stats.criticalByNeed[need]=(stats.criticalByNeed[need]??0)+1;
          const context=state.activeShifts[role]?'shift':state.world.places[role]!=='home'?'away':'home';
          const key=context+':'+need;
          stats.criticalByContext[key]=(stats.criticalByContext[key]??0)+1;
        }
        assert.ok(Number.isFinite(n)&&n>=0&&n<=100,role+':'+need);
      }
      for(const pet of pets){
        for(const n of [state.pets[pet].satiety,state.pets[pet].energy,state.pets[pet].bladder,state.pets[pet].happiness])assert.ok(Number.isFinite(n)&&n>=0&&n<=100);
        assert.ok(state.petFood[pet]>=0&&state.petBowls[pet]>=0);
      }
      if((elapsed+30)%(5*1440)===0||elapsed+30===days*1440){
        checkpoint();
        if((elapsed+30)%(30*1440)===0||elapsed+30===days*1440){
          stats.checkpoints.push({elapsedDays:(elapsed+30)/1440,cash:state.money,unpaid:state.billing.bills.filter(b=>b.paidAt===null).length,petSatiety:pets.map(p=>state.pets[p].satiety),petStock:pets.map(p=>state.petFood[p]),humanHunger:roles.map(r=>state.characters[r].hunger)});
        }
      }
    }
    assert.equal(state.money,initialCash+stats.income-stats.expense);
    assert.equal(new Set(state.billing.bills.map(b=>b.id)).size,state.billing.bills.length);
    assert.ok(stats.care>0);
    if(working){assert.ok(stats.shifts>0);assert.ok(stats.purchases>0);if(days>=30){assert.ok(stats.shifts>=days/3,'responsible scenario must actually sustain work');assert.ok(stats.petPurchases>0);assert.ok(stats.mealsEaten>0);assert.ok(stats.shared>0);}}
    else assert.ok(state.billing.bills.some(b=>b.paidAt===null),'no-income scenario must accrue actual debt');
    if(leisure&&days>=30){assert.ok(stats.venueVisits>0);assert.ok(stats.spaVisits>0);assert.ok(stats.furnitureOrders>0);assert.ok(stats.takeoutOrders>0);assert.equal(state.furnishing.orders.length,0); assert.ok(state.furnishing.stored.length>0);}
    assert.equal(Object.values(stats.criticalByNeed).reduce((a,b)=>a+b,0),stats.criticalNeedTicks);
    assert.equal(Object.values(stats.criticalByContext).reduce((a,b)=>a+b,0),stats.criticalNeedTicks);
    console.log('LONG_PLAY '+JSON.stringify(stats));
  }finally{rmSync(dir,{recursive:true,force:true});}
}

test('064 smoke: two days of real server transactions',()=>simulate(2,true,false));
test('064 30 days: no income, real debt and no autonomous spending',()=>simulate(30,false,false));
test('064 60 days: shared routine, shifts, food, pet supplies and reloads',()=>simulate(60,true,false));
test('064 100 days: mixed online presence, recurring bills, jobs and persistence',()=>simulate(100,true,true));

test('064 60 days: paid leisure, takeout, furniture and household economy',()=>simulate(60,true,false,true));
test('064 leisure smoke: short spending policy',()=>simulate(2,true,false,true));

test('071 60 days: clean 100000 RUB household, mixed presence, spending and reloads',()=>simulate(60,true,true,true,100000));
