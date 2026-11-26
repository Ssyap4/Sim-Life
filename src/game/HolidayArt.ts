import * as THREE from 'three';
import {batchRigidParts,cube,drum,orb,finish} from './ArtKit';
import {HOME_YARD} from '../shared/home';
import {gameDate} from '../shared/life';
import type {GameState} from '../shared/protocol';
import {occasionsAhead} from '../shared/familyLife';

export function holidayTheme(day:number,state?:GameState){
 const d=gameDate(day);
 if(d.month===12||d.month===1&&d.day===1)return 'winter';
 if(state&&occasionsAhead({...state,clock:{day,minute:0}},0).some(o=>['vladBirthday','alinaBirthday','anniversary'].includes(o.id)))return 'birthday';
 if(d.month===4&&d.day===2)return 'easter';
 if(d.month===2&&d.day===2||d.month===3&&d.day===1)return 'spring';
 return 'none';
}
const cone=new THREE.ConeGeometry(1,1,12);
const bulb=new THREE.MeshBasicMaterial({color:0xffe6a1});
function part(g:THREE.Group,geo:THREE.BufferGeometry,color:number,x:number,y:number,z:number,w:number,h:number,d:number,glow=false){
 const m=new THREE.Mesh(geo,glow?bulb:finish(color,'wood'));m.position.set(x,y,z);m.scale.set(w,h,d);g.add(m);return m;
}
function noPick(g:THREE.Group){batchRigidParts(g,true);g.traverse(o=>{o.raycast=()=>{};});return g;}
/** Slim festive spruce replaces the plants in the existing protected planter. */
export function buildHolidayTree(){
 const g=new THREE.Group(),{x,z}=HOME_YARD.planter;g.name='Festive spruce';g.position.set(x,.235,z);
 part(g,drum,0x76513a,0,.24,0,.14,.48,.14);
 for(let i=0;i<5;i++){
  const radius=.43-i*.067,y=.66+i*.28;
  part(g,cone,[0x315e49,0x376b50,0x3e7758][i%3],0,y,0,radius,.79-i*.065,radius);
  for(let j=0;j<9;j++){const a=j*Math.PI*2/9+i*.65,r=radius*.82;part(g,orb,j%3===0?0xc9454a:j%3===1?0xe5bc69:0xf4eee2,Math.cos(a)*r,y-.25,Math.sin(a)*r,.065,.065,.065);part(g,orb,0xffffff,Math.cos(a+.28)*r,y-.22,Math.sin(a+.28)*r,.038,.038,.038,true);}
 }
 const star=new THREE.Shape();for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,r=i%2?.062:.14;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?star.lineTo(x,y):star.moveTo(x,y);}star.closePath();
 const top=new THREE.Mesh(new THREE.ExtrudeGeometry(star,{depth:.035,bevelEnabled:false}),bulb);top.position.set(0,2.13,0);top.rotation.y=Math.PI/4;g.add(top);
 for(let i=0;i<4;i++){const z=(i<2?-1:1)*(.76+i%2*.39),c=[0xc84b50,0x497c68,0xb98243,0xe3c7a2][i];part(g,cube,c,0,.15,z,.34,.30,.34);part(g,cube,0xeac88e,0,.303,z,.35,.018,.065);part(g,cube,0xeac88e,0,.303,z,.065,.018,.35);part(g,cube,0xeac88e,0,.15,z+.173,.065,.30,.012);}
 g.visible=false;return noPick(g);
}
export function buildHolidayGarlands(){
 const root=new THREE.Group();root.name='Holiday garlands';
 const groups={winter:new THREE.Group(),birthday:new THREE.Group(),easter:new THREE.Group(),spring:new THREE.Group()};
 for(const [theme,g] of Object.entries(groups)){
  g.name='Holiday '+theme;g.visible=false;root.add(g);
  const colors=theme==='birthday'?[0xd88099,0xe5c077,0x89b2a1]:theme==='easter'?[0xe1b4c6,0xc0d69e,0xf0cd88]:theme==='spring'?[0xe4a2b3,0xe4cfb2,0x92b5a0]:[0xc74845,0x336a50,0xe5bc69];
  // Existing canopy beam, above the walking surface; no new floor obstacle.
  for(let i=0;i<23;i++){
   const t=i/22,x=-5.45+t*4.12,y=2.39-Math.sin(t*Math.PI)*.17;
   part(g,cube,theme==='winter'?0x345f49:0x9b7751,x,y,8.15,.20,.035,.045);
   if(theme==='winter'){
    part(g,orb,colors[i%3],x,y-.055,8.15,.085,.09,.085);
    if(i%2===0)part(g,orb,0xffffff,x+.085,y-.08,8.17,.045,.045,.045,true);
   }else if(i%2===0){
    const flag=new THREE.Mesh(new THREE.ConeGeometry(.095,.20,3),finish(colors[i%3],'fabric'));flag.rotation.z=Math.PI;flag.position.set(x,y-.115,8.15);g.add(flag);
   }
  }
  noPick(g);
 }
 return {root,groups,update(day:number,state?:GameState){const theme=holidayTheme(day,state);for(const [id,g] of Object.entries(groups))g.visible=id===theme;return theme;}};
}
