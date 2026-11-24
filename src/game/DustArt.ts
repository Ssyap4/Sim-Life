import * as THREE from 'three';
import {DUST_ROOMS,DUST_MAX,initialDust,type HomeDust} from '../shared/homeDust';
/** One reusable texture, static room planes, no particles or frame updates. */
export class DustArt{
 private readonly layers:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>[]=[];
 constructor(scene:THREE.Scene){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d')!;
  let seed=417;
  const rng=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  for(let i=0;i<650;i++){
   const x=rng()*128,y=rng()*128,r=.5+rng()*2.1;
   ctx.fillStyle=i%3===0?'rgba(77,66,52,.36)':'rgba(192,181,158,.5)';
   ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  }
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  for(const r of DUST_ROOMS){
   const material=new THREE.MeshBasicMaterial({map,transparent:true,opacity:0,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
   const mesh=new THREE.Mesh(new THREE.PlaneGeometry(r.maxX-r.minX-.12,r.maxZ-r.minZ-.12),material);
   mesh.rotation.x=-Math.PI/2;mesh.position.set((r.minX+r.maxX)/2,r.id.startsWith('wing')?.035:.012,(r.minZ+r.maxZ)/2);
   mesh.name='Dust:'+r.id;mesh.visible=false;scene.add(mesh);this.layers.push(mesh);
  }
 }
 sync(dust:HomeDust=initialDust()){
  this.layers.forEach((layer,i)=>{
   const value=dust[DUST_ROOMS[i].id]/DUST_MAX;
   layer.visible=value>=.25;layer.material.opacity=Math.max(0,(value-.2)*.4);
  });
 }
}