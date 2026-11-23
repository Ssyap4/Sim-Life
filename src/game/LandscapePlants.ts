import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { finish, type XYZ } from './ArtKit';

export function landscapeRandom(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function crownGeometry(detail: number) {
  const source = new THREE.IcosahedronGeometry(1, detail);
  source.deleteAttribute('normal');
  source.deleteAttribute('uv');
  const geometry = mergeVertices(source);
  source.dispose();
  const positions = geometry.getAttribute('position');
  const pigment: number[] = [];
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const lobes = 1+.15*Math.sin(x*7+y*6)*Math.cos(z*6-y*3)+.065*Math.sin(x*12-z*9);
    positions.setXYZ(i,x*lobes,y*lobes,z*lobes);
    pigment.push(1+.105*Math.sin(x*10+z*2)*Math.cos(y*8-z*9));
  }
  geometry.setAttribute('pigment',new THREE.Float32BufferAttribute(pigment,1));
  geometry.computeVertexNormals();
  return geometry;
}

const crown = crownGeometry(1);
const coarse = crownGeometry(0);
const twig = new THREE.CylinderGeometry(.53, 1, 1, 6);
const petal = new THREE.SphereGeometry(1, 6, 3);
const leaf = new THREE.BufferGeometry();
leaf.setAttribute('position', new THREE.Float32BufferAttribute([
  0,0,-1, -.68,.04,-.28, -.45,.11,.48, 0,.16,1, .45,.05,.48, .68,.02,-.28,
  0,.32,0, 0,-.08,0,
], 3));
leaf.setIndex([0,1,6, 1,2,6, 2,3,6, 3,4,6, 4,5,6, 5,0,6,
  1,0,7, 2,1,7, 3,2,7, 4,3,7, 5,4,7, 0,5,7]);
leaf.computeVertexNormals();

const plantMaterial = finish(0xffffff, 'fabric', true);

/** Opaque botanical parts share one draw per patch. Indexed meshes retain their smooth normals. */
export class PlantBatch {
  private readonly position: number[] = [];
  private readonly normal: number[] = [];
  private readonly color: number[] = [];
  private readonly indices: number[] = [];
  private readonly transform = new THREE.Object3D();
  private readonly normalMatrix = new THREE.Matrix3();
  private readonly vector = new THREE.Vector3();
  private readonly rgb = new THREE.Color();

  private add(geometry: THREE.BufferGeometry, color: number, at: XYZ, scale: XYZ,
    yaw = 0, pitch = 0, roll = 0, basis?: THREE.Quaternion, gradient = .16) {
    const t = this.transform;
    t.position.set(...at);
    t.scale.set(...scale);
    t.rotation.set(pitch, yaw, roll, 'YXZ');
    if (basis) t.quaternion.copy(basis);
    t.updateMatrix();
    this.normalMatrix.getNormalMatrix(t.matrix);
    this.rgb.setHex(color);
    const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal'), pigment = geometry.getAttribute('pigment');
    const start = this.position.length / 3;
    for (let i = 0; i < p.count; i++) {
      const shade = (pigment?.getX(i) ?? 1) + THREE.MathUtils.clamp(p.getY(i), -1, 1) * gradient;
      this.vector.fromBufferAttribute(p, i).applyMatrix4(t.matrix);
      this.position.push(this.vector.x, this.vector.y, this.vector.z);
      this.vector.fromBufferAttribute(n, i).applyNormalMatrix(this.normalMatrix);
      this.normal.push(this.vector.x, this.vector.y, this.vector.z);
      this.color.push(this.rgb.r * shade, this.rgb.g * shade, this.rgb.b * shade);
    }
    const index = geometry.getIndex();
    if (!index) return;
    for (let i = 0; i < index.count; i++) this.indices.push(index.getX(i) + start);
  }

  cluster(color: number, at: XYZ, scale: XYZ, yaw: number, distant = false, roll = 0) {
    this.add(distant ? coarse : crown, color, at, scale, yaw, 0, roll, undefined, .19);
  }

  blade(color: number, at: XYZ, scale: XYZ, yaw: number, pitch: number, roll = 0) {
    this.add(leaf, color, at, scale, yaw, pitch, roll);
  }

  bud(color: number, at: XYZ, scale: XYZ, yaw = 0, pitch = 0) {
    this.add(petal, color, at, scale, yaw, pitch, 0, undefined, .08);
  }

  stem(color: number, from: XYZ, to: XYZ, radius: number) {
    const start = new THREE.Vector3(...from);
    const delta = new THREE.Vector3(...to).sub(start);
    const length = delta.length();
    const basis = new THREE.Quaternion().setFromUnitVectors(THREE.Object3D.DEFAULT_UP, delta.normalize());
    this.add(twig, color, start.addScaledVector(delta, length * .5).toArray(), [radius,length,radius], 0,0,0,basis);
  }

  attach(parent: THREE.Object3D, name: string) {
    if (!this.indices.length) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.position, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normal, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.color, 3));
    geometry.setIndex(this.indices);
    const mesh = new THREE.Mesh(geometry, plantMaterial);
    mesh.name = name;
    parent.add(mesh);
  }
}

const species = {
  birch: { bark:0xe4ddd0, branch:0x988979, hues:[0x5b9048,0x7bac50,0xa6c66c], height:3.55, spread:.98 },
  linden: { bark:0x826449, branch:0x765942, hues:[0x47835c,0x689960,0x89ae69], height:3.32, spread:1.36 },
  maple: { bark:0x86624d, branch:0x805e4a, hues:[0xa26c47,0xc58b44,0xe0ac61], height:3.13, spread:1.45 },
  ornamental: { bark:0x96725e, branch:0x805d50, hues:[0xa95d7b,0xd194a8,0xefbdd1], height:2.52, spread:1.18 },
  spruce: { bark:0x755b43, branch:0x655144, hues:[0x386855,0x538468,0x7a9f71], height:4.23, spread:1.07 },
} as const;
export type LandscapeTree = keyof typeof species;

export function growTree(batch: PlantBatch, x: number, z: number, kind: LandscapeTree, size: number, seed: number, distant = false) {
  const style = species[kind], rng = landscapeRandom(seed);
  const h = style.height * size, w = style.spread * size;
  const dx = (rng() - .5) * .46 * size, dz = (rng() - .5) * .34 * size;
  const fork: XYZ = [x + dx * .30, h * .45, z + dz * .30];
  const apex: XYZ = [x + dx, h * .97, z + dz];
  const radius = (kind === 'birch' ? .092 : .143) * size;
  batch.stem(style.bark, [x,0,z], fork, radius);
  batch.stem(style.bark, fork, apex, radius * .61);
  if (!distant) {
    for (let i = 0; i < 4; i++) {
      const a = seed + i * 1.57;
      batch.stem(style.branch, [x + Math.sin(a) * radius * 1.85,.018,z + Math.cos(a) * radius * 1.85],
        [x,.19 * size,z], radius * .28);
    }
  }
  if (kind === 'birch' && !distant) {
    for (let i = 1; i < 13; i++) {
      const a = i * 2.61 + seed, y = h * (.03 + i * .040), f = y / fork[1];
      const r = radius * (1 - f * .47);
      batch.blade(i % 3 ? 0x65574c : 0x9e8973,
        [x + dx * f * .30 + Math.sin(a) * r, y, z + dz * f * .30 + Math.cos(a) * r],
        [.050,.021,.020], a, Math.PI / 2);
    }
  }
  if (kind === 'spruce') {
    for (let tier = 0; tier < 6; tier++) {
      const t = tier / 5;
      const y = h * (.30 + t * .64), r = w * (1.04 - t * .91);
      batch.cluster(style.hues[tier % 3], [x + dx * t,y,z + dz * t], [r,h * (.15 - t * .056),r], tier * .7, distant);
      if (distant) continue;
      for (let i = 0; i < 7; i++) {
        const a = seed + i * Math.PI * 2 / 7 + tier * .54;
        batch.blade(style.hues[(tier + i) % 3], [x + Math.sin(a) * r * .67,y - h * .024,z + Math.cos(a) * r * .67],
          [r * .33,r * .22,r * .51], a, .35 + t * .23);
      }
    }
    return;
  }
  const birch = kind === 'birch';
  batch.cluster(style.hues[0], [x + dx,h * .74,z + dz], [w * .83,h * (birch ? .29 : .24),w * .76], seed, distant);
  batch.cluster(style.hues[2], [apex[0],h * .94,apex[2]], [w * .54,h * .22,w * .49], seed * .23, distant);
  for (let i = 0; i < 7; i++) {
    const a = seed * .37 + i * 2.39996, r = w * (.53 + rng() * .34);
    const end: XYZ = [x + dx + Math.sin(a) * r,h * (.62 + i % 4 * .084 + rng() * .025),z + dz + Math.cos(a) * r];
    if (!distant) {
      const elbow: XYZ = [(fork[0] + end[0]) * .5,(fork[1] + end[1]) * .5,end[2] * .5 + fork[2] * .5];
      batch.stem(style.branch, fork, elbow, radius * .44);
      batch.stem(style.branch, elbow, end, radius * .27);
    }
    const height = (birch ? .52 : .41) * size;
    batch.cluster(style.hues[i % 3], end, [w * (.45 + i%3*.034),height * (.91+i%2*.19),w * (.47-i%3*.032)], a, distant, (i % 2 - .5) * .30);
    if (distant) continue;
    const lift = (i % 2 ? .38 : .25) * size;
    batch.cluster(style.hues[(i + 1) % 3], [end[0] + Math.sin(a + 1.7) * .27 * w,end[1] + lift,end[2] + Math.cos(a + 1.7) * .27 * w],
      [w * .32,height * .82,w * .34], a + 1.6);
    for (let spray = 0; spray < 3; spray++) {
      const spin = a + spray * 1.5;
      batch.blade(style.hues[(spray + i + 1) % 3], [end[0] + Math.sin(spin) * w * .42,end[1] + .07 * size,end[2] + Math.cos(spin) * w * .39],
        [.14 * size,.12 * size,.29 * size], spin, -.12 + spray * .28);
    }
    if (kind === 'ornamental') for (let j = 0; j < 3; j++) {
      const spin = a + j * 2.4;
      batch.bud(j % 2 ? 0xf4ccd9 : 0xf1adc6, [end[0] + Math.sin(spin) * w * .36,end[1] + height * .81,end[2] + Math.cos(spin) * w * .35],
        [.086 * size,.041 * size,.073 * size], spin);
    }
  }
}

const shrubs = [
  [0x487650,0x66955b,0x90ae64], [0x52795b,0x7d9d72,0xa8ba85],
  [0x5d8151,0x81a45c,0xb6ba70], [0x446b60,0x669b86,0x9abbaa],
] as const;

export function growShrub(batch: PlantBatch, x: number, y: number, z: number, w: number, h: number, d: number,
  palette: number, seed: number, distant = false) {
  const colors = shrubs[palette % shrubs.length], rng = landscapeRandom(seed);
  batch.cluster(colors[0], [x,y + h * .38,z], [w * .48,h * .53,d * .46], seed, distant);
  for (let i = 0; i < (distant ? 4 : 7); i++) {
    const a = i * 2.39996 + seed, r = .20 + rng() * .12;
    const p: XYZ = [x + Math.sin(a) * w * r,y + h * (.41 + rng() * .32),z + Math.cos(a) * d * r];
    batch.cluster(colors[(i + 1) % 3], p, [w * .27,h * .37,d * .28], a, distant);
    if (!distant) {
      batch.blade(colors[2], [p[0],p[1] + h * .25,p[2]], [w * .13,h * .27,d * .20], a + .7, -.38 + rng() * .52);
      batch.blade(colors[1], [p[0] + Math.sin(a) * w * .23,p[1],p[2] + Math.cos(a) * d * .24],
        [w * .13,h * .23,d * .17], a, -.16);
    }
  }
}

const flowerPalettes = [
  [0xffecbf,0xf5f1d8,0xe0a446], [0xe787a6,0xf2b1c0,0xb85570],
  [0x997acb,0xc3abe6,0x8066b9], [0xef9160,0xffb565,0xc96045],
] as const;

export function growFlowers(batch: PlantBatch, x: number, y: number, z: number, w: number, d: number,
  palette: number, count: number, seed: number, distant = false, canPlant?: (x:number,z:number)=>boolean) {
  const rng = landscapeRandom(seed);
  const hues = flowerPalettes[palette % flowerPalettes.length];
  // Each bed has a dominant botanical character rather than one stamp
  // repeated everywhere. Occasional companion stems break up uniform rows.
  const dominant=Math.floor(rng()*4);
  const stems = distant ? Math.ceil(count * .46) : count;
  for (let i = 0; i < stems; i++) {
    const a = i * 2.39996 + rng() * .7, r = Math.sqrt((i + .5) / stems) * .49;
    const px = x + Math.sin(a) * w * r, pz = z + Math.cos(a) * d * r;
    const kind=(dominant+(i%7===0?1:0))%4; // daisies, tall spikes, tulips, pompons
    const h=.17+rng()*(kind===1?.36:kind===2?.23:.19);
    if(canPlant&&!canPlant(px,pz))continue;
    const tip: XYZ = [px + Math.sin(a) * .04,y + h,pz + Math.cos(a) * .04];
    if(distant) {
      batch.cluster(hues[i%3],tip,[.092,palette===2?.14:.045,.084],a,true);
      continue;
    }
    batch.stem(0x578252, [px,y,pz], tip, .011);
    batch.blade(0x7fa85d, [px,y + h * .39,pz], [.048,.052,.12], a + 1.15, -.46);
    if(kind===1) {
      // Lupine-like upright spikes that rise above shorter bedding flowers.
      for(let j=0;j<6;j++){
        const angle=a+j*2.39996,radius=.041-j*.004;
        batch.bud(hues[j%3],
          [tip[0]+Math.sin(angle)*radius,tip[1]-j*.033,tip[2]+Math.cos(angle)*radius],
          [.034-j*.002,.034,.036-j*.002],angle,.31);
      }
      continue;
    }
    if(kind===2){
      // Three tall cup petals, a pointed tulip silhouette.
      for(let j=0;j<3;j++){
        const angle=a+j*2.0944;
        batch.bud(hues[(i+j)%3],
          [tip[0]+Math.sin(angle)*.027,tip[1]+.02,tip[2]+Math.cos(angle)*.026],
          [.044,.078,.035],angle,.20);
      }
      continue;
    }
    if(kind===3){
      // Round clustered pompons rather than identical flat daisies.
      for(let j=0;j<7;j++){
        const angle=a+j*2.39996;
        batch.bud(hues[(j+i)%3],
          [tip[0]+Math.sin(angle)*.036,tip[1]+(j%3)*.026,tip[2]+Math.cos(angle)*.036],
          [.032,.032,.032],angle);
      }
      continue;
    }
    for(let j=0;j<6;j++){
      const angle=a+j*Math.PI/3,r=palette===0?.062:.050;
      batch.bud(hues[(i+j%3)%3],
        [tip[0]+Math.sin(angle)*r,tip[1]+.018,tip[2]+Math.cos(angle)*r],
        [.036,.024,.055],angle,-.20);
    }
    batch.bud(palette===0?0xf1a52b:hues[2],
      [tip[0],tip[1]+.030,tip[2]],[.033,.022,.033]);
  }
}


/** Lightweight, visibly different edible crops. Soil is built into the yard;
 * crop leaves/fruits are collected into the same batched garden mesh. */
export type KitchenCrop='tomato'|'herbs'|'flowers'|'cabbage';
export function growKitchenGarden(batch:PlantBatch,x:number,y:number,z:number,w:number,d:number,
  crop:KitchenCrop,seed:number,distant=false):void {
  const rng=landscapeRandom(seed);
  const cols=crop==='tomato'?3:crop==='cabbage'?3:4;
  const rows=crop==='cabbage'?3:4;
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    const a=(row*cols+col),jitter=distant?0:.05;
    const px=x+(col/(cols-1)-.5)*w*.73+(rng()-.5)*jitter;
    const pz=z+(row/(rows-1)-.5)*d*.70+(rng()-.5)*jitter;
    const height=(crop==='tomato'?.48:crop==='herbs'?.24:crop==='cabbage'?.22:.34)*(.82+rng()*.38);
    if(distant){
      batch.cluster(crop==='flowers'?0xb88aa8:crop==='tomato'?0x5c8e52:
        crop==='cabbage'?0x78a875:0x6a9162,
      [px,y+height*.6,pz],[.13,height*.65,.14],seed+a,true);
      continue;
    }
    batch.stem(0x577a45,[px,y,pz],[px,y+height,pz],.010);
    for(let leafIndex=0;leafIndex<(crop==='cabbage'?7:5);leafIndex++){
      const angle=a*2.3+leafIndex*2.39996+seed*.04;
      const spread=crop==='cabbage'?.18:crop==='tomato'?.14:crop==='herbs'?.105:.12;
      const cy=y+height*(.34+leafIndex*.09);
      batch.blade([0x537f4f,0x739653,0x98b66c,0x46765a][(a+leafIndex)%4],
        [px+Math.sin(angle)*spread*.63,cy,pz+Math.cos(angle)*spread*.63],
        [spread*.73,.065+height*.10,spread*1.26],angle,-.34+(leafIndex%3)*.19);
    }
    if(crop==='tomato'){
      for(let fruit=0;fruit<3;fruit++){
        const spin=seed+a*1.7+fruit*2.23;
        batch.bud([0xd45b47,0xe38b42,0xb75040][(a+fruit)%3],
          [px+Math.sin(spin)*.087,y+height*(.55+fruit*.10),pz+Math.cos(spin)*.09],
          [.045,.045,.045],spin);
      }
      batch.stem(0x96745b,[px+.14,y,pz-.13],[px+.14,y+.73,pz-.13],.014);
    }else if(crop==='cabbage'){
      batch.cluster([0x7baa70,0x9cbd79,0x658e65][a%3],
        [px,y+height*.58,pz],[.14,.115,.13],a+.9);
    }else if(crop==='herbs'){
      for(let head=0;head<3;head++){
        const spin=a*1.2+head*2.4;
        batch.bud(head%2?0xbfc68e:0xe0d5a9,
          [px+Math.sin(spin)*.052,y+height+head*.018,pz+Math.cos(spin)*.045],
          [.032,.038,.030],spin);
      }
    }else{
      const colors=[0xe7a6b5,0xf0df96,0xceb6de,0xdca390];
      for(let head=0;head<5;head++){
        const spin=head*1.257+a;
        batch.bud(colors[(a+head)%4],
          [px+Math.sin(spin)*.066,y+height+.016,pz+Math.cos(spin)*.066],
          [.039,.026,.045],spin);
      }
      batch.bud(0xe4bf56,[px,y+height+.028,pz],[.035,.026,.035]);
    }
  }
}

const tuftGeometry = new THREE.BufferGeometry();
const tuftPositions: number[] = [];
const tuftColors: number[] = [];
for (let i = 0; i < 9; i++) {
  // Narrow and wide fronds, natural curvature, uneven crowns; each group
  // is a single cheap instanced blade cluster at runtime.
  const angle = i * 2.39996, radius=.026+.019*(i%4);
  const x = Math.sin(angle)*radius, z = Math.cos(angle)*radius;
  const width=(i%3===0?.019:.027)+i%4*.004;
  const height=.13+(i%5)*.034;
  const bow=Math.sin(angle)*(.039+.020*(i%3));
  const tip=bow+Math.cos(angle)*.055;
  tuftPositions.push(x-width,0,z,x+width,0,z,
    x+bow*.48+width*.38,height*.51,z+.024,
    x-width,0,z,x+bow*.48+width*.38,height*.51,z+.024,
    x+bow*.45-width*.37,height*.48,z-.021,
    x+bow*.45-width*.37,height*.48,z-.021,
    x+bow*.48+width*.38,height*.51,z+.024,
    x+tip,height,z+.042);
  const light=.80+(i%4)*.09;
  for(const shade of [.62,.70,.88,.62,.88,.76,.76,.91,light])
    tuftColors.push(shade,shade*.99,shade*.96);
}
tuftGeometry.setAttribute('position', new THREE.Float32BufferAttribute(tuftPositions,3));
tuftGeometry.setAttribute('color', new THREE.Float32BufferAttribute(tuftColors,3));
tuftGeometry.computeVertexNormals();

export const landscapeSharedGeometry = [tuftGeometry];
export type GrassTuft = {x:number; z:number; size:number; yaw:number; color:number};

export function grassMaterial() {
  const material = new THREE.MeshStandardMaterial({ color:0xffffff, side:THREE.DoubleSide, vertexColors:true, roughness:1 });
  const wind = {value:0};
  material.onBeforeCompile = shader => {
    shader.uniforms.landscapeWind = wind;
    shader.vertexShader = 'uniform float landscapeWind;\n' + shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\ntransformed.x += transformed.y * transformed.y * sin(landscapeWind * 1.48 + instanceMatrix[3].x * .81 + instanceMatrix[3].z * .62) * .37;');
  };
  return {material, wind};
}

export function addTufts(parent: THREE.Object3D, tufts: readonly GrassTuft[], material: THREE.Material) {
  if (!tufts.length) return;
  const mesh = new THREE.InstancedMesh(tuftGeometry, material, tufts.length);
  mesh.name = 'Grass tufts';
  const t = new THREE.Object3D(), rgb = new THREE.Color();
  for (const [i,b] of tufts.entries()) {
    t.position.set(b.x,.004,b.z);
    t.scale.set(b.size*(.74+(i%5)*.085),b.size*(.79+(i%7)*.060),b.size*(.81+(i%3)*.11));
    t.rotation.y = b.yaw;
    t.updateMatrix();
    mesh.setMatrixAt(i,t.matrix);
    mesh.setColorAt(i,rgb.setHex(b.color));
  }
  mesh.computeBoundingSphere();
  parent.add(mesh);
}
