
import { skillRank } from './education';
import type { GameState, CharacterId } from './protocol';
export const FOOD_QUALITIES=['bad','average','good','perfect'] as const;
export type FoodQuality=typeof FOOD_QUALITIES[number];
export const FOOD_QUALITY_LABEL:Record<FoodQuality,string>={bad:'Плохое',average:'Среднячок',good:'Хорошее',perfect:'Идеальное'};
export const isFoodQuality=(value:unknown):value is FoodQuality=>FOOD_QUALITIES.includes(value as FoodQuality);
const milestones=[[0,25,40,30,5],[5,10,25,50,15],[10,1,6,68,25],[15,0,2,48,50],[20,0,0,20,80]];
export function foodQualityChances(level:number):number[]{
 const l=Math.max(0,Math.min(20,level));
 const i=Math.min(3,Math.floor(l/5)),a=milestones[i],b=milestones[i+1],t=(l-a[0])/5;
 const bad=Math.round(a[1]+(b[1]-a[1])*t),average=Math.round(a[2]+(b[2]-a[2])*t),perfect=Math.round(a[4]+(b[4]-a[4])*t);
 return [bad,average,100-bad-average-perfect,perfect];
}
export function rollFoodQuality(level:number,random:()=>number=Math.random):FoodQuality{
 const chances=foodQualityChances(level);let roll=random()*100;
 for(let i=0;i<chances.length;i++){roll-=chances[i];if(roll<0)return FOOD_QUALITIES[i];}
 return 'perfect';
}
export function cookingQuality(state:GameState,role:CharacterId,random:()=>number=Math.random){return rollFoodQuality(skillRank(state.education.characters[role].xp.cooking).level,random);}
export function foodQualityEffect(quality:FoodQuality|undefined,mood:number,fun=0){
 return quality==='bad'?{mood:-30,fun:-30}:quality==='average'?{mood:-15,fun:-15}:quality==='perfect'?{mood:mood+5,fun:fun+5}:{mood,fun};
}
export function qualityLabel(quality:FoodQuality|undefined){return FOOD_QUALITY_LABEL[quality??'good'];}
export function qualitySuffix(batch:{kind:string;quality?:FoodQuality}){return batch.kind==='takeout'?'':' · '+qualityLabel(batch.quality);}
