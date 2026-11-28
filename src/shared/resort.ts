import type {CharacterId,GameState} from './protocol';
import {gameMinutes} from './life';
export const RESORT_PASSES={night:{name:'Сутки',price:18900,minutes:1440},weekend:{name:'Двое суток',price:34900,minutes:2880}} as const;
export type ResortPass=keyof typeof RESORT_PASSES;
export const isResortPass=(p:unknown):p is ResortPass=>typeof p==='string'&&Object.hasOwn(RESORT_PASSES,p);
export const RESORT_MEALS={breakfast:{name:'Завтрак · омлет, круассаны и кофе',start:480,end:660},lunch:{name:'Обед · суп, салат и горячее',start:780,end:960},dinner:{name:'Ужин · стейк, овощи и десерт',start:1140,end:1320}} as const;
export type ResortMeal=keyof typeof RESORT_MEALS;
export type ResortVisit={pass:ResortPass;from:number;until:number;guests:CharacterId[];eaten:Partial<Record<CharacterId,string[]>>};
export const RESORT_FLOOR={minX:-20,maxX:20,minZ:-17,maxZ:17};
export const RESORT_ACTIONS={
 resortBreakfast:{name:'Позавтракать на веранде',facility:'terrace',seconds:40,meal:'breakfast'},
 resortLunch:{name:'Пообедать на веранде',facility:'terrace',seconds:45,meal:'lunch'},
 resortDinner:{name:'Поужинать на веранде',facility:'terrace',seconds:50,meal:'dinner'},
 resortPool:{name:'Поплавать в бассейне',facility:'pool',seconds:60},
 resortJacuzzi:{name:'Отдохнуть в джакузи',facility:'jacuzzi',seconds:60},
 resortLake:{name:'Поплавать в лазурном озере',facility:'lake',seconds:60},
 resortRest:{name:'Отдохнуть на веранде',facility:'terrace',seconds:45},
 resortSleep:{name:'Поспать в коттедже',facility:'bed',seconds:120},
 resortWash:{name:'Вымыть руки',facility:'bath',seconds:6},
} as const;
export type ResortAction=keyof typeof RESORT_ACTIONS;
export type ResortFacility=typeof RESORT_ACTIONS[ResortAction]['facility']|'reception'|'bar'|'grill'|'media'|'kitchen';
export const isResortAction=(x:unknown):x is ResortAction=>typeof x==='string'&&Object.hasOwn(RESORT_ACTIONS,x);
export function validResort(v:unknown):v is ResortVisit{
 const r=v as ResortVisit;if(!r||!isResortPass(r.pass)||!Number.isSafeInteger(r.from)||r.from<0||r.until!==r.from+RESORT_PASSES[r.pass].minutes||!Array.isArray(r.guests)||r.guests.length<1||r.guests.length>2||new Set(r.guests).size!==r.guests.length||!r.guests.every(x=>x==='vlad'||x==='alina')||!r.eaten||typeof r.eaten!=='object'||Array.isArray(r.eaten))return false;
 return Object.entries(r.eaten).every(([role,keys])=>['vlad','alina'].includes(role)&&Array.isArray(keys)&&keys.length<=9&&new Set(keys).size===keys.length&&keys.every(k=>typeof k==='string'&&/^\d+:(breakfast|lunch|dinner)$/.test(k)));
}
export function resortAccess(s:GameState,r:CharacterId){const v=s.world.resort,n=gameMinutes(s.clock);return !!v&&v.guests.includes(r)&&s.world.places[r]==='resort'&&n>=v.from&&n<v.until;}
export function resortMealKey(s:GameState,r:CharacterId,meal:ResortMeal){if(!resortAccess(s,r))return;const v=s.world.resort!,n=gameMinutes(s.clock),d=RESORT_MEALS[meal],day=Math.floor(n/1440),start=day*1440+d.start,end=day*1440+d.end,key=day+':'+meal;if(n<start||n>=end||v.from>=end||v.eaten[r]?.includes(key))return;return key;}
export type ResortCommand={type:'resort_trip';pass:ResortPass};
export function resortSwimFrame(seconds:number,role:CharacterId,lake:boolean){const t=seconds*.38+(role==='vlad'?0:Math.PI),lane=role==='vlad'?-1:1;return lake?{x:12+Math.sin(t)*3,z:1+lane*1.6+Math.cos(t)*.8,y:.05,yaw:Math.atan2(3*Math.cos(t),-.8*Math.sin(t))}:{x:1+Math.sin(t)*2.8,z:6+lane*.95+Math.cos(t)*.45,y:.12,yaw:Math.atan2(2.8*Math.cos(t),-.45*Math.sin(t))};}
