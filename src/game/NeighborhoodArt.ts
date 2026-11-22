import * as THREE from 'three';
import { NEIGHBOR_HOMES, homeStops, type NeighborHome } from '../shared/neighborHomes';
export { NEIGHBOR_HOMES } from '../shared/neighborHomes';
import { batchRigidParts, cube, drum, finish, orb, softCube } from './ArtKit';

type Root = THREE.Group;
type Surface = Parameters<typeof finish>[1];

function part(parent: Root, geometry: THREE.BufferGeometry, size: readonly [number, number, number],
  at: readonly [number, number, number], color: number, surface: Surface = 'wood'): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, finish(color, surface));
  mesh.scale.set(...size);
  mesh.position.set(...at);
  mesh.receiveShadow = true;
  // All houses and vegetation are deliberately unshadowed background art.
  parent.add(mesh);
  return mesh;
}

function planting(root: Root, x: number, z: number, seed: number, large = false): void {
  if (large) {
    part(root, drum, [.16, 1.50, .16], [x, .62, z], 0x806750);
    for (let i = 0; i < 3; i++) {
      part(root, orb, [.70 - i * .09, .61, .64], [x + (i - 1) * .32, 1.51 + i * .22, z + (i % 2 ? .16 : -.13)],
        [0x6c8662, 0x81966a, 0x75916b, 0x9aa476][(seed + i) % 4]);
    }
  } else {
    part(root, orb, [.43, .28, .38], [x, .20, z],
      [0x708b62, 0x809465, 0x96a078, 0x68825e][seed % 4]);
    part(root, orb, [.29, .21, .33], [x + .23, .22, z - .13], seed % 2 ? 0x859b6e : 0x66835d);
  }
}

function flowerbed(root: Root, x: number, z: number, seed: number): void {
  part(root, softCube, [1.35, .11, .53], [x, -.025, z], 0x836b53);
  for (let i = 0; i < 5; i++) {
    const px = x - .51 + i * .255;
    part(root, orb, [.22, .20, .21], [px, .18, z + (i % 2 ? -.09 : .075)], 0x658663);
    part(root, orb, [.075, .065, .075], [px, .37, z + (i % 2 ? -.09 : .075)],
      [0xeab99b, 0xe6cf99, 0xc7a5ac, 0xf1e3c4][(seed + i) % 4]);
  }
}

type Home = NeighborHome;
function cottage(root:Root,home:Home,index:number,glass?:THREE.MeshStandardMaterial): void {
  const house = new THREE.Group();
  house.name = 'Фоновый дом · ' + home.id;
  house.position.set(home.x, 0, home.z);
  house.rotation.y = home.yaw;
  const w = home.width, d = home.depth, face = d / 2;
  const eave = 2.64, rise = index % 2 ? .88 : 1.06;
  const roofPitch = Math.atan2(rise, w / 2);
  const slopeLength = Math.hypot(w / 2, rise) + .33;

  // A complete detached home: foundation, varied gabled roof and its front
  // end, not the old rectangular 2D storefronts.
  part(house, softCube, [w + .32, .24, d + .25], [0, -.025, 0], 0xbba991, 'ceramic');
  part(house, cube, [w, eave, d], [0, eave / 2, 0], home.plaster, 'ceramic');
  part(house, cube, [w + .13, .10, d + .13], [0, .12, 0], home.trim, 'ceramic');

  for (const side of [-1, 1]) {
    const roof = part(house, cube, [slopeLength, .17, d + .82],
      [side * w / 4, eave + rise / 2, -.06], home.roof, 'ceramic');
    roof.rotation.z = -side * roofPitch;
    part(house, cube, [.085, .11, d + .79],
      [side * (w / 2 + .19), eave + .005, -.06], home.trim, 'ceramic');
  }
  // The gable closes the visible triangle between the two roof planes.
  for (const front of [-1, 1]) {
    const z = front * (d / 2 + .018);
    const shape = new THREE.BufferGeometry();
    shape.setAttribute('position', new THREE.Float32BufferAttribute([
      -w / 2, eave, z, w / 2, eave, z, 0, eave + rise, z,
    ], 3));
    shape.setIndex([0, 1, 2]);
    shape.computeVertexNormals();
    const material = finish(home.plaster, 'ceramic').clone();
    material.side = THREE.DoubleSide;
    const triangle = new THREE.Mesh(shape, material);
    triangle.receiveShadow = true;
    house.add(triangle);
  }

  // Timber door with porch canopy, shallow stair and real divided windows.
  part(house, softCube, [2.46, .14, 1.12], [0, .01, face + .38], 0xaf9e86, 'ceramic');
  part(house, cube, [1.48, .11, .50], [0, -.02, face + 1.05], 0xddd1b9, 'ceramic');
  part(house, cube, [1.10, 1.85, .12], [0, 1.03, face + .068], home.trim, 'wood');
  // Real hinge, kept outside rigid batching: opens for household NPCs.
  const leaf = new THREE.Group();
  leaf.name = 'neighbor-door-' + home.id;
  leaf.position.set(-.455, .145, face + .15);
  part(leaf, softCube, [.91, 1.67, .14], [.455, .835, 0], index % 2 ? 0x795944 : 0x718075);
  part(leaf, orb, [.05, .05, .055], [.755, .85, .086], 0xd0aa6c, 'metal');
  house.add(leaf);
  part(house, cube, [2.58, .15, 1.06], [0, 2.19, face + .35], home.roof, 'wood');
  for (const x of [-1.14, 1.14]) {
    part(house, softCube, [.095, 2.12, .105], [x, 1.05, face + .81], home.trim, 'wood');
  }

  for (const x of [-w * .30, w * .30]) {
    part(house, softCube, [1.17, 1.12, .105], [x, 1.59, face + .07], home.trim, 'wood');
    const pane=part(house,cube,[.98,.91,.11],[x,1.59,face+.13],0xaac3bd,'ceramic');
    if(glass)pane.material=glass;
    part(house, cube, [.065, .97, .14], [x, 1.59, face + .195], home.trim);
    part(house, cube, [1.04, .061, .14], [x, 1.59, face + .197], home.trim);
    for (const shift of [-.72, .72]) {
      part(house, cube, [.20, 1.05, .10], [x + shift, 1.59, face + .075], home.shutters, 'wood');
    }
    part(house, softCube, [1.28, .15, .26], [x, 1.03, face + .24], home.trim, 'wood');
    part(house, orb, [.29, .19, .21], [x, 1.13, face + .37], 0x6f8964);
    part(house, orb, [.17, .12, .15], [x + .20, 1.18, face + .40], index % 2 ? 0xd3a4a4 : 0xd3bd8a);
  }

  // A side window and chimney keep the four silhouettes readable from
  // oblique mobile camera angles, especially at the left and right boundaries.
  for (const side of [-1, 1]) {
    part(house, softCube, [.10, .91, 1.12], [side * (w / 2 + .055), 1.67, -.54], home.trim);
    part(house, cube, [.11, .75, .93], [side * (w / 2 + .11), 1.67, -.54], 0xb3c9c1, 'ceramic');
  }
  part(house, cube, [.58, 1.04, .62], [w * .25, eave + .48, -d * .17], 0xa36d59, 'ceramic');
  part(house, softCube, [.73, .14, .76], [w * .25, eave + 1.02, -d * .17], home.trim, 'ceramic');

  // A small front garden with a central open gate and private stepping stones.
  const fenceZ = face + 4.35;
  for (const side of [-1, 1]) {
    for (const y of [.34, .67]) {
      part(house, cube, [w / 2 - .67, .07, .10],
        [side * (w / 4 + .65), y, fenceZ], index % 2 ? 0xbba88d : 0xe0d4bb);
    }
    for (let i = 0; i < 7; i++) {
      const x = side * (1.15 + i * ((w / 2 - .23) / 7));
      part(house, softCube, [.09, .87, .13], [x, .43, fenceZ], index % 2 ? 0xb9aa90 : 0xf1dfc0);
    }
  }
  for (let i = 0; i < 7; i++) {
    const z = face + .86 + i * .47;
    part(house, softCube, [1.02, .065, .33], [((i % 2) - .5) * .045, .02, z],
      [0xc9b69c, 0xd9c7a9, 0xbca98e][i % 3], 'ceramic');
  }
  for (const side of [-1, 1]) {
    flowerbed(house, side * (w / 2 - .74), face + 1.47, index + (side + 1) / 2);
    planting(house, side * (w / 2 + .62), face + 1.94, index + 1);
  }
  // Larger personal plot: side borders, letterbox, a garden stool and
  // distinctive outdoor props. Keep the central walking lane unobstructed.
  for (const side of [-1, 1]) {
    for(let i=0;i<4;i++) {
      const z=face-1.0+i*1.45;
      part(house, orb, [.38,.30,.48],
        [side*(w/2+1.35), .22, z], (i+index)%2 ? 0x82976c : 0x718d67);
    }
    for(const z of [face-.10,face+2.15,face+4.26]) {
      part(house, softCube, [.12,.83,.14],
        [side*(w/2+1.70),.43,z], 0xb3a184,'wood');
    }
  }
  const mailX=w*.32;
  part(house, softCube, [.12, .85, .14], [mailX,.42,face+3.88], 0x8a725d,'wood');
  part(house, softCube, [.39, .28, .33], [mailX,.87,face+3.88], home.roof, 'metal');
  part(house, cube, [.27,.025,.033], [mailX,.88,face+4.06], home.trim,'ceramic');
  part(house, cube, [.48,.055,.34], [-w*.36,.51,face+2.46], 0xb99b78,'wood');
  for(const dx of [-.18,.18]) {
    part(house, cube, [.06,.49,.07], [-w*.36+dx,.25,face+2.46], 0x99785d,'wood');
  }
  part(house, drum, [.13,.17,.13], [-w*.36,.65,face+2.46], 0xe6cfaa,'ceramic');
  if (index === 1 || index === 2) {
    // A modest secondary volume gives the orchard and rear home different
    // silhouettes without introducing heavy unique meshes.
    part(house, cube, [1.85, 1.76, 2.03], [w / 2 + .61, .89, -d * .18], home.plaster, 'ceramic');
    part(house, cube, [2.18, .19, 2.42], [w / 2 + .61, 1.88, -d * .18], home.roof, 'ceramic');
  }
  const gardenZ = face + 2.10;
  const gardenX = w * .37;
  if(index===0) {
    for(let row=0;row<3;row++) {
      part(house,softCube,[1.13,.14,.43],[-gardenX,.05,gardenZ-1.05+row*.57],0xb28059,'wood');
      for(let n=0;n<4;n++)part(house,orb,[.11,.085,.075],[-gardenX-.39+n*.26,.16,gardenZ-1.05+row*.57],n%2?0x6e8862:0x879f62);
    }
  } else if(index===1) {
    for(const side of [-1,1])for(let n=0;n<3;n++)
      part(house,softCube,[.52,.12,.43],[side*(gardenX-.20+n*.22),.03,gardenZ-1.13+n*.29],0xd0c3a4,'ceramic');
    part(house, softCube,[.28,.51,.32],[gardenX,.26,gardenZ-.10],0x877b66,'ceramic');
  } else if(index===2) {
    for(const side of [-1,1]){
      part(house, softCube,[.68,.16,.43],[side*gardenX,.08,gardenZ-1.1],0x9a6f55,'wood');
      flowerbed(house,side*gardenX,gardenZ-.4,side + 2);
    }
  } else {
    for(const x of [-gardenX-.48,-gardenX+.49])
      part(house,cube,[.074,.75,.49],[x,.40,gardenZ-1.2],0x637b74,'metal');
    part(house,softCube,[1.15,.09,.51],[-gardenX,.54,gardenZ-1.18],0xb38b63,'wood');
    part(house,softCube,[1.16,.21,.095],[-gardenX,.74,gardenZ-1.38],0xb38b63,'wood');
  }
  batchRigidParts(house, true);
  root.add(house);
}

export function buildNeighborhood(parent:THREE.Object3D,glass?:THREE.MeshStandardMaterial):THREE.Group {
  const root = new THREE.Group();
  root.name='Four neighboring homes and their residents';
  parent.add(root);
  for(let i=0;i<NEIGHBOR_HOMES.length;i++){
    const home=NEIGHBOR_HOMES[i];
    cottage(root,home,i,glass);
    const {gate,sidewalk}=homeStops(home);
    const dx=sidewalk.x-gate.x,dz=sidewalk.z-gate.z;
    const length=Math.hypot(dx,dz),yaw=Math.atan2(dx,dz);
    for(let k=0;k<Math.floor(length/.55);k++){
      const f=(k+.5)*.55/length;
      const step=part(root,softCube,[.90,.050,.48],
        [gate.x+dx*f,.008,gate.z+dz*f],
        [0xd3c1a1,0xc9b79d,0xe1cfb0][(k+i)%3],'ceramic');
      step.rotation.y=yaw;
    }
  }
  return root;
}
