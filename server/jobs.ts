import { randomInt } from 'node:crypto';
import { JOBS, isJobId, totalGameMinutes, type JobId } from '../src/shared/jobs';
import { addLedger, formatRub } from '../src/shared/economy';
import { names, type CharacterId, type GameState } from '../src/shared/protocol';

export type JobResult = {ok:true;state:GameState;message:string}|{ok:false;reason:string};

/** Starts persistent work, not a fragile browser timeout. Finishes when the game clock reaches endsAt. */
export function beginShift(source:GameState,role:CharacterId,id:unknown):JobResult {
  if(!isJobId(id))return {ok:false,reason:'Неизвестная подработка'};
  if(source.activeShifts[role])return {ok:false,reason:'Сначала закончи текущую смену'};
  if(source.shiftDays[role]===source.clock.day)return {ok:false,reason:'Смена на сегодня уже отработана'};
  const resident=source.characters[role];
  if(resident.energy<25)return {ok:false,reason:'Для длинной смены нужно хотя бы 25% энергии'};
  if(resident.hunger<20)return {ok:false,reason:'Перед сменой нужно поесть'};
  const spec=JOBS[id];
  const hours=randomInt(spec.hoursMin,spec.hoursMax+1);
  const state=structuredClone(source);
  const startedAt=totalGameMinutes(state.clock);
  state.activeShifts[role]={job:id,hours,startedAt,endsAt:startedAt+hours*60};
  state.revision++;
  return {ok:true,state,message:names[role]+' отправился(-ась) на подработку: '+spec.name+' · '+hours+' ч. игрового времени'};
}
export function cancelShift(source:GameState,role:CharacterId):JobResult {
  if(!source.activeShifts[role])return {ok:false,reason:'Активной смены нет'};
  const state=structuredClone(source);
  delete state.activeShifts[role];
  state.revision++;
  return {ok:true,state,message:names[role]+': смена прервана, зарплата не начислена'};
}
export interface ShiftCompletion {
  role:CharacterId;
  job:JobId;
  payment:number;
  message:string;
}
/** Called after an authoritative clock tick. Emits one payout for each completed shift. */
export function settleCompletedShifts(source:GameState):{state:GameState;completed:ShiftCompletion[]} {
  const now=totalGameMinutes(source.clock);
  if(!Object.values(source.activeShifts).some(shift=>shift && shift.endsAt<=now))
    return {state:source,completed:[]};
  const state=structuredClone(source);
  const completed:ShiftCompletion[]=[];
  for(const role of ['vlad','alina'] as const) {
    const shift=state.activeShifts[role];
    if(!shift || shift.endsAt>now)continue;
    const job=JOBS[shift.job];
    const payment=randomInt(job.payMin,job.payMax+1);
    const actor=state.characters[role];
    state.money+=payment;
    actor.energy=Math.max(0,actor.energy-job.energyCost);
    actor.hunger=Math.max(0,actor.hunger-job.hungerCost);
    actor.hygiene=Math.max(0,actor.hygiene-job.hygieneCost);
    actor.mood=Math.max(0,Math.min(100,actor.mood+3));
    state.shiftDays[role]=state.clock.day; // cannot immediately work another shift on the payout day
    addLedger(state,role,'income','work',payment,job.name+' · '+shift.hours+' ч. смена');
    delete state.activeShifts[role];
    state.revision++;
    completed.push({role,job:shift.job,payment,
      message:names[role]+' закончил(а) смену «'+job.name+'»: +'+formatRub(payment)});
  }
  return {state,completed};
}
