import type { IngredientId } from './food';
export const PICNIC_SECONDS=90;
export const CAMP_RECIPES={
 campPotato:{name:'Картофель в фольге на углях',ingredients:{potato:2,butter:1,herbs:1},hunger:70,mood:12},
 campBread:{name:'Хрустящий хлеб на костре с сыром',ingredients:{bread:2,cheese:1,butter:1},hunger:65,mood:12},
 campSkewers:{name:'Колбаски на шпажках с помидорами и луком',ingredients:{sausage:2,tomato:1,onion:1},hunger:80,mood:14},
 campMarshmallow:{name:'Маршмеллоу на шпажках',ingredients:{marshmallow:4},hunger:35,mood:20},
} as const;
export type CampRecipe=keyof typeof CAMP_RECIPES;
export const isCampRecipe=(v:unknown):v is CampRecipe=>typeof v==='string'&&Object.hasOwn(CAMP_RECIPES,v);
export const campIngredients=(r:CampRecipe)=>Object.entries(CAMP_RECIPES[r].ingredients) as [IngredientId,number][];
export interface CampKit { fuel:number; recipes:Partial<Record<CampRecipe,number>> }
export interface ParkDogVisit { minutes:number; toilets:number; toiletUntil?:number }
export const PARK_DOG_ACTIONS=['dog','dogFetch','dogChase','dogRoll','dogToilet'] as const;
export const isParkDogAction=(v:string)=> (PARK_DOG_ACTIONS as readonly string[]).includes(v);
export const PARK_TREES=[
 [-7.2,-5.7,'spruce',.95],[-5.9,-5.8,'birch',.9],[-3.7,-5.9,'spruce',1.05],[-.8,-5.8,'linden',.9],[2,-5.8,'spruce',1.06],[5.1,-5.75,'birch',.92],[8,-5.9,'spruce',1.07],[11.6,-5.6,'spruce',.95],
 [-7.1,-2.8,'linden',.92],[-7.1,.4,'spruce',1.0],[-7.0,3.5,'birch',.9],[-6.6,5.9,'spruce',.93],[-3.9,5.8,'linden',.85],[.2,5.9,'spruce',.95],[3.7,5.9,'birch',.92],[6.8,5.8,'spruce',1.05],[10.1,5.8,'linden',.95],[12.0,3.1,'spruce',1.0],[12.1,.0,'birch',.9],[11.9,-2.8,'spruce',1.05],
] as const;
