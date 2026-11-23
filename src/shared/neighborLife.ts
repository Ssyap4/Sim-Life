import { DISTRICT_OBSTACLES, DISTRICT_FLOOR, DISTRICT_SITES, DISTRICT_POND, sitePoint } from './district';
import { findRoute } from '../game/navigation';
import type { NeighborAction, NeighborPose, NeighborProfile } from './neighbors';
import { NEIGHBOR_HOMES, REAR_WALK_Z, homeStops, yardFeatures, type NeighborPoint, type NeighborHome } from './neighborHomes';

type Stop = NeighborPoint & { t: number; action: NeighborAction; yaw: number; inside?: boolean };
type LifeKind = 'garden' | 'tea' | 'mail' | 'errand' | 'stroll' | 'chat' | 'exercise' | 'park' | 'pond' |
  'reading' | 'barbecue' | 'vegetables' | 'flowers' | 'relax';
export type NeighborVisit = { resident: number; home: number; start: number; end: number; kind: LifeKind; companion?: number; venue?: string };
type Plan = NeighborVisit & { steps: Stop[] };
const DAY = 1440;
export const RESIDENT_COUNT = 4;
const HOUSE_ROUTINES: readonly (readonly LifeKind[])[] = [
  // Marina likes flowers, books and long quiet evenings on the bench.
  ['garden','reading','vegetables','barbecue','flowers','errand','tea','stroll','mail'],
  // Denis looks after herbs, keeps the grill and often checks his phone.
  ['tea','vegetables','barbecue','flowers','mail','stroll','reading','park','exercise'],
  // Victoria grows flowers and sometimes reads outside after a coffee.
  ['mail','garden','stroll','tea','exercise','barbecue','flowers','reading','vegetables'],
  // Artyom has a small cabbage patch and a barbecue beside his bench.
  ['vegetables','tea','barbecue','mail','stroll','flowers','reading','errand','relax'],
];
// The ten visitors are not owners of the cottages: they enter the visible
// neighbourhood from the ends of the public streets.
const STREET_ENTRIES: readonly NeighborPoint[] = [
  {x:-19.45,z:30.85},{x:26.55,z:-14.85},
  {x:-26.90,z:-15.35},{x:26.65,z:30.75},
];
const MEETING_SPOTS: readonly NeighborPoint[] = [
  {x:16.65,z:-8.45}, // near the pine park
  {x:-8.45,z:-.52},   // fountain square
];
// Shore viewpoints, not the water or the flowerbeds. Validate through the
// same server-compatible A* before assigning a public outing.
const POND_LOOKOUTS:readonly NeighborPoint[]=[
  {x:DISTRICT_POND.x-3.45,z:DISTRICT_POND.z+.35},
  {x:DISTRICT_POND.x+3.32,z:DISTRICT_POND.z-.45},
  {x:DISTRICT_POND.x-.60,z:DISTRICT_POND.z-3.0},
];
const clamp01=(n:number)=>Math.max(0,Math.min(1,n));
const smooth=(n:number)=>{const t=clamp01(n);return t*t*(3-2*t);};
const dist=(a:NeighborPoint,b:NeighborPoint)=>Math.hypot(a.x-b.x,a.z-b.z);
const yawTo=(a:NeighborPoint,b:NeighborPoint)=>Math.atan2(b.x-a.x,b.z-a.z);
function variation(day:number,slot:number,salt:number):number {
  const n=Math.imul(day+13,0x7feb352d)^Math.imul(slot+117,0x846ca68b)^Math.imul(salt+9,0x9e3779b1);
  return ((Math.imul(n^(n>>>16),0x7feb352d)>>>0)%10007)/10007;
}
class Sequence {
  steps:Stop[];
  constructor(at:NeighborPoint,private readonly pace:number){
    this.steps=[{...at,t:0,action:'look',yaw:0,inside:false}];
  }
  get last(){return this.steps[this.steps.length-1];}
  get elapsed(){return this.last.t;}
  move(to:NeighborPoint):this {
    const from=this.last;
    if(dist(from,to)<.08)return this;
    this.steps.push({...to,t:from.t+Math.max(.65,dist(from,to)/this.pace),
      action:'walk',yaw:yawTo(from,to),inside:false});
    return this;
  }
  hold(action:NeighborAction,duration:number,yaw=this.last.yaw,inside=!!this.last.inside):this {
    this.steps.push({...this.last,t:this.elapsed+duration,action,yaw,inside});
    return this;
  }
  until(minute:number,action:NeighborAction='look'):this {
    if(this.elapsed<minute)this.hold(action,minute-this.elapsed);
    return this;
  }
}
// Shared A* path cache across dates and characters. Unreachable means stay
// away: never replace an invalid path with a straight line through geometry.
const routes=new Map<string,NeighborPoint[]|null>();
const key=(p:NeighborPoint)=>Math.round(p.x*100)+':'+Math.round(p.z*100);
function publicRoute(from:NeighborPoint,to:NeighborPoint):NeighborPoint[]|null {
  const id=key(from)+'>'+key(to);
  const cached=routes.get(id);
  if(cached!==undefined)return cached;
  const path=findRoute(from,to,DISTRICT_OBSTACLES,DISTRICT_FLOOR);
  const answer=path?[{...from},...path]:null;
  routes.set(id,answer);
  return answer;
}
function follow(s:Sequence,path:readonly NeighborPoint[]):void {
  for(const point of path)s.move(point);
}
function reverse(s:Sequence,path:readonly NeighborPoint[]):void {
  for(const point of path.slice(0,-1).reverse())s.move(point);
}
function leaveHouse(s:Sequence,home:NeighborHome,path:readonly NeighborPoint[]):void {
  const stops=homeStops(home);
  s.move(stops.porch).move(stops.gate);
  follow(s,path);
}
function returnHome(s:Sequence,home:NeighborHome,path:readonly NeighborPoint[]):void {
  const stops=homeStops(home);
  reverse(s,path);
  s.move(stops.gate).move(stops.porch).move(stops.door);
}
// The character fades into an actual doorway, stays hidden indoors and
// fades back out at exactly that door before continuing its return route.
function enterVenue(s:Sequence,day:number,seed:number):void {
  s.hold('look',1.2);
  s.hold('look',1.7,s.last.yaw,true);
  s.hold('look',11+variation(day,seed,83)*17,s.last.yaw,true);
  s.hold('look',1.7,s.last.yaw,false);
  s.hold('look',1.4);
}
function homePlan(home:NeighborHome,kind:LifeKind,resident:number,day:number,slot:number):Sequence {
  const stops=homeStops(home),f=variation(day,slot,resident+2);
  const yard=yardFeatures(home,resident);
  const s=new Sequence(stops.door,2.25+.35*f);
  if(kind==='garden'||kind==='flowers') {
    s.move(stops.porch).move(yard.flowerApproach).hold('prune',6+f*5,yard.plantYaw)
      .hold('water',11+f*8,yard.plantYaw).hold('admire',4+f*3,yard.plantYaw)
      .move(stops.porch).move(stops.door);
  } else if(kind==='vegetables') {
    s.move(stops.porch).move(yard.patchApproach)
      .hold('tend',6+f*4,yard.plantYaw).hold('water',10+f*6,yard.plantYaw)
      .hold('harvest',6+f*6,yard.plantYaw).move(stops.porch).move(stops.door);
  } else if(kind==='barbecue') {
    s.move(stops.porch).move(yard.grillApproach)
      .hold('prepareGrill',7+f*3,yard.grillYaw).hold('grill',19+f*9,yard.grillYaw)
      .hold('taste',4+f*3,yard.grillYaw).move(stops.porch).move(stops.door);
  } else if(kind==='reading'||kind==='relax') {
    s.move(stops.porch).move(yard.benchApproach).move(yard.bench)
      .hold(kind==='reading'?'sitRead':'sitPhone',16+f*9,yard.benchYaw)
      .hold(kind==='reading'?'sitSip':'sitRest',8+f*4,yard.benchYaw)
      .move(yard.benchApproach).move(stops.porch).move(stops.door);
  } else if(kind==='tea') {
    // A few sips while approaching the bench retain the standing tea gesture.
    s.move(stops.porch).move(stops.tea).hold('sip',7+3*f,home.yaw)
      .move(yard.benchApproach).move(yard.bench)
      .hold('sitSip',14+6*f,yard.benchYaw)
      .hold(f>.57?'sitPhone':'sitRest',5+4*f,yard.benchYaw)
      .move(yard.benchApproach).move(stops.porch).move(stops.door);
  } else if(kind==='mail') {
    s.move(stops.porch).move(stops.gate).move(stops.mail).hold('mail',9,home.yaw)
      .move(stops.gate).hold('stretch',6).move(stops.porch).hold('look',4).move(stops.door);
  } else if(kind==='exercise') {
    s.move(stops.porch).move(stops.gate).hold('stretch',10,home.yaw)
      .hold('look',5).move(stops.flower).hold('adjust',6).move(stops.door);
  } else {
    const place=DISTRICT_SITES[(resident+slot)%DISTRICT_SITES.length];
    const destination=kind==='park'?DISTRICT_SITES[DISTRICT_SITES.length-1]:place;
    const pondStop=kind==='stroll'&&slot%2===0;
    const target=kind==='stroll'?(pondStop?POND_LOOKOUTS[0]:MEETING_SPOTS[slot%2]):
      sitePoint(destination,0,destination.d/2+.48);
    const path=publicRoute(stops.sidewalk,target);
    if(!path)return homePlan(home,'garden',resident,day,slot);
    leaveHouse(s,home,path);
    if(kind==='stroll'){
      if(pondStop)s.hold('admire',20+f*10,yawTo(s.last,DISTRICT_POND));
      else s.hold('look',9+f*7).hold('phone',4+f*5);
    }else enterVenue(s,day,slot+resident);
    returnHome(s,home,path);
    if(kind==='errand')s.hold('carry',2.4);
  }
  return s;
}
function houseMeeting(home:NeighborHome,meeting:NeighborPoint,other:NeighborPoint):Sequence {
  const stops=homeStops(home),s=new Sequence(stops.door,2.40);
  const path=publicRoute(stops.sidewalk,meeting);
  if(!path)return homePlan(home,'tea',0,0,0);
  leaveHouse(s,home,path);
  s.until(29,'look').hold('chat',24,yawTo(meeting,other)).hold('wave',3,yawTo(meeting,other));
  returnHome(s,home,path);
  return s;
}
function visitorPlan(resident:number,day:number,round:number):Plan|null {
  const origin=STREET_ENTRIES[(resident+round)%STREET_ENTRIES.length];
  const venue=DISTRICT_SITES[(resident-RESIDENT_COUNT+round*3)%DISTRICT_SITES.length];
  const destination=sitePoint(venue,0,venue.d/2+.48);
  const path=publicRoute(origin,destination);
  if(!path)return null;
  const s=new Sequence(origin,2.4+variation(day,resident,round)*.37);
  follow(s,path);
  enterVenue(s,day,resident*7+round);
  // A detour to the pond is an actual walked route, with a 20–30 minute
  // waterfront pause. Other visitors linger by the park before returning.
  const pondTrip=(round===1||round===3)&&resident%3===round%3;
  const lookout=POND_LOOKOUTS[(resident+round)%POND_LOOKOUTS.length];
  const leisureTarget=pondTrip?lookout:venue.place==='park'?MEETING_SPOTS[0]:null;
  if(leisureTarget){
    const stroll=publicRoute(destination,leisureTarget);
    if(stroll){
      follow(s,stroll);
      if(pondTrip)s.hold('admire',20+variation(day,resident,round+51)*10,
        yawTo(s.last,DISTRICT_POND));
      else s.hold('look',13+variation(day,resident,round+51)*7);
      reverse(s,stroll);
    }
  }
  if((resident+round)%5===0)s.hold('checkWatch',3.5);
  if((resident+round)%4===0)s.hold('photograph',5);
  else if((resident+round)%3===0)s.hold('phone',4);
  reverse(s,path);
  return {resident,home:-1,start:0,end:0,kind:venue.place==='park'?'park':'errand',venue:venue.place,steps:s.steps};
}
function publicConversation(day:number,first:number,second:number,spot:NeighborPoint):[Plan,Plan]|null {
  const left={x:spot.x-.80,z:spot.z},right={x:spot.x+.80,z:spot.z};
  const people=[first,second];
  const entries=people.map(id=>STREET_ENTRIES[(id+1)%STREET_ENTRIES.length]);
  // Assign opposite ends of the meeting to the nearest approach: otherwise
  // two friends can cross through one another as they walk to chat.
  const crossed=dist(entries[0],right)+dist(entries[1],left)<
    dist(entries[0],left)+dist(entries[1],right);
  const points=crossed?[right,left]:[left,right];
  const sequences:Sequence[]=[],paths:NeighborPoint[][]=[];
  for(let i=0;i<2;i++){
    const entry=STREET_ENTRIES[(people[i]+1)%STREET_ENTRIES.length];
    const path=publicRoute(entry,points[i]);
    if(!path)return null;
    paths.push(path);
    const s=new Sequence(entry,2.44+.08*variation(day,people[i],4));
    if(i===1)s.hold('look',3); // Do not simultaneously funnel onto a narrow approach.
    follow(s,path);
    sequences.push(s);
  }
  const ready=Math.max(...sequences.map(s=>s.elapsed))+4;
  const conversationMinutes=22+variation(day,first,second)*8;
  for(let i=0;i<2;i++){
    sequences[i].until(ready,'look')
      .hold(i===0?'greet':'wave',2.4,yawTo(points[i],points[1-i]))
      .hold('chat',conversationMinutes,yawTo(points[i],points[1-i]))
      .hold(i===0?'laugh':'listen',3,yawTo(points[i],points[1-i]))
      .hold('wave',2,yawTo(points[i],points[1-i]));
    reverse(sequences[i],paths[i]);
  }
  return [
    {resident:first,home:-1,start:0,end:0,kind:'chat',companion:second,venue:'park',steps:sequences[0].steps},
    {resident:second,home:-1,start:0,end:0,kind:'chat',companion:first,venue:'park',steps:sequences[1].steps},
  ];
}

let cachedDay=NaN,cachedCount=-1,cachedPlans:Plan[]=[];
function sampleSteps(steps:readonly Stop[],local:number):NeighborPoint {
  let i=1;
  while(i<steps.length-1&&steps[i].t<local)i++;
  const a=steps[i-1],b=steps[i],f=clamp01((local-a.t)/Math.max(.001,b.t-a.t));
  return {x:a.x+(b.x-a.x)*f,z:a.z+(b.z-a.z)*f};
}
/** Reservations avoid intersections on a narrow lane, without banning all
 * simultaneous public activity. Shared chat companions intentionally stand
 * face-to-face at 1.6 m. */
function dayPlans(day:number,count:number):Plan[] {
  if(cachedDay===day&&cachedCount===count)return cachedPlans;
  const plans:Plan[]=[];
  const proposals:{group:Plan[];preferred:number}[]=[];
  const queue=(group:Plan[],preferred:number):void=>{proposals.push({group,preferred});};
  const add=(group:Plan[],preferred:number):void=>{
    for(const delay of [0,4,-4,9,-9,15,-15,23,-23,32,-32,43,-43,56,-56]){
      const start=preferred+delay;
      const prepared=group.map(p=>({...p,start,end:start+p.steps[p.steps.length-1].t}));
      if(prepared.some(p=>p.start<440||p.end>1335))continue;
      if(prepared.some(p=>plans.some(other=>p.resident===other.resident&&p.start<other.end&&p.end>other.start)))continue;
      const collision=prepared.some(p=>plans.some(other=>{
        const from=Math.max(p.start,other.start),until=Math.min(p.end,other.end);
        if(from>=until)return false;
        for(let time=from;time<until;time+=.20){
          if(dist(sampleSteps(p.steps,time-p.start),sampleSteps(other.steps,time-other.start))<1.20)return true;
        }
        return false;
      }));
      if(collision)continue;
      plans.push(...prepared);
      return;
    }
  };
  // Four named cottage owners have guaranteed home-only chores and outings.
  for(let round=0;round<9;round++)for(let home=0;home<Math.min(count,RESIDENT_COUNT);home++){
    if((round===4&&home<2)||(round===6&&home>=2))continue;
    const kind=HOUSE_ROUTINES[home][round];
    const start=451+round*99+home*15+Math.floor(variation(day,round,home)*7);
    const s=homePlan(NEIGHBOR_HOMES[home],kind,home,day,round+home);
    queue([{resident:home,home,start:0,end:0,kind,steps:s.steps,
      venue:kind==='park'?'park':kind==='errand'?
        DISTRICT_SITES[(home+round+home)%DISTRICT_SITES.length].place:undefined}],start);
  }
  for(const [a,b,start] of [[0,1,806],[2,3,1042]] as const){
    if(count<=b)continue;
    const center={x:a===0?-13.55:13.45,z:REAR_WALK_Z};
    const left={x:center.x-.78,z:center.z},right={x:center.x+.78,z:center.z};
    const first=houseMeeting(NEIGHBOR_HOMES[a],left,right);
    const second=houseMeeting(NEIGHBOR_HOMES[b],right,left);
    queue([{resident:a,home:a,start:0,end:0,kind:'chat',companion:b,steps:first.steps},
      {resident:b,home:b,start:0,end:0,kind:'chat',companion:a,steps:second.steps}],start);
  }
  // Ten public residents are independent of the cottage door schedule.
  // Each visits several buildings per day, with two public meeting areas.
  for(let round=0;round<5;round++)for(let person=RESIDENT_COUNT;person<count;person++){
    if(round===2){
      if((person-RESIDENT_COUNT)%2 || person+1>=count)continue;
      const pair=(person-RESIDENT_COUNT)/2;
      const talk=publicConversation(day,person,person+1,MEETING_SPOTS[pair%2]);
      if(talk)queue(talk,766+pair*22);
    }else {
      const trip=visitorPlan(person,day,round);
      if(trip)queue([trip],463+round*157+(person-RESIDENT_COUNT)*9+
        Math.floor(variation(day,round,person)*7));
    }
  }
  // Schedule in time order; reserving the entire day for house chores first
  // was starving daytime public traffic even though visitors had valid routes.
  proposals.sort((a,b)=>a.preferred-b.preferred);
  for(const p of proposals)add(p.group,p.preferred);
  plans.sort((a,b)=>a.start-b.start||a.resident-b.resident);
  cachedDay=day;cachedCount=count;cachedPlans=plans;
  return plans;
}
export function neighborVisits(gameMinute:number,neighborCount:number):readonly NeighborVisit[]{
  if(!Number.isFinite(gameMinute))return [];
  return dayPlans(Math.floor(gameMinute/DAY),neighborCount);
}
export function neighborDoorOpen(homeIndex:number,gameMinute:number,neighborCount:number):number {
  if(!Number.isFinite(gameMinute))return 0;
  const day=Math.floor(gameMinute/DAY),time=((gameMinute%DAY)+DAY)%DAY;
  let open=0;
  for(const visit of dayPlans(day,neighborCount)){
    if(visit.home!==homeIndex)continue;
    const depart=smooth((time-(visit.start-2.4))/1.8)*(1-smooth((time-(visit.start+3.1))/1.7));
    const arrive=smooth((time-(visit.end-3.2))/1.35)*(1-smooth((time-(visit.end+2.3))/1.7));
    open=Math.max(open,depart,arrive);
  }
  return open;
}
const hidden:NeighborPose={x:0,z:0,yaw:0,action:'look',visible:false,opacity:0,gestureBlend:0};
export function livingNeighborPose(index:number,gameMinute:number,profiles:readonly NeighborProfile[]):NeighborPose{
  if(!Number.isFinite(gameMinute)||index<0||index>=profiles.length)return hidden;
  const day=Math.floor(gameMinute/DAY),time=((gameMinute%DAY)+DAY)%DAY;
  const plan=dayPlans(day,profiles.length).find(v=>v.resident===index&&time>=v.start&&time<v.end);
  if(!plan)return hidden;
  const local=time-plan.start,keys=plan.steps;
  let step=1;
  while(step<keys.length-1&&keys[step].t<local)step++;
  const from=keys[step-1],to=keys[step],range=Math.max(.0001,to.t-from.t),frac=clamp01((local-from.t)/range);
  let x=to.x,z=to.z,yaw=to.yaw,action:NeighborAction=to.action,blend=0,gait=0;
  if(to.action==='walk'){
    x=from.x+(to.x-from.x)*frac;
    z=from.z+(to.z-from.z)*frac;
    gait=(from.action==='walk'?1:smooth((local-from.t)/.58))*
      (keys[step+1]?.action==='walk'?1:smooth((to.t-local)/.58));
    const desired=yawTo(from,to),turn=Math.atan2(Math.sin(desired-from.yaw),Math.cos(desired-from.yaw));
    yaw=from.yaw+turn*smooth((local-from.t)/.48);
  }else{
    blend=smooth((local-from.t)/.95)*smooth((to.t-local)/.95);
  }
  const fadeIn=smooth(local/1.6),fadeOut=smooth((plan.end-time)/1.6);
  const indoor=from.inside&&to.inside?0:to.inside?1-smooth(frac):from.inside?smooth(frac):1;
  const opacity=fadeIn*fadeOut*indoor;
  return {x,z,yaw,action,visible:opacity>.001,opacity,gestureBlend:blend,
    intent:plan.kind,gait,carrying:plan.kind==='errand'&&local>(plan.end-plan.start)*.54&&
      local<plan.steps[plan.steps.length-1].t-.7};
}

/** Park interior is its own small scene. Visual extras reuse existing GLB rigs
 * and the shared clock; no household or server persistence is required. */
const PARK_VISITORS=[4,7,9,11] as const;
function parkSequence(index:number):Sequence {
  const start=index===4?{x:-.45,z:4.10}:index===7?{x:.65,z:4.10}:
    index===9?{x:1.75,z:4.10}:{x:-1.75,z:4.10};
  const s=new Sequence(start,2.4);
  if(index===4) {
    s.move({x:-2.68,z:3.75}).move({x:-2.68,z:.37}).move({x:-1.10,z:.37})
      .until(17,'look').hold('chat',25,Math.PI/2).hold('wave',2,Math.PI/2)
      .move({x:-2.68,z:.37}).move({x:-2.68,z:3.75});
  }else if(index===7){
    s.move({x:2.52,z:3.75}).move({x:2.52,z:.37}).move({x:.55,z:.37})
      .until(17,'look').hold('chat',25,-Math.PI/2).hold('wave',2,-Math.PI/2)
      .move({x:2.52,z:.37}).move({x:2.52,z:3.75});
  }else if(index===9){
    s.move({x:2.52,z:3.75}).move({x:2.52,z:-2.65})
      .hold('admire',24,-.5).move({x:2.52,z:3.75});
  }else{
    s.move({x:-2.68,z:3.75}).move({x:-2.68,z:-2.65})
      .hold('look',13).hold('phone',9).move({x:-2.68,z:3.75});
  }
  s.move({x:start.x,z:4.10});
  return s;
}
const PARK_SEQUENCES=PARK_VISITORS.map(index=>parkSequence(index));
const PARK_CYCLE=112;
export function parkNeighborPose(index:number,gameMinute:number):NeighborPose {
  if(!Number.isFinite(gameMinute))return hidden;
  const hour=((gameMinute%DAY)+DAY)%DAY;
  if(hour<475||hour>1290)return hidden;
  const order=PARK_VISITORS.indexOf(index as typeof PARK_VISITORS[number]);
  if(order<0)return hidden;
  const offset=order<2?0:(order===2?47:65);
  const local=((hour-475+offset)%PARK_CYCLE+PARK_CYCLE)%PARK_CYCLE;
  const keys=PARK_SEQUENCES[order].steps;
  const end=PARK_SEQUENCES[order].elapsed;
  if(local>=end)return hidden;
  let step=1;
  while(step<keys.length-1&&keys[step].t<local)step++;
  const from=keys[step-1],to=keys[step];
  const ratio=clamp01((local-from.t)/Math.max(.001,to.t-from.t));
  const walking=to.action==='walk';
  const yaw=walking?yawTo(from,to):to.yaw;
  const opacity=smooth(local/1.7)*smooth((end-local)/1.7);
  return {
    x:walking?from.x+(to.x-from.x)*ratio:to.x,
    z:walking?from.z+(to.z-from.z)*ratio:to.z,
    yaw,action:to.action,visible:opacity>.001,opacity,
    gestureBlend:walking?0:smooth((local-from.t)/.9)*smooth((to.t-local)/.9),
    gait:walking?smooth((local-from.t)/.55)*smooth((to.t-local)/.55):0,
    intent:to.action==='admire'?'pond':to.action==='chat'?'chat':'stroll',
  };
}
