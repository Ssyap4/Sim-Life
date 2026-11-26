import type {CharacterId,GameState} from './protocol';
import {gameMinutes} from './life';
export const LAKE_PASSES={
 day:{name:'Дневное посещение',single:800,pair:1400,minutes:720},
 night:{name:'С ночёвкой',single:1500,pair:2500,minutes:1440},
 weekend:{name:'Двое суток',single:2700,pair:4500,minutes:2880}
} as const;
export const LAKE_TENTS={
 basic:{name:'Forest Basic 2',price:900,comfort:10,mood:5},
 nord:{name:'Nord Camp 3',price:1800,comfort:25,mood:10},
 family:{name:'Wild Family 4',price:3200,comfort:40,mood:20},
 summit:{name:'Summit Luxury',price:5500,comfort:60,mood:30}
} as const;
export const LAKE_RODS={
 float:{name:'Поплавочная удочка',price:350,seconds:40,weights:[80,18,2]},
 spin:{name:'Спиннинг',price:750,seconds:60,weights:[60,30,10]},
 feeder:{name:'Фидер',price:1200,seconds:90,weights:[50,40,10]}
} as const;
export const LAKE_MEALS={
 sausages:{name:'Колбаски на костре',price:220,hunger:65,mood:20,seconds:35},
 marshmallow:{name:'Маршмеллоу на шпажках',price:140,hunger:20,mood:25,seconds:25}
} as const;
export type LakeMeal=keyof typeof LAKE_MEALS;
export const LAKE_MEAL_ACTIONS={
 lakeCookSausages:{meal:'sausages',cook:true},lakeCookMarshmallow:{meal:'marshmallow',cook:true},
 lakeEatSausages:{meal:'sausages',cook:false},lakeEatMarshmallow:{meal:'marshmallow',cook:false}
} as const;
export type LakeMealAction=keyof typeof LAKE_MEAL_ACTIONS;
export const isLakeMealAction=(v:unknown):v is LakeMealAction=>typeof v==='string'&&Object.hasOwn(LAKE_MEAL_ACTIONS,v);
export type LakePass=keyof typeof LAKE_PASSES;
export type LakeTent=keyof typeof LAKE_TENTS;
export type LakeRod=keyof typeof LAKE_RODS;
export type LakeVisit={pass:LakePass;until:number;rod?:LakeRod;tent?:LakeTent;pitch?:string;fire?:boolean;meals?:Partial<Record<LakeMeal,number>>};
export type LakeState=Partial<Record<CharacterId,LakeVisit>>;
export type LakeCommand={type:'lake_trip';pass:LakePass}|{type:'lake_rent';item:LakeTent|LakeRod;category:'tent'|'rod'}|{type:'lake_pitch';station:string}|{type:'lake_fire';station:string;lit:boolean};
export const lakePass=(v:unknown):v is LakePass=>typeof v==='string'&&Object.hasOwn(LAKE_PASSES,v);
export const lakeTent=(v:unknown):v is LakeTent=>typeof v==='string'&&Object.hasOwn(LAKE_TENTS,v);
export const lakeRod=(v:unknown):v is LakeRod=>typeof v==='string'&&Object.hasOwn(LAKE_RODS,v);
export const LAKE_PITCHES=['lake-pitch-1','lake-pitch-2','lake-pitch-3','lake-pitch-4'] as const;
export function validLake(v:unknown):v is LakeState{
 if(!v||typeof v!=='object'||Array.isArray(v))return false;
 const seen=new Set<string>();
 return Object.entries(v).every(([r,p])=>{if(!['vlad','alina'].includes(r)||!p||!lakePass(p.pass)||!Number.isSafeInteger(p.until)||p.until<0||p.rod!==undefined&&!lakeRod(p.rod)||p.tent!==undefined&&!lakeTent(p.tent))return false;
 if(p.fire!==undefined&&(typeof p.fire!=='boolean'||!p.pitch))return false;
 if(p.meals!==undefined&&(!p.pitch||!p.meals||typeof p.meals!=='object'||Array.isArray(p.meals)||!Object.entries(p.meals).every(([k,n])=>Object.hasOwn(LAKE_MEALS,k)&&Number.isSafeInteger(n)&&Number(n)>=0&&Number(n)<=4)))return false;
 if(p.pitch!==undefined){if(!p.tent||!LAKE_PITCHES.some(id=>id===p.pitch)||seen.has(p.pitch))return false;seen.add(p.pitch);}return true;});
}
export function lakeAccess(s:GameState,r:CharacterId){const v=s.world.lake?.[r];return s.world.places[r]==='lake'&&!!v&&v.until>gameMinutes(s.clock);}
export function lakeVisit(pass:LakePass,now:number):LakeVisit{return {pass,until:now+LAKE_PASSES[pass].minutes};}
export function residentLook(s:Pick<GameState,'world'>,r:CharacterId,water=false):string{
 return s.world.places[r]==='lake'?'lake-visit':water?'spa-visit':s.world.wardrobe?.[r].worn??'signature';
}
export const LAKE_LOOKS={vlad:'cargo',alina:'cozy'} as const;
