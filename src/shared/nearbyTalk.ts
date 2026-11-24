import { HOME_WALLS } from './home';
import type { Point } from './locations';
import type { CharacterId, GameState } from './protocol';
export const TALK_RANGE=2.6;
export function nearbyTalkDenial(s:GameState,from:CharacterId,positions:Partial<Record<CharacterId,Point>>):string|undefined {
 const to:CharacterId=from==='vlad'?'alina':'vlad';
 if(s.world.places[from]!==s.world.places[to])return 'Вы находитесь в разных местах';
 if([from,to].some(r=>s.characters[r].pose==='sleep'||s.activeShifts[r]||s.careers.residents[r].shift))return 'Сейчас партнёр спит или работает';
 const a=positions[from],b=positions[to];
 if(!a||!b)return 'Сначала дождитесь окончания перехода';
 if(Math.hypot(a.x-b.x,a.z-b.z)>TALK_RANGE)return 'Подойдите немного ближе';
 if(s.world.places[from]==='home'){
  // Test the segment against each solid wall, not furniture: no talking through walls.
  for(const w of HOME_WALLS){
   let lo=0,hi=1;
   for(const [v,d,min,max] of [[a.x,b.x-a.x,w.minX,w.maxX],[a.z,b.z-a.z,w.minZ,w.maxZ]]){
    if(Math.abs(d)<1e-8){if(v<min||v>max){lo=2;break;}continue;}
    const p=(min-v)/d,q=(max-v)/d;lo=Math.max(lo,Math.min(p,q));hi=Math.min(hi,Math.max(p,q));
   }
   if(lo<=hi)return 'Между вами стена';
  }
 }
}