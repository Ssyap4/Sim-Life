import * as THREE from 'three';
import {paintedMap} from './ArtKit';
import {ROOMS,coveringById,type Covering,type RenovationState,type RenovationPreview,type RoomId,type SurfaceKind} from '../shared/renovation';
const mats=new Map<string,THREE.MeshStandardMaterial>();
const blank=new THREE.MeshStandardMaterial({color:0xffffff});
export function coveringMaterial(p:Covering){
 let m=mats.get(p.id);if(m)return m;
 const map=paintedMap('renovation-'+p.id,256,256,ctx=>{
  const color=new THREE.Color(p.color),hex=(n:number)=>'#'+color.clone().multiplyScalar(n).getHexString();
  ctx.fillStyle=hex(1);ctx.fillRect(0,0,256,256);
  let seed=127;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const wood=(x:number,y:number,w:number,h:number)=>{ctx.fillStyle=hex(.86+rand()*.23);ctx.fillRect(x,y,w,h);for(let i=0;i<9;i++){ctx.strokeStyle=i%2?'#492f191c':'#fff4d629';ctx.beginPath();const xx=x+rand()*w;ctx.moveTo(xx,y);ctx.bezierCurveTo(xx-2,y+h/3,xx+2,y+h*2/3,xx,y+h);ctx.stroke();}};
  if(['wood','vinyl','slat'].includes(p.pattern)){
   const w=p.pattern==='slat'?32:64;for(let i=0;i<256/w;i++){for(let j=-1;j<3;j++){const h=p.pattern==='slat'?256:128,y=j*h+(i%2)*h/2;wood(i*w,y,w-1,h-1);}ctx.fillStyle='#422b2144';ctx.fillRect(i*w,0,p.pattern==='slat'?4:1,256);}
  }else if(p.pattern==='herringbone'){
   for(let j=-8;j<9;j++)for(let i=-5;i<6;i++){ctx.save();ctx.translate(i*64+(j%2)*32,j*32);ctx.rotate((i+j)%2?Math.PI/4:-Math.PI/4);wood(-11,-37,22,74);ctx.restore();}
  }else if(p.pattern==='tile'||p.pattern==='stone'){
   for(let y=0;y<256;y+=128)for(let x=0;x<256;x+=128){ctx.fillStyle=hex(.92+rand()*.14);ctx.fillRect(x+1,y+1,126,126);if(p.pattern==='stone'){for(let i=0;i<8;i++){ctx.strokeStyle=i%2?'#48443f20':'#ffffff35';ctx.beginPath();const q=y+rand()*128;ctx.moveTo(x,q);ctx.bezierCurveTo(x+45,q-12,x+80,q+12,x+128,q-5);ctx.stroke();}}}
   ctx.strokeStyle='#61594d44';ctx.lineWidth=2;for(let i=0;i<=256;i+=128){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,256);ctx.moveTo(0,i);ctx.lineTo(256,i);ctx.stroke();}
  }else{
   const dense=p.pattern==='linen'||p.pattern==='carpet';for(let i=0;i<(dense?11000:2600);i++){ctx.fillStyle=i%2?'#fff9ec25':'#493d3020';ctx.fillRect(rand()*256,rand()*256,dense?1:2,dense?2:2+rand()*3);}
   if(p.pattern==='linen'){ctx.fillStyle='#51493c12';for(let i=0;i<256;i+=4){ctx.fillRect(i,0,1,256);ctx.fillRect(0,i,256,1);}}
  }
 });
 if(map){map.wrapS=map.wrapT=THREE.RepeatWrapping;}
 m=new THREE.MeshStandardMaterial({color:map?0xffffff:p.color,map,roughness:p.pattern==='tile'?.68:.94});
 mats.set(p.id,m);return m;
}
function patch(parent:THREE.Object3D,room:RoomId,kind:SurfaceKind,w:number,h:number,x:number,y:number,z:number,rx:number,ry:number){
 if(w<.025||h<.025)return;
 const g=new THREE.PlaneGeometry(w,h),uv=g.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*w,uv.getY(i)*h);
 const m=new THREE.Mesh(g,blank);m.position.set(x,y,z);m.rotation.set(rx,ry,0);m.visible=false;m.receiveShadow=true;m.raycast=()=>{};m.userData.renovation={room,kind};parent.add(m);
}
export function addRenovationFloors(parent:THREE.Group,wing:boolean){
 const group=new THREE.Group();group.name='Room finish floors';parent.add(group);
 for(const r of ROOMS.filter(r=>r.id.startsWith('wing')===wing))patch(group,r.id,'floor',r.x2-r.x1-.025,r.z2-r.z1-.025,(r.x1+r.x2)/2,wing?.026:.004,(r.z1+r.z2)/2,-Math.PI/2,0);
}
export function addRenovationWall(parent:THREE.Group,size:[number,number,number],at:[number,number,number]){
 const [w,h,d]=size,[x,y,z]=at;const alongX=w>d;const group=new THREE.Group();group.name='Room finish wall faces';
 for(const r of ROOMS){
  for(const side of [-1,1]){
   const face=alongX?z+side*d/2:x+side*w/2;
   const inside=face+side*.035;
   if(alongX?(inside<r.z1||inside>r.z2):(inside<r.x1||inside>r.x2))continue;
   const from=Math.max(alongX?x-w/2:z-d/2,alongX?r.x1:r.z1),to=Math.min(alongX?x+w/2:z+d/2,alongX?r.x2:r.z2);
   if(to-from<.025)continue;
   patch(group,r.id,'wall',to-from,h,alongX?(from+to)/2:face+side*.002,y,alongX?face+side*.002:(from+to)/2,0,alongX?(side===1?0:Math.PI):side*Math.PI/2);
  }
 }
 if(group.children.length)parent.add(group);
}
export function collectRenovation(root:THREE.Object3D){
 const meshes:THREE.Mesh[]=[];root.traverse(o=>{if(o instanceof THREE.Mesh&&o.userData.renovation)meshes.push(o);});
 let signature='';
 return {apply(state?:RenovationState,preview?:RenovationPreview){
  const next=JSON.stringify([state?.surfaces??{},preview??null]);if(next===signature)return;signature=next;
  for(const m of meshes){const {room,kind}=m.userData.renovation as {room:RoomId;kind:SurfaceKind};const p=coveringById(preview?.room===room&&coveringById(preview.sku)?.kind===kind?preview.sku:state?.surfaces[room]?.[kind]);m.visible=!!p;if(p)m.material=coveringMaterial(p);}
 },count:meshes.length};
}
