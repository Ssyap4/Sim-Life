import * as THREE from 'three';
import { HOME_PLACEMENTS, HOME_FURNITURE, HOUSE } from '../shared/home';
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
  const width = HOUSE.maxX - HOUSE.minX;
  const depth = HOUSE.maxZ - HOUSE.minZ;
  const map = paintedMap('furniture-contact', 256, 256, (ctx) => {
    const shapes = Object.values(HOME_FURNITURE).map(({ minX, maxX, minZ, maxZ }) =>
      [(minX + maxX) / 2, (minZ + maxZ) / 2, (maxX - minX) * .62, (maxZ - minZ) * .69]);
    const { fridge, vanity, officeSofa, officeTv } = HOME_PLACEMENTS;
    shapes.push([fridge.x, fridge.z, .74, .62], [vanity.x, vanity.z, .62, .84],
      [officeSofa.x, officeSofa.z, .72, .99], [officeTv.x, officeTv.z, .45, .69]);
    for (const [x, z, rx, rz] of shapes) {
      const cx = (x - HOUSE.minX) / width * 256, cy = (z - HOUSE.minZ) / depth * 256;
      ellipse(ctx, cx, cy, rx * 1.04 / width * 256, rz * 1.04 / depth * 256, 0.19);
      ellipse(ctx, cx, cy, rx * 0.68 / width * 256, rz * 0.64 / depth * 256, 0.30);
    }
  });
  const mesh = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({
    map, transparent: true, opacity: map ? 1 : 0, depthWrite: false, toneMapped: false,
  }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, .027, (HOUSE.minZ + HOUSE.maxZ) / 2);
  mesh.scale.set(width, depth, 1);
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
