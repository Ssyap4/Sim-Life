import * as THREE from 'three';
import { BATH_FIXTURES, type BathFixture } from '../shared/home';
import { colors as C, cube, drum, finish, orb, paintedMap, panel, plane, softCube, type XYZ } from './ArtKit';

const porcelain = 0xf4ede2;
const glaze = 0xa5c6ba;
const chrome = 0x9caeac;

function part(root: THREE.Group, size: XYZ, position: XYZ, color: number,
  material: 'ceramic' | 'metal' | 'wood' | 'fabric' = 'ceramic',
  geometry: THREE.BufferGeometry = softCube) {
  const mesh = new THREE.Mesh(geometry, finish(color, material));
  mesh.position.set(...position);
  mesh.scale.set(...size);
  mesh.receiveShadow = true;
  root.add(mesh);
  return mesh;
}

function tap(root: THREE.Group, x: number, y: number, z: number): void {
  part(root, [.042, .19, .042], [x, y + .09, z], chrome, 'metal', drum);
  part(root, [.047, .036, .16], [x, y + .17, z + .055], chrome, 'metal');
  part(root, [.14, .025, .036], [x, y + .15, z - .034], chrome, 'metal');
}

function toilet(root: THREE.Group): void {
  root.rotation.y = Math.PI / 2;
  part(root, [.52, .37, .55], [0, .195, .07], porcelain);
  part(root, [.33, .16, .46], [0, .332, .19], porcelain, 'ceramic', orb);
  part(root, [.325, .068, .405], [0, .462, .176], porcelain, 'ceramic', orb);
  part(root, [.237, .016, .309], [0, .526, .19], 0xc9d9cb, 'ceramic', orb);
  part(root, [.21, .012, .26], [0, .539, .21], glaze, 'ceramic', orb);
  part(root, [.60, .61, .23], [0, .571, -.34], porcelain);
  part(root, [.63, .082, .28], [0, .89, -.34], porcelain);
  part(root, [.062, .018, .045], [.15, .939, -.29], chrome, 'metal');
  part(root, [.64, .016, .23], [0, .024, .57], 0xb38672, 'fabric');
}

function shower(root: THREE.Group): void {
  part(root, [1.47, .078, 1.40], [0, .032, 0], porcelain);
  part(root, [1.32, .016, 1.23], [0, .074, 0], glaze, 'ceramic', cube);
  part(root, [.13, .010, .13], [.38, .083, .28], chrome, 'metal', drum);
  const glass = new THREE.MeshBasicMaterial({
    color: 0xb2d0c2, transparent: true, opacity: .21, depthWrite: false, side: THREE.DoubleSide,
  });
  for (const z of [-.66, .66]) {
    const pane = new THREE.Mesh(plane, glass);
    pane.position.set(0, .99, z);
    pane.scale.set(1.41, 1.84, 1);
    root.add(pane);
    part(root, [1.43, .076, .050], [0, 2.0, z], C.pine, 'metal');
    part(root, [.052, 1.96, .051], [-.70, 1.03, z], C.pine, 'metal');
    part(root, [.052, 1.96, .051], [.70, 1.03, z], C.pine, 'metal');
  }
  part(root, [.06, 2.02, 1.37], [.70, 1.05, 0], 0xacc4b7, 'ceramic', cube);
  part(root, [.031, 1.36, .031], [.62, 1.49, .16], chrome, 'metal', drum);
  part(root, [.29, .036, .034], [.50, 2.15, .16], chrome, 'metal');
  part(root, [.14, .036, .14], [.36, 2.12, .16], chrome, 'metal', drum);
  part(root, [.043, .076, .076], [.596, 1.06, .16], C.pine, 'metal');
  part(root, [.18, .047, .34], [.59, 1.26, -.34], porcelain);
  part(root, [.085, .15, .085], [.57, 1.36, -.38], C.clay, 'ceramic', drum);
}

function roundedRectangle(path: THREE.Path, w: number, d: number, radius: number): void {
  const x = w / 2, y = d / 2;
  path.moveTo(-x + radius, -y);
  path.lineTo(x - radius, -y);
  path.quadraticCurveTo(x, -y, x, -y + radius);
  path.lineTo(x, y - radius);
  path.quadraticCurveTo(x, y, x - radius, y);
  path.lineTo(-x + radius, y);
  path.quadraticCurveTo(-x, y, -x, y - radius);
  path.lineTo(-x, -y + radius);
  path.quadraticCurveTo(-x, -y, -x + radius, -y);
}

function bathtub(root: THREE.Group): void {
  const shell = new THREE.Shape();
  roundedRectangle(shell, 1.28, 2.12, .28);
  const inside = new THREE.Path();
  roundedRectangle(inside, 1.00, 1.78, .26);
  shell.holes.push(inside);
  const rim = new THREE.ExtrudeGeometry(shell, { depth: .55, bevelEnabled: true,
    bevelSize: .024, bevelThickness: .026, bevelSegments: 1, curveSegments: 4 });
  rim.rotateX(-Math.PI / 2);
  part(root, [1, 1, 1], [0, .09, 0], porcelain, 'ceramic', rim);
  const waterOutline = new THREE.Shape();
  roundedRectangle(waterOutline, 1.015, 1.795, .25);
  const water = new THREE.ShapeGeometry(waterOutline, 4);
  water.rotateX(-Math.PI / 2);
  part(root, [1, 1, 1], [0, .41, 0], glaze, 'ceramic', water);
  tap(root, -.31, .66, -.87);
  part(root, [.31, .067, .25], [.54, .66, .80], 0xcba889, 'fabric');
  part(root, [.28, .059, .29], [.48, .72, .78], C.paper, 'fabric');
}

function basin(root: THREE.Group): void {
  part(root, [1.17, .69, .61], [0, .398, 0], C.pine, 'wood');
  for (const x of [-.282, .282]) {
    part(root, [.54, .49, .039], [x, .416, .313], C.sage, 'wood');
    part(root, [.105, .026, .04], [x, .537, .351], C.brass, 'metal');
  }
  part(root, [1.23, .094, .67], [0, .785, .005], porcelain);
  part(root, [.335, .135, .238], [0, .843, .041], porcelain, 'ceramic', orb);
  part(root, [.258, .020, .169], [0, .971, .053], glaze, 'ceramic', orb);
  part(root, [.036, .011, .036], [0, .992, .052], chrome, 'metal', drum);
  tap(root, 0, .921, -.19);
  const reflection = paintedMap('bathroom-mirror', 64, 64, ctx => {
    const gradient = ctx.createLinearGradient(5, 4, 58, 64);
    gradient.addColorStop(0, '#f4f2dc');
    gradient.addColorStop(.44, '#b5cac2');
    gradient.addColorStop(.53, '#d5e1d5');
    gradient.addColorStop(1, '#a2bcb7');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
  });
  part(root, [1.00, .89, .053], [0, 1.662, -.277], C.walnut, 'wood');
  panel(root, [0, 1.662, -.247], [.91, .80], reflection, glaze, .18);
  part(root, [.52, .043, .052], [0, 2.16, -.21], C.paper);
  part(root, [.104, .154, .10], [.46, .906, -.12], C.clay);
}

const builders = { toilet, shower, bathtub, basin };

export function buildBathFixture(id: BathFixture): THREE.Group {
  const root = new THREE.Group();
  const { x, z } = BATH_FIXTURES[id].center;
  root.position.set(x, 0, z);
  builders[id](root);
  return root;
}
