import type { CharacterId, GameState } from './protocol';
import { gameMinutes } from './life';
import { activeEmotions, recordEmotion, type EventKind } from './emotions';

const slots:readonly {minute:number;kind:EventKind}[]=[
 {minute:8*60,kind:'quietMorning'},
 {minute:14*60,kind:'creativeSpark'},
 {minute:20*60,kind:'cozyEvening'},
];

/** One potential moment per resident per game day, deterministic across restarts.
 * Only crossings of the selected time count: no backfill after reconnect. */
export function applyLifeMoments(state:GameState,previousMinute:number,eligible:readonly CharacterId[]):void{
 const now=gameMinutes(state.clock);
 if(now<=previousMinute)return;
 const day=Math.floor(now/1440);
 for(const role of new Set(eligible)){
  const seed=Math.imul(day+17,1103515245)+ (role==='vlad'?137:7919);
  const roll=(seed>>>0)%10;
  if(roll>=7)continue;
  const slot=slots[((seed>>>8)>>>0)%slots.length];
  const at=day*1440+slot.minute;
  if(previousMinute>=at||now<at||now-at>30)continue;
  const p=state.characters[role];
  if(state.world.places[role]!=='home'||p.pose!=='idle'||Math.min(p.energy,p.hunger,p.bladder,p.hygiene,p.comfort,p.social,p.fun)<55||p.mood<55)continue;
  if(activeEmotions(state,role).length)continue;
  recordEmotion(state,role,slot.kind);
 }
}
