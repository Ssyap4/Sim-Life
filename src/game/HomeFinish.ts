import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {cube,finish,colors as C,paintedMap,panel,batchRigidParts} from './ArtKit';
import {HOUSE,HOUSE_WING} from '../shared/home';

export const DOOR_CLEAR_HEIGHT=2.24;
type Passage={x:number;z:number;width:number};
/** All upright casing sits outside the existing clear opening.
 * In contrast to the old knee-high headers, the lintel clears the actor. */
export function addPassageFinish(parent:THREE.Group,p:Passage,axis:'x'|'z'){
 const frame=new THREE.Group();
 frame.name='Finished passage';frame.position.set(p.x,0,p.z);
 if(axis==='z')frame.rotation.y=Math.PI/2;
 const add=(w:number,h:number,d:number,x:number,y:number,z:number,color:number)=>{
  const m=new THREE.Mesh(cube,finish(color,'wood'));
  m.scale.set(w,h,d);m.position.set(x,y,z);m.receiveShadow=true;frame.add(m);
 };
 const half=p.width/2,h=DOOR_CLEAR_HEIGHT;
 for(const side of [-1,1]){
  const z=side*(half+.045);
  add(.25,h,.09,0,h/2,z,C.walnut);
  for(const x of [-.137,.137])add(.038,h+.015,.13,x,h/2,side*(half+.065),C.oat);
  add(.285,.14,.12,0,.07,side*(half+.06),C.walnut);
 }
 add(.25,.105,p.width+.18,0,h+.0525,0,C.walnut);
 for(const x of [-.137,.137])add(.038,.065,p.width+.26,x,h+.078,0,C.oat);
 // A flush transition strip and thin inlay instead of a raised step.
 add(.34,.018,p.width,0,.012,0,C.oat);
 for(const x of [-.142,.142])add(.024,.02,p.width, x,.013,0,C.walnut);
 batchRigidParts(frame,true);
 frame.traverse(o=>{if(o instanceof THREE.Mesh)o.raycast=()=>{};});
 parent.add(frame);return frame;
}

/** The frames never animate or take taps. Combine all of one shell's
 * vertex-colored jamb meshes in shell-local coordinates, preserving UVs. */
export function batchPassageFinishes(parent:THREE.Group):void{
 const frames=parent.children.filter(o=>o.name==='Finished passage');
 if(frames.length<2)return;
 const parts=frames.flatMap(f=>f.children.map(m=>({f,m})));
 if(parts.some(({m})=>!(m instanceof THREE.Mesh)||Array.isArray(m.material)))return;
 const meshes=parts as {f:THREE.Object3D;m:THREE.Mesh}[];
 const material=meshes[0].m.material;
 if(meshes.some(({m})=>m.material!==material))return;
 const sources=meshes.map(({f,m})=>{
  f.updateMatrix();m.updateMatrix();
  return m.geometry.clone().applyMatrix4(m.matrix).applyMatrix4(f.matrix);
 });
 const merged=mergeGeometries(sources);
 sources.forEach(g=>g.dispose());
 if(!merged)return;
 const batch=new THREE.Mesh(merged,material);
 batch.name='Batched finished passages';batch.receiveShadow=true;batch.raycast=()=>{};
 for(const f of frames)parent.remove(f);
 for(const g of new Set(meshes.map(({m})=>m.geometry)))g.dispose();
 parent.add(batch);
}

function wallArtMap(){
 return paintedMap('home-rear-gallery-061',512,256,ctx=>{
  for(let i=0;i<2;i++){
   const x=i*256;
   ctx.fillStyle='#594534';ctx.fillRect(x,0,256,256);
   ctx.fillStyle='#ebdfcb';ctx.fillRect(x+8,8,240,240);
   ctx.fillStyle=i?'#b8c2ad':'#c3d1c5';ctx.fillRect(x+23,23,210,210);
   const sky=ctx.createLinearGradient(0,23,0,233);
   sky.addColorStop(0,i?'#e1ccac':'#c7ddd5');sky.addColorStop(1,i?'#b2a68a':'#a3b9ab');
   ctx.fillStyle=sky;ctx.fillRect(x+23,23,210,210);
   ctx.fillStyle=i?'#f0dfab':'#f7ead0';ctx.beginPath();ctx.arc(x+161,72,24,0,Math.PI*2);ctx.fill();
   for(const [y,color,offset] of [[135,'#8eaa91',0],[167,'#6e9178',19],[198,'#486f5b',-16]] as const){
    ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x+23,y+18);ctx.quadraticCurveTo(x+70,y-65+offset,x+128,y+8);ctx.quadraticCurveTo(x+185,y-45-offset,x+233,y+2);ctx.lineTo(x+233,233);ctx.lineTo(x+23,233);ctx.closePath();ctx.fill();
   }
  }
 });
}
/** Architectural details stay on the existing wall, not in the furnishing grid. */
export function addRearFinish(parent:THREE.Group){
 const root=new THREE.Group();root.name='Rear wall finish 061';
 const add=(w:number,h:number,d:number,x:number,y:number,z:number,color:number)=>{
  const m=new THREE.Mesh(cube,finish(color,'wood'));m.scale.set(w,h,d);m.position.set(x,y,z);m.receiveShadow=true;root.add(m);
 };
 const z=HOUSE.minZ+.12;
 // Continuous crown and base trim on the wing, aligned with the main shell.
 const w=HOUSE_WING.maxX-HOUSE.maxX;
 add(w-.02,.13,.079,(HOUSE_WING.maxX+HOUSE.maxX)/2,.085,z+.04,C.walnut);
 add(w-.02,.04,.06,(HOUSE_WING.maxX+HOUSE.maxX)/2,.16,z+.035,C.oat);
 // Timber joinery at both rear corners, inside the wall envelope.
 for(const x of [HOUSE.minX+.13,HOUSE_WING.maxX-.13]){
  add(.16,3.10,.055,x,1.55,z+.018,C.walnut);
  add(.038,3.10,.025,x+.045,1.55,z+.054,C.oat);
 }
 // Framed landscape pair in the study, clear of the existing wall lights.
 // One shared atlas with UV subranges, mounted flush to the wall.
 const map=wallArtMap();
 for(const [i,x] of [5.82,8.65].entries()){
  add(.90,.77,.055,x,2.22,z+.035,C.walnut);
  const m=panel(root,[x,2.22,z+.066],[.83,.70],map,i?0x9cae92:0xb5c8bb);
  m.geometry=m.geometry.clone();
  const uv=m.geometry.getAttribute('uv');
  for(let n=0;n<uv.count;n++)uv.setX(n,(uv.getX(n)+i)/2);
 }
 batchRigidParts(root,true);
 root.traverse(o=>{if(o instanceof THREE.Mesh)o.raycast=()=>{};});
 parent.add(root);return root;
}