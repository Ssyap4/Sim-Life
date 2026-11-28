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
export const lawnAt=(x:number,z:number)=>contains(YARD_SURFACE,x,z)&&![house,LOUNGE_DECK,planter,...YARD_PAVING].some(r=>contains(r,x,z,.13));
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
/** Flush stone borders along the union perimeter, never along internal cell edges. */
export function pavingBorderCells(cells:readonly Rect[]):Rect[]{
 const result:Rect[]=[],w=.045;
 for(const c of cells){
  const midX=(c.minX+c.maxX)/2,midZ=(c.minZ+c.maxZ)/2;
  for(const [side,x,z] of [['left',c.minX-.001,midZ],['right',c.maxX+.001,midZ],['back',midX,c.minZ-.001],['front',midX,c.maxZ+.001]] as const){
   if(cells.some(q=>contains(q,x,z)))continue;
   if(side==='left')result.push({...c,maxX:c.minX+Math.min(w,(c.maxX-c.minX)/2)});
   else if(side==='right')result.push({...c,minX:c.maxX-Math.min(w,(c.maxX-c.minX)/2)});
   else if(side==='back')result.push({minX:c.minX+w,maxX:c.maxX-w,minZ:c.minZ,maxZ:c.minZ+Math.min(w,(c.maxZ-c.minZ)/2)});
   else result.push({minX:c.minX+w,maxX:c.maxX-w,minZ:c.maxZ-Math.min(w,(c.maxZ-c.minZ)/2),maxZ:c.maxZ});
  }
 }
 return result.filter(c=>c.maxX>c.minX&&c.maxZ>c.minZ);
}
function repeat(map:THREE.Texture|null){if(map){map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=4;}return map;}
function turfMap(){
 return repeat(paintedMap('yard-lawn-062b',1024,1024,ctx=>{
  const n=1024,rng=landscapeRandom(86127);
  ctx.fillStyle='#648844';ctx.fillRect(0,0,n,n);
  const wrapped=(x:number,z:number,draw:(x:number,z:number)=>void)=>{for(const dx of [-n,0,n])for(const dz of [-n,0,n]){const a=x+dx,b=z+dz;if(a>=-160&&a<=n+160&&b>=-160&&b<=n+160)draw(a,b);}};
  for(let i=0;i<100;i++){const x=rng()*n,z=rng()*n,r=25+rng()*110;wrapped(x,z,(a,b)=>{const g=ctx.createRadialGradient(a,b,0,a,b,r);g.addColorStop(0,i%3===0?'#b4be7750':i%3===1?'#406d3755':'#92b35e66');g.addColorStop(1,'#789c5000');ctx.fillStyle=g;ctx.fillRect(a-r,b-r,r*2,r*2);});}
  const colors=['#3c6432','#567e37','#81a34d','#96b360','#b1bf78','#4b753a'];
  for(let i=0;i<68000;i++){const x=rng()*n,z=rng()*n,l=3+rng()*9,dx=(rng()-.5)*7;ctx.strokeStyle=colors[i%6];ctx.globalAlpha=.23+rng()*.49;ctx.lineWidth=.65+rng()*.85;
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
 const turfMaterial=new THREE.MeshStandardMaterial({map:turf,color:turf?0xffffff:0x779b50,roughness:.98});
 // Broad irregular tonal variation uses world coordinates, not another texture.
 turfMaterial.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec2 lawnXZ;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nlawnXZ=(modelMatrix*vec4(position,1.)).xz;');
  shader.fragmentShader='varying vec2 lawnXZ;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   float tone=sin(lawnXZ.x*.76+sin(lawnXZ.y*.44)*1.8)*sin(lawnXZ.y*.89+lawnXZ.x*.23);
   diffuseColor.rgb*=mix(vec3(.86,.91,.85),vec3(1.09,1.10,.99),tone*.5+.5);`);
 };
 seasonalMaterial(turfMaterial,'lawn');turfMaterial.customProgramCacheKey=()=> 'simlife-yard-lawn-062';
 const turfMesh=new THREE.Mesh(surface([YARD_SURFACE],-.008,5),turfMaterial);
 turfMesh.name='Continuous lawn surface';turfMesh.receiveShadow=true;turfMesh.raycast=()=>{};parent.add(turfMesh);
 const path=new THREE.Mesh(surface(pavingCells(),.012,2.4),seasonalMaterial(new THREE.MeshStandardMaterial({map:stone,color:stone?0xffffff:0xb8b0a2,roughness:.87}),'paving'));path.name='Continuous nonoverlapping stone paths';path.receiveShadow=true;path.raycast=()=>{};parent.add(path);
 const border=new THREE.Mesh(surface(pavingBorderCells(pavingCells()),.013,2.4),seasonalMaterial(new THREE.MeshStandardMaterial({color:0x938775,roughness:.92}),'paving'));border.name='Flush path edge';border.receiveShadow=true;border.raycast=()=>{};parent.add(border);
 // Three individually leaning blades per clump, with root-to-tip vertex colour.
 // The same mesh and material serve all sectors; no alpha texture or shadows.
 const positions:number[]=[],indices:number[]=[],pigments:number[]=[];
 for(let k=0;k<3;k++){
  const a=k*Math.PI*2/3,c=Math.cos(a),q=Math.sin(a),i=positions.length/3,h=.105+k*.016,w=.012-k*.0015,root=.024+k*.009;
  positions.push(c*root-q*w,0,q*root+c*w,c*root+q*w,0,q*root-c*w,c*(root+.024)-q*w*.57,h*.59,q*(root+.024)+c*w*.57,c*(root+.024)+q*w*.57,h*.59,q*(root+.024)-c*w*.57,c*(root+.057),h,q*(root+.057));
  indices.push(i,i+1,i+2,i+1,i+3,i+2,i+2,i+3,i+4);
  for(const light of [.74,.74,.96,.96,1.12])pigments.push(light*.96,light,light*.87);
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(pigments,3));geo.setIndex(indices);geo.computeVertexNormals();
 const grassBase=new THREE.MeshLambertMaterial({color:0xffffff,vertexColors:true,side:THREE.DoubleSide,emissive:0x385827,emissiveIntensity:.38});
 const breeze={value:0},snowHeight={value:0},gust={value:1};
 grassBase.onBeforeCompile=shader=>{
  shader.uniforms.yardBreeze=breeze;shader.uniforms.yardSnowHeight=snowHeight;shader.uniforms.yardGust=gust;
  shader.vertexShader='uniform float yardBreeze,yardSnowHeight,yardGust;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   float phase=instanceMatrix[3].x*.71+instanceMatrix[3].z*.49+yardBreeze*1.35;
   transformed.x+=transformed.y*transformed.y*sin(phase)*1.6*yardGust;
   transformed.y*=1.-yardSnowHeight*.94;`);
 };
 const material=seasonalMaterial(grassBase,'grass');material.customProgramCacheKey=()=> 'simlife-yard-wind-v062b';
 const rng=landscapeRandom(5171),sectors:THREE.InstancedMesh[]=[];
 const palette=[0x81a650,0x87a957,0x95b360,0x71964a,0xa0b867,0x7d9f51],t=new THREE.Object3D(),color=new THREE.Color();
 for(let x=YARD_SURFACE.minX;x<YARD_SURFACE.maxX;x+=6)for(let z=YARD_SURFACE.minZ;z<YARD_SURFACE.maxZ;z+=6){
  const points:{x:number;z:number}[]=[];
  for(let a=x+.14;a<Math.min(x+6,YARD_SURFACE.maxX);a+=.195)for(let b=z+.14;b<Math.min(z+6,YARD_SURFACE.maxZ);b+=.195){const px=a+(rng()-.5)*.16,pz=b+(rng()-.5)*.16;if(lawnAt(px,pz))points.push({x:px,z:pz});}
  if(!points.length)continue;
  // Shuffle once so reducing count at distance thins the whole sector evenly.
  for(let i=points.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[points[i],points[j]]=[points[j],points[i]];}
  const mesh=new THREE.InstancedMesh(geo,material,points.length);mesh.userData.fullCount=points.length;mesh.name='Short 3D lawn blades';mesh.raycast=()=>{};
  for(const [i,p] of points.entries()){t.position.set(p.x,-.008,p.z);t.rotation.y=rng()*Math.PI*2;t.scale.set(.82+rng()*.52,snowPreview()?.08:.56+rng()*.57,.82+rng()*.52);t.updateMatrix();mesh.setMatrixAt(i,t.matrix);mesh.setColorAt(i,color.setHex(palette[i%palette.length]));}
  mesh.computeBoundingSphere();sectors.push(mesh);parent.add(mesh);
 }
 let lastDetail:{x:number;y:number;z:number;low:boolean;snow:number}|undefined;
 return {sectors,turfMesh,path,animate(seconds:number,snow:number,wind:number){breeze.value=seconds;snowHeight.value=THREE.MathUtils.clamp(snow,0,1);gust.value=wind;},detail(camera:THREE.Camera,low:boolean){const {x,y,z}=camera.position,snow=snowHeight.value;if(lastDetail&&lastDetail.x===x&&lastDetail.y===y&&lastDetail.z===z&&lastDetail.low===low&&lastDetail.snow===snow)return false;lastDetail={x,y,z,low,snow};for(const m of sectors){const distance=camera.position.distanceTo(m.boundingSphere!.center);m.visible=distance<(low?22:34);const fraction=low?(distance<12?.52:.22):(distance<15?1:distance<24?.46:.23);m.count=Math.max(1,Math.floor(m.userData.fullCount*fraction*(1-snowHeight.value*.78)));}return true;}};
}
