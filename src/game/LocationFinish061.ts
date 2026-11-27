import * as THREE from 'three';
import {STATIONS,type PlaceId} from '../shared/locations';
import {cube,finish,batchRigidParts,plane} from './ArtKit';
import {painted,type LocationResources} from './LocationArt';
type FinishProfile={left:number;right:number;rear:number;front:number;top:number;trim:number;edge:number;mat:string;ink:string};
const room=(trim:number,edge:number,mat:string,ink='#fff6e5'):FinishProfile=>({left:-6,right:6,rear:-4.90,front:5,top:2.86,trim,edge,mat,ink});
const profiles:Partial<Record<PlaceId,FinishProfile>>={
 cafe:room(0x79614b,0x9e7859,'#667d65'),
 petshop:room(0x5e8071,0x8caa93,'#5e8071'),
 clothing:room(0x947d88,0xbca8aa,'#927b88'),
 electronics:{...room(0x506a7b,0x8097a4,'#486579'),right:11},
 clinic:room(0x659794,0x93b5ac,'#508a84'),
 barber:room(0xb1936c,0x755b49,'#4e4b43'),
 education:room(0x8e876c,0xb3aa94,'#688579'),
 'work-it':room(0x728a85,0x9caca8,'#536f68'),
 'work-marketing':room(0x987b83,0xba9aa1,'#987b83'),
 'work-detail':room(0x52646c,0x879697,'#52646c'),
 'work-clinic':room(0x739c89,0xa0bcab,'#739c89'),
 fitness:{...room(0x647b80,0x596e76,'#4d6e70'),left:-9,right:15,rear:-6.94,front:7,top:2.8},
 venue:{...room(0x758a96,0x455b67,'#526d7b'),left:-10,right:10,rear:-6.94,front:7,top:2.8},
 spa:{...room(0x9d8b72,0x86aaa2,'#6c9489'),left:-9,right:10,rear:-6.94,front:6.2,top:2.8},
};
export const finishedLocations=Object.keys(profiles) as PlaceId[];
/** Light, raycast-free trim on the existing cutaway envelope. No new walls,
 * collision volumes, point lights, or furniture. */
export function addLocationFinish(root:THREE.Group,place:PlaceId,resources:LocationResources){
 const p=profiles[place];if(!p)return;
 const g=new THREE.Group();g.name='Location finish 061';
 root.add(g);
 const w=p.right-p.left,d=p.front-p.rear,cx=(p.left+p.right)/2,cz=(p.front+p.rear)/2;
 const piece=(x:number,y:number,z:number,sx:number,sy:number,sz:number,color:number)=>{
  const m=new THREE.Mesh(cube,finish(color,'wood'));
  m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.receiveShadow=true;g.add(m);
 };
 // Visible thickness and a continuous timber/metal cap finish the cutaway.
 for(const [y,h] of [[.105,.12],[p.top,.11]]){
  piece(cx,y,p.rear+.055,w,h,.10,p.trim);
  piece(p.left+.065,y,cz,.10,h,d,p.trim);
 }
 // Front/right edges remain low, flush with the existing floor cutaway.
 piece(cx,-.09,p.front-.035,w,.14,.08,p.edge);
 piece(p.right-.04,-.09,cz,.08,.14,d,p.edge);
 // Shallow decorative slats are restricted to the side wall surface.
 for(const f of [.15,.38,.62,.85]){
  piece(p.left+.105,1.42,p.rear+d*f,.045,2.52,.055,p.trim);
 }
 batchRigidParts(g,true);
 const exit=STATIONS[place].find(s=>s.action.kind==='door'&&s.action.destination==='district');
 if(exit){
  const map=painted(resources,256,128,ctx=>{
   ctx.fillStyle=p.mat;ctx.fillRect(0,0,256,128);
   ctx.strokeStyle=p.ink;ctx.lineWidth=3;ctx.strokeRect(7,7,242,114);
   ctx.globalAlpha=.16;for(let i=14;i<128;i+=6){ctx.beginPath();ctx.moveTo(12,i);ctx.lineTo(244,i);ctx.stroke();}ctx.globalAlpha=1;
   ctx.fillStyle=p.ink;ctx.font='bold 30px system-ui';ctx.textAlign='center';ctx.fillText('ВЫХОД',128,46);
   ctx.beginPath();ctx.moveTo(128,108);ctx.lineTo(106,79);ctx.lineTo(119,79);ctx.lineTo(119,62);ctx.lineTo(137,62);ctx.lineTo(137,79);ctx.lineTo(150,79);ctx.closePath();ctx.fill();
  });
  const mat=new THREE.MeshStandardMaterial({map,color:map?0xffffff:p.trim,roughness:.96});
  resources.materials.push(mat);
  const marker=new THREE.Mesh(plane,mat);marker.name='Exit approach mat';
  marker.rotation.x=-Math.PI/2;marker.scale.set(1.46,.78,1);
  marker.position.set(exit.center.x,.034,exit.center.z-.78);marker.receiveShadow=true;g.add(marker);
 }
 g.traverse(o=>{if(o instanceof THREE.Mesh)o.raycast=()=>{};});
 return g;
}