import * as THREE from 'three';

export type ViewBand = { top: number; bottom: number };

/** Fit the subject's world bounds into the currently unobstructed canvas band. */
export function inspectionFrame(bounds: THREE.Box3, direction: THREE.Vector3,
  fov: number, aspect: number, band: ViewBand) {
  const target = bounds.getCenter(new THREE.Vector3());
  const distanceAxis = direction.clone().normalize();
  const right = new THREE.Vector3().crossVectors(THREE.Object3D.DEFAULT_UP, distanceAxis).normalize();
  const up = new THREE.Vector3().crossVectors(distanceAxis, right);
  const tanY = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const tanX = tanY * aspect * 0.86;
  const height = THREE.MathUtils.clamp(band.bottom - band.top - 0.075, 0.32, 0.87);
  const middle = 1 - band.top - band.bottom;
  const corner = new THREE.Vector3();
  let distance = 1.45;
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) {
    for (const z of [bounds.min.z, bounds.max.z]) {
      corner.set(x, y, z).sub(target);
      const depth = corner.dot(distanceAxis);
      const vertical = corner.dot(up) + middle * depth * tanY;
      distance = Math.max(distance, depth + Math.abs(corner.dot(right)) / tanX,
        depth + Math.abs(vertical) / (tanY * height));
    }
  }
  target.addScaledVector(up, -middle * distance * tanY);
  return { target, position: target.clone().addScaledVector(distanceAxis, distance) };
}
