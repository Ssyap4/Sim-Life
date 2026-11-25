import type {CharacterId,GameState} from './protocol';
import type {ConsoleMatch} from './consoleCatalog';
export const VENUE_GAMES={
 venueBowling:{name:'Боулинг',price:1200,seconds:75,fun:50,mood:20,energy:-9,seated:false},
 venueHockey:{name:'Аэрохоккей',price:650,seconds:55,fun:45,mood:18,energy:-7,seated:false},
 venueBilliards:{name:'Бильярд',price:850,seconds:65,fun:42,mood:18,energy:-4,seated:false},
 venueJenga:{name:'Дженга',price:450,seconds:55,fun:40,mood:18,energy:-2,seated:true},
 venueUno:{name:'UNO',price:450,seconds:65,fun:45,mood:20,energy:-2,seated:true},
 venueUfc:{name:'PS5 · UFC 6',price:1000,seconds:120,fun:55,mood:20,energy:-3,seated:true},
} as const;
export type VenueGame=keyof typeof VENUE_GAMES;
export type VenueCommand={type:'venue_trip'};
export const isVenueGame=(v:unknown):v is VenueGame=>typeof v==='string'&&Object.hasOwn(VENUE_GAMES,v);
export const venueStation=(game:VenueGame)=>'venue-'+game.slice(5).toLowerCase();
export function venueDenial(s:GameState,game:VenueGame,individual=false):string|undefined{
 if(individual||s.world.places.vlad!=='venue'||s.world.places.alina!=='venue')return 'Для игры вдвоём приезжайте в PLAY ARENA';
 if(s.money<VENUE_GAMES[game].price)return 'Недостаточно денег';
 if((['vlad','alina'] as const).some(r=>s.characters[r].energy<12))return 'Сначала отдохните';
}
export const venueWinner=(match:ConsoleMatch):CharacterId=>match.winner==='red'?'vlad':'alina';
export function bowlingHit(match:ConsoleMatch,roll:number){
 const role=roll%2===0?'vlad':'alina',n=Math.floor(roll/2);
 return role===venueWinner(match)?8+(match.seed+n*3)%3:4+(match.seed+n*5)%4;
}
export function venueScoreAt(game:VenueGame,match:ConsoleMatch,seconds:number):[number,number]|undefined{
 const t=Math.max(0,Math.min(seconds,VENUE_GAMES[game].seconds)),winner=venueWinner(match)==='vlad'?0:1,loser=1-winner;
 const score:[number,number]=[0,0];
 if(game==='venueBowling'){for(let i=0;i<10;i++)if(t>=i*7+3.4)score[i%2]+=bowlingHit(match,i);return score;}
 if(game==='venueHockey'||game==='venueBilliards'){
  const best=game==='venueHockey'?7:8,other=game==='venueHockey'?2+match.seed%4:3+match.seed%4;
  const n=Math.floor(Math.min(1,t/(VENUE_GAMES[game].seconds-2))*(best+other));
  score[loser]=Math.floor(n*other/(best+other));score[winner]=n-score[loser];return score;
 }
 if(game==='venueUno'){const other=1+match.seed%4,p=Math.min(1,t/(VENUE_GAMES[game].seconds-2));score[winner]=Math.ceil(7*(1-p));score[loser]=Math.ceil(7-(7-other)*p);return score;}
}
export function venueScore(game:VenueGame,match:ConsoleMatch):string{return venueScoreAt(game,match,VENUE_GAMES[game].seconds)?.join(':')??'';}

export function hockeyPad(role:CharacterId,t:number){const i=role==='vlad'?0:1,phase=t*1.65;return {x:Math.sin(phase*1.73+i*.6)*.32,z:(i?1:-1)*(.99-.11*Math.max(0,Math.sin(phase+(i?0:Math.PI))))};}
export function venueHandFrame(game:VenueGame,role:CharacterId,t:number,match:ConsoleMatch){
 const side=role==='vlad'?-1:1,turn=Math.floor(t/4.5)%2===0?'vlad':'alina';
 if(game==='venueHockey'){const p=hockeyPad(role,t);return {...p,y:.965,reach:true};}
 if(game==='venueJenga'){const index=(match.seed+Math.floor(t/4.5)*5)%21,level=Math.floor(index/3);return {x:level%2?(index%3-1)*.112:0,y:.89+level*.075,z:side*.20,reach:turn===role&&t%4.5<2.1};}
 if(game==='venueUno')return {x:-.15,y:.91,z:side*.19,reach:turn===role&&t%4.5<2.1};
 if(game==='venueBilliards')return {x:0,y:1.02,z:side*(.95+.13*Math.cos(t*3)),reach:turn===role};
 return {x:side*.52,y:.55,z:3.85,reach:Math.floor(t/7)%2===(role==='vlad'?0:1)&&t%7<1.6};
}
