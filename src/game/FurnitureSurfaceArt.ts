import * as THREE from 'three';
import { finishSurface, paintedMap } from './ArtKit';

type SurfaceKind='wood'|'fabric';
function woodGrain(){
 return paintedMap('furniture-wood-polish-v2',256,128,ctx=>{
  ctx.fillStyle='#f0e9df';ctx.fillRect(0,0,256,128);
  let seed=392;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  for(let y=0;y<128;y+=2){
   const bend=(rand()-.5)*7,shade=rand();
   ctx.strokeStyle=shade<.38?'#96857560':shade<.65?'#c0a99580':'#fffaf4b0';
   ctx.lineWidth=.55+rand()*.75;ctx.beginPath();ctx.moveTo(0,y);
   ctx.bezierCurveTo(64,y+bend,180,y-bend*.6,256,y);ctx.stroke();
  }
  for(const [x,y] of [[72,34],[190,93]]){
   for(let i=0;i<5;i++){ctx.strokeStyle=i%2?'#b5a08a69':'#e3d3c1a0';ctx.lineWidth=.8;ctx.beginPath();ctx.ellipse(x,y,7+i*7,1.2+i*1.6,-.08,0,Math.PI*2);ctx.stroke();}
  }
  const glaze=ctx.createLinearGradient(0,0,0,128);glaze.addColorStop(0,'#fff8ed35');glaze.addColorStop(.5,'#ffffff00');glaze.addColorStop(1,'#b29e8a25');ctx.fillStyle=glaze;ctx.fillRect(0,0,256,128);
 });
}
function fabricWeave(){
 return paintedMap('furniture-fabric-polish-v2',128,128,ctx=>{
  ctx.fillStyle='#edece7';ctx.fillRect(0,0,128,128);
  for(let y=0;y<128;y+=3)for(let x=0;x<128;x+=3){
   ctx.fillStyle=(x+y)%6===0?'#b9b6ae9c':'#fffdf8b0';ctx.fillRect(x,y,2,2);
  }
  for(let i=0;i<128;i+=12){ctx.fillStyle='#c2bfb738';ctx.fillRect(i,0,1,128);ctx.fillRect(0,i,128,1);}
  // Subtle broad weave variation, legible on a small portrait viewport.
  const soft=ctx.createRadialGradient(64,57,10,64,57,78);soft.addColorStop(0,'#ffffff28');soft.addColorStop(1,'#8c898025');ctx.fillStyle=soft;ctx.fillRect(0,0,128,128);
 });
}
const cached=new WeakMap<THREE.MeshStandardMaterial,THREE.MeshStandardMaterial>();
/** Apply after rigid batching: identical meshes, vertex colors, UVs and collision volumes.
 * Only explicitly selected furniture uses these two shared diffuse maps. */
export function polishFurniture(root:THREE.Object3D, fabrics=true,
 mapFor:(kind:SurfaceKind)=>THREE.Texture|null=kind=>kind==='wood'?woodGrain():fabricWeave()){
 root.traverse(part=>{
  if(!(part instanceof THREE.Mesh)||part instanceof THREE.SkinnedMesh||!part.geometry.hasAttribute('uv')||Array.isArray(part.material))return;
  const base=part.material;if(!(base instanceof THREE.MeshStandardMaterial)||base.map||base.transparent||base.emissiveIntensity>0&&base.emissive.getHex()!==0)return;
  const kind=finishSurface(base);
  if(kind!=='wood'&&(kind!=='fabric'||!fabrics))return;
  const map=mapFor(kind);if(!map)return;
  let material=cached.get(base);
  if(!material||material.map!==map){material=base.clone();material.map=map;cached.set(base,material);}
  part.material=material;
 });
}
