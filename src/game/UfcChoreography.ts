import type {ConsoleMatch} from '../shared/consoleCatalog';
export type FightMove='jab'|'cross'|'hook'|'kick'|'dodge'|'clinch'|'knockdown'|'celebrate'|'break';
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(v:number)=>{v=clamp(v);return v*v*(3-2*v);};
const pulse=(v:number)=>Math.sin(Math.PI*clamp(v));
const combos:FightMove[][]=[
 ['jab','cross','dodge','hook','kick','clinch'],
 ['dodge','jab','hook','cross','clinch','kick'],
 ['kick','jab','clinch','hook','dodge','cross'],
 ['cross','hook','dodge','jab','kick','hook']
];
/** Single shared, deterministic choreography. No random calls per render. */
export function ufcBroadcastFrame(t:number,match?:ConsoleMatch){
 const time=Math.max(0,Math.min(120,t)),seed=match?.seed??0,winner=match?.winner==='blue'?1:0;
 const replay=time>=111&&time<115,celebrate=time>=115;
 // Show the very same decisive exchange twice, not a separate random fight.
 const sceneTime=replay?107+(time-111)*.875:time;
 const finish=sceneTime>=107&&sceneTime<111;
 const round=Math.min(3,Math.floor(sceneTime/39)+1),rt=sceneTime-(round-1)*39;
 const roundBreak=round<3&&rt>=36;
 const beat=Math.floor((sceneTime+seed%9*.19)/2.4),phase=((sceneTime+seed%9*.19)%2.4)/2.4;
 const moves=combos[(seed+round)%combos.length],kind:FightMove=celebrate?'celebrate':finish?'knockdown':roundBreak?'break':moves[beat%moves.length];
 const active=finish||celebrate?winner:(beat+round+seed)%2;
 const strike=finish?smooth((sceneTime-107.32)/.44)*(1-smooth((sceneTime-108.1)/.7)):
  celebrate||roundBreak?0:kind==='clinch'?pulse(phase):pulse((phase-.12)/.65);
 const fall=finish?smooth((sceneTime-107.75)/1.15):celebrate?1:0;
 const angle=(Math.floor(sceneTime/7)+seed)%4;
 const zoom=celebrate?1.48:replay?1.30:finish?1.13:roundBreak?.99:angle===1?1.19:angle===3?1.10:1;
 return {time,sceneTime,round,rt,kind,active,strike,fall,winner,replay,celebrate,roundBreak,phase,zoom,
  cameraX:celebrate?(winner===0?94:162):128+(angle===1?8:angle===3?-8:0),cameraY:celebrate?77:85,
  dodge:kind==='dodge'?pulse(phase):0,
  label:celebrate?'WINNER':replay?'SLOW MOTION REPLAY':finish?'FINISH':roundBreak?'ROUND BREAK':null};
}
