import { TABLE_TENNIS_SECONDS } from './tableTennis';
export const LEISURE = {
  boardGame:{sku:'leisure-board',label:'Играть в настольную игру',seconds:24,seated:true,paired:true,skill:'attention',fun:32,mood:10,comfort:5,energy:-2},
  chessGame:{sku:'leisure-chess',label:'Играть в шахматы',seconds:24,seated:true,paired:true,skill:'logic',fun:27,mood:10,comfort:5,energy:-3},
  dartsGame:{sku:'leisure-darts',label:'Играть в дартс',seconds:24,seated:false,paired:true,skill:'attention',fun:33,mood:10,comfort:0,energy:-4},
  pingPong:{sku:'leisure-tennis',label:'Играть в настольный теннис',seconds:TABLE_TENNIS_SECONDS,seated:false,paired:true,skill:'fitness',fun:42,mood:12,comfort:0,energy:-9},
  billiards:{sku:'leisure-billiards',label:'Играть в бильярд',seconds:30,seated:false,paired:true,skill:'attention',fun:38,mood:12,comfort:0,energy:-4},
  hammockRest:{sku:'leisure-hammock',label:'Отдохнуть в гамаке',seconds:25,seated:true,paired:false,skill:null,fun:12,mood:10,comfort:35,energy:12},
  swingRest:{sku:'leisure-swing',label:'Отдохнуть на садовых качелях',seconds:24,seated:true,paired:true,skill:null,fun:24,mood:15,comfort:24,energy:5},
} as const;
export type LeisureAction=keyof typeof LEISURE;
export function isLeisureAction(a:unknown):a is LeisureAction{return typeof a==='string'&&Object.hasOwn(LEISURE,a);}
export function leisureAction(sku:string):LeisureAction|undefined{return (Object.keys(LEISURE) as LeisureAction[]).find(a=>LEISURE[a].sku===sku);}
