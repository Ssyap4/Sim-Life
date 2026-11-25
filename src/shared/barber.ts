import type {GameState,CharacterId} from './protocol';
import {CARE,careEffects,finishCare,type CareId} from './vanity';
import {gameMinutes} from './life';
export const BARBER_SERVICES={
 barberFade:{name:'Коррекция Fade',price:1200,seconds:50,points:30,hours:72,care:['vladProFade']},
 barberShave:{name:'Королевское бритьё',price:900,seconds:40,points:25,hours:48,care:['vladProShave']},
 barberStyle:{name:'Профессиональная укладка',price:700,seconds:35,points:25,hours:48,care:['vladProStyle']},
 barberFace:{name:'Уход за лицом',price:800,seconds:40,points:20,hours:48,care:['vladProFace']},
 barberFull:{name:'Комплексный уход',price:2900,seconds:90,points:100,hours:72,care:['vladProFade','vladProShave','vladProFace','vladPerfume']}
} as const;
export type BarberAction=keyof typeof BARBER_SERVICES;
export type BarberCommand={type:'barber_book';at:number;service:BarberAction}|{type:'barber_cancel'};
export type BarberBooking={at:number;service:BarberAction};
export const isBarberAction=(a:unknown):a is BarberAction=>typeof a==='string'&&Object.hasOwn(BARBER_SERVICES,a);
export const barberSlots=(now:number)=>Array.from({length:48},(_,i)=>Math.floor(now/60)*60+60+i*60).filter(t=>t%1440>=9*60&&t%1440<=20*60);
export function validBarberBooking(v:unknown):v is BarberBooking{if(!v||typeof v!=='object'||Array.isArray(v))return false;const b=v as BarberBooking;return Number.isSafeInteger(b.at)&&b.at>=0&&isBarberAction(b.service);}
export function barberDenial(s:GameState,r:CharacterId,a:BarberAction):string|undefined{
 if(r!=='vlad'||s.world.places[r]!=='barber')return 'Услуга доступна Владу в BRO';
 const d=BARBER_SERVICES[a],now=gameMinutes(s.clock);
 if(s.money<d.price)return 'Недостаточно денег';
 if(d.care.every(id=>careEffects(s,r).some(e=>CARE[e.id].group===CARE[id].group&&CARE[e.id].points>=CARE[id].points&&e.until-now>=d.hours*60-120)))return 'Эффект ещё свежий';
}
export function finishBarber(s:GameState,a:BarberAction){const d=BARBER_SERVICES[a];for(const id of d.care)finishCare(s,id as CareId,d.hours);if(s.barberBooking?.service===a)delete s.barberBooking;}
