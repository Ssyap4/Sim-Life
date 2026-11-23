import * as THREE from 'three';
import { batchRigidParts,cube,softCube,drum,orb,finish } from './ArtKit';
import { NEIGHBOR_BENCH_TOP,yardFeatures,type NeighborHome } from '../shared/neighborHomes';

type Dimension=readonly [number,number,number];
function piece(root:THREE.Object3D,geometry:THREE.BufferGeometry,size:Dimension,
  position:Dimension,color:number,material:'wood'|'ceramic'|'metal'|'fabric'='wood') {
  const mesh=new THREE.Mesh(geometry,finish(color,material));
  mesh.position.set(...position);mesh.scale.set(...size);
  mesh.castShadow=false;mesh.receiveShadow=true;root.add(mesh);return mesh;
}
function flowerPlanter(root:THREE.Object3D,x:number,z:number,w:number,d:number,shade:number){
  // Asymmetrical corners and layered timber/stone edges read like a real plot.
  piece(root,softCube,[w,.19,d],[x,.09,z],shade,'wood');
  piece(root,softCube,[w-.10,.043,d-.10],[x,.204,z],0x544533,'ceramic');
  for(const edge of [-1,1]){
    piece(root,cube,[w+.09,.10,.081],[x,.25,z+edge*d*.48],0xb99b7c);
    piece(root,cube,[.09,.12,d+.08],[x+edge*w*.48,.25,z],0xc8a987);
  }
}
function gardenBarbecue(root:THREE.Object3D,x:number,z:number,i:number) {
  const barbecue=new THREE.Group();
  barbecue.name='Мангал соседа '+(i+1);
  barbecue.position.set(x,0,z);
  const color=[0x495853,0x766a58,0x42545b,0x67614f][i];
  // Hearth, lower log shelf, grill, support legs and side tools.
  piece(barbecue,softCube,[1.22,.08,1.09],[0,.025,0],0xc7b99f,'ceramic');
  for(const legX of [-.31,.31])for(const legZ of [-.23,.23])
    piece(barbecue,cube,[.070,.53,.070],[legX,.30,legZ],0x4b4943,'metal');
  piece(barbecue,cube,[.84,.38,.56],[0,.72,0],color,'metal');
  piece(barbecue,cube,[.68,.04,.46],[0,.94,0],0x282d2b,'metal');
  for(let n=0;n<5;n++)
    piece(barbecue,cube,[.055,.022,.48],[(n-2)*.13,.969,0],0xa7ada4,'metal');
  // Food is physically recognizable at mobile zoom; dishes vary by lot.
  for(let n=0;n<3;n++){
    if(i%2===0){
      const skewer=piece(barbecue,drum,[.070,.27,.073],
        [(n-1)*.17,1.008,.005+(n%2)*.085],n%2?0xb45d37:0x936142,'ceramic');
      skewer.rotation.x=Math.PI/2;
    } else {
      const vegetable=piece(barbecue,drum,[.068,.16,.068],
        [(n-1)*.18,1.008,(n%2)*.14-.07],n%2?0xe0aa54:0x819854,'ceramic');
      vegetable.rotation.x=Math.PI/2;
    }
  }
  piece(barbecue,cube,[.79,.07,.38],[0,.26,0],0x7c6150);
  for(let n=0;n<3;n++){
    const twig=piece(barbecue,drum,[.08,.36,.08],[(n-1)*.19,.30,.03],0x79513a);
    twig.rotation.z=.9+(n-1)*.16;
  }
  piece(barbecue,cube,[.15,.034,.43],[.49,.75,0],0x9c8e75,'metal');
  // Solid parts are static; keep a named group for identity but merge the
  // metal, timber and ceramic surfaces into a handful of draw calls.
  batchRigidParts(barbecue,true);
  root.add(barbecue);
}
function yardBench(root:THREE.Object3D,x:number,z:number,i:number) {
  const bench=new THREE.Group();
  bench.name='Скамейка соседа '+(i+1);
  bench.position.set(x,0,z);
  const oak=[0x9b7451,0x927958,0xb18c6f,0x8c765c][i];
  const metal=[0x4d5f55,0x545e61,0x64735d,0x4e5850][i];
  piece(bench,softCube,[1.65,.11,.62],[0,.50,0],oak);
  for(const dz of [-.16,.16])
    piece(bench,cube,[1.61,.038,.080],[0,NEIGHBOR_BENCH_TOP-.019,dz],0xc19b75);
  for(const x0 of [-.69,.69]){
    piece(bench,cube,[.072,.53,.09],[x0,.27,.075],metal,'metal');
    piece(bench,cube,[.076,.90,.09],[x0,.65,-.26],metal,'metal');
    piece(bench,cube,[.088,.06,.49],[x0,.43,-.01],metal,'metal');
  }
  for(const y of [.76,.93])
    piece(bench,softCube,[1.65,.115,.086],[0,y,-.27],oak);
  if(i===1||i===3)for(const x0 of [-.81,.81])
    piece(bench,softCube,[.08,.15,.58],[x0,.64,0],oak);
  batchRigidParts(bench,true);
  root.add(bench);
}
function gardenDetails(root:THREE.Object3D,home:NeighborHome,i:number) {
  const w=home.width,face=home.depth/2;
  const palette=[0xa67c59,0x8c9870,0xbba082,0x8b745b][i];
  // Narrow paths weave around beds and seating, leaving the middle open.
  for(let j=0;j<4;j++){
    const x= (i%2?1:-1) * (w*.13+j*.34);
    const z=face+.92+(j%2)*.31;
    const stone=piece(root,softCube,[.27,.038,.39],[x,.014,z],
      [0xc4b39b,0xd5c6ab,0xb7ab9c,0xcbbba2][(i+j)%4],'ceramic');
    stone.rotation.y=(i+j%3-1)*.12;
  }
  // Watering barrel, pail, basket and occasional floral arches vary the lots.
  const barrelX=-w*.43;
  piece(root,drum,[.28,.52,.28],[barrelX,.26,face+2.90],0x98765a);
  piece(root,drum,[.30,.036,.30],[barrelX,.54,face+2.90],0x667d68,'metal');
  for(const y of [.11,.45])piece(root,drum,[.289,.034,.29],[barrelX,y,face+2.90],0x6c6151,'metal');
  if(i===0||i===2) {
    const pos=[w*.34,face+3.97] as const;
    piece(root,softCube,[.51,.32,.42],[pos[0],.17,pos[1]],palette);
    for(let k=0;k<4;k++)piece(root,orb,[.10,.07,.09],
      [pos[0]+(k%2-.5)*.23,.36,pos[1]+(Math.floor(k/2)-.5)*.18],i===0?0xc75f4b:0xf0c26f,'ceramic');
  }else{
    const cx=-w*.42,z=face+3.92;
    piece(root,drum,[.26,.31,.26],[cx,.18,z],0xa2886e);
    piece(root,drum,[.19,.04,.19],[cx,.36,z],0x6f7853);
  }
}
export function buildNeighborYard(root:THREE.Group,home:NeighborHome,i:number) {
  // The caller places everything inside the home's local coordinate space.
  const front=home.depth/2,style=yardFeatures(home,i);
  const benchX=-home.width*.30,benchZ=front+3.02;
  const grillX=home.width*.34,grillZ=front+2.89;
  const patchX=home.width*.31,patchZ=front+1.54;
  const flowerX=-home.width*.32,flowerZ=front+1.53;
  yardBench(root,benchX,benchZ,i);
  gardenBarbecue(root,grillX,grillZ,i);
  flowerPlanter(root,patchX,patchZ,style.patchArea.w,style.patchArea.d,
    style.style==='flowers'?0x947e65:style.style==='tomato'?0x8b694b:0x9d805e);
  if(i===2)flowerPlanter(root,flowerX,flowerZ,1.18,.58,0xa89079);
  if(i===1) {
    // Herb rack against the right-hand fence, instead of another copy of a bed.
    for(let n=0;n<3;n++){
      const z=front+3.15+n*.25;
      piece(root,softCube,[.60,.10,.22],[home.width*.44,.62+n*.25,z],0xa58865);
      piece(root,softCube,[.51,.13,.20],[home.width*.44,.74+n*.25,z],0x74654b);
    }
  }
  if(i===3){
    // Tiny espalier for the more rustic home.
    for(const x of [home.width*.18,home.width*.40])
      piece(root,cube,[.070,1.38,.067],[x,.69,front+1.02],0x887254);
    for(const y of [.55,1.18])
      piece(root,cube,[home.width*.27,.054,.05],[home.width*.29,y,front+1.02],0x9a805b);
  }
  gardenDetails(root,home,i);
}
