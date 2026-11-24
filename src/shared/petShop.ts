import type {PetId,PetState} from './pets';
export type FoodTier=0|1|2|3;
export type FoodForm='dry'|'wet';
export interface PetFoodProduct {id:string;pet:PetId;name:string;price:number;refills:number;satiety:number;happiness:number;lasting:number;color:number}
const tiers=['Эконом','Стандарт','Премиум','Суперпремиум'];
const brands={verdell:{dry:['Pedigree','Brit Premium','Royal Canin','Farmina N&D'],wet:['Pedigree','Brit Premium','Royal Canin','Farmina N&D']},simba:{dry:['Whiskas','Purina ONE','Pro Plan','Farmina N&D'],wet:['Whiskas','Purina ONE','Pro Plan','Royal Canin']}};
export const PET_SHOP_FOOD:PetFoodProduct[]=(['verdell','simba'] as const).flatMap(pet=>
  (['dry','wet'] as const).flatMap(form=>tiers.map((tier,i)=>({
    id:pet+'-'+form+'-'+i,pet,name:brands[pet][form][i]+' · '+tier+' · '+(form==='dry'?'сухой':'влажный')+' корм '+(pet==='verdell'?'для собак':'для кошек'),
    price:(form==='dry'?[390,850,1690,3290]:[560,1090,2390,4190])[i],refills:10,
    satiety:(form==='dry'?[30,39,47,56]:[33,42,50,60])[i],happiness:[1,4,7,10][i],
    lasting:[0,45,105,180][i],color:[0xcaa16c,0x72a58e,0x6b85b6,0x976da5][i]
  }))));
export const petFoodProduct=(id:unknown)=>typeof id==='string'?PET_SHOP_FOOD.find(p=>p.id===id):undefined;
export type FoodPreference=0|1|2|3;
export const FOOD_REACTIONS=['Не в восторге','Нормально','Нравится','Любимый корм'] as const;
export function discoverFoodPreference(pet:PetState,id:string,random=Math.random):FoodPreference {
  const known=pet.foodPreferences?.[id];if(known!==undefined)return known;
  const r=random();const value:FoodPreference=r<.20?0:r<.55?1:r<.85?2:3;
  (pet.foodPreferences??={})[id]=value;return value;
}
export function nextPetFood(pet:PetState):PetFoodProduct|undefined {
  return petFoodProduct(pet.foodQueue?.[0]);
}
export function petFoodBenefit(p:PetFoodProduct){return p.refills+' насыпаний · сытость +'+p.satiety+' · радость +'+p.happiness+(p.lasting?' · дольше сыт ('+p.lasting+' игр. мин)':'');}
export function validPetFoodExtras(pet:PetState,id:PetId,total:number,bowl:number):boolean {
  const compatible=(key:unknown)=>petFoodProduct(key)?.pet===id;
  return (pet.foodQueue===undefined||Array.isArray(pet.foodQueue)&&pet.foodQueue.length<=total&&pet.foodQueue.every(compatible))&&
    (pet.bowlFood===undefined||bowl>0&&compatible(pet.bowlFood))&&
    (pet.foodPreferences===undefined||!!pet.foodPreferences&&typeof pet.foodPreferences==='object'&&!Array.isArray(pet.foodPreferences)&&Object.entries(pet.foodPreferences).every(([key,n])=>compatible(key)&&[0,1,2,3].includes(n)))&&
    (pet.foodFullUntil===undefined||Number.isSafeInteger(pet.foodFullUntil)&&pet.foodFullUntil>=0);
}
