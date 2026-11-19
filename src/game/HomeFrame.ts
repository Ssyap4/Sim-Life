import * as THREE from 'three';
import type { ViewBand } from './InspectionFrame';

/** The two standing walls and the full platform, including the front garden. */
export const houseOutline = [
  [-6.26, -.63, -5.24], [6.26, -.63, -5.24], [-6.26, -.63, 12.24], [6.26, -.63, 12.24],
  [-6.26, 0, -5.24], [6.26, 0, -5.24], [-6.26, 0, 12.24], [6.26, 0, 12.24],
  [-6.17, 3.40, -5.17], [6.15, 3.40, -5.17], [-6.17, 3.40, 5.08],
] as const;

/** Keep the furniture, path and front fence visible on narrow screens. */
export const playOutline = [
  [-5.69, 1.41, -4.74], [-5.69, 0, -2.00], [-5.80, 1.96, -1.00],
  [5.72, 2.18, -4.25], [5.72, 0, -3.40], [5.74, 1.93, 1.96],
  [5.63, .13, 4.88], [-5.68, .15, 4.88],
  [-5.98, .22, 8.60], [5.98, .22, 8.60], [-6.04, .55, 12.14], [6.04, .55, 12.14],
] as const;

type Vertex = readonly [number, number, number];

export function portraitHomeFrame(fov: number, aspect: number, band: ViewBand,
  horizontal: readonly Vertex[] = playOutline, vertical: readonly Vertex[] = houseOutline,
  direction: Vertex = [0.20, 1.26, 1.02]) {
  // An elevated, front-facing view keeps the house threshold and yard readable.
  const axis = new THREE.Vector3(...direction).normalize();
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
  const widthOutline = horizontal.map(project);
  const heightOutline = vertical.map(project);

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
