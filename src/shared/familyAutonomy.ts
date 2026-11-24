import type {GameState,CharacterId} from './protocol';
import {gameMinutes} from './life';
import {residentEmotion} from './emotions';
import {SOCIAL_BY_ID,contextAvailable,socialRestriction} from './socialLife';

export const FAMILY_ACTIONS=['nearTalk:day','nearTalk:joke','nearTalk:listen','nearTalk:compliment','nearTalk:plans','yardRest','musicTogether','sofaTalk'] as const;
export function familyAutonomyReady(s:GameState):boolean{
 const now=gameMinutes(s.clock);
 return (['vlad','alina'] as const).every(r=>{
  const p=s.characters[r];
  return s.autonomy[r]==='full'&&s.world.places[r]==='home'&&p.pose!=='sleep'&&!s.activeShifts[r]&&!s.careers.residents[r].shift&&Math.min(p.hunger,p.energy,p.hygiene,p.bladder)>50;
 })&&!s.relationship.recent.some(e=>now-e.at<150&&(FAMILY_ACTIONS as readonly string[]).includes(e.action));
}
export function familyAutoTopics(s:GameState,from:CharacterId):string[]{
 if(!familyAutonomyReady(s))return [];
 const other=from==='vlad'?'alina':'vlad',emotion=residentEmotion(s,other).id;
 const preferred=emotion==='sad'||emotion==='tense'?['nearTalk:listen','nearTalk:compliment','nearTalk:day']:
  ['nearTalk:day','nearTalk:joke','nearTalk:plans','nearTalk:compliment'];
 const recent=s.relationship.recent.at(-1)?.action;
 return preferred.filter(id=>SOCIAL_BY_ID.has(id)&&contextAvailable(SOCIAL_BY_ID.get(id)!,s,from)&&!socialRestriction(SOCIAL_BY_ID.get(id)!,s,from)).sort((a,b)=>Number(a===recent)-Number(b===recent));
}
export function familyAutoLeisure(s:GameState,from:CharacterId):string[]{
 if(!familyAutonomyReady(s))return [];
 const options=['yardRest','musicTogether','sofaTalk'];
 const start=(Math.floor(gameMinutes(s.clock)/125)+(from==='alina'?1:0))%options.length;
 return [...options.slice(start),...options.slice(0,start)].filter(id=>!socialRestriction(SOCIAL_BY_ID.get(id)!,s,from));
}