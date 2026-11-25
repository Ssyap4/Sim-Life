import type {CharacterId,GameState} from './protocol';
export const SPA_PASSES={single:{name:'SPA · один гость',price:1800},pair:{name:'SPA · вдвоём',price:3200},package:{name:'SPA · пакет с массажем',price:4900}} as const;
export type SpaPass=keyof typeof SPA_PASSES;
export type SpaCommand={type:'spa_trip';pass:'pair'|'package'};
export const SPA_ACTIVITIES={
 spaPool:{name:'Поплавать в бассейне',seconds:55,comfort:15,mood:20,energy:-8,fun:25},
 spaJacuzzi:{name:'Отдохнуть в джакузи',seconds:40,comfort:35,mood:18,energy:5,fun:10},
 spaSauna:{name:'Посетить сауну',seconds:30,comfort:25,mood:15,energy:-5,fun:5},
 spaLounge:{name:'Отдохнуть на лежаке',seconds:35,comfort:25,mood:10,energy:15,fun:5},
 spaMassage:{name:'Профессиональный массаж',seconds:45,comfort:45,mood:25,energy:20,fun:5}
} as const;
export type SpaAction=keyof typeof SPA_ACTIVITIES;
export const isSpaAction=(v:unknown):v is SpaAction=>typeof v==='string'&&Object.hasOwn(SPA_ACTIVITIES,v);
export const SPA_MASSAGE_PRICE=1100;
export type SpaVisit={pass:SpaPass;used:SpaAction[]};
export type SpaState=Partial<Record<CharacterId,SpaVisit>>;
export function validSpa(v:unknown):v is SpaState{
 if(!v||typeof v!=='object'||Array.isArray(v))return false;
 return Object.entries(v).every(([r,p])=>['vlad','alina'].includes(r)&&p&&Object.hasOwn(SPA_PASSES,p.pass)&&Array.isArray(p.used)&&p.used.every(isSpaAction)&&new Set(p.used).size===p.used.length);
}
export function spaDenial(s:GameState,r:CharacterId,a:SpaAction):string|undefined{
 const visit=s.world.spa?.[r];
 if(s.world.places[r]!=='spa'||!visit)return 'Нужно оплатить посещение SPA';
 if(visit.used.includes(a))return 'Эта процедура уже выполнена за визит';
 if(a==='spaMassage'&&visit.pass!=='package'&&s.money<SPA_MASSAGE_PRICE)return 'Недостаточно денег';
 if((a==='spaPool'||a==='spaSauna')&&(s.characters[r].energy<20||s.characters[r].hunger<20))return 'Сначала поешь и отдохни';
}
export function finishSpa(s:GameState,r:CharacterId,a:SpaAction){
 const v=s.world.spa![r]!,c=s.characters[r],d=SPA_ACTIVITIES[a];v.used.push(a);
 for(const key of ['comfort','mood','energy','fun'] as const)c[key]=Math.max(0,Math.min(100,c[key]+d[key]));
 c.pose='idle';
}
