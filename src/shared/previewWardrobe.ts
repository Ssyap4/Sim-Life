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
  ['pajamaRose','Розовая пижама · короткие шорты · мягкие тапочки'],
  ['pajamaMint','Мятная пижама с кантом · шорты · тапочки'],
  ['pajamaCream','Молочная домашняя футболка · персиковые шорты · тапочки'],
  ['silkBerry','Ягодный атласный топ · короткие шорты'],
  ['silkMidnight','Тёмно-синий атласный комплект · светлые тапочки'],
  ['datePearl','Жемчужный приталенный топ · бордовые брюки · кеды'],
 ],
 vlad:[
  ['signature','Исходный комплект'],
  ['home','Зелёная футболка · длинные шорты'],
  ['denim','Терракотовая футболка оверсайз · широкие тёмные джинсы'],
  ['city','Чёрная футболка · бежевые брюки'],
  ['cozy','Синее худи · спортивные штаны'],
  ['street','Серое худи · тёмные джинсы'],
  ['track','Тёмный спортивный костюм · три полоски'],
  ['polo','Синее поло · светлые брюки'],
  ['cargo','Песочная футболка · брюки карго'],
  ['graphic','Графитовая футболка с принтом · джинсы'],
  ['athletic','Коричневое худи на молнии · джоггеры'],
  ['weekend','Голубое поло · длинные светлые шорты'],
  ['trackNavy','Синяя олимпийка · белая футболка · светлые кеды'],
  ['trackForest','Зелёная олимпийка · графитовая футболка · высокие кеды'],
  ['teeRetro','Молочная футболка с принтом · джинсы · красные кеды'],
  ['teeBlack','Чёрная футболка · светлые брюки · массивные кроссовки'],
  ['robeNavy','Тёмно-синий домашний халат · тапочки'],
  ['robeGrey','Серый домашний халат с поясом · мягкие тапочки'],
 ],
} as const;
export function isPreviewLook(role:CharacterId,look:string):boolean{
 return PREVIEW_LOOKS[role].some(([id])=>id===look);
}
export const LONG_SLEEVE_LOOKS = ['cozy','street','sportshort','lounge','track','athletic','trackNavy','trackForest','robeNavy','robeGrey'] as const;
export function previewLongSleeves(look:string):boolean{
 return LONG_SLEEVE_LOOKS.some(id=>id===look);
}

export const OUTFIT_CONTEXTS=['home','sleep','outdoor','sport','date'] as const;
export type OutfitContext=typeof OUTFIT_CONTEXTS[number];
export const OUTFIT_LABELS:Record<OutfitContext,string>={home:'Дома',sleep:'Сон',outdoor:'Выход из дома',sport:'Спорт',date:'Кафе и свидания'};
export type PersonalWardrobe={owned:string[];worn:string;auto?:boolean;contexts?:Partial<Record<OutfitContext,string>>};
export type OwnedWardrobe=Record<CharacterId,PersonalWardrobe>;
export function outfitContext(s:Pick<import('./protocol').GameState,'world'>&Partial<Pick<import('./protocol').GameState,'characters'>>,role:CharacterId):OutfitContext{const place=s.world.places[role];return place==='home'?(s.characters?.[role].sleepingOn||s.characters?.[role].pose==='sleep'?'sleep':'home'):place==='fitness'?'sport':place==='cafe'||place==='venue'?'date':'outdoor';}
export function contextualLook(s:Pick<import('./protocol').GameState,'world'>&Partial<Pick<import('./protocol').GameState,'characters'>>,role:CharacterId){const p=s.world.wardrobe?.[role];if(!p)return 'signature';const look=p.auto?p.contexts?.[outfitContext(s,role)]:undefined;return look&&p.owned.includes(look)?look:p.worn;}
export function defaultWardrobe():OwnedWardrobe {
 return {vlad:{owned:['signature'],worn:'signature'},alina:{owned:['signature'],worn:'signature'}};
}
export const outfitPrice=(look:string):number=>({signature:0,home:1290,summer:2490,pink:1890,sportshort:3290,denim:2990,city:2790,cozy:3290,street:3890,wide:3590,highrise:3190,lounge:4290,track:4990,polo:3290,cargo:3690,graphic:2990,athletic:4490,weekend:2690,pajamaRose:1890,pajamaMint:1990,pajamaCream:1590,silkBerry:2790,silkMidnight:2990,datePearl:3490,trackNavy:4490,trackForest:4590,teeRetro:2990,teeBlack:3190,robeNavy:3290,robeGrey:3490} as Record<string,number>)[look]??0;
export function validWardrobe(value:unknown):value is OwnedWardrobe{
 if(!value||typeof value!=='object')return false;
 const w=value as OwnedWardrobe;
 return (['vlad','alina'] as const).every(role=>{
  const r=w[role];
  return !!r&&Array.isArray(r.owned)&&r.owned.includes('signature')&&r.owned.length===new Set(r.owned).size&&r.owned.every(id=>typeof id==='string'&&isPreviewLook(role,id))&&r.owned.includes(r.worn)&&(r.auto===undefined||typeof r.auto==='boolean')&&(r.contexts===undefined||!!r.contexts&&typeof r.contexts==='object'&&!Array.isArray(r.contexts)&&Object.entries(r.contexts).every(([k,v])=>(OUTFIT_CONTEXTS as readonly string[]).includes(k)&&typeof v==='string'&&r.owned.includes(v)));
 });
}
