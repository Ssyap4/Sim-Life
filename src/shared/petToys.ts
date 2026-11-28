import type {PetId,PetState} from './pets';
export type ShopToyKind='bone'|'ring'|'puzzle'|'mouse'|'spring'|'feather';
export type ManualCatToy='wand'|'string'|'laser'|'bell';
export const CAT_DIRECTIONS=['north','east','south','west'] as const;
export type CatDirection=typeof CAT_DIRECTIONS[number];
export type CatPlayCommand={type:'cat_play';toy:string}&({direction:CatDirection}|{point:{x:number;z:number}});
export interface ToyProduct {manual?:ManualCatToy;id:string;pet:PetId;kind:ShopToyKind;name:string;price:number;description:string;x:number;z:number;joy:number}
export const PET_TOYS:readonly ToyProduct[]=[
 {id:'dog-bone',pet:'verdell',kind:'bone',name:'Пищащая косточка',price:490,description:'Берёт в пасть, сжимает и грызёт.',x:-2.70,z:8.65,joy:9},
 {id:'dog-ring',pet:'verdell',kind:'ring',name:'Резиновое кольцо',price:790,description:'Подхватывает, трясёт головой и роняет.',x:.48,z:4.43,joy:10},
 {id:'dog-puzzle',pet:'verdell',kind:'puzzle',name:'Игрушка-головоломка',price:1590,description:'Нюхает и открывает ячейки лапой.',x:7.65,z:-3.72,joy:13},
 {id:'cat-mouse',pet:'simba',kind:'mouse',name:'Мышка с хвостиком',price:290,description:'Крадётся, прыгает и ловит лапами.',x:-.25,z:1.32,joy:9},
 {id:'cat-spring',pet:'simba',kind:'spring',name:'Пружинка',price:190,description:'Бьёт лапкой, пружинка отскакивает.',x:-2.90,z:3.80,joy:8},
 {id:'cat-feather',pet:'simba',kind:'feather',name:'Перья на пружинке',price:690,description:'Следит за перьями, поднимает лапы и ловит их.',x:-6.26,z:-3.71,joy:12},
 {id:'cat-wand',pet:'simba',kind:'feather',manual:'wand',name:'Удочка с перьями',price:590,description:'Хозяин перемещает перья, Симба подкрадывается и ловит.',x:0,z:0,joy:12},
 {id:'cat-string-mouse',pet:'simba',kind:'mouse',manual:'string',name:'Мышка на верёвке',price:390,description:'Перетягивай мышку по полу, Симба бежит за ней.',x:0,z:0,joy:11},
 {id:'cat-laser',pet:'simba',kind:'mouse',manual:'laser',name:'Лазерная указка',price:490,description:'Перемещай красную точку по свободному полу.',x:0,z:0,joy:9},
 {id:'cat-bell-ball',pet:'simba',kind:'spring',manual:'bell',name:'Мячик с колокольчиком',price:350,description:'Перекатывай мячик в разные стороны.',x:0,z:0,joy:10},
];
export const catManualToys=(p:PetState)=>PET_TOYS.filter(t=>t.pet==='simba'&&t.manual&&toyOwned(p,t.id));
export const toysFor=(id:PetId)=>PET_TOYS.filter(p=>p.pet===id);
export const toyProduct=(id:unknown)=>PET_TOYS.find(p=>p.id===id);
export function toyOwned(pet:PetState,id:string){return pet.ownedToys?.includes(id)??false;}
export function toyPreference(pet:PetState,id:string,random=Math.random):0|1|2|3 {
 const known=pet.toyPreferences?.[id];if(known!==undefined)return known;
 const r=random(),value=r<.2?0:r<.5?1:r<.85?2:3;
 (pet.toyPreferences??={})[id]=value;return value;
}
export const TOY_REACTIONS=['Не заинтересовала','Иногда играет','Нравится','Любимая игрушка'] as const;
export function validToyExtras(pet:PetState,id:PetId){
 const valid=(key:unknown)=>toyProduct(key)?.pet===id;
 return (pet.ownedToys===undefined||Array.isArray(pet.ownedToys)&&pet.ownedToys.length<=toysFor(id).length&&new Set(pet.ownedToys).size===pet.ownedToys.length&&pet.ownedToys.every(valid))&&
 (pet.toyPreferences===undefined||!!pet.toyPreferences&&typeof pet.toyPreferences==='object'&&!Array.isArray(pet.toyPreferences)&&Object.entries(pet.toyPreferences).every(([key,n])=>valid(key)&&toyOwned(pet,key)&&[0,1,2,3].includes(n)));
}
