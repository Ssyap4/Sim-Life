import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type XYZ = [number, number, number];
export const colors = {
  paper: 0xf6e7cd, limestone: 0xe4ccb1, oat: 0xd5b68c,
  oak: 0xb8794d, walnut: 0x704630, darkWood: 0x493128,
  sage: 0x91a087, leaf: 0x627e63, pine: 0x3b6456,
  clay: 0xb9614c, coral: 0xd98a70, rust: 0x924939,
  ink: 0x293d43, brass: 0xc59453, sky: 0xa8c2b6,
} as const;

export const cube = new THREE.BoxGeometry();
export const softCube = new RoundedBoxGeometry(1, 1, 1, 1, 0.14);
export const orb = new THREE.SphereGeometry(1, 14, 10);
export const drum = new THREE.CylinderGeometry(1, 1, 1, 20);
export const torus = new THREE.TorusGeometry(1, 0.10, 6, 18);
export const plane = new THREE.PlaneGeometry();
type Surface = 'fabric' | 'wood' | 'metal' | 'screen' | 'ceramic' | 'skin';
const roughness: Record<Surface, number> = {
  fabric: 0.94, wood: 0.72, metal: 0.42, screen: 0.33, ceramic: 0.54, skin: 0.76,
};
const finishes = new Map<string, THREE.MeshStandardMaterial>();

export function finish(color: number, surface: Surface = 'fabric'): THREE.MeshStandardMaterial {
  const key = `${color}/${surface}`;
  let material = finishes.get(key);
  if (!material) {
    material = new THREE.MeshStandardMaterial({
      color, roughness: roughness[surface], metalness: surface === 'metal' ? 0.28 : 0,
    });
    finishes.set(key, material);
  }
  return material;
}

const illustrations = new Map<string, THREE.Texture>();
export function paintedMap(key: string, width: number, height: number,
  paint: (ctx: CanvasRenderingContext2D) => void): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const existing = illustrations.get(key);
  if (existing) return existing;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  paint(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  illustrations.set(key, texture);
  return texture;
}

export function panel(parent: THREE.Object3D, position: XYZ, size: [number, number],
  map: THREE.Texture | null, fallback: number, glow = 0): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial({
    color: map ? 0xffffff : fallback, map,
    emissive: glow ? (map ? 0xffffff : fallback) : 0, emissiveMap: map, emissiveIntensity: glow,
    roughness: 0.86,
  });
  const mesh = new THREE.Mesh(plane, material);
  mesh.position.set(...position);
  mesh.scale.set(...size, 1);
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/** Join rigid mesh parts with the same material and shadow settings at setup time.
 * Only direct children are combined, so animation pivots and their transforms survive.
 */
export function batchRigidParts(parent: THREE.Object3D): void {
  const batches = new Map<string, THREE.Mesh[]>();
  for (const child of parent.children) {
    if (!(child instanceof THREE.Mesh) || child instanceof THREE.SkinnedMesh || Array.isArray(child.material) ||
        child.material.transparent || child.geometry.hasAttribute('color')) continue;
    const key = `${child.material.uuid}/${child.castShadow}/${child.receiveShadow}`;
    const batch = batches.get(key) ?? [];
    batch.push(child);
    batches.set(key, batch);
  }
  for (const batch of batches.values()) {
    if (batch.length < 2) continue;
    const sources = batch.map((mesh) => {
      mesh.updateMatrix();
      const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      return geometry.applyMatrix4(mesh.matrix);
    });
    const geometry = mergeGeometries(sources);
    for (const source of sources) source.dispose();
    if (!geometry) continue;
    const [sample] = batch;
    const combined = new THREE.Mesh(geometry, sample.material);
    combined.castShadow = sample.castShadow;
    combined.receiveShadow = sample.receiveShadow;
    parent.remove(...batch);
    parent.add(combined);
  }
}

/** A soft tapered lock, fur tuft, or tail swept along a curved centerline. */
export function sculptedCurve(parent: THREE.Object3D, points: XYZ[], start: number,
  end: number, color: number, flatten = 0.65, shadow = false, rings?: number): THREE.Mesh {
  const path = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const steps = 12;
  const sides = 8;
  const frames = path.computeFrenetFrames(steps, false);
  const positions: number[] = [];
  const uv: number[] = [];
  const tint: number[] = [];
  const stripe = new THREE.Color(rings);
  const indices: number[] = [];
  const point = new THREE.Vector3();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    path.getPointAt(t, point);
    const radius = THREE.MathUtils.lerp(start, end, t) + start * Math.sin(t * Math.PI) * 0.32;
    for (let j = 0; j <= sides; j++) {
      const angle = j / sides * Math.PI * 2;
      const vertex = point.clone()
        .addScaledVector(frames.normals[i], Math.cos(angle) * radius)
        .addScaledVector(frames.binormals[i], Math.sin(angle) * radius * flatten);
      positions.push(vertex.x, vertex.y, vertex.z);
      uv.push(t, j / sides);
      if (rings !== undefined) {
        const band = i % 4 === 2 || i === steps;
        tint.push(band ? stripe.r : 1, band ? stripe.g : 1, band ? stripe.b : 1);
      }
      if (i === steps || j === sides) continue;
      const a = i * (sides + 1) + j;
      const b = a + sides + 1;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = finish(color, 'skin');
  const surface = rings === undefined ? material : material.clone();
  if (rings !== undefined) {
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(tint, 3));
    surface.vertexColors = true;
  }
  const mesh = new THREE.Mesh(geometry, surface);
  mesh.castShadow = shadow;
  parent.add(mesh);
  return mesh;
}
