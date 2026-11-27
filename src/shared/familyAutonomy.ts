import type {GameState,CharacterId} from './protocol';
import {gameMinutes} from './life';
import {residentEmotion} from './emotions';
import {SOCIAL_BY_ID,contextAvailable,socialRestriction} from './socialLife';
import {weatherAt} from './weather';

const greetings=['nearTalk:welcomeHome','nearTalk:goodMorning','nearTalk:goodNight'] as const;
const casual=['nearTalk:day','nearTalk:joke','nearTalk:plans','nearTalk:compliment','nearTalk:favoriteDay','nearTalk:tomorrowTogether','nearTalk:homeDream','nearTalk:weekendIdeas','nearTalk:ourTradition','nearTalk:whatILove','nearTalk:petDebate','nearTalk:vladStudio','nearTalk:alinaStudio','nearTalk:codeIdeas','nearTalk:hairIdeas','nearTalk:fishingDream','nearTalk:travelDream','nearTalk:bookIdeas'] as const;
const support=['nearTalk:listen','nearTalk:compliment','nearTalk:day','nearTalk:listenWithoutAdvice','nearTalk:shareLoad','nearTalk:smallVictory'] as const;
export const FAMILY_ACTIONS=[...new Set([...greetings,...casual,...support,'yardRest','musicTogether','sofaTalk'])];
const people=['vlad','alina'] as const;
export function familyAutonomyReady(s:GameState):boolean{
 const now=gameMinutes(s.clock);
 return people.every(r=>{
  const p=s.characters[r];
  return s.autonomy[r]==='full'&&s.world.places[r]==='home'&&p.pose!=='sleep'&&!s.activeShifts[r]&&!s.careers.residents[r].shift&&Math.min(p.hunger,p.energy,p.hygiene,p.bladder)>50;
 })&&!s.relationship.recent.some(e=>now>=e.at&&now-e.at<150&&FAMILY_ACTIONS.includes(e.action));
}
const allowed=(s:GameState,from:CharacterId,id:string)=>{
 const a=SOCIAL_BY_ID.get(id);return !!a&&contextAvailable(a,s,from)&&!socialRestriction(a,s,from);
};
export function familyAutoTopics(s:GameState,from:CharacterId):string[]{
 if(!familyAutonomyReady(s))return [];
 const other=from==='vlad'?'alina':'vlad',emotion=residentEmotion(s,other).id;
 const needsSupport=emotion==='sad'||emotion==='tense'||emotion==='lonely';
 const day=s.clock.day,slot=Math.floor(s.clock.minute/180);
 const rotate=(xs:readonly string[])=>{const n=(day+slot+(from==='alina'?3:0))%xs.length;return [...xs.slice(n),...xs.slice(0,n)];};
 const personal=from==='vlad'?['nearTalk:vladStudio','nearTalk:codeIdeas','nearTalk:fishingDream','nearTalk:travelDream']:['nearTalk:alinaStudio','nearTalk:hairIdeas','nearTalk:bookIdeas','nearTalk:travelDream'];
 const special=needsSupport?['nearTalk:listen','nearTalk:compliment','nearTalk:day',...rotate(support)]:[...greetings.slice(1),...((day+slot)%3!==0?rotate(personal):[]),...rotate(casual)];
 const list=[...new Set(['nearTalk:welcomeHome',...special])];
 const last=s.relationship.recent.at(-1)?.action;
 return list.filter(id=>allowed(s,from,id)).sort((a,b)=>Number(a===last)-Number(b===last));
}
/** The resident who is waiting at home greets the actual returning partner.
 * Otherwise support the resident with lower social/mood, then alternate. */
export function familyAutoInitiator(s:GameState,fallback:CharacterId):CharacterId{
 if(!familyAutonomyReady(s))return fallback;
 for(const role of people)if(allowed(s,role,'nearTalk:welcomeHome'))return role;
 const score=(r:CharacterId)=>Math.min(s.characters[r].social,s.characters[r].mood);
 if(score('vlad')+15<score('alina'))return 'alina';
 if(score('alina')+15<score('vlad'))return 'vlad';
 return fallback;
}
export function familyAutoLeisure(s:GameState,from:CharacterId):string[]{
 if(!familyAutonomyReady(s))return [];
 const weather=weatherAt(s.clock),night=s.clock.minute>=1260||s.clock.minute<360;
 const outside=!night&&!['rain','storm','snow'].includes(weather.kind);
 const options=outside?['yardRest','musicTogether','sofaTalk']:['musicTogether','sofaTalk'];
 const start=(Math.floor(gameMinutes(s.clock)/125)+(from==='alina'?1:0))%options.length;
 return [...options.slice(start),...options.slice(0,start)].filter(id=>allowed(s,from,id));
}
