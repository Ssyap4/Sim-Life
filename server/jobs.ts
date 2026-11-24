import { electronicsModel } from '../src/shared/electronics';
import { computerDevice } from "../src/shared/computer";
import { serviceAvailable } from "../src/shared/services";
import { isHomeJob, HOME_JOBS } from "../src/shared/jobs";
import { protectNeeds } from '../src/shared/happiness';
import { awardHomeJobPractice } from './education';
import { homeJobSkillXP } from '../src/shared/homeJobSkills';
import { SKILLS } from '../src/shared/education';
import { randomInt, randomUUID } from 'node:crypto';
import { HOME_QUESTS, pendingHomeQuest, homeQuestContent, validQuestChoice, correctQuestChoice, type HomeQuestRun } from '../src/shared/homeJobQuests';
import { JOBS, isOfferedJob, totalGameMinutes, shiftFullPay, shiftWage, shiftWorkedMinutes,
  type JobId, type ShiftAssignment } from '../src/shared/jobs';
import { addLedger, formatRub } from '../src/shared/economy';
import { names, type CharacterId, type GameState } from '../src/shared/protocol';

export type JobResult = {ok:true;state:GameState;message:string}|{ok:false;reason:string};

/** Starts one persistent shift per paid game day. A whole-shift salary is rolled only once. */
export function beginShift(source:GameState,role:CharacterId,id:unknown,device?:unknown,travelMinutes=0):JobResult {
  const home=isHomeJob(id);
  if(!isHomeJob(id)&&!isOfferedJob(id))return {ok:false,reason:'Неизвестная подработка'};
  if(home && (!computerDevice(device)||HOME_JOBS[id as keyof typeof HOME_JOBS].owner!==role||(role==='vlad'&&device!=='desktop')))return {ok:false,reason:'Заказ недоступен этому персонажу или устройству'};
  if(home && Object.values(source.activeShifts).some(shift=>shift?.homeDevice===device))return {ok:false,reason:"Компьютер уже занят"};
  if(home && source.world.places[role]!=='home')return {ok:false,reason:'Заказ выполняется дома'};
  if(home && !serviceAvailable(source.billing,'internet',totalGameMinutes(source.clock)))return {ok:false,reason:'Для заказов нужен домашний интернет'};
  if(source.activeShifts[role]||source.careers.residents[role].shift)return {ok:false,reason:'Сначала закончи текущую смену'};
  if(!home&&source.shiftDays[role]===source.clock.day)return {ok:false,reason:'Смена на сегодня уже отработана'};
  const resident=source.characters[role];
  if(resident.energy<25)return {ok:false,reason:'Для длинной смены нужно хотя бы 25% энергии'};
  if(resident.hunger<20)return {ok:false,reason:'Перед сменой нужно поесть'};
  const spec=JOBS[id];
  const hours=randomInt(spec.hoursMin,spec.hoursMax+1);
  const targetPay=randomInt(spec.payMin,spec.payMax+1);
  const state=structuredClone(source);
  const startedAt=totalGameMinutes(state.clock)+(home?Math.max(0,Math.ceil(travelMinutes)):0);
  const homeSpeed=home&&computerDevice(device)?electronicsModel(source,role,device).speed:0;
  const duration=Math.round(hours*60*(100-homeSpeed)/100);
  state.activeShifts[role]={job:id,hours,startedAt,endsAt:startedAt+duration,targetPay,...(home&&computerDevice(device)?{homeDevice:device,homeSpeed}:{})};
  if(isHomeJob(id)){
    const pool=HOME_QUESTS[id], indices=pool.map((_,i)=>i);
    const segment=duration/hours;
    const quests:HomeQuestRun[]=[];
    // Include one genuine multiple-selection task and one alternate format in every order.
    const selected:number[]=[];
    const take=(choices:number[])=>{const index=choices[randomInt(choices.length)];selected.push(index);indices.splice(indices.indexOf(index),1);};
    take(indices.filter(i=>pool[i].kind==='multi'));
    take(indices.filter(i=>pool[i].kind==='binary'||pool[i].kind==='sequence'));
    take(indices.filter(i=>!pool[i].kind||pool[i].kind==='single'));
    while(selected.length<hours)take(indices);
    for(let j=selected.length-1;j>0;j--){const k=randomInt(j+1);[selected[j],selected[k]]=[selected[k],selected[j]];}
    for(let i=0;i<selected.length;i++){
      const index=selected[i];
      const at=startedAt+Math.floor(i*segment)+randomInt(7,Math.max(8,Math.floor(segment-34)));
      const order=pool[index].options.map((_,i)=>i);
      for(let j=order.length-1;j>0;j--){const k=randomInt(j+1);[order[j],order[k]]=[order[k],order[j]];}
      quests.push({nonce:randomUUID(),index,at,until:Math.min(at+32,startedAt+Math.floor((i+1)*segment)-3),order});
    }
    state.activeShifts[role]!.quests=quests;
  }
  state.revision++;
  return {ok:true,state,message:names[role]+(home?' принял(а) домашний заказ: ':' отправился(-ась) на подработку: ')+spec.name+' · '+((duration/60).toFixed(1).replace('.',','))+' ч. игрового времени'};
}

/** A quest is optional; its nonce and single answer are validated by the server. */
export function answerHomeQuest(source:GameState,role:CharacterId,nonce:unknown,choice:unknown):JobResult {
  const shift=source.activeShifts[role],now=totalGameMinutes(source.clock);
  const run=pendingHomeQuest(shift,now);
  if(!shift?.homeDevice||!run||run.nonce!==nonce)return {ok:false,reason:'Это задание уже недоступно'};
  const spec=homeQuestContent(shift,run);
  if(!spec)return {ok:false,reason:'Задание не найдено'};
  if(!validQuestChoice(spec,run,choice))return {ok:false,reason:'Выбери вариант ответа'};
  const state=structuredClone(source),next=state.activeShifts[role]!,q=next.quests!.find(item=>item.nonce===nonce)!;
  const correct=choice===correctQuestChoice(spec,run);
  q.result=choice===-1?'skipped':correct?'correct':'wrong';
  let bonus=0;
  if(correct){
    const base=shiftFullPay(next);
    bonus=Math.min(150,JOBS[next.job].payMax-base);
    next.targetPay=base+bonus;
    state.characters[role].mood=Math.min(100,state.characters[role].mood+2);
  }
  state.revision++;
  return {ok:true,state,message:choice===-1?'Задание пропущено. Работа продолжается.':(correct?'Отлично! '+(bonus?'К оплате +'+formatRub(bonus)+'. ':''):'Не совсем. ')+spec.explanation};
}
export function expireHomeQuests(state:GameState):void {
  const now=totalGameMinutes(state.clock);
  for(const shift of Object.values(state.activeShifts))for(const run of shift?.quests??[])if(!run.result&&now>=run.until){run.result='skipped';state.revision++;}
}

/** The same settlement path pays complete and partial shifts. Client never supplies money or duration. */
function payAndClose(source:GameState,role:CharacterId,shift:ShiftAssignment,early:boolean):{
  state:GameState; payment:number; message:string;
} {
  const state=structuredClone(source);
  const job=JOBS[shift.job];
  const worked=shiftWorkedMinutes(shift,state.clock);
  const duration=shift.endsAt-shift.startedAt;
  const fraction=duration>0 ? worked/duration : 0;
  const payment=early ? shiftWage(shift,state.clock) : shiftFullPay(shift);
  const actor=state.characters[role];
  state.money+=payment;
  actor.energy=Math.max(0,actor.energy-Math.round(job.energyCost*fraction));
  actor.hunger=Math.max(0,actor.hunger-Math.round(job.hungerCost*fraction));
  actor.hygiene=Math.max(0,actor.hygiene-Math.round(job.hygieneCost*fraction));
  actor.mood=Math.max(0,Math.min(100,actor.mood+Math.round(3*fraction)));
  if(shift.homeDevice)actor.pose="idle";
  else state.shiftDays[role]=state.clock.day;
  if(payment>0){
    const workedHours=(worked/60).toFixed(1).replace('.',',');
    addLedger(state,role,'income','work',payment,
      job.name+(early?' · досрочный уход':' · полная смена')+' · '+workedHours+' ч.');
  }
  const practice=homeJobSkillXP(state.education.characters[role],shift,fraction);
  const earned=practice?awardHomeJobPractice(state,role,practice.skill,practice.xp,"Работа из дома · "+job.name):0;
  delete state.activeShifts[role];
  state.revision++;
  const workedHours=(worked/60).toFixed(1).replace('.',',');
  const message=names[role]+(early?' завершил(а) смену досрочно':' закончил(а) смену')+
    ' «'+job.name+'» · '+workedHours+' из '+((duration/60).toFixed(1).replace('.',','))+' ч.: +'+formatRub(payment)+
    (practice&&earned?' · '+SKILLS[practice.skill][1]+' +'+earned+' XP':'');
  protectNeeds(state);
  return {state,payment,message};
}

/** Any time is allowed, even immediately (0 ₽). A partial shift uses up today's work slot. */
export function leaveShiftEarly(source:GameState,role:CharacterId):JobResult {
  const shift=source.activeShifts[role];
  if(!shift)return {ok:false,reason:'Активной смены нет'};
  return {ok:true,...payAndClose(source,role,shift,true)};
}

export interface ShiftCompletion {
  role:CharacterId;
  job:JobId;
  payment:number;
  message:string;
}
/** Called from the server's authoritative game clock; after logout/restart shifts remain valid. */
export function settleCompletedShifts(source:GameState):{state:GameState;completed:ShiftCompletion[]} {
  const now=totalGameMinutes(source.clock);
  if(!Object.values(source.activeShifts).some(shift=>shift && shift.endsAt<=now))
    return {state:source,completed:[]};
  let state=source;
  const completed:ShiftCompletion[]=[];
  for(const role of ['vlad','alina'] as const){
    const shift=state.activeShifts[role];
    if(!shift || shift.endsAt>now)continue;
    const payout=payAndClose(state,role,shift,false);
    state=payout.state;
    completed.push({role,job:shift.job,payment:payout.payment,message:payout.message});
  }
  return {state,completed};
}
