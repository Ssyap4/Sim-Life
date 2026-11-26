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
 fish:{name:'Рыба на решётке',price:90,hunger:80,mood:25,seconds:40},
 soup:{name:'Уха в котелке',price:160,hunger:95,mood:35,seconds:50},
 marshmallow:{name:'Маршмеллоу на шпажках',price:140,hunger:20,mood:25,seconds:25}
} as const;
export type LakeMeal=keyof typeof LAKE_MEALS;
export const LAKE_MEAL_ACTIONS={
 lakeCookFish:{meal:'fish',cook:true},lakeCookSoup:{meal:'soup',cook:true},lakeEatFish:{meal:'fish',cook:false},lakeEatSoup:{meal:'soup',cook:false},
 lakeCookSausages:{meal:'sausages',cook:true},lakeCookMarshmallow:{meal:'marshmallow',cook:true},
 lakeEatSausages:{meal:'sausages',cook:false},lakeEatMarshmallow:{meal:'marshmallow',cook:false}
} as const;
export type LakeMealAction=keyof typeof LAKE_MEAL_ACTIONS;
export const isLakeMealAction=(v:unknown):v is LakeMealAction=>typeof v==='string'&&Object.hasOwn(LAKE_MEAL_ACTIONS,v);
export const LAKE_FISH={
 crucian:{name:'Карась',min:200,max:1500,tier:0},perch:{name:'Окунь',min:150,max:1800,tier:0},roach:{name:'Плотва',min:100,max:800,tier:0},
 bream:{name:'Лещ',min:500,max:3000,tier:1},carp:{name:'Карп',min:1000,max:8000,tier:1},pike:{name:'Щука',min:800,max:7000,tier:1},
 trout:{name:'Форель',min:400,max:3000,tier:2},zander:{name:'Судак',min:800,max:5000,tier:2},catfish:{name:'Сом',min:2000,max:15000,tier:2}
} as const;
export type LakeFish=keyof typeof LAKE_FISH;
export type FishCatch={species:LakeFish;grams:number;expires:number};
export const FISH_ACTIONS={lakeFishFloat:'float',lakeFishSpin:'spin',lakeFishFeeder:'feeder'} as const;
export type LakeFishAction=keyof typeof FISH_ACTIONS;
export const isLakeFishAction=(v:unknown):v is LakeFishAction=>typeof v==='string'&&Object.hasOwn(FISH_ACTIONS,v);
export type FishingStock={fish:FishCatch[];record:Partial<Record<CharacterId,number>>;species:LakeFish[];treatDay?:number};
export const emptyFishing=():FishingStock=>({fish:[],record:{},species:[]});
export const freshFish=(s:GameState)=> (s.world.fishing?.fish??[]).filter(f=>f.expires>gameMinutes(s.clock));
export const validCatch=(v:unknown):v is FishCatch=>{const f=v as FishCatch;if(!f||!Object.hasOwn(LAKE_FISH,f.species))return false;const d=LAKE_FISH[f.species];return Number.isSafeInteger(f.grams)&&f.grams>=d.min&&f.grams<=d.max&&Number.isSafeInteger(f.expires)&&f.expires>=0;};
export function validFishing(v:unknown):v is FishingStock{
 const f=v as FishingStock;return !!f&&Array.isArray(f.fish)&&f.fish.length<=12&&f.fish.every(validCatch)&&!!f.record&&Object.entries(f.record).every(([r,n])=>['vlad','alina'].includes(r)&&Number.isSafeInteger(n)&&n>=0&&n<=15000)&&Array.isArray(f.species)&&f.species.length<=9&&new Set(f.species).size===f.species.length&&f.species.every(k=>Object.hasOwn(LAKE_FISH,k))&&(f.treatDay===undefined||Number.isSafeInteger(f.treatDay)&&f.treatDay>=0);
}
export function rollFish(rod:LakeRod,now:number,random:()=>number=Math.random):FishCatch|null{
 const chance=rod==='float'?.78:rod==='spin'?.70:.75;
 if(random()>=chance)return null;
 const roll=random()*100,w=LAKE_RODS[rod].weights,tier=roll<w[0]?0:roll<w[0]+w[1]?1:2;
 const pool=(Object.keys(LAKE_FISH) as LakeFish[]).filter(k=>LAKE_FISH[k].tier===tier);
 const preferred=rod==='spin'?pool.filter(k=>['perch','pike','trout','zander'].includes(k)):rod==='feeder'?pool.filter(k=>['crucian','roach','bream','carp','catfish'].includes(k)):pool;
 const list=preferred.length&&random()<.86?preferred:pool;
 const species=list[Math.min(list.length-1,Math.floor(random()*list.length))],d=LAKE_FISH[species];
 return {species,grams:Math.round(d.min+(d.max-d.min)*Math.pow(random(),1.7)),expires:now+2880};
}
export function fishLabel(f:FishCatch){return LAKE_FISH[f.species].name+' · '+(f.grams/1000).toFixed(2)+' кг';}
export const LAKE_CARE={lakeToilet:{name:'В туалет',seconds:18,facility:'toilet'},lakeWash:{name:'Умыться и вымыть руки',seconds:20,facility:'wash'}} as const;
export type LakeCareAction=keyof typeof LAKE_CARE;
export const isLakeCareAction=(v:unknown):v is LakeCareAction=>typeof v==='string'&&Object.hasOwn(LAKE_CARE,v);
export const LAKE_REST={
 lakeNap:{name:'Вздремнуть в палатке',seconds:45,energy:30},
 lakeSleep:{name:'Поспать в палатке',seconds:120,energy:75},
 lakeFireRest:{name:'Отдохнуть у костра',seconds:45,energy:8}
} as const;
export type LakeRestAction=keyof typeof LAKE_REST;
export const isLakeRestAction=(v:unknown):v is LakeRestAction=>typeof v==='string'&&Object.hasOwn(LAKE_REST,v);
export function lakeCampFor(s:GameState,station:string){
 const pitch=station.replace('lake-fire-','lake-pitch-');
 return Object.values(s.world.lake??{}).find(v=>v.pitch===pitch&&v.until>gameMinutes(s.clock));
}
export function lakeSleepAnchor(tent:LakeTent,role:CharacterId){
 const w={basic:2.12,nord:2.50,family:3.12,summit:3.48}[tent],d={basic:2.12,nord:2.45,family:2.68,summit:2.78}[tent];
 return {x:(role==='vlad'?-1:1)*w*.225,y:.33,z:d*.40-.13,yaw:0};
}
export type LakePass=keyof typeof LAKE_PASSES;
export type LakeTent=keyof typeof LAKE_TENTS;
export type LakeRod=keyof typeof LAKE_RODS;
export type LakeVisit={pass:LakePass;until:number;rod?:LakeRod;tent?:LakeTent;pitch?:string;fire?:boolean;catch?:FishCatch;meals?:Partial<Record<LakeMeal,number>>};
export type LakeState=Partial<Record<CharacterId,LakeVisit>>;
export type LakeCommand={type:'lake_trip';pass:LakePass;dog?:boolean}|{type:'lake_rent';item:LakeTent|LakeRod;category:'tent'|'rod'}|{type:'lake_pitch';station:string}|{type:'lake_fire';station:string;lit:boolean}|{type:'lake_dog_treat';station:string;fish:boolean}|{type:'lake_catch';keep:boolean;again?:LakeFishAction;station?:string};
export const lakePass=(v:unknown):v is LakePass=>typeof v==='string'&&Object.hasOwn(LAKE_PASSES,v);
export const lakeTent=(v:unknown):v is LakeTent=>typeof v==='string'&&Object.hasOwn(LAKE_TENTS,v);
export const lakeRod=(v:unknown):v is LakeRod=>typeof v==='string'&&Object.hasOwn(LAKE_RODS,v);
export const LAKE_PITCHES=['lake-pitch-1','lake-pitch-2','lake-pitch-3','lake-pitch-4'] as const;
export function validLake(v:unknown):v is LakeState{
 if(!v||typeof v!=='object'||Array.isArray(v))return false;
 const seen=new Set<string>();
 return Object.entries(v).every(([r,p])=>{if(!['vlad','alina'].includes(r)||!p||!lakePass(p.pass)||!Number.isSafeInteger(p.until)||p.until<0||p.rod!==undefined&&!lakeRod(p.rod)||p.tent!==undefined&&!lakeTent(p.tent))return false;
 if(p.catch!==undefined&&!validCatch(p.catch))return false;
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
