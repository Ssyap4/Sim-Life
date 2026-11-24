import type {CharacterId,GameState} from './protocol';
import {gameMinutes} from './life';
export const FITNESS_PASSES={
  single:{name:'Разовое посещение',price:800,days:1},
  ten:{name:'Абонемент на 10 дней',price:4900,days:10},
  month:{name:'Абонемент на 30 дней',price:11900,days:30},
  family:{name:'Семейный на 30 дней',price:19900,days:30},
} as const;
export type FitnessPass=keyof typeof FITNESS_PASSES;
export type FitnessProfile={until:number;booking?:number;ticket?:boolean;visit?:boolean;fatigue:number;saunaDay:number};
export type FitnessState=Record<CharacterId,FitnessProfile>;
export type FitnessCommand={type:'fitness_pass';pass:FitnessPass}|{type:'fitness_book';at:number}|{type:'fitness_cancel'};
export const initialFitness=():FitnessState=>({vlad:{until:0,fatigue:0,saunaDay:0},alina:{until:0,fatigue:0,saunaDay:0}});
export function fitnessProfile(s:GameState,r:CharacterId){return s.world.fitness?.[r]??initialFitness()[r]}
export const fitnessAccess=(s:GameState,r:CharacterId)=>fitnessProfile(s,r).until>gameMinutes(s.clock)||!!fitnessProfile(s,r).visit&&s.world.places[r]==='fitness';
export const SAUNA_PRICE=500;
export function validFitness(v:unknown):v is FitnessState{
  if(!v||typeof v!=='object')return false;
  const state=v as FitnessState;
  const integer=(n:unknown)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
  return (['vlad','alina'] as const).every(r=>{const p=state[r];return !!p&&integer(p.until)&&integer(p.saunaDay)&&(p.ticket===undefined||typeof p.ticket==='boolean')&&(p.visit===undefined||typeof p.visit==='boolean')&&typeof p.fatigue==='number'&&Number.isFinite(p.fatigue)&&p.fatigue>=0&&p.fatigue<=100&&(p.booking===undefined||integer(p.booking))});
}
export function fitnessBookingSlots(now:number){
  const start=Math.floor(now/60)*60+60;
  return Array.from({length:48},(_,i)=>start+i*60).filter(t=>t%1440>=7*60&&t%1440<=21*60);
}
