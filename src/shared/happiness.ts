import type { CharacterId, GameState } from './protocol';
import { gameMinutes, type VitalNeed } from './life';

export const REWARDS = {
  hygiene: {icon:'🧼', title:'Безупречная чистота', price:600, description:'Гигиена не снижается 24 игровых часа.'},
  bladder: {icon:'🚽', title:'Железный пузырь', price:825, description:'Не нужно ходить в туалет 24 игровых часа.'},
  hunger: {icon:'🍔', title:'Запас сытости', price:1200, description:'Сытость не снижается 24 игровых часа.'},
  energy: {icon:'🌙', title:'Борьба со сном', price:2250, description:'Энергия не расходуется 24 игровых часа, даже на работе.'},
} as const;
export type RewardId = keyof typeof REWARDS;
export const REWARD_IDS = Object.keys(REWARDS) as RewardId[];
export type HappinessState = { points:number; stock:Partial<Record<RewardId,number>>; until:Partial<Record<RewardId,number>>; fulfilled:Record<string,number>; count:number };
export const initialHappiness = ():HappinessState=>({points:0,stock:{},until:{},fulfilled:{},count:0});
export function validHappiness(value:unknown):boolean {
  if(!value||typeof value!=='object')return false;
  const x=value as Record<CharacterId,HappinessState>;
  const nonnegative=(n:unknown)=>Number.isSafeInteger(n)&&Number(n)>=0;
  return (['vlad','alina'] as const).every(role=>{
    const p=x[role];return !!p&&nonnegative(p.points)&&nonnegative(p.count)&&
      !!p.stock&&!!p.until&&!!p.fulfilled&&
      Object.entries(p.stock).every(([k,v])=>Object.hasOwn(REWARDS,k)&&nonnegative(v)&&v<=99)&&
      Object.entries(p.until).every(([k,v])=>Object.hasOwn(REWARDS,k)&&nonnegative(v))&&
      Object.keys(p.fulfilled).length<=200&&Object.values(p.fulfilled).every(nonnegative);
  });
}
export function activeReward(state:GameState,role:CharacterId,need:VitalNeed):number {
  const until=state.happiness?.[role]?.until[need as RewardId]??0;
  return until>gameMinutes(state.clock)?until:0;
}
export function protectNeeds(state:GameState):void {
  for(const role of ['vlad','alina'] as const)for(const id of REWARD_IDS)
    if(activeReward(state,role,id))state.characters[role][id]=100;
}
export function wishAvailable(state:GameState,role:CharacterId,id:string):boolean {
  const last=state.happiness?.[role]?.fulfilled[id];
  return last===undefined||gameMinutes(state.clock)-last>=1440;
}
export function gameReward(id:string):{points:number;mood:number} {
  if(id.startsWith('need-'))return {points:5,mood:2};
  if(id.startsWith('companion-'))return {points:20,mood:6};
  if(id==='favorite-meal')return {points:15,mood:3};
  if(id.startsWith('cook-'))return {points:25,mood:8};
  if(id.startsWith('goal-'))return {points:75,mood:15};
  if(id==='dog-walk')return {points:30,mood:8};
  if(id==='together-time')return {points:35,mood:10};
  if(id.startsWith('learn-'))return {points:15,mood:5};
  return {points:15,mood:5};
}
export function rewardTime(minutes:number):string {
  return Math.floor(minutes/60)+' ч '+Math.floor(minutes%60)+' мин';
}
