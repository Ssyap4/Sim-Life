import type {CharacterId,GameState,TimedCommand} from './protocol';
import {gameMinutes} from './life';
export const FITNESS_PASSES={
  single:{name:'Разовое посещение',price:800,days:1},
  ten:{name:'Абонемент на 10 дней',price:4900,days:10},
  month:{name:'Абонемент на 30 дней',price:11900,days:30},
  family:{name:'Семейный на 30 дней',price:19900,days:30},
} as const;
export type FitnessPass=keyof typeof FITNESS_PASSES;
export type FitnessProfile={until:number;booking?:number;ticket?:boolean;visit?:boolean;fatigue:number;saunaDay:number;stats?:FitnessStats;lastTrainingDay?:number;trainingDay?:number;dailyGain?:number;workouts?:number;history?:{day:number;facility:string}[]};
export type FitnessState=Record<CharacterId,FitnessProfile>;
export type FitnessCommand={type:'fitness_pass';pass:FitnessPass}|{type:'fitness_book';at:number}|{type:'fitness_cancel'}|{type:'fitness_program';program:FitnessProgramId};
export const initialFitness=():FitnessState=>({vlad:{until:0,fatigue:0,saunaDay:0},alina:{until:0,fatigue:0,saunaDay:0}});
export function fitnessProfile(s:GameState,r:CharacterId){return s.world.fitness?.[r]??initialFitness()[r]}
export const fitnessAccess=(s:GameState,r:CharacterId)=>fitnessProfile(s,r).until>gameMinutes(s.clock)||!!fitnessProfile(s,r).visit&&s.world.places[r]==='fitness';
export const SAUNA_PRICE=500;
export function validFitness(v:unknown):v is FitnessState{
  if(!v||typeof v!=='object')return false;
  const state=v as FitnessState;
  const integer=(n:unknown)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
  return (['vlad','alina'] as const).every(r=>{const p=state[r];return !!p&&integer(p.until)&&integer(p.saunaDay)&&(p.ticket===undefined||typeof p.ticket==='boolean')&&(p.visit===undefined||typeof p.visit==='boolean')&&typeof p.fatigue==='number'&&Number.isFinite(p.fatigue)&&p.fatigue>=0&&p.fatigue<=100&&(p.booking===undefined||integer(p.booking))&&(p.lastTrainingDay===undefined||integer(p.lastTrainingDay))&&(p.trainingDay===undefined||integer(p.trainingDay))&&(p.dailyGain===undefined||Number.isFinite(p.dailyGain)&&p.dailyGain>=0&&p.dailyGain<=8)&&(p.workouts===undefined||integer(p.workouts))&&(p.history===undefined||Array.isArray(p.history)&&p.history.length<=8&&p.history.every(h=>h&&integer(h.day)&&!!fitnessExercise(h.facility)))&&(p.stats===undefined||(['strength','endurance','flexibility','recovery'] as const).every(k=>Number.isFinite(p.stats![k])&&p.stats![k]>=0&&p.stats![k]<=100))});
}
export function fitnessBookingSlots(now:number){
  const start=Math.floor(now/60)*60+60;
  return Array.from({length:48},(_,i)=>start+i*60).filter(t=>t%1440>=7*60&&t%1440<=21*60);
}

export type FitnessAxis='strength'|'endurance'|'flexibility'|'recovery';
export type FitnessStats=Record<FitnessAxis,number>;
export const emptyFitnessStats=():FitnessStats=>({strength:0,endurance:0,flexibility:0,recovery:0});
export function fitnessStats(s:GameState,r:CharacterId):FitnessStats{return fitnessProfile(s,r).stats??emptyFitnessStats()}
export const fitnessForm=(s:GameState,r:CharacterId)=>Object.values(fitnessStats(s,r)).reduce((a,b)=>a+b,0)/4;
export type FitnessMotion='gymRun'|'gymCycle'|'gymRow'|'gymPress'|'gymPull'|'gymSquat'|'gymCurl'|'gymStretch'|'gymStep'|'gymLeg';
type Exercise={name:string;minutes:number;axis:FitnessAxis;motion:FitnessMotion;fatigue:number;minLevel:number};
export const FITNESS_EXERCISES:Record<string,Exercise>={
 treadmill:{name:'Бег на дорожке',minutes:15,axis:'endurance',motion:'gymRun',fatigue:14,minLevel:0},
 bike:{name:'Велотренировка',minutes:12,axis:'endurance',motion:'gymCycle',fatigue:11,minLevel:0},
 elliptical:{name:'Эллиптическая тренировка',minutes:12,axis:'endurance',motion:'gymStep',fatigue:12,minLevel:0},
 stepper:{name:'Степпер',minutes:10,axis:'endurance',motion:'gymStep',fatigue:11,minLevel:0},
 rower:{name:'Гребля',minutes:12,axis:'endurance',motion:'gymRow',fatigue:13,minLevel:0},
 legpress:{name:'Жим ногами',minutes:12,axis:'strength',motion:'gymLeg',fatigue:15,minLevel:0},
 latpull:{name:'Вертикальная тяга',minutes:10,axis:'strength',motion:'gymPull',fatigue:12,minLevel:0},
 seatedrow:{name:'Горизонтальная тяга',minutes:10,axis:'strength',motion:'gymRow',fatigue:12,minLevel:0},
 chestpress:{name:'Жим от груди',minutes:10,axis:'strength',motion:'gymPress',fatigue:13,minLevel:0},
 legextension:{name:'Разгибание ног',minutes:8,axis:'strength',motion:'gymLeg',fatigue:10,minLevel:0},
 legcurl:{name:'Сгибание ног',minutes:8,axis:'strength',motion:'gymLeg',fatigue:10,minLevel:0},
 crossover:{name:'Тяга в кроссовере',minutes:12,axis:'strength',motion:'gymPull',fatigue:15,minLevel:2},
 rack:{name:'Приседания со штангой',minutes:12,axis:'strength',motion:'gymSquat',fatigue:16,minLevel:2},
 bench:{name:'Жим штанги',minutes:12,axis:'strength',motion:'gymPress',fatigue:15,minLevel:2},
 dumbbells:{name:'Упражнения с гантелями',minutes:10,axis:'strength',motion:'gymCurl',fatigue:11,minLevel:0},
 mat:{name:'Йога и растяжка',minutes:15,axis:'flexibility',motion:'gymStretch',fatigue:3,minLevel:0},
};
export function fitnessExercise(facility:unknown):Exercise|undefined{return typeof facility==='string'&&Object.hasOwn(FITNESS_EXERCISES,facility)?FITNESS_EXERCISES[facility]:undefined}
export function fitnessBonuses(s:GameState,r:CharacterId){
 const a=fitnessStats(s,r);
 return {energyDrain:1-.25*a.endurance/100,comfortDrain:1-.25*a.flexibility/100,moodDrain:1-.20*fitnessForm(s,r)/100,sleepGain:1+.30*a.recovery/100,physicalSpeed:1+.20*a.strength/100};
}
export function fitnessTaskSpeed(s:GameState,r:CharacterId,c:TimedCommand){
 return c.type==='clean_room'||c.type==='act'&&['bedMake','kitchenTidy','kitchenDishes','kitchenWash'].includes(c.actionId)||c.type==='furniture_use'&&['bedMake','kitchenTidy','kitchenDishes','kitchenWash','tidy'].includes(c.action)?fitnessBonuses(s,r).physicalSpeed:1;
}
export function advanceFitness(s:GameState,role:CharacterId,minutes:number,oldDay:number){
 const p=s.world.fitness?.[role];if(!p)return;
 p.fatigue=Math.max(0,Math.round((p.fatigue-minutes/60*2)*100)/100);
 if(p.stats&&p.lastTrainingDay!==undefined){
  const days=Math.max(0,s.clock.day-Math.max(oldDay,p.lastTrainingDay+5));
  if(days)for(const axis of Object.keys(p.stats) as FitnessAxis[])p.stats[axis]=Math.max(0,p.stats[axis]-days);
 }
}

export const FITNESS_PROGRAMS={
 cardio:{name:'Лёгкое кардио',stations:['fitness-treadmill-a','fitness-bike','fitness-elliptical']},
 full:{name:'Всё тело',stations:['fitness-treadmill-a','fitness-legpress','fitness-chestpress']},
 legs:{name:'Ноги и ягодицы',stations:['fitness-bike','fitness-legpress','fitness-legcurl']},
 back:{name:'Спина и плечи',stations:['fitness-latpull','fitness-seatedrow','fitness-dumbbells']},
 arms:{name:'Грудь и руки',stations:['fitness-chestpress','fitness-dumbbells','fitness-mat-a']},
 stretch:{name:'Йога и растяжка',stations:['fitness-mat-a','fitness-mat-b']},
 intensive:{name:'Интенсивное кардио',stations:['fitness-treadmill-b','fitness-rower','fitness-stepper']},
} as const;
export type FitnessProgramId=keyof typeof FITNESS_PROGRAMS;
export function fitnessProgram(id:unknown){return typeof id==='string'&&Object.hasOwn(FITNESS_PROGRAMS,id)?FITNESS_PROGRAMS[id as FitnessProgramId]:undefined}
