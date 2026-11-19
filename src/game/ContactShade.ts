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
      [-3.1, 1.7, 1.7, 0.81], [-3.85, -2.62, 1.74, 1.65],
      [3.45, -3.91, 2.65, 0.69], [3.2, 1.46, 1.43, 0.77],
      [-0.6, -3.63, 1.22, 0.55], [-1.88, 0.03, 0.73, 0.73],
    ]) ellipse(ctx, (x + 6) / 12 * 256, (z + 5) / 10 * 256,
      rx / 12 * 256, rz / 10 * 256, 0.25);
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
  const map = paintedMap('walking-contact', 64, 64,
    (ctx) => ellipse(ctx, 32, 32, 32, 32, 0.55));
  const mesh = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({
    map, transparent: true, opacity: map ? 0.48 : 0, depthWrite: false, toneMapped: false,
  }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.scale.set(dogOrCat ? 0.75 : 0.61, dogOrCat ? 1.05 : 0.63, 1);
  return mesh;
}
