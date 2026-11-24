
import type {CharacterId,GameState} from './protocol';
export type ElectronicsKind='desktop'|'laptop'|'tv'|'phone';
export const ELECTRONICS_KINDS=['desktop','laptop','tv','phone'] as const;
export const ELECTRONICS_LABELS={desktop:'Компьютеры',laptop:'Ноутбуки',tv:'Телевизоры',phone:'Смартфоны'} as const;
export type ElectronicsModel={kind:ElectronicsKind;name:string;price:number;spec:string;speed:number;bonus:number};
export const ELECTRONICS={
 pcStart:{kind:'desktop',name:'Домашний ПК',price:0,spec:'Базовый компьютер',speed:0,bonus:0},
 pcOffice:{kind:'desktop',name:'Vector Office',price:24900,spec:'6 ядер · 16 ГБ · SSD 512 ГБ',speed:10,bonus:0},
 pcCreator:{kind:'desktop',name:'Vector Creator',price:54900,spec:'8 ядер · 32 ГБ · SSD 1 ТБ',speed:18,bonus:0},
 pcPro:{kind:'desktop',name:'Vector Studio',price:84900,spec:'12 ядер · 64 ГБ · SSD 2 ТБ',speed:25,bonus:0},
 laptopStart:{kind:'laptop',name:'Домашний ноутбук',price:0,spec:'Базовый ноутбук',speed:0,bonus:0},
 laptopAir:{kind:'laptop',name:'Nova Air',price:22900,spec:'4 ядра · 16 ГБ · SSD 256 ГБ',speed:8,bonus:0},
 laptopPlus:{kind:'laptop',name:'Nova Plus',price:45900,spec:'8 ядер · 16 ГБ · SSD 512 ГБ',speed:15,bonus:0},
 laptopPro:{kind:'laptop',name:'Nova Pro',price:69900,spec:'8 ядер · 32 ГБ · SSD 1 ТБ',speed:22,bonus:0},
 tvStart:{kind:'tv',name:'Домашний телевизор',price:0,spec:'Базовый экран',speed:0,bonus:0},
 tvHD:{kind:'tv',name:'Lumen 43',price:18900,spec:'43″ · Full HD',speed:0,bonus:2},
 tv4k:{kind:'tv',name:'Lumen 55',price:36900,spec:'55″ · 4K HDR',speed:0,bonus:4},
 tvOLED:{kind:'tv',name:'Lumen OLED 65',price:72900,spec:'65″ · OLED · 4K',speed:0,bonus:7},
 phoneStart:{kind:'phone',name:'Обычный смартфон',price:0,spec:'Базовая модель',speed:0,bonus:0},
 phoneLite:{kind:'phone',name:'Pulse Lite',price:12900,spec:'128 ГБ · IPS',speed:0,bonus:2},
 phonePlus:{kind:'phone',name:'Pulse Plus',price:28900,spec:'256 ГБ · OLED',speed:0,bonus:4},
 phonePro:{kind:'phone',name:'Pulse Pro',price:54900,spec:'512 ГБ · OLED 120 Гц',speed:0,bonus:6},
} as const satisfies Record<string,ElectronicsModel>;
export type ElectronicsId=keyof typeof ELECTRONICS;
export type ElectronicsState={desktop:ElectronicsId;laptop:ElectronicsId;tv:ElectronicsId;phones:Record<CharacterId,ElectronicsId>};
export const initialElectronics=():ElectronicsState=>({desktop:'pcStart',laptop:'laptopStart',tv:'tvStart',phones:{vlad:'phoneStart',alina:'phoneStart'}});
export const isElectronicsId=(id:unknown):id is ElectronicsId=>typeof id==='string'&&Object.hasOwn(ELECTRONICS,id);
export function validElectronics(value:unknown):value is ElectronicsState{
 if(!value||typeof value!=='object')return false;
 const s=value as ElectronicsState;
 return ['desktop','laptop','tv'].every(k=>isElectronicsId(s[k as 'desktop'])&&ELECTRONICS[s[k as 'desktop']].kind===k)&&!!s.phones&&['vlad','alina'].every(r=>isElectronicsId(s.phones[r as CharacterId])&&ELECTRONICS[s.phones[r as CharacterId]].kind==='phone');
}
export function installedElectronics(state:Pick<GameState,'world'>,role:CharacterId,kind:ElectronicsKind):ElectronicsId{
 const e=state.world.electronics??initialElectronics();return kind==='phone'?e.phones[role]:e[kind];
}
export const electronicsModel=(state:Pick<GameState,'world'>,role:CharacterId,kind:ElectronicsKind)=>ELECTRONICS[installedElectronics(state,role,kind)];
export const electronicsBenefit=(model:ElectronicsModel)=>model.speed?'Длительность домашнего заказа −'+model.speed+'%':model.bonus?model.kind==='phone'?'Звонки: +'+model.bonus+' общения':'Просмотр: +'+model.bonus+' досуга и настроения':'Базовые характеристики';
export const electronicsFor=(kind:ElectronicsKind)=>(Object.keys(ELECTRONICS) as ElectronicsId[]).filter(id=>ELECTRONICS[id].kind===kind&&ELECTRONICS[id].price>0);
