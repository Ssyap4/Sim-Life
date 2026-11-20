import * as THREE from 'three';
import { cube, drum, finish, plane, softCube, type XYZ } from './ArtKit';

export const smallOrb = new THREE.SphereGeometry(1, 9, 7);
export const bud = new THREE.SphereGeometry(1, 7, 5);
export const shortCylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
export const locationGeometry = [smallOrb, bud, shortCylinder];

export function part(parent: THREE.Object3D, size: XYZ, position: XYZ, color: number,
  geometry: THREE.BufferGeometry = cube, surface: Parameters<typeof finish>[1] = 'wood'): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, finish(color, surface));
  mesh.scale.set(...size);
  mesh.position.set(...position);
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export const round = (parent: THREE.Object3D, radius: number, height: number, pos: XYZ, color: number) =>
  part(parent, [radius, height, radius], pos, color, drum);
export const trim = (parent: THREE.Object3D, size: XYZ, pos: XYZ, color: number) =>
  part(parent, size, pos, color, softCube);

export type LocationResources = { textures: THREE.Texture[]; materials: THREE.Material[] };

export function painted(resources: LocationResources, width: number, height: number,
  draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  resources.textures.push(texture);
  return texture;
}

export function lettering(parent: THREE.Object3D, resources: LocationResources, at: XYZ,
  width: number, height: number, title: string, colors: [string, string], detail?: string,
  billboard = false): THREE.Object3D {
  const [background, ink] = colors;
  const map = painted(resources, 384, detail ? 112 : 76, ctx => {
    ctx.fillStyle = background;
    ctx.beginPath();
    ctx.roundRect(1, 1, 382, ctx.canvas.height - 2, 13);
    ctx.fill();
    ctx.strokeStyle = ink + '66';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(7, 7, 370, ctx.canvas.height - 14, 9);
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '750 ' + (detail ? 35 : 38) + 'px system-ui';
    ctx.fillText(title, 192, detail ? 43 : 39, 340);
    if (detail) {
      ctx.font = '650 20px system-ui';
      ctx.fillText(detail, 192, 82, 330);
    }
  });
  const options = {map, color: map ? '#ffffff' : background, transparent: true, alphaTest: .40, toneMapped: false};
  const material = billboard ? new THREE.SpriteMaterial(options) : new THREE.MeshBasicMaterial(options);
  resources.materials.push(material);
  const sign = material instanceof THREE.SpriteMaterial ? new THREE.Sprite(material) : new THREE.Mesh(plane, material);
  sign.scale.set(width, height, 1);
  sign.position.set(...at);
  sign.name = title;
  parent.add(sign);
  return sign;
}

export function paving(parent: THREE.Group, resources: LocationResources, width: number, depth: number, zCenter: number,
  draw: (ctx: CanvasRenderingContext2D) => void, fallback: number) {
  const map = painted(resources, 768, 640, ctx => {
    // Convert the canvas to metre coordinates matching the floor mesh.
    ctx.setTransform(ctx.canvas.width / width, 0, 0, ctx.canvas.height / depth,
      ctx.canvas.width / 2, ctx.canvas.height * (.5 - zCenter / depth));
    draw(ctx);
  });
  const material = new THREE.MeshStandardMaterial({map, color: map ? 0xffffff : fallback, roughness: .92});
  resources.materials.push(material);
  const floor = new THREE.Mesh(plane, material);
  floor.position.set(0, .011, zCenter);
  floor.rotation.x = -Math.PI / 2;
  floor.scale.set(width, depth, 1);
  floor.receiveShadow = true;
  parent.add(floor);
}

export function paintContactShade(ctx: CanvasRenderingContext2D, x: number, z: number, radiusX: number, radiusZ: number) {
  ctx.save();
  ctx.translate(x, z);
  ctx.scale(radiusX, radiusZ);
  const shade = ctx.createRadialGradient(0, 0, .18, 0, 0, 1);
  shade.addColorStop(0, 'rgba(62,48,33,.31)');
  shade.addColorStop(1, 'rgba(62,48,33,0)');
  ctx.fillStyle = shade;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}
