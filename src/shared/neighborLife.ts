import type { NeighborAction, NeighborPose, NeighborProfile } from './neighbors';
import { NEIGHBOR_HOMES, REAR_WALK_Z, homeStops, type NeighborPoint, type NeighborHome } from './neighborHomes';

type Stop = NeighborPoint & { t: number; action: NeighborAction; yaw: number };
type LifeKind = 'garden' | 'tea' | 'mail' | 'errand' | 'stroll' | 'chat' | 'exercise';
export type NeighborVisit = { resident: number; home: number; start: number; end: number; kind: LifeKind; companion?: number };
type Plan = NeighborVisit & { steps: Stop[] };

const DAY = 1440;
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
  constructor(at: NeighborPoint) { this.steps = [{ ...at, t: 0, action: 'look', yaw: 0 }]; }
  get last() { return this.steps[this.steps.length-1]; }
  get elapsed() { return this.last.t; }
  move(to: NeighborPoint): this {
    const from = this.last;
    if(dist(from,to)<.08) return this;
    const duration = Math.max(.65, dist(from,to)/2.30);
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

function publicRoute(home:NeighborHome,to:NeighborPoint):NeighborPoint[]{
  return [homeStops(home).sidewalk,to];
}
function outward(s: Sequence, home: NeighborHome, destination: NeighborPoint): void {
  const stops=homeStops(home);
  s.move(stops.porch).move(stops.gate);
  for(const p of publicRoute(home,destination))s.move(p);
}
function inbound(s: Sequence, home: NeighborHome, destination: NeighborPoint): void {
  const stops=homeStops(home);
  const way=publicRoute(home,destination);
  for(const p of way.slice(0,-1).reverse())s.move(p);
  s.move(stops.gate).move(stops.porch).move(stops.door);
}

function singlePlan(home: NeighborHome, kind: LifeKind): Sequence {
  const stops=homeStops(home);
  const s=new Sequence(stops.door);
  if(kind==='garden') {
    s.move(stops.porch).move(stops.flower).hold('water',15,home.yaw-.48)
      .hold('look',4).move(stops.mail).hold('mail',5,home.yaw).move(stops.door);
  } else if(kind==='tea') {
    s.move(stops.porch).move(stops.tea).hold('sip',18,home.yaw)
      .hold('phone',6).move(stops.flower).hold('look',4,home.yaw-.45).move(stops.door);
  } else if(kind==='mail') {
    s.move(stops.porch).move(stops.mail).hold('mail',9,home.yaw)
      .move(stops.flower).hold('stretch',6).move(stops.porch)
      .hold('look',4).move(stops.door);
  } else if(kind==='exercise') {
    s.move(stops.porch).move(stops.gate).hold('stretch',10,home.yaw)
      .hold('look',5).move(stops.flower).hold('adjust',4).move(stops.door);
  } else {
    const base=stops.sidewalk;
    // Public walks are deliberately rare. Most outings stay in the plots.
    const distance=kind==='errand'?7.5:5.4;
    const target={x:Math.max(-24,Math.min(24,base.x+(home.x<0?distance:-distance))),z:base.z};
    outward(s,home,target);
    s.hold(kind==='errand'?'phone':'look',6);
    if(kind==='stroll')s.hold('stretch',3);
    inbound(s,home,target);
    if(kind==='errand') {
      // Groceries carried home from outside; no purchases, inventory or costs.
      s.hold('carry',3);
    }
  }
  return s;
}

function rendezvous(home: NeighborHome, meeting: NeighborPoint, right: boolean): Sequence {
  const s=new Sequence(homeStops(home).door);
  outward(s,home,meeting);
  s.until(29,'look');
  const other={x:meeting.x+(right?-1.52:1.52),z:meeting.z};
  s.hold('chat',18,yawTo(meeting,other));
  s.hold('wave',3,yawTo(meeting,other));
  inbound(s,home,meeting);
  return s;
}

function chooseResident(day:number,home:number,slot:number,count:number):number {
  const members=Array.from({length:count},(_,i)=>i).filter(i=>i%NEIGHBOR_HOMES.length===home);
  return members[(day*5+slot*2)%members.length];
}

let cachedDay=NaN;
let cachedCount=-1;
let cachedPlans:Plan[]=[];

function dayPlans(day:number,count:number):Plan[] {
  if(cachedDay===day && cachedCount===count)return cachedPlans;
  const plans:Plan[]=[];
  SLOTS.forEach((slot,index)=>{
    const start=slot.start + ((day*13+index*7)%11-5);
    const first=chooseResident(day,slot.home,index,count);
    const home=NEIGHBOR_HOMES[slot.home];
    if(slot.kind!=='chat' || slot.withHome===undefined) {
      const scene=slot.kind==='garden'&&day%4===3?'exercise'
      :slot.kind==='mail'&&day%5===4?'garden':slot.kind;
      const seq=singlePlan(home,scene);
      plans.push({resident:first,home:slot.home,start,end:start+seq.elapsed,kind:scene,steps:seq.steps});
      return;
    }
    const second=chooseResident(day,slot.withHome,index+2,count);
    const centerX=slot.home===0?-13.55:13.45;
    const firstRight=slot.home>slot.withHome;
    const a={x:centerX+(firstRight?.78:-.78),z:REAR_WALK_Z};
    const b={x:centerX+(firstRight?-.78:.78),z:REAR_WALK_Z};
    const sa=rendezvous(home,a,firstRight);
    const sb=rendezvous(NEIGHBOR_HOMES[slot.withHome],b,!firstRight);
    plans.push({resident:first,home:slot.home,start,end:start+sa.elapsed,kind:'chat',companion:second,steps:sa.steps});
    plans.push({resident:second,home:slot.withHome,start,end:start+sb.elapsed,kind:'chat',companion:first,steps:sb.steps});
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
  let from=keys[0],to=keys[keys.length-1];
  for(let i=1;i<keys.length;i++)if(local<=keys[i].t){to=keys[i];from=keys[i-1];break;}
  const range=Math.max(.0001,to.t-from.t);
  const frac=clamp01((local-from.t)/range);
  let x=to.x,z=to.z,yaw=to.yaw;
  let action:NeighborAction=to.action;
  let blend=0;
  if(to.action==='walk') {
    x=from.x+(to.x-from.x)*frac;
    z=from.z+(to.z-from.z)*frac;
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
  const opacity=fadeIn*fadeOut;
  return {x,z,yaw,action,visible:opacity>.001,opacity,gestureBlend:blend,
    carrying:plan.kind==='errand' && local>14 && local<plan.steps[plan.steps.length-1].t-.7};
}
