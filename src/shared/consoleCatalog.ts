import {isSpeakerSku} from './speakerCatalog';
import type {GameState} from './protocol';
export const CONSOLES={
 'console-ps5':{name:'PlayStation 5',price:64990,width:.33,depth:.22,height:.105,description:'Два DualSense · игры на ТВ'},
 'console-switch2':{name:'Nintendo Switch 2',price:49990,width:.28,depth:.15,height:.14,description:'Док-станция · два контроллера'}
} as const;
export type ConsoleSku=keyof typeof CONSOLES;
export const isConsoleSku=(s:unknown):s is ConsoleSku=>typeof s==='string'&&Object.hasOwn(CONSOLES,s);
export const isSurfaceDevice=(s:unknown)=>isSpeakerSku(s)||isConsoleSku(s)||s==='lamp-table-linen';
export const CONSOLE_GAMES={
 ufc6:{name:'UFC 6',console:'console-ps5',price:6990,mode:'versus',seconds:120},
 mk1:{name:'Mortal Kombat 1',console:'console-ps5',price:3990,mode:'versus',seconds:90},
 forza6:{name:'Forza Horizon 6',console:'console-ps5',price:6490,mode:'solo',seconds:120},
 gta6:{name:'GTA 6',console:'console-ps5',price:8990,mode:'solo',seconds:120},
 itTakesTwo:{name:'It Takes Two',console:'console-ps5',price:2990,mode:'coop',seconds:120},
 splitFiction:{name:'Split Fiction',console:'console-ps5',price:4490,mode:'coop',seconds:120},
 marioKart:{name:'Mario Kart World',console:'console-switch2',price:6490,mode:'versus',seconds:90},
 marioParty:{name:'Super Mario Party Jamboree',console:'console-switch2',price:5490,mode:'versus',seconds:120},
 marioWonder:{name:'Super Mario Bros. Wonder',console:'console-switch2',price:4990,mode:'coop',seconds:120},
 switchSports:{name:'Nintendo Switch Sports',console:'console-switch2',price:3990,mode:'versus',seconds:90},
 animalCrossing:{name:'Animal Crossing',console:'console-switch2',price:4990,mode:'solo',seconds:120},
 smash:{name:'Super Smash Bros. Ultimate',console:'console-switch2',price:4990,mode:'versus',seconds:90}
} as const satisfies Record<string,{name:string;console:ConsoleSku;price:number;mode:'versus'|'coop'|'solo';seconds:number}>;
export type ConsoleGameId=keyof typeof CONSOLE_GAMES;
export const isConsoleGame=(s:unknown):s is ConsoleGameId=>typeof s==='string'&&Object.hasOwn(CONSOLE_GAMES,s);
export const consoleOwned=(s:GameState,sku:ConsoleSku)=>[...s.furnishing.placed,...s.furnishing.stored,...s.furnishing.orders].some(i=>i.sku===sku);
export const consoleInstalled=(s:GameState,sku:ConsoleSku)=>s.furnishing.placed.some(i=>i.sku===sku&&!!i.mount);
export const consoleLibrary=(s:GameState)=>s.consoleLibrary??[];
export const validConsoleLibrary=(v:unknown):v is ConsoleGameId[]=>Array.isArray(v)&&v.length<=Object.keys(CONSOLE_GAMES).length&&v.every(isConsoleGame)&&new Set(v).size===v.length;
export const consoleGames=(sku:ConsoleSku)=>(Object.keys(CONSOLE_GAMES) as ConsoleGameId[]).filter(id=>CONSOLE_GAMES[id].console===sku);
export function consolePlayError(s:GameState,id:unknown){if(!isConsoleGame(id))return 'Неизвестная игра';if(!consoleInstalled(s,CONSOLE_GAMES[id].console))return 'Установи нужную консоль';if(!consoleLibrary(s).includes(id))return 'Сначала купи игру';if(s.furnishing.soldFixtures?.includes('sofa'))return 'Для игры пока нужен штатный диван';}
export type ConsoleMatch={seed:number;winner:'red'|'blue';redLabel:string;blueLabel:string};
export function newConsoleMatch(paired:boolean,role:'vlad'|'alina',random= Math.random):ConsoleMatch{return {seed:Math.floor(random()*1000000),winner:random()<.5?'red':'blue',redLabel:paired||role==='vlad'?'VLAD':'ALINA',blueLabel:paired?'ALINA':'CPU'};}
export function consoleMatchWinner(m:ConsoleMatch){const label=m.winner==='red'?m.redLabel:m.blueLabel;return label==='VLAD'?'Влад':label==='ALINA'?'Алина':'Компьютер';}
export type ConsoleCommand={type:'console_buy';sku:ConsoleSku}|{type:'console_game_buy';game:ConsoleGameId};
