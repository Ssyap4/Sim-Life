import type { CharacterId } from '../shared/protocol';

/**
 * Two-foot walking gait. Keep the navigation speed and cadence unchanged.
 * The previous gait lowered the entire model by ~0.116 m every frame while
 * shortening the IK legs, producing an obvious perpetual half-squat.
 *
 * The foot arc fits the actual skeleton instead of requiring a deep hip dip.
 * The pelvis now shifts by at most 0.039 m, with a subtle twice-per-stride
 * weight transfer. The swing foot still clears the floor.
 */
/** Match the visual stride to actual navigation displacement, including yielding
 * and slow side-steps. This never changes the movement budget or the route. */
export function walkMotionTarget(traveled:number,dt:number,normalSpeed:number):number {
  if(!(traveled>.0001)||!(dt>0)||!(normalSpeed>0))return 0;
  const ratio=Math.min(1,traveled/(dt*normalSpeed));
  return Math.sqrt(ratio);
}
export const WALK_STANCE_FRACTION = 0.60;
export const WALK_MAX_HIP_DROP = 0.039;

export function walkStrideLength(id: CharacterId): number {
  return id === 'vlad' ? 1.43 : 1.31;
}

export function walkPelvisDrop(phase: number, motion: number): number {
  const weightTransfer = (1 + Math.cos(phase * Math.PI * 4)) * 0.5;
  return motion * (0.014 + 0.025 * weightTransfer);
}

export function walkFootTarget(
  gait: number,
  legIndex: 0 | 1,
  legLength: number,
  strideLength: number,
  motion: number,
  pelvisDrop: number,
  crouch: number,
): { y: number; z: number; toePitch: number; swing: boolean } {
  const phase = (gait + legIndex * .5) % 1;
  const swing = phase >= WALK_STANCE_FRACTION;
  const travel = swing
    ? (phase - WALK_STANCE_FRACTION) / (1 - WALK_STANCE_FRACTION)
    : phase / WALK_STANCE_FRACTION;
  const lift = swing ? Math.sin(travel * Math.PI) ** 1.55 * 0.085 : 0;
  const step = swing ? (travel * travel * (3 - 2 * travel)) * 2 - 1 : 1 - 2 * travel;
  // Maximum 36% of the leg length on each side of the pelvis. A larger step
  // forces the short shins into a bent-knee crouch throughout the stance.
  const travelRange = Math.min(strideLength * WALK_STANCE_FRACTION * .5, legLength * .36);
  return {
    y: -legLength + pelvisDrop + motion * lift + crouch,
    z: step * motion * travelRange + crouch * .08,
    toePitch: swing ? -.16 * motion * Math.sin(travel * Math.PI * 2) : 0,
    swing,
  };
}
