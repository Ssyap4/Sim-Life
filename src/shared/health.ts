import type {CharacterId,GameState} from './protocol';
import type {PetId} from './pets';
import type {FoodQuality} from './foodQuality';
import {weatherAt} from './weather';

// Simulation tuning only: these are fictional game conditions, not medical advice.
export const CONDITIONS = {
 cold:{name:'Простуда',minutes:2880,energy:1.0,hunger:0,comfort:0.4,mood:0.6},
 flu:{name:'Грипп',minutes:4320,energy:1.5,hunger:0,comfort:0.7,mood:1.0},
 poisoning:{name:'Отравление',minutes:1440,energy:0.5,hunger:1.6,comfort:1.3,mood:0.7},
 gastritis:{name:'Гастрит',minutes:2880,energy:0,hunger:1.2,comfort:0.6,mood:0.4},
 insomnia:{name:'Бессонница',minutes:2880,energy:0.6,hunger:0,comfort:0.3,mood:0.5},
 exhaustion:{name:'Переутомление',minutes:1440,energy:1.2,hunger:0,comfort:0.5,mood:0.6},
} as const;
export type ConditionId=keyof typeof CONDITIONS;
export type HumanRisk='cold'|'hunger'|'sleep'|'work';
type Illness<K extends string>={id:K;remaining:number;diagnosed:boolean;tested?:boolean;treated?:boolean;medicine?:boolean;medicated?:boolean;followup?:boolean};
type HumanHealth={risk:Record<HumanRisk,number>;illness?:Illness<ConditionId>;cooldown:number;booking?:number};
export const PET_CONDITIONS={
 digestive:{name:'Расстройство пищеварения',minutes:2880},
 stress:{name:'Сильный стресс',minutes:2880}
} as const;
export type PetConditionId=keyof typeof PET_CONDITIONS;
type PetHealth={hunger:number;attention:number;illness?:Illness<PetConditionId>;cooldown:number};
export type HealthState={people:Record<CharacterId,HumanHealth>;pets:Record<PetId,PetHealth>};
const newHuman=():HumanHealth=>({risk:{cold:0,hunger:0,sleep:0,work:0},cooldown:0});
const newPet=():PetHealth=>({hunger:0,attention:0,cooldown:0});
export const initialHealth=():HealthState=>({people:{vlad:newHuman(),alina:newHuman()},pets:{verdell:newPet(),simba:newPet()}});
export const humanHealth=(s:GameState,r:CharacterId)=>s.health?.people[r]??newHuman();
export const petHealth=(s:GameState,p:PetId)=>s.health?.pets[p]??newPet();
const mutable=(s:GameState)=>s.health??=initialHealth();
const limit=(n:number)=>Math.max(0,Math.min(100,Math.round(n*100)/100));
const exposure=(old:number,active:boolean,minutes:number,threshold:number)=>active?Math.min(threshold,old+minutes):Math.max(0,old-minutes*2);
const startHuman=(h:HumanHealth,id:ConditionId)=>{if(!h.illness&&!h.cooldown){h.illness={id,remaining:CONDITIONS[id].minutes,diagnosed:false};h.risk=newHuman().risk;return true;}return false;};
export function validHealth(value:unknown):value is HealthState {
 if(!value||typeof value!=='object')return false;
 const s=value as HealthState;
 const num=(n:unknown,max=10080)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0&&n<=max;
 const illness=(v:unknown,ids:object)=>{if(v===undefined)return true;if(!v||typeof v!=='object')return false;const x=v as Illness<string>;return typeof x.id==='string'&&Object.hasOwn(ids,x.id)&&num(x.remaining)&&x.remaining>0&&typeof x.diagnosed==='boolean'&&(['tested','treated','medicine','medicated','followup'] as const).every(k=>x[k]===undefined||typeof x[k]==='boolean');};
 return !!s.people&&!!s.pets&&(['vlad','alina'] as const).every(r=>{const h=s.people[r];return !!h&&!!h.risk&&(['cold','hunger','sleep','work'] as const).every(k=>num(h.risk[k]))&&num(h.cooldown)&&(h.booking===undefined||num(h.booking,Number.MAX_SAFE_INTEGER))&&illness(h.illness,CONDITIONS);})&&
 (['verdell','simba'] as const).every(p=>{const h=s.pets[p];return !!h&&num(h.hunger)&&num(h.attention)&&num(h.cooldown)&&illness(h.illness,PET_CONDITIONS);});
}
/** Mutates only the new clock state, never the source or offline residents. */
export function advanceHumanHealth(s:GameState,before:GameState,r:CharacterId,minutes:number){
 const h=mutable(s).people[r],c=s.characters[r],old=before.characters[r];
 if(h.illness){
  const d=CONDITIONS[h.illness.id],elapsed=Math.min(minutes,h.illness.remaining),hours=elapsed/60;
  for(const key of ['energy','hunger','comfort','mood'] as const)c[key]=limit(c[key]-d[key]*hours);
  h.illness.remaining-=elapsed;
  if(!h.illness.remaining){delete h.illness;h.cooldown=1440;}
  return;
 }
 if(h.cooldown){h.cooldown=Math.max(0,h.cooldown-minutes);return;}
 const outdoors=before.world.places[r]==='park'||before.world.places[r]==='district';
 const w=outdoors?weatherAt(before.clock):undefined;
 h.risk.cold=exposure(h.risk.cold,!!w&&(w.temp<=0||w.kind==='rain'&&w.temp<=8)&&old.comfort<35,minutes,180);
 h.risk.hunger=exposure(h.risk.hunger,old.hunger<12,minutes,720);
 h.risk.sleep=exposure(h.risk.sleep,old.energy<12&&old.pose!=='sleep',minutes,1080);
 h.risk.work=exposure(h.risk.work,old.energy<20&&!!(before.activeShifts[r]||before.careers.residents[r].shift),minutes,360);
 if(h.risk.cold>=180)startHuman(h,'cold');
 else if(h.risk.hunger>=720)startHuman(h,'gastritis');
 else if(h.risk.work>=360)startHuman(h,'exhaustion');
 else if(h.risk.sleep>=1080)startHuman(h,'insomnia');
}
export function foodIllness(s:GameState,r:CharacterId,quality:FoodQuality|undefined,random:()=>number=Math.random){
 const chance=quality==='bad'?.08:quality==='average'?.02:0;
 if(chance&&random()<chance)return startHuman(mutable(s).people[r],'poisoning');
 return false;
}
/** A single missed meal or play session never causes a pet illness. */
export function advancePetHealth(s:GameState,minutes:number){
 for(const p of ['verdell','simba'] as const){
  const h=mutable(s).pets[p],pet=s.pets[p];
  if(h.illness){
   const elapsed=Math.min(minutes,h.illness.remaining);
   if(h.illness.id==='digestive')pet.satiety=limit(pet.satiety-elapsed/60*.65);
   else pet.happiness=limit(pet.happiness-elapsed/60*.6);
   h.illness.remaining-=elapsed;
   if(!h.illness.remaining){delete h.illness;h.cooldown=1440;}
   continue;
  }
  if(h.cooldown){h.cooldown=Math.max(0,h.cooldown-minutes);continue;}
  h.hunger=exposure(h.hunger,pet.satiety<15,minutes,1440);
  h.attention=exposure(h.attention,pet.happiness<15&&pet.bond<25,minutes,2880);
  const id=h.hunger>=1440?'digestive':h.attention>=2880?'stress':undefined;
  if(id){h.illness={id,remaining:PET_CONDITIONS[id].minutes,diagnosed:false};h.hunger=0;h.attention=0;}
 }
}

export const CLINIC_SERVICES={
 clinicExam:{name:'Приём терапевта',price:1500,station:'clinic-doctor',seconds:24},
 clinicDiagnosis:{name:'Диагностика',price:2500,station:'clinic-diagnostics',seconds:28},
 clinicProcedure:{name:'Расширенное обследование и помощь',price:4500,station:'clinic-procedure',seconds:35},
 clinicFollowup:{name:'Повторный приём',price:800,station:'clinic-doctor',seconds:18},
 clinicMedicine:{name:'Купить назначенное лекарство',price:0,station:'clinic-pharmacy',seconds:8},
} as const;
export type ClinicAction=keyof typeof CLINIC_SERVICES;
export type HealthCommand={type:'health_book';at:number}|{type:'health_cancel'}|{type:'health_medicine'};
export const isClinicAction=(a:unknown):a is ClinicAction=>typeof a==='string'&&Object.hasOwn(CLINIC_SERVICES,a);
export const healthBookingSlots=(now:number)=>Array.from({length:48},(_,i)=>Math.floor(now/60)*60+60+i*60).filter(t=>t%1440>=8*60&&t%1440<=20*60);
export const MEDICINE_PRICE:Record<ConditionId,number>={cold:450,flu:1800,poisoning:650,gastritis:950,insomnia:750,exhaustion:250};
export function healthStatus(s:GameState,r:CharacterId){
 const x=humanHealth(s,r).illness;
 return x?(x.diagnosed?CONDITIONS[x.id].name:'Недомогание · требуется осмотр'):'Здоров';
}
export function medicinePrice(s:GameState,r:CharacterId){const x=humanHealth(s,r).illness;return x?MEDICINE_PRICE[x.id]:0;}
export function clinicAvailable(s:GameState,r:CharacterId,a:ClinicAction):boolean{
 const x=humanHealth(s,r).illness;if(!x)return false;
 return a==='clinicExam'?!x.diagnosed:a==='clinicDiagnosis'?x.diagnosed&&!x.tested:a==='clinicProcedure'?x.diagnosed&&!x.treated:a==='clinicFollowup'?x.diagnosed&&(!!x.medicated||!!x.treated)&&!x.followup:x.diagnosed&&!x.medicine&&!x.medicated;
}
export function completeClinicService(s:GameState,r:CharacterId,a:ClinicAction){
 const h=mutable(s).people[r],x=h.illness!;
 if(a==='clinicExam'){x.diagnosed=true;delete h.booking;}
 else if(a==='clinicDiagnosis'){x.tested=true;x.remaining=Math.max(60,x.remaining-180);}
 else if(a==='clinicProcedure'){x.treated=true;x.remaining=Math.max(60,Math.ceil(x.remaining*.65));}
 else if(a==='clinicFollowup'){x.followup=true;x.remaining=Math.max(60,x.remaining-120);}
 else x.medicine=true;
}
export function takeGameMedicine(s:GameState,r:CharacterId){
 const x=mutable(s).people[r].illness;
 if(!x?.medicine||x.medicated)return false;
 x.medicine=false;x.medicated=true;x.remaining=Math.max(60,Math.ceil(x.remaining*.5));return true;
}
export function setHealthBooking(s:GameState,r:CharacterId,at?:number){const h=mutable(s).people[r];if(at===undefined)delete h.booking;else h.booking=at;}