import type {CharacterId,GameState} from './protocol';
import type {PetId} from './pets';
import {gameMinutes} from './life';
export const GROOM_SERVICES={
 dogWash:{name:'Экспресс-купание',pet:'verdell',price:950,seconds:45,stages:['wash'],hours:24},
 dogDry:{name:'Купание и сушка',pet:'verdell',price:1600,seconds:65,stages:['wash','dry'],hours:48},
 dogBrush:{name:'Вычёсывание шубки',pet:'verdell',price:1200,seconds:45,stages:['brush'],hours:36},
 dogPaws:{name:'Лапки и когти',pet:'verdell',price:850,seconds:35,stages:['paws'],hours:48},
 dogFull:{name:'Полный комплекс',pet:'verdell',price:3200,seconds:105,stages:['wash','dry','brush','paws'],hours:72},
 dogPremium:{name:'SPA для шпица',pet:'verdell',price:4500,seconds:135,stages:['wash','dry','brush','paws','brush'],hours:96},
 catBrush:{name:'Деликатное вычёсывание',pet:'simba',price:950,seconds:40,stages:['brush'],hours:36},
 catPaws:{name:'Уход за когтями',pet:'simba',price:750,seconds:30,stages:['paws'],hours:48},
 catFull:{name:'Деликатный комплекс',pet:'simba',price:1950,seconds:75,stages:['brush','paws','brush'],hours:72},
} as const;
export type GroomAction=keyof typeof GROOM_SERVICES;
export type GroomStage='wash'|'dry'|'brush'|'paws';
export type GroomVisit={owner:CharacterId;pet:PetId};
export const isGroomAction=(x:unknown):x is GroomAction=>typeof x==='string'&&Object.hasOwn(GROOM_SERVICES,x);
export function petAway(s:GameState,id:PetId){return s.world.vetVisit?.pet===id||s.world.groomVisit?.pet===id||s.world.resort?.pets?.includes(id)===true;}
export function groomingDenial(s:GameState,r:CharacterId,a:GroomAction){
 const v=s.world.groomVisit,d=GROOM_SERVICES[a];if(!v||v.owner!==r||v.pet!==d.pet||s.world.places[r]!=='grooming')return 'Привези подходящего питомца в салон';
 if(s.money<d.price)return 'Недостаточно денег';
 const p=s.pets[v.pet];if(p.energy<12)return 'Питомцу сначала нужно отдохнуть';
 if((p.groomedUntil??0)>gameMinutes(s.clock)+d.hours*60-120&&p.groomedService===a)return 'Этот уход ещё свежий';
}
export function groomingStage(a:GroomAction,seconds:number):GroomStage{const d=GROOM_SERVICES[a];return d.stages[Math.min(d.stages.length-1,Math.floor(Math.max(0,seconds)/d.seconds*d.stages.length))];}
export function finishGroom(s:GameState,a:GroomAction){const d=GROOM_SERVICES[a],p=s.pets[d.pet];p.groomedUntil=gameMinutes(s.clock)+d.hours*60;p.groomedService=a;p.happiness=Math.min(100,p.happiness+25);p.bond=Math.min(100,p.bond+6);if(d.pet==='verdell'&&d.stages.some(x=>x==='wash'))p.cleanliness=100;}
