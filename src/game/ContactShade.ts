import * as THREE from 'three';
import { paintedMap, plane } from './ArtKit';

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, alpha: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(rx, ry);
  const gradient = ctx.createRadialGradient(0, 0, 0.25, 0, 0, 1);
  gradient.addColorStop(0, 'rgba(53,36,31,' + alpha + ')');
  gradient.addColorStop(1, 'rgba(53,36,31,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

export function furnitureContact(): THREE.Mesh {
  const map = paintedMap('furniture-contact', 256, 256, (ctx) => {
    for (const [x, z, rx, rz] of [
      [-3.1, 1.7, 1.56, 0.76], [-3.85, -2.62, 1.74, 1.65],
      [2.43, -3.91, 2.50, 0.69], [2.68, 1.73, 1.43, 0.77], [5.24, -4.25, .74, .62],
      [-0.6, -3.63, 1.22, 0.55], [-1.88, 0.03, 0.80, 0.76],
      [2.68, 2.80, 0.55, 0.53], [-0.84, 0.05, 0.49, 0.47],
    ]) {
      const cx = (x + 6) / 12 * 256, cy = (z + 5) / 10 * 256;
      ellipse(ctx, cx, cy, rx * 1.04 / 12 * 256, rz * 1.04 / 10 * 256, 0.19);
      ellipse(ctx, cx, cy, rx * 0.68 / 12 * 256, rz * 0.64 / 10 * 256, 0.30);
    }
  });
  const mesh = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({
    map, transparent: true, opacity: map ? 1 : 0, depthWrite: false, toneMapped: false,
  }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.027;
  mesh.scale.set(12, 10, 1);
  return mesh;
}

export function walkingContact(dogOrCat: boolean) {
  const map = paintedMap('walking-contact', 64, 64, (ctx) => {
    ellipse(ctx, 32, 32, 32, 32, 0.36);
    ellipse(ctx, 32, 33, 23, 19, 0.29);
  });
  const mesh = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({
    map, transparent: true, opacity: map ? 0.48 : 0, depthWrite: false, toneMapped: false,
  }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.scale.set(dogOrCat ? 0.75 : 0.61, dogOrCat ? 1.05 : 0.63, 1);
  return mesh;
}
