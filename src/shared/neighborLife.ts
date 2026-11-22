import { DISTRICT_OBSTACLES, DISTRICT_FLOOR, DISTRICT_SITES, sitePoint } from './district';
import { findRoute } from '../game/navigation';
import type { NeighborAction, NeighborPose, NeighborProfile } from './neighbors';
import { NEIGHBOR_HOMES, REAR_WALK_Z, homeStops, type NeighborPoint, type NeighborHome } from './neighborHomes';

type Stop = NeighborPoint & { t: number; action: NeighborAction; yaw: number; inside?: boolean };
type LifeKind = 'garden' | 'tea' | 'mail' | 'errand' | 'stroll' | 'chat' | 'exercise';
export type NeighborVisit = { resident: number; home: number; start: number; end: number; kind: LifeKind; companion?: number };
type Plan = NeighborVisit & { steps: Stop[] };

const DAY = 1440;
const habits: readonly (readonly LifeKind[])[] = [
  ['garden','garden','tea','stroll'], ['exercise','errand','mail','stroll'],
  ['tea','errand','stroll','mail'], ['exercise','stroll','exercise','tea'],
  ['garden','stroll','tea','stroll'], ['stroll','mail','garden','errand'],
  ['tea','garden','stroll','tea'], ['errand','exercise','mail','stroll'],
  ['stroll','garden','stroll','mail'], ['tea','exercise','stroll','stroll'],
  ['garden','tea','mail','stroll'], ['mail','errand','garden','exercise'],
  ['tea','garden','stroll','garden'], ['mail','stroll','exercise','stroll'],
];

function variation(day:number, slot:number, salt:number) {
  const n=Math.imul(day+13,0x7feb352d)^Math.imul(slot+117,0x846ca68b)^Math.imul(salt+9,0x9e3779b1);
  return ((Math.imul(n^(n>>>16),0x7feb352d)>>>0)%10007)/10007;
}

const SLOTS: readonly { start: number; home: number; kind: LifeKind; withHome?: number }[] = [
  {start:462,home:0,kind:'garden'},
  {start:480,home:1,kind:'tea'},
  {start:508,home:2,kind:'mail'},
  {start:529,home:3,kind:'garden'},
  {start:555,home:1,kind:'garden'},
  {start:579,home:0,kind:'mail'},
  {start:607,home:2,kind:'tea'},
  {start:637,home:3,kind:'exercise'},
  {start:670,home:0,kind:'tea'},
  {start:693,home:1,kind:'mail'},
  {start:723,home:3,kind:'garden'},
  {start:747,home:2,kind:'exercise'},
  {start:806,home:0,kind:'chat',withHome:1},
  {start:839,home:2,kind:'garden'},
  {start:867,home:3,kind:'tea'},
  {start:910,home:0,kind:'garden'},
  {start:938,home:1,kind:'tea'},
  {start:968,home:2,kind:'errand'},
  {start:991,home:3,kind:'garden'},
  {start:1043,home:2,kind:'chat',withHome:3},
  {start:1062,home:1,kind:'exercise'},
  {start:1108,home:0,kind:'mail'},
  {start:1136,home:3,kind:'tea'},
  {start:1166,home:2,kind:'garden'},
  {start:1197,home:0,kind:'tea'},
  {start:1220,home:1,kind:'mail'},
  {start:1250,home:3,kind:'stroll'},
];
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => { const x = clamp01(v); return x * x * (3 - 2 * x); };
const dist = (a: NeighborPoint, b: NeighborPoint) => Math.hypot(a.x - b.x, a.z - b.z);
const yawTo = (a: NeighborPoint, b: NeighborPoint) => Math.atan2(b.x-a.x, b.z-a.z);

class Sequence {
  steps: Stop[];
  constructor(at: NeighborPoint, private readonly pace:number) { this.steps = [{ ...at, t: 0, action: 'look', yaw: 0 }]; }
  get last() { return this.steps[this.steps.length-1]; }
  get elapsed() { return this.last.t; }
  move(to: NeighborPoint): this {
    const from = this.last;
    if(dist(from,to)<.08) return this;
    const duration = Math.max(.65, dist(from,to)/this.pace);
    this.steps.push({ ...to, t: from.t+duration, action: 'walk', yaw: yawTo(from,to) });
    return this;
  }
  hold(action: NeighborAction, duration: number, yaw = this.last.yaw): this {
    const s=this.last;
    this.steps.push({ ...s, t: s.t + duration, action, yaw });
    return this;
  }
  until(minute: number, action: NeighborAction = 'look'): this {
    if(this.elapsed<minute) this.hold(action,minute-this.elapsed);
    return this;
  }
}

// Neighbor plans are shared across days. Cache the static routes: the
// entire district's A* is too expensive to recompute for each trip home.
const publicPaths=new Map<string,NeighborPoint[]|null>();
function publicRoute(home:NeighborHome,to:NeighborPoint):NeighborPoint[]|null {
  const key=home.id+':'+Math.round(to.x*100)+':'+Math.round(to.z*100);
  const cached=publicPaths.get(key);
  if(cached!==undefined)return cached;
  const sidewalk=homeStops(home).sidewalk;
  const path=findRoute(sidewalk,to,DISTRICT_OBSTACLES,DISTRICT_FLOOR);
  const route=path?[sidewalk,...path]:null;
  publicPaths.set(key,route);
  return route;
}
function outward(s:Sequence,home:NeighborHome,way:readonly NeighborPoint[]):void {
  const stops=homeStops(home);
  s.move(stops.porch).move(stops.gate);
  for(const p of way)s.move(p);
}
function inbound(s:Sequence,home:NeighborHome,way:readonly NeighborPoint[]):void {
  const stops=homeStops(home);
  for(const p of way.slice(0,-1).reverse())s.move(p);
  s.move(stops.gate).move(stops.porch).move(stops.door);
}

function singlePlan(home: NeighborHome, kind: LifeKind, resident:number, day:number, slot:number): Sequence {
  const stops=homeStops(home);
  const f=variation(day,slot,2);
  const s=new Sequence(stops.door,2.44 + .32*variation(resident,slot,3));
  if(kind==='garden') {
    s.move(stops.porch).move(stops.flower).hold('water',11+6*f,home.yaw-.48)
      .hold('look',3+f*3).move(stops.mail).hold('mail',4+f*3,home.yaw).move(stops.door);
  } else if(kind==='tea') {
    s.move(stops.porch).move(stops.tea).hold('sip',13+6*f,home.yaw)
      .hold(f>.57?'phone':'look',4+4*f).move(stops.flower).hold('look',4,home.yaw-.45).move(stops.door);
  } else if(kind==='mail') {
    s.move(stops.porch).move(stops.mail).hold('mail',9,home.yaw)
      .move(stops.flower).hold('stretch',6).move(stops.porch)
      .hold('look',4).move(stops.door);
  } else if(kind==='exercise') {
    s.move(stops.porch).move(stops.gate).hold('stretch',10,home.yaw)
      .hold('look',5).move(stops.flower).hold('adjust',4).move(stops.door);
  } else {
    const base=stops.sidewalk;
    const distance=4.0+6*f;
    const west=home.x<0;
    const destinations = DISTRICT_SITES.filter(site=>site.place==='market'||site.place==='cafe');
    const destination = destinations[Math.floor(variation(day,resident,slot+13)*destinations.length)];
    // Finish at a collision-safe point right in front of the actual door.
    // Do NOT step inside the facade obstacle to fake the indoor transition.
    const target=kind==='errand'
      ? sitePoint(destination,0,destination.d/2+.45)
      : f>.62?{x:west?-15.77:11.55,z:-10.18}
        :{x:Math.max(-24,Math.min(24,base.x+(west?distance:-distance))),z:base.z};
    const route=publicRoute(home,target);
    // A closed route is not permission to walk in a straight line through
    // buildings. Stay near home instead of inventing a path.
    if(!route)return singlePlan(home,'garden',resident,day,slot);
    outward(s,home,route);
    if(kind==='errand'){
      s.hold('look',10+f*5);
      s.last.inside=true;
    } else s.hold('look',4+f*5);
    if(kind==='stroll')s.hold(f>.47?'stretch':'look',3+3*f);
    inbound(s,home,route);
    if(kind==='errand') {
      // Groceries carried home from outside; no purchases, inventory or costs.
      s.hold('carry',3);
    }
  }
  return s;
}

function rendezvous(home: NeighborHome, meeting: NeighborPoint, right: boolean): Sequence {
  const stops=homeStops(home);
  const s=new Sequence(stops.door,2.63);
  const route=publicRoute(home,meeting);
  if(!route)return s.move(stops.porch).hold('look',28).move(stops.door);
  outward(s,home,route);
  s.until(29,'look');
  const other={x:meeting.x+(right?-1.52:1.52),z:meeting.z};
  s.hold('chat',18,yawTo(meeting,other));
  s.hold('wave',3,yawTo(meeting,other));
  inbound(s,home,route);
  return s;
}

function chooseResident(day:number,home:number,slot:number,count:number):number {
  const members=Array.from({length:count},(_,i)=>i).filter(i=>i%NEIGHBOR_HOMES.length===home);
  return members[(day+slot*7+Math.floor(variation(day,slot,home)*members.length))%members.length];
}

let cachedDay=NaN;
let cachedCount=-1;
let cachedPlans:Plan[]=[];

function sampleSteps(steps:Stop[], local:number):NeighborPoint {
  let index=1;
  while(index<steps.length-1&&steps[index].t<local)index++;
  const from=steps[index-1],to=steps[index];
  const t=clamp01((local-from.t)/Math.max(.001,to.t-from.t));
  return {x:from.x+(to.x-from.x)*t,z:from.z+(to.z-from.z)*t};
}

function dayPlans(day:number,count:number):Plan[] {
  if(cachedDay===day && cachedCount===count)return cachedPlans;
  const plans:Plan[]=[];
  const admit=(group:Plan[])=>{
    for(const delay of [0,3,-3,6,-6,9,12,16,-9]){
      const shifted=group.map(row=>({...row,start:row.start+delay,end:row.end+delay}));
      if(shifted.some(row=>row.start<450||row.end>1290))continue;
      const available=shifted.every(row=>!plans.some(other=>{
        const left=Math.max(row.start,other.start),right=Math.min(row.end,other.end);
        if(left>=right)return false;
        if(row.home===other.home || row.resident===other.resident)return true;
        for(let time=left;time<right;time+=.45)
          if(dist(sampleSteps(row.steps,time-row.start),sampleSteps(other.steps,time-other.start))<1.10)return true;
        return false;
      }));
      if(available){plans.push(...shifted);return;}
    }
  };
  SLOTS.forEach((slot,index)=>{
    const start=slot.start+Math.round((variation(day,index,1)-.5)*19);
    const first=chooseResident(day,slot.home,index,count);
    const home=NEIGHBOR_HOMES[slot.home];
    if(slot.kind!=='chat' || slot.withHome===undefined) {
      const options=habits[first%habits.length];
      const random=variation(day,index,43);
      let scene=slot.kind;
      // Residents have personal preferences, and the same slot plays out
      // differently on a different day. Public outings stay occasional.
      if(index>3 && random<.54){
        const preferred=options[Math.floor(variation(day,index,first)*options.length)];
        if((preferred!=='errand'&&preferred!=='stroll') || (index%5===2 && random<.22))scene=preferred;
      }
      const seq=singlePlan(home,scene,first,day,index);
      admit([{resident:first,home:slot.home,start,end:start+seq.elapsed,kind:scene,steps:seq.steps}]);
      return;
    }
    const second=chooseResident(day,slot.withHome,index+2,count);
    const centerX=slot.home===0?-13.55:13.45;
    const firstRight=slot.home>slot.withHome;
    const a={x:centerX+(firstRight?.78:-.78),z:REAR_WALK_Z};
    const b={x:centerX+(firstRight?-.78:.78),z:REAR_WALK_Z};
    const sa=rendezvous(home,a,firstRight);
    const sb=rendezvous(NEIGHBOR_HOMES[slot.withHome],b,!firstRight);
    admit([{resident:first,home:slot.home,start,end:start+sa.elapsed,kind:'chat',companion:second,steps:sa.steps},
      {resident:second,home:slot.withHome,start,end:start+sb.elapsed,kind:'chat',companion:first,steps:sb.steps}]);
  });
  cachedDay=day;
  cachedCount=count;
  cachedPlans=plans;
  return plans;
}

export function neighborVisits(gameMinute:number, neighborCount:number):readonly NeighborVisit[] {
  if(!Number.isFinite(gameMinute))return [];
  return dayPlans(Math.floor(gameMinute/DAY),neighborCount);
}

/** Doors open just BEFORE an NPC emerges and stay open until the return
 * finishes. Deterministic, even when the owner is currently invisible. */
export function neighborDoorOpen(homeIndex:number, gameMinute:number, neighborCount:number):number {
  if(!Number.isFinite(gameMinute))return 0;
  const day=Math.floor(gameMinute/DAY);
  const local=((gameMinute%DAY)+DAY)%DAY;
  let opening=0;
  for(const visit of dayPlans(day,neighborCount)) {
    if(visit.home!==homeIndex)continue;
    const depart=smooth((local-(visit.start-2.4))/1.8)*
      (1-smooth((local-(visit.start+3.1))/1.7));
    const arrive=smooth((local-(visit.end-3.2))/1.35)*
      (1-smooth((local-(visit.end+2.3))/1.7));
    opening=Math.max(opening,depart,arrive);
  }
  return opening;
}

const hidden:NeighborPose={x:0,z:0,yaw:0,action:'look',visible:false,opacity:0,gestureBlend:0};

export function livingNeighborPose(index:number,gameMinute:number,profiles:readonly NeighborProfile[]):NeighborPose {
  if(!Number.isFinite(gameMinute)||index<0||index>=profiles.length)return hidden;
  const day=Math.floor(gameMinute/DAY);
  const time=((gameMinute%DAY)+DAY)%DAY;
  const plan=dayPlans(day,profiles.length).find(v=>v.resident===index && time>=v.start && time<v.end);
  if(!plan)return hidden;
  const local=time-plan.start;
  const keys=plan.steps;
  let step=1;
  while(step<keys.length-1&&keys[step].t<local)step++;
  const from=keys[step-1],to=keys[step];
  const range=Math.max(.0001,to.t-from.t);
  const frac=clamp01((local-from.t)/range);
  let x=to.x,z=to.z,yaw=to.yaw;
  let action:NeighborAction=to.action;
  let blend=0,gait=0;
  if(to.action==='walk') {
    x=from.x+(to.x-from.x)*frac;
    z=from.z+(to.z-from.z)*frac;
    gait=(from.action==='walk'?1:smooth((local-from.t)/.58)) *
      (keys[step+1]?.action==='walk'?1:smooth((to.t-local)/.58));
    const desired=yawTo(from,to);
    const turn=Math.atan2(Math.sin(desired-from.yaw),Math.cos(desired-from.yaw));
    yaw=from.yaw+turn*smooth((local-from.t)/.48);
  } else {
    // Every short activity has its own soft start/end; stationary talkers
    // do not slide or keep "walking" in place.
    blend=smooth((local-from.t)/.95)*smooth((to.t-local)/.95);
    action=to.action;
  }
  // Doors are the only entrance/exit. We fade only when passing *through*
  // the doorway, never in the middle of a visible street.
  const fadeIn=smooth(local/1.6);
  const fadeOut=smooth((plan.end-time)/1.6);
  const indoor=to.inside ? 1-smooth((local-from.t)/.85)
    : from.inside ? smooth((local-from.t)/.85) : 1;
  const opacity=fadeIn*fadeOut*indoor;
  return {x,z,yaw,action,visible:opacity>.001,opacity,gestureBlend:blend,
    intent:plan.kind,gait,
    carrying:plan.kind==='errand' && local>(plan.end-plan.start)*.54 && local<plan.steps[plan.steps.length-1].t-.7};
}
