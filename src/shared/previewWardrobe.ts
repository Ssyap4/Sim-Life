import type {CharacterId} from './protocol';

export const PREVIEW_LOOKS = {
 alina:[
  ['signature','Исходный комплект'],
  ['home','Розовая футболка · домашние шорты'],
  ['summer','Молочная футболка оверсайз · джинсовые шорты'],
  ['pink','Малиновый топ · светлые короткие шорты'],
  ['sportshort','Голубое худи на молнии · спортивные шорты'],
  ['denim','Молочная футболка · голубые джинсы'],
  ['city','Зелёная футболка · бежевые брюки'],
  ['cozy','Сиреневое худи · домашние штаны'],
  ['street','Бежевое худи · джинсы'],
  ['wide','Приталенная футболка · широкие брюки'],
  ['highrise','Синий топ · светлые джинсы'],
  ['lounge','Сиренево-серый костюм на молнии'],
 ],
 vlad:[
  ['signature','Исходный комплект'],
  ['home','Зелёная футболка · длинные шорты'],
  ['denim','Белая футболка · синие джинсы'],
  ['city','Чёрная футболка · бежевые брюки'],
  ['cozy','Синее худи · спортивные штаны'],
  ['street','Серое худи · тёмные джинсы'],
  ['track','Тёмный спортивный костюм · три полоски'],
 ],
} as const;
export function isPreviewLook(role:CharacterId,look:string):boolean{
 return PREVIEW_LOOKS[role].some(([id])=>id===look);
}
export const LONG_SLEEVE_LOOKS = ['cozy','street','sportshort','lounge','track'] as const;
export function previewLongSleeves(look:string):boolean{
 return LONG_SLEEVE_LOOKS.some(id=>id===look);
}

export type OwnedWardrobe = Record<CharacterId,{owned:string[];worn:string}>;
export function defaultWardrobe():OwnedWardrobe {
 return {vlad:{owned:['signature'],worn:'signature'},alina:{owned:['signature'],worn:'signature'}};
}
export const outfitPrice=(look:string):number=>({signature:0,home:1290,summer:2490,pink:1890,sportshort:3290,denim:2990,city:2790,cozy:3290,street:3890,wide:3590,highrise:3190,lounge:4290,track:4990} as Record<string,number>)[look]??0;
export function validWardrobe(value:unknown):value is OwnedWardrobe{
 if(!value||typeof value!=='object')return false;
 const w=value as OwnedWardrobe;
 return (['vlad','alina'] as const).every(role=>{
  const r=w[role];
  return !!r&&Array.isArray(r.owned)&&r.owned.includes('signature')&&r.owned.length===new Set(r.owned).size&&r.owned.every(id=>typeof id==='string'&&isPreviewLook(role,id))&&r.owned.includes(r.worn);
 });
}
