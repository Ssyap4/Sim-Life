import * as THREE from 'three';
import type { ViewBand } from './InspectionFrame';

/** The cutaway's outline: floor deck, front step, and two standing walls.
 * Keep this in step with the architecture in HomeStyling.ts.
 */
export const houseOutline = [
  [-6.26, -0.63, -5.24], [6.26, -0.63, -5.24], [-6.26, -0.63, 5.24], [6.26, -0.63, 5.24],
  [-6.26, 0, -5.24], [6.26, 0, -5.24], [-6.26, 0, 5.24], [6.26, 0, 5.24],
  [-0.32, -0.54, 5.51], [1.72, -0.54, 5.51],
  [-6.17, 3.40, -5.17], [6.15, 3.40, -5.17], [-6.17, 3.40, 5.08],
] as const;

/** Horizontal composition anchors. Empty side edges of the cutaway may bleed
 * past the screen; the furniture, pet stations and front step stay in frame.
 */
export const playOutline = [
  [-5.22, 1.41, -3.99], [-5.22, 0, -1.27],
  [-4.47, 1.24, 2.30], [-4.47, 0, 2.30],
  [5.70, 1.99, -4.42], [5.70, 0, -4.42], [5.70, 0, -3.40],
  [4.34, 1.93, 1.96], [4.34, 0, 3.12],
  [5.63, 1.22, 3.88], [-1.90, 1.25, 3.48], [1.98, 1.24, 1.23],
  [-0.32, -0.54, 5.51], [1.72, -0.54, 5.51],
] as const;

export function portraitHomeFrame(fov: number, aspect: number, band: ViewBand) {
  // The front-facing angle makes better use of a narrow width and gives the
  // characters a larger face-on silhouette while keeping both walls visible.
  const axis = new THREE.Vector3(0.24, 0.98, 1.10).normalize();
  const right = new THREE.Vector3().crossVectors(THREE.Object3D.DEFAULT_UP, axis).normalize();
  const up = new THREE.Vector3().crossVectors(axis, right);
  const tanY = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const tanX = tanY * aspect;
  const left = -0.93, rightEdge = 0.93;
  const bottom = 1 - 2 * band.bottom + 0.045;
  const top = Math.max(bottom + 0.12, 1 - 2 * band.top - 0.045);
  const point = new THREE.Vector3();
  const project = ([x, y, z]: readonly [number, number, number]) => {
    point.set(x, y, z);
    return { x: point.dot(right), y: point.dot(up), depth: point.dot(axis) };
  };
  const widthOutline = playOutline.map(project);
  const heightOutline = houseOutline.map(project);

  // At a fixed distance each vertex constrains where the camera may aim.
  // Intersect the intervals to frame the actual asymmetric silhouette.
  function limits(distance: number) {
    let xMin = -Infinity, xMax = Infinity, yMin = -Infinity, yMax = Infinity;
    for (const p of widthOutline) {
      const depth = distance - p.depth;
      xMin = Math.max(xMin, p.x - rightEdge * depth * tanX);
      xMax = Math.min(xMax, p.x - left * depth * tanX);
    }
    for (const p of heightOutline) {
      const depth = distance - p.depth;
      yMin = Math.max(yMin, p.y - top * depth * tanY);
      yMax = Math.min(yMax, p.y - bottom * depth * tanY);
    }
    return { xMin, xMax, yMin, yMax };
  }

  let near = 10, far = 88;
  for (let step = 0; step < 18; step++) {
    const distance = (near + far) / 2;
    const { xMin, xMax, yMin, yMax } = limits(distance);
    if (xMin <= xMax && yMin <= yMax) far = distance;
    else near = distance;
  }
  const { xMin, xMax, yMin, yMax } = limits(far);
  const target = right.multiplyScalar((xMin + xMax) / 2).addScaledVector(up, (yMin + yMax) / 2);
  return { target, position: target.clone().addScaledVector(axis, far) };
}

export function renderProfile(compactPortrait: boolean, devicePixelRatio: number) {
  return {
    pixelRatio: Math.min(devicePixelRatio || 1, compactPortrait ? 1.25 : 1.5),
    shadowSize: compactPortrait ? 768 : 1024,
  };
}
