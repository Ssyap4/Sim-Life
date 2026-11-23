/** Keep a finger drag travelling the same WORLD distance at every zoom.
 * OrbitControls multiplies screen pan by camera distance; cancelling that
 * factor removes the unpredictable slow/fast feeling while exploring.
 * This is a pure helper so mobile camera semantics can be regression-tested. */
export function steadyPanSpeed(distance:number,referenceDistance=24):number {
  if(!Number.isFinite(distance)||distance<=0)return 1;
  return Math.max(.16,Math.min(3.4,referenceDistance/distance));
}
export const TOUCH_CAMERA_DAMPING=.14;
