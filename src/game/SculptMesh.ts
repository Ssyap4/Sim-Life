import * as THREE from 'three';
import { finish } from './ArtKit';

/** Cross section: elevation, half width, half depth, fore/aft center. */
export type Section = readonly [number, number, number, number?];
type Profile = (x: number, y: number, z: number, angle: number) => [number, number, number];
type Tint = (color: THREE.Color, angle: number, elevation: number) => void;

export function loft(sections: readonly Section[], sides = 20, steps = 24,
  profile?: Profile, tint?: Tint): THREE.BufferGeometry {
  const vertices: number[] = [];
  const uv: number[] = [];
  const indices: number[] = [];
  const colors: number[] = [];
  const color = new THREE.Color();
  for (let row = 0; row <= steps; row++) {
    const t = row / steps * (sections.length - 1);
    const i = Math.min(Math.floor(t), sections.length - 2);
    const a = sections[i], b = sections[i + 1];
    const f = t - i;
    const y = THREE.MathUtils.lerp(a[0], b[0], f);
    // Interpolate the widths with tangents measured in world units, avoiding
    // visible creases when adjacent rings have very different spacing.
    const curve = (channel: 1 | 2 | 3) => {
      const prev = sections[Math.max(0, i - 1)];
      const next = sections[Math.min(sections.length - 1, i + 2)];
      const p = a[channel] ?? 0, q = b[channel] ?? 0;
      const d = b[0] - a[0];
      const m = ((b[channel] ?? 0) - (prev[channel] ?? 0)) / (b[0] - prev[0]) * d;
      const n = ((next[channel] ?? 0) - (a[channel] ?? 0)) / (next[0] - a[0]) * d;
      return (2 * f ** 3 - 3 * f ** 2 + 1) * p + (f ** 3 - 2 * f ** 2 + f) * m +
        (-2 * f ** 3 + 3 * f ** 2) * q + (f ** 3 - f ** 2) * n;
    };
    const width = Math.max(0.001, curve(1));
    const depth = Math.max(0.001, curve(2));
    const center = curve(3);
    for (let side = 0; side < sides; side++) {
      const angle = side / sides * Math.PI * 2;
      const x = Math.sin(angle) * width;
      const z = center + Math.cos(angle) * depth;
      vertices.push(...(profile ? profile(x, y, z, angle) : [x, y, z]));
      uv.push(side / sides, row / steps);
      if (tint) {
        tint(color, angle, y);
        colors.push(color.r, color.g, color.b);
      }
      if (row < steps) {
        const here = row * sides + side;
        const next = row * sides + (side + 1) % sides;
        indices.push(here, next, here + sides, next, next + sides, here + sides);
      }
    }
  }
  for (let side = 1; side < sides - 1; side++) {
    indices.push(0, side + 1, side, steps * sides, steps * sides + side, steps * sides + side + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (tint) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function sculpt(parent: THREE.Object3D, geometry: THREE.BufferGeometry,
  color: number, surface: Parameters<typeof finish>[1], shadow = true): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, finish(color, surface, geometry.hasAttribute('color')));
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/** The visible skin or fabric spans a joint. Shoes and hands follow the lower bone. */
export function hingedLimb(parent: THREE.Group, geometry: THREE.BufferGeometry,
  hingeY: number, color: number, surface: Parameters<typeof finish>[1]): THREE.Bone {
  const root = new THREE.Bone();
  const lower = new THREE.Bone();
  lower.position.y = hingeY;
  root.add(lower);

  const joints: number[] = [], weights: number[] = [];
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const lowerWeight = 1 - THREE.MathUtils.smoothstep(positions.getY(i), hingeY - 0.10, hingeY + 0.10);
    joints.push(0, 1, 0, 0);
    weights.push(1 - lowerWeight, lowerWeight, 0, 0);
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(joints, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  const mesh = new THREE.SkinnedMesh(geometry, finish(color, surface));
  mesh.add(root);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton([root, lower]));
  // Bounds must cover bent poses for picking and shadow culling.
  mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Math.abs(hingeY) * 2.5);
  mesh.boundingBox = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(),
    new THREE.Vector3(2, 2, 2).multiplyScalar(mesh.boundingSphere.radius));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return lower;
}
