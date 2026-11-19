import * as THREE from 'three';
import { paintedMap } from './ArtKit';

type EyeStyle = {
  iris: string;
  edge: string;
  white: string;
  pupil: number;
  human?: boolean;
};

const geometries = new Map<string, THREE.BufferGeometry>();
const materials = new Map<string, THREE.MeshStandardMaterial>();

/** A curved aperture with a painted iris and lid. The full surface blinks as one mesh. */
export function makeEye(parent: THREE.Object3D, width: number, height: number,
  depth: number, style: EyeStyle): THREE.Mesh {
  const key = `${width}/${height}/${depth}/${Boolean(style.human)}`;
  let geometry = geometries.get(key);
  if (!geometry) {
    geometry = apertureGeometry(width, height, depth, style.human ?? false);
    geometries.set(key, geometry);
  }
  const palette = [style.iris, style.edge, style.white, style.pupil, Boolean(style.human)].join('/');
  let material = materials.get(palette);
  if (!material) {
    material = eyeMaterial(style);
    materials.set(palette, material);
  }
  const mesh = new THREE.Mesh(geometry, material);
  parent.add(mesh);
  return mesh;
}

function apertureGeometry(width: number, height: number, depth: number, human: boolean): THREE.BufferGeometry {
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  const columns = 16, rows = 4;
  for (let row = 0; row <= rows; row++) {
    const v = row / rows;
    for (let column = 0; column <= columns; column++) {
      const u = column / columns;
      const x = 2 * u - 1;
      const contour = (1 - x * x) ** (human ? 0.85 : 0.57);
      const y = (2 * v - 1) * contour * (v < 0.5 && human ? 0.72 : 1);
      positions.push(width * x, height * y, depth * contour * Math.sqrt(1 - 0.46 * (2 * v - 1) ** 2) - 0.006 * x * x);
      uv.push(u, v);
      if (row < rows && column < columns) {
        const a = row * (columns + 1) + column;
        const b = a + columns + 1;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function eyeMaterial(style: EyeStyle): THREE.MeshStandardMaterial {
  const { iris, edge, white, pupil, human } = style;
  const map = paintedMap(`eye-${iris}-${edge}`, 64, 32, (ctx) => {
    ctx.scale(0.5, 0.5);
    const lid = ctx.createLinearGradient(0, 0, 0, 64);
    lid.addColorStop(0, edge);
    lid.addColorStop(human ? 0.105 : 0.085, white);
    lid.addColorStop(0.62, white);
    lid.addColorStop(1, edge);
    ctx.fillStyle = lid;
    ctx.fillRect(0, 0, 128, 64);
    const irisWidth = human ? 24 : 35;
    const irisHeight = human ? 31 : 33;
    ctx.save();
    ctx.translate(64, human ? 29 : 31);
    ctx.scale(irisWidth, irisHeight);
    const pigment = ctx.createRadialGradient(0.04, 0.40, 0.07, 0, 0, 1);
    pigment.addColorStop(0, '#e3bd89');
    pigment.addColorStop(0.65, iris);
    pigment.addColorStop(1, edge);
    ctx.fillStyle = pigment;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = '#221c1d';
    ctx.beginPath();
    ctx.ellipse(0, -0.06, pupil, human ? 0.61 : 0.84, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = '#f9eada';
    ctx.beginPath();
    ctx.ellipse(-0.34, -0.36, 0.18, 0.12, -0.3, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
    if (human) {
      ctx.fillStyle = edge;
      ctx.fillRect(0, 0, 128, 6);
    }
  });
  return new THREE.MeshStandardMaterial({
    color: map ? 0xffffff : white, map, roughness: human ? 0.58 : 0.46,
  });
}
