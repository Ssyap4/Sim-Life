import { pointIsClear, segmentIsClear, type FloorPoint, type FloorRect } from './navigation';

export type TrafficBody = {
  position: FloorPoint;
  clearance: number;
  /** Only other adult avatars may briefly pass closer. Pets retain full clearance. */
  person?: boolean;
  moving?: boolean;
};

export type ResidentTraffic = {
  side: 1 | -1;
  stalled: number;
  yielding: number;
  free: number;
  bypass?: { body:FloorPoint; waypoints:readonly [FloorPoint,FloorPoint]; index:number };
};

/** State belongs to one actor, so a passing lane stays consistent across frames. */
export const residentTraffic = (): ResidentTraffic => ({
  side: 1, stalled: 0, yielding: 0, free: 0,
});

export function resetResidentTraffic(state: ResidentTraffic): void {
  state.side = 1;
  state.stalled = 0;
  state.yielding = 0;
  state.free = 0;
  state.bypass = undefined;
}

function sweep(from: FloorPoint, to: FloorPoint, body: FloorPoint, clearance: number): boolean {
  const dx = to.x - from.x, dz = to.z - from.z;
  const x = from.x - body.x, z = from.z - body.z;
  const travel = dx * dx + dz * dz;
  if (travel < 1e-10) return true;
  const dot = x * dx + z * dz;
  // An actor who is already slightly close may only move away, never
  // be forcibly snapped to the rim of the exclusion circle.
  if (x * x + z * z < clearance * clearance) return dot >= 0;
  const t = Math.max(0, Math.min(1, -dot / travel));
  return (x + dx * t) ** 2 + (z + dz * t) ** 2 >= clearance * clearance;
}

/** Steering is visual-only. No server coordinates, player tasks, or pets are displaced.
 * Unlike repeated one-frame right/left guesses, the selected passing side is
 * held until the route has been clear long enough to reset.
 */
export function smoothResidentTrafficStep(
  from: FloorPoint,
  desired: FloorPoint,
  bodies: readonly TrafficBody[],
  obstacles: readonly FloorRect[],
  floor: FloorRect,
  state: ResidentTraffic,
  dt: number,
  yieldToOncoming = false,
): FloorPoint {
  const dx = desired.x - from.x, dz = desired.z - from.z;
  const length = Math.hypot(dx, dz);
  if (length < 1e-7) return desired;
  if (!bodies.length) {
    resetResidentTraffic(state);
    return desired;
  }

  const speedTime = Math.min(Math.max(dt, 0), .20);
  const nearPerson = bodies.some(body => body.person &&
    Math.hypot(body.position.x-from.x,body.position.z-from.z) < 1.45);
  const safeStatic = (next:FloorPoint) =>
    segmentIsClear(from,next,obstacles,floor) || !pointIsClear(from,obstacles,floor);
  const passes = (next:FloorPoint, recovery:number) => bodies.every(body => {
    // Full clearance is the norm. When movement has failed for long enough,
    // a human may pass closer without ever ignoring furniture or pet bodies.
    const min = body.person ? Math.max(.54, body.clearance * (1 - .38 * recovery)) : body.clearance;
    return sweep(from,next,body.position,min);
  });

  // Two adults meeting nose-to-nose must not both continuously try to dodge
  // one another. Vlad politely waits while Alina takes the narrow lane.
  // The wait is bounded: a blocked partner eventually gets a soft-pass fallback.
  if (yieldToOncoming && nearPerson && state.yielding < 1.05) {
    state.yielding += speedTime;
    state.stalled += speedTime;
    state.free = 0;
    return from;
  }
  if (!yieldToOncoming) state.yielding = 0;

  const recovery = Math.min(1,Math.max(0,(state.stalled-.48)/.87));
  // Persistent detour around a *stationary* person: compute the route once
  // instead of alternately side-stepping toward and away from the target.
  // Moving residents still use the dynamic oncoming/yielding flow below.
  const followBypass=():FloorPoint|undefined=>{
    const path=state.bypass;
    if(!path)return;
    const person=bodies.find(b=>b.person&&!b.moving);
    if(!person||Math.hypot(person.position.x-path.body.x,person.position.z-path.body.z)>.22){
      state.bypass=undefined;
      return;
    }
    const point=path.waypoints[path.index];
    const distance=Math.hypot(point.x-from.x,point.z-from.z);
    if(distance<.035){
      path.index++;
      if(path.index>=path.waypoints.length){state.bypass=undefined;state.stalled=0;return;}
      return followBypass();
    }
    const fraction=Math.min(1,length/distance);
    const next={x:from.x+(point.x-from.x)*fraction,z:from.z+(point.z-from.z)*fraction};
    if(!safeStatic(next)||!passes(next,1)){state.bypass=undefined;return;}
    if(fraction===1){
      path.index++;
      if(path.index>=path.waypoints.length){state.bypass=undefined;state.stalled=0;}
    }
    return next;
  };
  if(state.bypass){const step=followBypass();if(step)return step;}
  if (passes(desired,recovery) && safeStatic(desired)) {
    state.stalled = Math.max(0,state.stalled-speedTime*2);
    state.free += speedTime;
    if (state.free > .65) resetResidentTraffic(state);
    return desired;
  }
  state.free = 0;
  const waitingPerson=bodies.find(b=>b.person&&!b.moving &&
    !sweep(from,desired,b.position,b.clearance));
  if(waitingPerson){
    const bx=waitingPerson.position.x,bz=waitingPerson.position.z;
    const ux=dx/length,uz=dz/length;
    const passingSides:(1|-1)[]=[state.side,state.side===1?-1:1];
    for(const side of passingSides){
      const sideOffset=.60*side;
      const entry={x:bx-ux*.72-uz*sideOffset,z:bz-uz*.72+ux*sideOffset};
      const exit={x:bx+ux*.72-uz*sideOffset,z:bz+uz*.72+ux*sideOffset};
      if(!pointIsClear(entry,obstacles,floor)||!pointIsClear(exit,obstacles,floor)||
          !segmentIsClear(entry,exit,obstacles,floor)||!segmentIsClear(from,entry,obstacles,floor)||
          !passes(entry,1)||!bodies.every(b=>sweep(entry,exit,b.position,b.person ? .54 : b.clearance)))continue;
      state.side=side;
      state.bypass={body:{x:bx,z:bz},waypoints:[entry,exit],index:0};
      const step=followBypass();
      if(step)return step;
      state.bypass=undefined;
    }
  }
  // These angles always have nonnegative progress along the original
  // route, avoiding the abrupt backward steps of the old ±136° search.
  const angles = [.46,.74,1.01,1.25,1.53];
  const candidate = (side:1|-1):FloorPoint|undefined => {
    for (const angle of angles) for(const fraction of [1,.55,.26]) {
      // Small sub-steps let a slow frame navigate around doorway corners
      // without jumping over a safe tangent and getting wedged behind a wall.
      const cos = Math.cos(angle), sin = Math.sin(angle) * side;
      const next = {x:from.x+fraction*(dx*cos-dz*sin),z:from.z+fraction*(dx*sin+dz*cos)};
      if (passes(next,recovery) && safeStatic(next)) return next;
    }
  };
  let result = candidate(state.side);
  // Don't alternate sides on adjacent frames. A sustained obstacle may force
  // a deliberate lane switch, but the new lane is then remembered.
  if (!result && state.stalled > .38) {
    const opposite = state.side===1?-1:1;
    const alternative=candidate(opposite);
    if (alternative) {
      state.side=opposite;
      state.stalled=0;
      result=alternative;
    }
  }
  if (!result) {
    state.stalled += speedTime;
    return from;
  }
  const forward = ((result.x-from.x)*dx+(result.z-from.z)*dz)/length;
  state.stalled = forward < length * .16
    ? state.stalled+speedTime : Math.max(0,state.stalled-speedTime*.75);
  return result;
}
