import * as THREE from 'three';
export const HEIGHT_MAX_POLAR = Math.PI / 2 - .005;
export const CAMERA_FLOOR = .65;
/** Move on a constant-radius vertical arc, preserving zoom and azimuth. */
export function adjustHeight(eye: THREE.Vector3, target: THREE.Vector3,
  direction: 1|-1, seconds: number, minPolar=.24): void {
  const offset = eye.clone().sub(target);
  const radius = offset.length();
  if (radius < .001 || !Number.isFinite(radius) || !Number.isFinite(seconds)) return;
  const speed = THREE.MathUtils.clamp(radius * .68, 2.4, 24);
  const low = Math.min(radius * Math.cos(minPolar),
    Math.max(radius * Math.cos(HEIGHT_MAX_POLAR), 1.55 - target.y));
  const high = radius * Math.cos(minPolar);
  const y = THREE.MathUtils.clamp(offset.y + direction * speed * Math.max(0, Math.min(.12, seconds)), low, high);
  const horizontal = Math.sqrt(Math.max(0, radius*radius-y*y));
  const azimuth = Math.atan2(offset.x,offset.z);
  eye.set(target.x+Math.sin(azimuth)*horizontal,target.y+y,target.z+Math.cos(azimuth)*horizontal);
  protectCameraFloor(eye,target);
}
export function protectCameraFloor(eye: THREE.Vector3,target: THREE.Vector3): void {
  const lift = Math.max(0, CAMERA_FLOOR-eye.y);
  eye.y+=lift; target.y+=lift;
}
