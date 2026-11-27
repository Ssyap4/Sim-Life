import type {CharacterId,GameState,TimedCommand} from './protocol';
import type {AutoChoice} from './autonomy';
import type {HomeLeisure} from './home';
import type {PetId} from './pets';
import {leisureKind,residentEmotion} from './emotions';
import {weatherAt} from './weather';
export type FullHistory={key:string;group:string}[];
export function autoPetAvailable(s:GameState,id:PetId):boolean{
 const p=s.pets[id];
 return !(id==='verdell'&&s.world.dogWalker)&&s.world.vetVisit?.pet!==id&&
 p.energy>=30&&p.satiety>=25&&p.bladder>=30&&
 !['eat','sleep','toilet','bath','bedTogether','train','fetch','come','perch','scratch','toy'].includes(p.routine?.kind??'');
}
export function activityIdentity(c:TimedCommand):FullHistory[number]{
 if(c.type==='pet_action')return {key:'pet:'+c.pet+':'+c.action,group:'pet'};
 const group=leisureKind(c);
 const key=c.type==='act'?c.actionId:c.type==='furniture_use'?c.action:c.type;
 return {key,group:group==='other'?key:group};
}
export function rememberFull(history:FullHistory,entry:FullHistory[number]):FullHistory{
 return [...history,entry].slice(-6);
}
/** Recent real starts, not rejected suggestions. Context alters rank, not task rules. */
export function rankFull<T extends TimedCommand>(s:GameState,role:CharacterId,actions:readonly T[],history:FullHistory):T[]{
 const p=s.characters[role],night=s.clock.minute>=1320||s.clock.minute<360;
 const score=(c:T,i:number)=>{
  const {key,group}=activityIdentity(c);
  let value=-i*.12;
  for(let n=0;n<history.length;n++){const last=history[n],weight=1+(n+1)/history.length;
   if(last.key===key)value-=5*weight;else if(last.group===group)value-=1.7*weight;
  }
  if(night){if(['rest','reading','music'].includes(group))value+=3;if(['games','study','social'].includes(group))value-=3;}
  if(p.energy<65&&['rest','reading','music'].includes(group))value+=3;
  if(c.type==='pet_action'){const pet=s.pets[c.pet];value+=(100-pet.happiness)*.055+(100-pet.bond)*.018;}
  return value;
 };
 return actions.filter(c=>c.type!=='pet_action'||autoPetAvailable(s,c.pet)).map((c,i)=>({c,score:score(c,i)})).sort((a,b)=>b.score-a.score).map(x=>x.c);
}
export function fullIdleChoices(s:GameState,role:CharacterId,turn:number,recent:readonly HomeLeisure[]):HomeLeisure[]{
 const options:HomeLeisure[]=role==='vlad'?['computer','tv','simba','verdell','stroll']:['verdell','tv','simba','computer','stroll'];
 const night=s.clock.minute>=1320||s.clock.minute<360,w=weatherAt(s.clock);
 const e=residentEmotion(s,role).id;
 return options.map((_,i)=>options[(i+turn)%options.length]).filter(a=>
  (a!=='stroll'||!night&&!['rain','storm','snow'].includes(w.kind))&&
  (a!=='simba'&&a!=='verdell'||autoPetAvailable(s,a))
 ).map((a,i)=>({a,score:-i*.2-recent.reduce((n,r,j)=>n+(r===a?2+j:0),0)+(a==='tv'&&e==='tired'?2:0)+(a==='stroll'&&s.characters[role].energy>75?1:0)})).sort((a,b)=>b.score-a.score).map(x=>x.a);
}

/** Rotate ways of satisfying the same need, never move a leisure choice
 * ahead of a more urgent physical need or cook ahead of ready food. */
export function rankCareChoices(s:GameState,role:CharacterId,choices:AutoChoice[],history:FullHistory):AutoChoice[]{
  const groups=new Map<AutoChoice['need'],AutoChoice[]>();
  for(const c of choices){const group=groups.get(c.need)??[];group.push(c);groups.set(c.need,group);}
  const result:AutoChoice[]=[];
  for(const [need,group] of groups){
    if(need==='fun'||need==='social'||need==='comfort'){
      const sorted=rankFull(s,role,group.map(c=>c.command),history);
      for(const command of sorted)result.push(group.find(c=>c.command===command)!);
    }else result.push(...group);
  }
  return result;
}