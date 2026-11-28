import type {CharacterId,GameState} from './protocol';
import {CONSOLE_GAMES,consoleGames,type ConsoleGameId} from './consoleCatalog';
import {MEDIA_CATALOG,type MediaSelection} from './mediaCatalog';
import type {RecipeId} from './food';
import {gameMinutes} from './life';
export const RESORT_PASSES={night:{name:'Сутки',price:18900,minutes:1440},weekend:{name:'Двое суток',price:34900,minutes:2880}} as const;
export type ResortPass=keyof typeof RESORT_PASSES;
export const isResortPass=(p:unknown):p is ResortPass=>typeof p==='string'&&Object.hasOwn(RESORT_PASSES,p);
export const RESORT_MEALS={breakfast:{name:'Завтрак · омлет, круассаны и кофе',start:480,end:660},lunch:{name:'Обед · суп, салат и горячее',start:780,end:960},dinner:{name:'Ужин · стейк, овощи и десерт',start:1140,end:1320}} as const;
export type ResortMeal=keyof typeof RESORT_MEALS;
export const RESORT_MEAL_DISHES:Record<ResortMeal,readonly [RecipeId,RecipeId,RecipeId]>={breakfast:['omelette','butterCroissant','fruitSalad'],lunch:['chickenSoup','salad','creamyChicken'],dinner:['grillSteak','grillVegetables','berryCheesecake']};
export const RESORT_GRILL={pork:{name:'Шашлык из свинины',price:1350,dish:'grillChicken',hunger:90,color:0xa85d39},chicken:{name:'Шашлык из курицы',price:950,dish:'grillChicken',hunger:85,color:0xd9a05f},beef:{name:'Шашлык из говядины',price:1850,dish:'grillChicken',hunger:100,color:0x75402d},sausages:{name:'Купаты',price:850,dish:'grillChicken',hunger:80,color:0xc38b58},steak:{name:'Стейки на углях',price:2450,dish:'grillSteak',hunger:100,color:0x7f4331},vegetables:{name:'Овощи на гриле',price:590,dish:'grillVegetables',hunger:65,color:0x8eab57}} as const;
export type ResortGrill=keyof typeof RESORT_GRILL;
export const isResortGrill=(x:unknown):x is ResortGrill=>typeof x==='string'&&Object.hasOwn(RESORT_GRILL,x);
export const RESORT_DRINKS={beer:{name:'Пиво',price:450,alcohol:true,color:0xd5a441},redWine:{name:'Красное вино',price:690,alcohol:true,color:0x702d42},whiteWine:{name:'Белое вино',price:690,alcohol:true,color:0xe5d28b},sparkling:{name:'Игристое',price:790,alcohol:true,color:0xf0d99c},whisky:{name:'Виски',price:950,alcohol:true,color:0xb47231},mojito:{name:'Мохито',price:780,alcohol:true,color:0xc2dc95},spritz:{name:'Апероль спритц',price:850,alcohol:true,color:0xe68c47},lemonade:{name:'Лимонад',price:350,alcohol:false,color:0xe7d999},juice:{name:'Апельсиновый фреш',price:390,alcohol:false,color:0xf2a348},water:{name:'Вода',price:0,alcohol:false,color:0xc5e8ef},coffee:{name:'Капучино',price:320,alcohol:false,color:0x9b6332},tea:{name:'Чай',price:240,alcohol:false,color:0xb18142}} as const;
export type ResortDrink=keyof typeof RESORT_DRINKS;
export type ResortVisit={pass:ResortPass;from:number;until:number;guests:CharacterId[];eaten:Partial<Record<CharacterId,string[]>>;raw?:Partial<Record<ResortGrill,number>>;cooked?:Partial<Record<ResortGrill,number>>;bar?:Partial<Record<CharacterId,{day:number;alcohol:number}>>};
export const RESORT_FLOOR={minX:-20,maxX:20,minZ:-17,maxZ:17};
const RESORT_BASE_ACTIONS={
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
type GrillCookAction=`resortCook-${ResortGrill}`;type GrillEatAction=`resortEat-${ResortGrill}`;type DrinkAction=`resortDrink-${ResortDrink}`;
export type ResortMediaId=`resortFilm-${string}`|`resortGame-${ConsoleGameId}`;
export type ResortMedia={name:string;seconds:number;paired:boolean;solo:boolean;game?:ConsoleGameId;selection?:MediaSelection};
const films=Array.from(new Set(MEDIA_CATALOG.filter(t=>!t.seasons).map(t=>t.genre))).flatMap(genre=>MEDIA_CATALOG.filter(t=>!t.seasons&&t.genre===genre).slice(0,2));
const series=MEDIA_CATALOG.filter(t=>t.seasons).slice(0,4);
export const RESORT_MEDIA=Object.fromEntries([...films,...series].map<[string,ResortMedia]>(t=>[`resortFilm-${t.id}`,{name:t.title+(t.seasons?' · С1 Э1':''),seconds:120,paired:true,solo:true,selection:{id:t.id,...(t.seasons?{season:1,episode:1}:{})}}]).concat(consoleGames('console-switch2').map<[string,ResortMedia]>(id=>[`resortGame-${id}`,{name:CONSOLE_GAMES[id].name,seconds:CONSOLE_GAMES[id].seconds,paired:CONSOLE_GAMES[id].mode!=='solo',solo:CONSOLE_GAMES[id].mode!=='coop',game:id}]))) as Record<ResortMediaId,ResortMedia>;
export function resortMedia(id:unknown):ResortMedia|undefined{return typeof id==='string'&&Object.hasOwn(RESORT_MEDIA,id)?RESORT_MEDIA[id as ResortMediaId]:undefined;}
export type ResortAction=ResortMediaId|keyof typeof RESORT_BASE_ACTIONS|GrillCookAction|GrillEatAction|DrinkAction;
export type ResortActionDef={name:string;facility:'terrace'|'pool'|'jacuzzi'|'lake'|'bed'|'bath'|'grill'|'bar'|'media';seconds:number;meal?:ResortMeal;cook?:ResortGrill;eat?:ResortGrill;drink?:ResortDrink;media?:ResortMediaId};
export const RESORT_ACTIONS:Record<ResortAction,ResortActionDef>={...RESORT_BASE_ACTIONS,...Object.fromEntries(Object.entries(RESORT_MEDIA).map(([id,d])=>[id,{name:d.name,facility:'media',seconds:d.seconds,media:id}])),...Object.fromEntries(Object.entries(RESORT_GRILL).flatMap(([id,d])=>[[`resortCook-${id}`,{name:'Приготовить: '+d.name,facility:'grill',seconds:50,cook:id}],[`resortEat-${id}`,{name:'Съесть: '+d.name,facility:'terrace',seconds:40,eat:id}]])),...Object.fromEntries(Object.entries(RESORT_DRINKS).map(([id,d])=>[`resortDrink-${id}`,{name:d.name,facility:'bar',seconds:25,drink:id}]))} as Record<ResortAction,ResortActionDef>;
export const RESORT_LABELS=Object.fromEntries(Object.entries(RESORT_ACTIONS).map(([id,d])=>[id,d.name])) as Record<ResortAction,string>;
export type ResortFacility=typeof RESORT_ACTIONS[ResortAction]['facility']|'reception'|'bar'|'grill'|'media'|'kitchen';
export const isResortAction=(x:unknown):x is ResortAction=>typeof x==='string'&&Object.hasOwn(RESORT_ACTIONS,x);
export function validResort(v:unknown):v is ResortVisit{
 const r=v as ResortVisit;if(!r||!isResortPass(r.pass)||!Number.isSafeInteger(r.from)||r.from<0||r.until!==r.from+RESORT_PASSES[r.pass].minutes||!Array.isArray(r.guests)||r.guests.length<1||r.guests.length>2||new Set(r.guests).size!==r.guests.length||!r.guests.every(x=>x==='vlad'||x==='alina')||!r.eaten||typeof r.eaten!=='object'||Array.isArray(r.eaten))return false;
 const stock=(s:unknown,max:number)=>s===undefined||!!s&&typeof s==='object'&&!Array.isArray(s)&&Object.entries(s).every(([k,n])=>isResortGrill(k)&&Number.isSafeInteger(n)&&n>=0&&n<=max);
 if(!stock(r.raw,3)||!stock(r.cooked,6)||r.bar!==undefined&&(!r.bar||typeof r.bar!=='object'||Array.isArray(r.bar)||!Object.entries(r.bar).every(([k,v])=>['vlad','alina'].includes(k)&&!!v&&Number.isSafeInteger(v.day)&&v.day>=1&&Number.isSafeInteger(v.alcohol)&&v.alcohol>=0&&v.alcohol<=3)))return false;
 return Object.entries(r.eaten).every(([role,keys])=>['vlad','alina'].includes(role)&&Array.isArray(keys)&&keys.length<=9&&new Set(keys).size===keys.length&&keys.every(k=>typeof k==='string'&&/^\d+:(breakfast|lunch|dinner)$/.test(k)));
}
export function resortAccess(s:GameState,r:CharacterId){const v=s.world.resort,n=gameMinutes(s.clock);return !!v&&v.guests.includes(r)&&s.world.places[r]==='resort'&&n>=v.from&&n<v.until;}
export function resortService(s:GameState){const v=s.world.resort,n=gameMinutes(s.clock);if(!v||n<v.from||n>=v.until)return;const day=Math.floor(n/1440);for(const meal of Object.keys(RESORT_MEALS) as ResortMeal[]){const d=RESORT_MEALS[meal],start=Math.max(v.from,day*1440+d.start),end=Math.min(v.until,day*1440+d.end),delivery=start+6;if(n<start||n>=end||delivery>=end)continue;const key=day+':'+meal;return {meal,key,delivery,progress:Math.min(1,(n-start)/6),served:n>=delivery,remaining:v.guests.filter(r=>!v.eaten[r]?.includes(key))};}}
export function resortMealKey(s:GameState,r:CharacterId,meal:ResortMeal){if(!resortAccess(s,r))return;const service=resortService(s);return service?.meal===meal&&service.served&&service.remaining.includes(r)?service.key:undefined;}
export function resortAlcoholCount(s:GameState,r:CharacterId){const b=s.world.resort?.bar?.[r];return b?.day===s.clock.day?b.alcohol:0;}
export type ResortCommand={type:'resort_trip';pass:ResortPass}|{type:'resort_buy_meat';item:ResortGrill};
export function resortSwimFrame(seconds:number,role:CharacterId,lake:boolean){const t=seconds*.38+(role==='vlad'?0:Math.PI),lane=role==='vlad'?-1:1;return lake?{x:12+Math.sin(t)*3,z:1+lane*1.6+Math.cos(t)*.8,y:.05,yaw:Math.atan2(3*Math.cos(t),-.8*Math.sin(t))}:{x:1+Math.sin(t)*2.8,z:6+lane*.95+Math.cos(t)*.45,y:.12,yaw:Math.atan2(2.8*Math.cos(t),-.45*Math.sin(t))};}
