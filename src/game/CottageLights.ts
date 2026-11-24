import * as THREE from 'three';
import {HOUSE} from '../shared/home';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {cube,softCube,drum,finish,paintedMap,batchRigidParts} from './ArtKit';
/** Visible warm practicals with a single additional shadowless light.
 * The wall glow is a shared painted mask, not a post-processing pass. */
export function buildCottageLights(scene:THREE.Scene){
 const group=new THREE.Group();group.name='Cottage wall lighting';
 const metal=finish(0x654a30,'metal');
 const diffuser=new THREE.MeshStandardMaterial({color:0xffe7c4,emissive:0xffb96a,emissiveIntensity:0,roughness:.8});
 const map=paintedMap('cottage-wall-glow',64,64,ctx=>{
  const g=ctx.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,'rgba(255,194,105,.48)');g.addColorStop(.4,'rgba(255,184,92,.23)');g.addColorStop(1,'rgba(255,184,92,0)');
  ctx.fillStyle=g;ctx.fillRect(0,0,64,64);
 });
 const glowMat=new THREE.MeshBasicMaterial({map,transparent:true,opacity:0,depthWrite:false});
 const glows=new THREE.Group();glows.visible=false;const glowParts:THREE.BufferGeometry[]=[];
 for(const [x,y] of [[-9.02,2.47],[-4.84,2.47],[-1.45,2.71],[4.08,2.71],[7.45,2.54]]){
  const z=HOUSE.minZ+.16;
  const mount=new THREE.Mesh(cube,metal);mount.scale.set(.24,.37,.08);mount.position.set(x,y,z);group.add(mount);
  const shade=new THREE.Mesh(softCube,diffuser);shade.scale.set(.23,.28,.18);shade.position.set(x,y,z+.105);group.add(shade);
  for(const side of [-1,1]){const rim=new THREE.Mesh(cube,metal);rim.scale.set(.25,.035,.19);rim.position.set(x,y+side*.14,z+.105);group.add(rim);}
  if(map){glowParts.push(new THREE.PlaneGeometry(1.4,1.55).translate(x,y,z-.026));}
 }
 // Small ceiling-mounted fixtures leave the cutaway camera open.
 const shadeMat=new THREE.MeshStandardMaterial({color:0x8b6b48,roughness:.68,metalness:.22});
 for(const [x,y,z,wide] of [[2.39,2.75,-2.22,.44],[-2.36,2.76,1.0,.39],[7.1,2.72,-4.4,.26],[7.6,2.72,2.5,.29],[-7.3,2.72,3.35,.24]]){
  const rod=new THREE.Mesh(drum,metal);rod.scale.set(.018,.25,.018);rod.position.set(x,y+.18,z);group.add(rod);
  const shade=new THREE.Mesh(drum,shadeMat);shade.scale.set(wide,.11,wide);shade.position.set(x,y+.035,z);group.add(shade);
  const lamp=new THREE.Mesh(drum,diffuser);lamp.scale.set(wide*.86,.035,wide*.86);lamp.position.set(x,y-.033,z);group.add(lamp);
 }
 // Soft reflected pools give the bathrooms, study and dining table a local
 // evening glow without extra punctual lights or shadow-map passes.
 if(map)for(const [x,z,w,d] of [[2.39,-2.22,3.5,3.0],[-2.36,1.0,3.7,3.2],[7.1,-4.4,3.0,3.0],[7.6,2.5,3.4,3.4],[-7.3,3.35,2.8,2.4]]){
  const p=new THREE.PlaneGeometry(w,d);p.rotateX(-Math.PI/2);p.translate(x,.038,z);glowParts.push(p);
 }
 batchRigidParts(group);
 if(glowParts.length){const geo=mergeGeometries(glowParts);for(const p of glowParts)p.dispose();if(geo){const mesh=new THREE.Mesh(geo,glowMat);mesh.raycast=()=>{};glows.add(mesh);}}
 group.add(glows);
 // Decorative light fixtures must not intercept interaction rays.
 group.traverse(p=>{if(p instanceof THREE.Mesh)p.raycast=()=>{};});
 const bedroom=new THREE.PointLight(0xffc48c,0,11,2);
 bedroom.position.set(-6.5,2.55,-3.95);bedroom.castShadow=false;bedroom.visible=false;group.add(bedroom);
 scene.add(group);
 return {group,bedroom,setLevel(level:number){
  const amount=THREE.MathUtils.clamp(level,0,1);
  diffuser.emissiveIntensity=amount*1.25;
  glowMat.opacity=amount*.61;glows.visible=amount>.04;
  bedroom.intensity=amount*10;bedroom.visible=amount>.04;
 }};
}
