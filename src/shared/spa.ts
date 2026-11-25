import type {CharacterId,GameState} from './protocol';
export const SPA_PASSES={single:{name:'SPA · один гость',price:1800},pair:{name:'SPA · вдвоём',price:3200},package:{name:'SPA · пакет с массажем',price:4900}} as const;
export type SpaPass=keyof typeof SPA_PASSES;
export type SpaCommand={type:'spa_trip';pass:'pair'|'package'};
export const SPA_ACTIVITIES={
 spaLocker:{name:'Переодеться',seconds:12,comfort:0,mood:0,energy:0,fun:0},
 spaShower:{name:'Принять душ',seconds:30,comfort:8,mood:5,energy:0,fun:0},
 spaPool:{name:'Поплавать в бассейне',seconds:55,comfort:15,mood:20,energy:-8,fun:25},
 spaJacuzzi:{name:'Отдохнуть в джакузи',seconds:40,comfort:35,mood:18,energy:5,fun:10},
 spaSauna:{name:'Посетить сауну',seconds:30,comfort:25,mood:15,energy:-5,fun:5},
 spaLounge:{name:'Отдохнуть на лежаке',seconds:35,comfort:25,mood:10,energy:15,fun:5},
 spaMassage:{name:'Профессиональный массаж',seconds:45,comfort:45,mood:25,energy:20,fun:5}
} as const;
export type SpaAction=keyof typeof SPA_ACTIVITIES;
export const isSpaAction=(v:unknown):v is SpaAction=>typeof v==='string'&&Object.hasOwn(SPA_ACTIVITIES,v);
export const SPA_MASSAGE_PRICE=1100;
export type SpaVisit={pass:SpaPass;used:SpaAction[];changed?:boolean;progress?:Partial<Record<SpaAction,number>>};
export type SpaState=Partial<Record<CharacterId,SpaVisit>>;
export function validSpa(v:unknown):v is SpaState{
 if(!v||typeof v!=='object'||Array.isArray(v))return false;
 return Object.entries(v).every(([r,p])=>['vlad','alina'].includes(r)&&p&&Object.hasOwn(SPA_PASSES,p.pass)&&(p.changed===undefined||typeof p.changed==='boolean')&&Array.isArray(p.used)&&p.used.every(isSpaAction)&&new Set(p.used).size===p.used.length&&(p.progress===undefined||!!p.progress&&typeof p.progress==='object'&&!Array.isArray(p.progress)&&Object.entries(p.progress).every(([a,n])=>isSpaAction(a)&&a!=='spaLocker'&&!p.used.includes(a)&&typeof n==='number'&&Number.isFinite(n)&&n>0&&n<1)));
}
export function spaDenial(s:GameState,r:CharacterId,a:SpaAction):string|undefined{
 const visit=s.world.spa?.[r];
 if(s.world.places[r]!=='spa'||!visit)return 'Нужно оплатить посещение SPA';
 if(a==='spaLocker')return;
 if(a!=='spaLounge'&&a!=='spaMassage'&&a!=='spaShower'&&visit.changed===false)return 'Сначала переоденься в раздевалке';
 if(visit.used.includes(a))return 'Эта процедура уже выполнена за визит';
 if(a==='spaMassage'&&visit.pass!=='package'&&!visit.progress?.[a]&&s.money<SPA_MASSAGE_PRICE)return 'Недостаточно денег';
 if(!visit.progress?.[a]&&(a==='spaPool'||a==='spaSauna')&&(s.characters[r].energy<20||s.characters[r].hunger<20))return 'Сначала поешь и отдохни';
}
export function spaProgress(s:GameState,r:CharacterId,a:SpaAction,fraction:number){
 const v=s.world.spa![r]!,c=s.characters[r],d=SPA_ACTIVITIES[a];
 const old=v.progress?.[a]??0,now=Math.max(old,Math.min(1,fraction)),delta=now-old;
 if(delta<=0||a==='spaLocker')return;
 for(const key of ['comfort','mood','energy','fun'] as const)c[key]=Math.max(0,Math.min(100,c[key]+d[key]*delta));
 if(a==='spaShower')c.hygiene=Math.min(100,c.hygiene+100*delta);
 if(now<1)(v.progress??={})[a]=now;else if(v.progress)delete v.progress[a];
}
export function finishSpa(s:GameState,r:CharacterId,a:SpaAction){
 const v=s.world.spa![r]!,c=s.characters[r];if(a==='spaLocker'){v.changed=v.changed===false;c.pose='idle';return;}spaProgress(s,r,a,1);v.used.push(a);if(a==='spaShower')c.hygiene=100;
 c.pose='idle';
}

/** Separate slow oval swim loops. Coordinates relative to the larger pool. */
export function spaSwimFrame(t:number,role:CharacterId){
 const side=role==='vlad'?-1:1,phase=t*.38+(side===1?Math.PI:0);
 const cx=side*1.70+.53*Math.sin(phase),cz=.96*Math.cos(phase);
 const yaw=Math.atan2(-.53*Math.cos(phase),.96*Math.sin(phase));
 return {x:cx+.77*Math.sin(yaw),z:cz+.77*Math.cos(yaw),y:.20,yaw};
}
