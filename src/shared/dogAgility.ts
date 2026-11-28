import {commandSkill,finishTraining,type DogCommand} from './dogTraining';
import type {PetState} from './pets';
import type {CharacterId} from './protocol';
import type {FloorPoint} from '../game/navigation';

export const DOG_AGILITY={
 dogHurdle:{name:'Низкий барьер',cue:'Вперёд!',skill:'fetch',x:2.65,z:4.15,threshold:48},
 dogTunnel:{name:'Тоннель',cue:'Апорт!',skill:'fetch',x:4.15,z:4.15,threshold:54},
 dogSlalom:{name:'Змейка',cue:'За мной!',skill:'stay',x:5.65,z:4.15,threshold:57},
 dogBalance:{name:'Балансир',cue:'Место!',skill:'stay',x:7.15,z:4.15,threshold:63},
} as const satisfies Record<string,{name:string;cue:string;skill:DogCommand;x:number;z:number;threshold:number}>;
export type DogAgilityAction=keyof typeof DOG_AGILITY;
export const AGILITY_ACTIONS=Object.keys(DOG_AGILITY) as DogAgilityAction[];
export const isDogAgility=(v:unknown):v is DogAgilityAction=>typeof v==='string'&&Object.hasOwn(DOG_AGILITY,v);
export type AgilitySupport={cue?:number;helper?:CharacterId};
export const agilityCueQuality=(fraction:number)=>Math.max(0,Math.round(10*(1-Math.abs(fraction-.38)/.32)));
export type AgilityVisit={attempts:number;independent:number;last?:{action:DogAgilityAction;owner:CharacterId;independent:boolean;helper?:CharacterId;cue?:number}};
export function validAgilityVisit(v:unknown):v is AgilityVisit{
 const a=v as AgilityVisit;return !!a&&Number.isSafeInteger(a.attempts)&&a.attempts>=0&&a.attempts<=1000000&&Number.isSafeInteger(a.independent)&&a.independent>=0&&a.independent<=a.attempts&&(a.last===undefined||!!a.last&&isDogAgility(a.last.action)&&['vlad','alina'].includes(a.last.owner)&&typeof a.last.independent==='boolean'&&(a.last.helper===undefined||['vlad','alina'].includes(a.last.helper)&&a.last.helper!==a.last.owner)&&(a.last.cue===undefined||Number.isInteger(a.last.cue)&&a.last.cue>=0&&a.last.cue<=10));
}
export function agilityConfidence(p:PetState,a:DogAgilityAction){return Math.min(100,Math.round(commandSkill(p,DOG_AGILITY[a].skill).xp*.65+p.bond*.16+p.happiness*.12+p.energy*.10));}
export const agilityReady=(p:PetState)=>p.satiety>=45&&p.energy>=40&&p.bladder>=40;
export function finishAgility(p:PetState,visit:AgilityVisit,role:CharacterId,action:DogAgilityAction,support:AgilitySupport={}){
 const spec=DOG_AGILITY[action],independent=agilityConfidence(p,action)+(support.cue??0)>=spec.threshold;
 finishTraining(p,{command:spec.skill,role,success:independent,yaw:0,practice:true});
 // Both assisted and independent passages are positive practice, never punish refusal.
 p.happiness=Math.min(100,p.happiness+3);p.bond=Math.min(100,p.bond+1);
 visit.attempts=Math.min(1000000,visit.attempts+1);visit.independent=Math.min(visit.attempts,visit.independent+Number(independent));visit.last={action,owner:role,independent,...support};if(support.helper){p.happiness=Math.min(100,p.happiness+2);p.bond=Math.min(100,p.bond+1);}
 return independent;
}
export function agilityObstacles(except?:DogAgilityAction){return AGILITY_ACTIONS.filter(a=>a!==except).map(a=>{const {x,z}=DOG_AGILITY[a],w=a==='dogHurdle'?.72:a==='dogTunnel'?.63:.54,d=a==='dogHurdle'?.40:a==='dogTunnel'?.83:1.04;return {minX:x-w,maxX:x+w,minZ:z-d,maxZ:z+d};});}
export function agilityPath(action:DogAgilityAction):FloorPoint[]{
 const {x,z}=DOG_AGILITY[action];
 if(action==='dogSlalom')return [{x,z:z-1.10},{x:x-.32,z:z-.70},{x:x+.32,z:z-.23},{x:x-.32,z:z+.23},{x:x+.32,z:z+.70},{x,z:z+1.10}];
 return [{x,z:z-1.10},{x,z:z-.72},{x,z},{x,z:z+.72},{x,z:z+1.10}];
}
/** Vertical motion in world meters, only on the active equipment. */
export function agilityHeight(action:DogAgilityAction,p:FloorPoint){
 const {x,z}=DOG_AGILITY[action],dz=Math.abs(p.z-z);if(Math.abs(p.x-x)>.24)return 0;
 if(action==='dogHurdle')return dz<.58?.36*Math.cos(dz/.58*Math.PI/2)**2:0;
 if(action==='dogBalance')return dz<1.0?.19*Math.min(1,(1-dz)/.52):0;
 return 0;
}
