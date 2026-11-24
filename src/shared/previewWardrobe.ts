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
