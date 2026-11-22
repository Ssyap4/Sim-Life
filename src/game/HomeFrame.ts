import * as THREE from 'three';
import { HOUSE, HOUSE_WING, HOME_YARD } from '../shared/home';
import type { ViewBand } from './InspectionFrame';

type Vertex = readonly [number, number, number];
const rear = HOUSE.minZ - .25;
const front = HOUSE.maxZ + .24;
const wing = HOUSE.maxX + .25;
const yardFront = HOME_YARD.gate.z + .18;

export const houseOutline: readonly Vertex[] = [-1, 1].flatMap(side => {
  const edge = side < 0 ? -wing : HOUSE_WING.maxX + .25;
  return [
    [edge, -.63, rear], [edge, -.63, front], [side * 6.26, -.63, yardFront],
    [edge, 3.22, rear], [edge, 1.24, front], [side * 6.26, .66, yardFront],
  ];
});
export const playOutline: readonly Vertex[] = [-1, 1].flatMap(side => {
  const edge = side < 0 ? HOUSE.minX : HOUSE_WING.maxX;
  return [[edge, 3.20, rear], [edge, 0, front], [side * 6.05, .66, yardFront]];
});

/** Extended desktop overview: reserve land and all three public walkways
 * fit the viewport. On portrait phones we keep the tighter home framing. */
export const neighborhoodOutline: readonly Vertex[] = [
  [-26.0,0,12.0],[27.0,0,12.0],
  [-26.0,0,-33.0],[27.0,0,-33.0],
];

export function portraitHomeFrame(fov: number, aspect: number, band: ViewBand,
  horizontal: readonly Vertex[] = playOutline, vertical: readonly Vertex[] = houseOutline,
  direction: Vertex = [0.13, 1.42, 1.08]) {
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
