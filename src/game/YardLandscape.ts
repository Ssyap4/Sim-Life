import * as THREE from 'three';
import {HOUSE,HOUSE_WING,HOME_FLOOR,HOME_YARD,HOUSE_ENTRY} from '../shared/home';
import {paintedMap} from './ArtKit';
import {landscapeRandom} from './LandscapePlants';
import {seasonalMaterial} from './SeasonalPalette';
import {snowPreview} from './LandscapePalette';
import type {FloorRect} from './navigation';

type Rect=FloorRect;
const rect=(x:number,z:number,w:number,d:number):Rect=>({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2});
export const YARD_SURFACE={minX:HOME_FLOOR.minX-.25,maxX:HOME_FLOOR.maxX+.25,minZ:HOME_FLOOR.minZ-.45,maxZ:HOME_YARD.gate.z+.09};
const house:Rect={minX:HOUSE.minX-.10,maxX:HOUSE_WING.maxX+.10,minZ:HOUSE.minZ-.10,maxZ:HOUSE.maxZ+.10};
export const LOUNGE_DECK=rect(-3.38,6.77,4.78,3.04);
const p=HOME_YARD.parking,g=HOME_YARD.gate;
export const YARD_PAVING:readonly Rect[]=[
 {minX:HOUSE_ENTRY.x-.94,maxX:HOUSE_ENTRY.x+.94,minZ:HOUSE_ENTRY.z,maxZ:g.z+.09},
 {minX:p.x-1.42,maxX:p.x+1.42,minZ:p.z-2.99,maxZ:g.z+.09},
 {minX:HOUSE_ENTRY.x+.94,maxX:p.x-1.42,minZ:7.47,maxZ:9.03},
 {minX:LOUNGE_DECK.maxX,maxX:HOUSE_ENTRY.x-.94,minZ:6.62,maxZ:7.78},
 rect(1.96,11.27,1.12,1.17),
];
const planter=rect(HOME_YARD.planter.x,HOME_YARD.planter.z,.68,3.9);
const contains=(r:Rect,x:number,z:number,pad=0)=>x>=r.minX-pad&&x<=r.maxX+pad&&z>=r.minZ-pad&&z<=r.maxZ+pad;
export const lawnAt=(x:number,z:number)=>contains(YARD_SURFACE,x,z)&&![house,LOUNGE_DECK,planter,...YARD_PAVING].some(r=>contains(r,x,z,.045));
/** Split rectangular union into disjoint quads; shared edges have world-scale UVs. */
export function pavingCells():Rect[]{
 const xs=[...new Set(YARD_PAVING.flatMap(r=>[r.minX,r.maxX]))].sort((a,b)=>a-b);
 const zs=[...new Set(YARD_PAVING.flatMap(r=>[r.minZ,r.maxZ]))].sort((a,b)=>a-b);
 const cells:Rect[]=[];
 for(let i=1;i<xs.length;i++)for(let j=1;j<zs.length;j++){
  const r={minX:xs[i-1],maxX:xs[i],minZ:zs[j-1],maxZ:zs[j]};
  if(YARD_PAVING.some(q=>contains(q,(r.minX+r.maxX)/2,(r.minZ+r.maxZ)/2)))cells.push(r);
 }
 return cells;
}
function surface(cells:readonly Rect[],y:number,scale:number){
 const pos:number[]=[],uv:number[]=[],indices:number[]=[];
 for(const r of cells){const i=pos.length/3;
  for(const [x,z] of [[r.minX,r.minZ],[r.maxX,r.minZ],[r.maxX,r.maxZ],[r.minX,r.maxZ]]){pos.push(x,y,z);uv.push(x/scale,-z/scale);}
  indices.push(i,i+2,i+1,i,i+3,i+2);
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
function repeat(map:THREE.Texture|null){if(map){map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=4;}return map;}
function turfMap(){
 return repeat(paintedMap('yard-lawn-0511',1024,1024,ctx=>{
  const n=1024,rng=landscapeRandom(86127);
  ctx.fillStyle='#779b50';ctx.fillRect(0,0,n,n);
  const wrapped=(x:number,z:number,draw:(x:number,z:number)=>void)=>{for(const dx of [-n,0,n])for(const dz of [-n,0,n]){const a=x+dx,b=z+dz;if(a>=-160&&a<=n+160&&b>=-160&&b<=n+160)draw(a,b);}};
  for(let i=0;i<100;i++){const x=rng()*n,z=rng()*n,r=25+rng()*110;wrapped(x,z,(a,b)=>{const g=ctx.createRadialGradient(a,b,0,a,b,r);g.addColorStop(0,i%3===0?'#b4be7750':i%3===1?'#406d3755':'#92b35e66');g.addColorStop(1,'#789c5000');ctx.fillStyle=g;ctx.fillRect(a-r,b-r,r*2,r*2);});}
  const colors=['#547c37','#608e42','#8dac57','#9bb76c','#b2bf80','#416f37'];
  for(let i=0;i<68000;i++){const x=rng()*n,z=rng()*n,l=2+rng()*7,dx=(rng()-.5)*5;ctx.strokeStyle=colors[i%6];ctx.globalAlpha=.23+rng()*.49;ctx.lineWidth=.65+rng()*.85;
   wrapped(x,z,(a,b)=>{ctx.beginPath();ctx.moveTo(a,b);ctx.quadraticCurveTo(a+dx*.2,b-l*.55,a+dx,b-l);ctx.stroke();});
  }ctx.globalAlpha=1;
 }));
}
function stoneMap(){
 return repeat(paintedMap('yard-pavers-0511',1024,1024,ctx=>{
  const n=1024,rng=landscapeRandom(3741);ctx.fillStyle='#807c70';ctx.fillRect(0,0,n,n);
  const tones=['#b5aea0','#b9b2a5','#c1b9a9','#aaa69b','#c4bcad','#b4ac9d'];
  for(let row=0;row<8;row++)for(let col=0;col<4;col++){
   const x=col*256+(row%2)*128,z=row*128,ink=tones[Math.floor(rng()*tones.length)];
   const draw=(a:number)=>{ctx.save();ctx.beginPath();ctx.moveTo(a+7,z+2);ctx.lineTo(a+249,z+2);ctx.lineTo(a+254,z+7);ctx.lineTo(a+254,z+121);ctx.lineTo(a+249,z+126);ctx.lineTo(a+7,z+126);ctx.lineTo(a+2,z+121);ctx.lineTo(a+2,z+7);ctx.closePath();ctx.clip();ctx.fillStyle=ink;ctx.fillRect(a,z,256,128);
    ctx.fillStyle='#f9f0d95e';ctx.fillRect(a+3,z+3,249,3);ctx.fillRect(a+3,z+4,3,118);ctx.fillStyle='#58544b40';ctx.fillRect(a+3,z+121,249,4);ctx.fillRect(a+250,z+4,4,118);
    const seed=landscapeRandom(10000+row*71+((col+4)%4)*91);for(let i=0;i<170;i++){ctx.fillStyle=i%2?'#766d6028':'#f6edd633';ctx.fillRect(a+seed()*256,z+seed()*128,1+seed()*4,.8+seed()*2);}ctx.restore();};
   draw(x);if(x+256>n)draw(x-n);
  }

 }));
}
export function buildYardLandscape(parent:THREE.Group){
 const turf=turfMap(),stone=stoneMap();
 const turfMesh=new THREE.Mesh(surface([YARD_SURFACE],-.008,5),seasonalMaterial(new THREE.MeshStandardMaterial({map:turf,color:turf?0xffffff:0x779b50,roughness:.98}),'lawn'));
 turfMesh.name='Continuous lawn surface';turfMesh.receiveShadow=true;turfMesh.raycast=()=>{};parent.add(turfMesh);
 const path=new THREE.Mesh(surface(pavingCells(),.012,2.4),new THREE.MeshStandardMaterial({map:stone,color:stone?0xffffff:0xb8b0a2,roughness:.87}));path.name='Continuous nonoverlapping stone paths';path.receiveShadow=true;path.raycast=()=>{};parent.add(path);
 // Three short tapered blades per instance; no alpha texture, no shadow pass.
 const positions:number[]=[],indices:number[]=[];
 for(let k=0;k<3;k++){const a=k*Math.PI*2/3,c=Math.cos(a),s=Math.sin(a),i=positions.length/3;positions.push(-s*.024,0,c*.024,s*.024,0,-c*.024,c*.035-s*.012,.065,s*.035+c*.012,c*.035+s*.012,.065,s*.035-c*.012,c*.065,.102,s*.065);indices.push(i,i+1,i+2,i+1,i+3,i+2,i+2,i+3,i+4);}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();
 const material=seasonalMaterial(new THREE.MeshLambertMaterial({color:0xffffff,side:THREE.DoubleSide}),'grass');
 const rng=landscapeRandom(5171),sectors:THREE.InstancedMesh[]=[];
 const palette=[0x658b42,0x789d4e,0x90ae61,0x597c3c,0x9cb46c],t=new THREE.Object3D(),color=new THREE.Color();
 for(let x=YARD_SURFACE.minX;x<YARD_SURFACE.maxX;x+=6)for(let z=YARD_SURFACE.minZ;z<YARD_SURFACE.maxZ;z+=6){
  const points:{x:number;z:number}[]=[];
  for(let a=x+.14;a<Math.min(x+6,YARD_SURFACE.maxX);a+=.32)for(let b=z+.14;b<Math.min(z+6,YARD_SURFACE.maxZ);b+=.32){const px=a+(rng()-.5)*.24,pz=b+(rng()-.5)*.24;if(lawnAt(px,pz))points.push({x:px,z:pz});}
  if(!points.length)continue;
  const mesh=new THREE.InstancedMesh(geo,material,points.length);mesh.name='Short 3D lawn blades';mesh.raycast=()=>{};
  for(const [i,p] of points.entries()){t.position.set(p.x,-.008,p.z);t.rotation.y=rng()*Math.PI*2;t.scale.set(.65+rng()*.8,snowPreview()?.25:.5+rng()*.7,.65+rng()*.8);t.updateMatrix();mesh.setMatrixAt(i,t.matrix);mesh.setColorAt(i,color.setHex(palette[i%palette.length]));}
  mesh.computeBoundingSphere();sectors.push(mesh);parent.add(mesh);
 }
 return {sectors,turfMesh,path,detail(camera:THREE.Camera,low:boolean){for(const m of sectors){const distance=camera.position.distanceTo(m.boundingSphere!.center);m.visible=distance<(low?20:32);}}};
}
