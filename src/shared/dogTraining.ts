import type {PetState} from './pets';
export const DOG_COMMANDS=['sit','lie','paw','beg','bark','fetch','stay'] as const;
export type DogCommand=typeof DOG_COMMANDS[number];
export type DogTrainingAction=`train-${DogCommand}`;
export const DOG_COMMAND_NAMES:Record<DogCommand,string>={sit:'Сидеть',lie:'Лежать',paw:'Дай лапу',beg:'Зайка',bark:'Голос',fetch:'Апорт',stay:'Место'};
export interface CommandSkill {xp:number;attempts:number;successes:number}
export interface TrainingAttempt {command:DogCommand;success:boolean;role:'vlad'|'alina';yaw:number;practice:boolean}
export function isDogCommand(x:unknown):x is DogCommand{return DOG_COMMANDS.includes(x as DogCommand);}
export function trainingCommand(action:unknown):DogCommand|undefined {const c=typeof action==='string'&&action.startsWith('train-')?action.slice(6):undefined;return isDogCommand(c)?c:undefined;}
export const isTrainingAction=(action:unknown):action is DogTrainingAction=>!!trainingCommand(action);
export const commandSkill=(p:PetState,c:DogCommand):CommandSkill=>p.training?.[c]??{xp:0,attempts:0,successes:0};
export const trainingChance=(p:PetState,c:DogCommand)=>Math.min(.98,.30+.0063*commandSkill(p,c).xp+.0012*p.bond+.0007*p.happiness);
export const trainingLevel=(xp:number)=>xp>=100?'Освоена':xp>=70?'Уверенно':xp>=35?'Учится':'Новичок';
export function finishTraining(p:PetState,t:TrainingAttempt){
 const old=commandSkill(p,t.command),gain=t.success?10:5;
 (p.training??={})[t.command]={xp:Math.min(100,old.xp+gain),attempts:Math.min(1000000,old.attempts+1),successes:Math.min(1000000,old.successes+Number(t.success))};
 p.lastTraining={command:t.command,success:t.success};
 p.energy=Math.max(0,p.energy-4);
 p.happiness=Math.min(100,p.happiness+(t.success?7:1));
 p.bond=Math.min(100,p.bond+(t.success?3:1));
}
export function validTraining(p:PetState,id:string){
 if(id!=='verdell')return p.training===undefined&&p.lastTraining===undefined;
 const t=p.training;
 return (t===undefined||!!t&&typeof t==='object'&&!Array.isArray(t)&&Object.entries(t).every(([c,s])=>isDogCommand(c)&&!!s&&Number.isInteger(s.xp)&&s.xp>=0&&s.xp<=100&&Number.isSafeInteger(s.attempts)&&s.attempts>=0&&s.attempts<=1000000&&Number.isSafeInteger(s.successes)&&s.successes>=0&&s.successes<=s.attempts))&&
 (p.lastTraining===undefined||!!p.lastTraining&&isDogCommand(p.lastTraining.command)&&typeof p.lastTraining.success==='boolean');
}
export function validTrainingAttempt(t:unknown):t is TrainingAttempt{
 const a=t as TrainingAttempt;return !!a&&isDogCommand(a.command)&&typeof a.success==='boolean'&&['vlad','alina'].includes(a.role)&&Number.isFinite(a.yaw)&&Math.abs(a.yaw)<=Math.PI+.001&&typeof a.practice==='boolean';
}
