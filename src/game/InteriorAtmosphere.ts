import * as THREE from 'three';
import type {PlaceId} from '../shared/locations';
import {STATIONS} from '../shared/locations';
import {painted,type LocationResources} from './LocationArt';
import {cube,finish,batchRigidParts} from './ArtKit';
type Profile={w:number;d:number;x:number;z:number;y:number;warm:number;floor:number;key:number;fill:number;lamps:readonly number[]};
const profiles:Partial<Record<PlaceId,Profile>>={
 market:{w:12,d:10,x:0,z:0,y:.016,warm:0xfff0d7,floor:0x9ca99e,key:1.75,fill:1.42,lamps:[-3.8,0,3.8]},
 cafe:{w:12,d:10,x:0,z:0,y:.008,warm:0xffd4a3,floor:0xaf8e70,key:1.48,fill:1.33,lamps:[-3.8,0,3.8]},
 petshop:{w:12,d:10,x:0,z:0,y:.009,warm:0xffebce,floor:0x9eae9c,key:1.65,fill:1.44,lamps:[-3.8,0,3.8]},
 clothing:{w:12,d:10,x:0,z:0,y:.009,warm:0xffe6da,floor:0xc2b0b4,key:1.68,fill:1.42,lamps:[-3.8,0,3.8]},
 electronics:{w:17,d:10,x:2.5,z:0,y:.013,warm:0xe9f3ff,floor:0xb1c3ce,key:1.82,fill:1.50,lamps:[-3,1,5,9]},
 education:{w:12,d:10,x:0,z:0,y:.014,warm:0xffedce,floor:0xc4bda9,key:1.65,fill:1.36,lamps:[]},
};
export function interiorLighting(place:PlaceId){return profiles[place];}
/** One baked contact-light atlas per older shop. Uses existing station footprints;
 * no collision meshes, new point lights, or shadow-map passes. */
export function polishShopInterior(root:THREE.Group,place:PlaceId,resources:LocationResources){
 const p=profiles[place];if(!p)return;
 const g=new THREE.Group();g.name='Interior atmosphere 057';root.add(g);
 const map=painted(resources,512,512,ctx=>{
  const px=(x:number)=>(x-p.x+p.w/2)/p.w*512,pz=(z:number)=>(z-p.z+p.d/2)/p.d*512;
  ctx.clearRect(0,0,512,512);
  for(const s of STATIONS[place]){
   if(['door','waypoint'].includes(s.action.kind))continue;
   ctx.save();ctx.translate(px(s.center.x),pz(s.center.z));ctx.scale((s.width+.45)*256/p.w,(s.depth+.45)*256/p.d);
   const sh=ctx.createRadialGradient(0,0,.25,0,0,1);sh.addColorStop(0,'rgba(39,44,36,.37)');sh.addColorStop(.58,'rgba(39,44,36,.21)');sh.addColorStop(1,'rgba(39,44,36,0)');ctx.fillStyle=sh;ctx.fillRect(-1,-1,2,2);ctx.restore();
  }
  for(const x of p.lamps)for(const z of [-2.2,2.2]){
   ctx.save();ctx.translate(px(x),pz(z));ctx.scale(512/p.w*1.95,512/p.d*1.7);
   const light=ctx.createRadialGradient(0,0,0,0,0,1);light.addColorStop(0,place==='cafe'?'rgba(255,213,151,.21)':'rgba(255,252,226,.14)');light.addColorStop(1,'rgba(255,252,226,0)');ctx.fillStyle=light;ctx.fillRect(-1,-1,2,2);ctx.restore();
  }
 });
 if(map){const mat=new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,opacity:.85});resources.materials.push(mat);const m=new THREE.Mesh(new THREE.PlaneGeometry(p.w,p.d),mat);m.name='Shop baked contact light';m.rotation.x=-Math.PI/2;m.position.set(p.x,p.y,p.z);m.raycast=()=>{};g.add(m);}
 // Two batched groups: housing and luminous faces, no per-fixture light.
 const lampMat=new THREE.MeshStandardMaterial({color:p.warm,emissive:p.warm,emissiveIntensity:.75,roughness:.65});
 resources.materials.push(lampMat);
 const fixtures=new THREE.Group();g.add(fixtures);
 for(const x of p.lamps)for(const z of [-3.15,1.8]){
  const body=new THREE.Mesh(cube,finish(0x656b65,'metal'));body.scale.set(place==='cafe'?1.1:1.85,.075,.24);body.position.set(x,2.72,z);fixtures.add(body);
  const lens=new THREE.Mesh(cube,lampMat);lens.scale.set(place==='cafe'?.96:1.71,.031,.18);lens.position.set(x,2.665,z);fixtures.add(lens);
 }
 batchRigidParts(fixtures);wallGallery(g,place,resources);g.traverse(o=>{if(o instanceof THREE.Mesh)o.raycast=()=>{};});
 return g;
}


// One wall atlas for three location-specific panels, instead of many separate props.
function wallGallery(g:THREE.Group,place:PlaceId,resources:LocationResources){
 if(place==='education')return;
 const themes:Partial<Record<PlaceId,readonly [string,string,string]>>={
  market:['#607d5b','#ad855a','#789c92'],cafe:['#815d46','#b89066','#71856d'],
  petshop:['#769c82','#b6a48b','#81969c'],clothing:['#957e8b','#c79b91','#7c8e9b'],
  electronics:['#446578','#628ea0','#4f7b76']
 };
 const colors=themes[place];if(!colors)return;
 const map=painted(resources,768,128,ctx=>{
  ctx.clearRect(0,0,768,128);
  for(let i=0;i<3;i++){
   const x=i*256+42,w=172,y=8,h=112,c=colors[i];
   ctx.fillStyle='rgba(37,44,40,.22)';ctx.fillRect(x+4,y+4,w,h);
   ctx.fillStyle='#62584b';ctx.fillRect(x,y,w,h);
   ctx.fillStyle='#f0e5d0';ctx.fillRect(x+4,y+4,w-8,h-8);
   ctx.fillStyle=c;ctx.fillRect(x+11,y+11,w-22,h-22);
   ctx.save();ctx.translate(x+w/2,64);ctx.fillStyle='#f2e7d2';ctx.strokeStyle='#f2e7d2';ctx.lineWidth=3;
   if(place==='cafe'){
    ctx.beginPath();ctx.roundRect(-26,-15,46,34,7);ctx.fill();
    ctx.beginPath();ctx.arc(22,0,12,-Math.PI/2,Math.PI/2);ctx.stroke();
    ctx.fillRect(-32,23,60,4);for(let n=0;n<3;n++){ctx.beginPath();ctx.moveTo(-14+n*12,-20);ctx.bezierCurveTo(-22+n*12,-32,-4+n*12,-36,-13+n*12,-46);ctx.stroke();}
   }else if(place==='petshop'){
    for(let n=0;n<4;n++){ctx.beginPath();ctx.ellipse(-22+n*14,-18-Math.sin(n/3*Math.PI)*9,6.5,9,(n-1.5)*.24,0,Math.PI*2);ctx.fill();}
    ctx.beginPath();ctx.ellipse(0,9,24,17,0,0,Math.PI*2);ctx.fill();
   }else if(place==='electronics'){
    ctx.beginPath();ctx.roundRect(-36,-26,72,48,5);ctx.stroke();ctx.fillRect(-5,22,10,10);ctx.fillRect(-22,32,44,3);
    ctx.strokeStyle='#b9e2dd';ctx.beginPath();ctx.moveTo(-25,7);ctx.lineTo(-8,-9);ctx.lineTo(1,1);ctx.lineTo(21,-16);ctx.stroke();
   }else if(place==='clothing'){
    ctx.beginPath();ctx.moveTo(-13,-30);ctx.lineTo(-33,-17);ctx.lineTo(-24,0);ctx.lineTo(-16,-5);ctx.lineTo(-16,31);ctx.lineTo(16,31);ctx.lineTo(16,-5);ctx.lineTo(24,0);ctx.lineTo(33,-17);ctx.lineTo(13,-30);ctx.quadraticCurveTo(0,-15,-13,-30);ctx.fill();
   }else{
    for(let n=0;n<3;n++){ctx.beginPath();ctx.ellipse(-21+n*21,4,12,17,(n-1)*.20,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(-17+n*21,-15,8,3,-.6,0,Math.PI*2);ctx.fill();}
   }
   ctx.restore();
   ctx.fillStyle='rgba(255,255,255,.25)';ctx.fillRect(x+12,y+12,w-24,2);
  }
 });
 if(!map)return;
 const mat=new THREE.MeshStandardMaterial({map,transparent:true,alphaTest:.02,depthWrite:false,roughness:.8});
 resources.materials.push(mat);
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(8.5,1.03),mat);mesh.name='Shop wall gallery';mesh.rotation.y=Math.PI/2;mesh.position.set(-5.84,2.14,0);mesh.raycast=()=>{};g.add(mesh);
}
