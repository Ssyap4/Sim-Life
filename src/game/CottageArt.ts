import * as THREE from 'three';
import {paintedMap,cube,panel} from './ArtKit';
import {HOUSE,HOUSE_WING,WEST_WALL,EAST_WALL,BEDROOM_END,WC_START,OFFICE_END} from '../shared/home';
type Style='oak'|'honey'|'carpet'|'stone'|'slate'|'linen';
type Rect={x1:number;x2:number;z1:number;z2:number;style:Style};
export const cottageRooms:readonly Rect[]=[
 {x1:HOUSE.minX,x2:WEST_WALL,z1:HOUSE.minZ,z2:BEDROOM_END,style:'carpet'},
 {x1:HOUSE.minX,x2:WEST_WALL,z1:BEDROOM_END,z2:WC_START,style:'honey'},
 {x1:HOUSE.minX,x2:WEST_WALL,z1:WC_START,z2:HOUSE.maxZ,style:'stone'},
 {x1:WEST_WALL,x2:EAST_WALL,z1:HOUSE.minZ,z2:-.85,style:'stone'},
 {x1:WEST_WALL,x2:EAST_WALL,z1:-.85,z2:HOUSE.maxZ,style:'oak'},
 {x1:EAST_WALL,x2:HOUSE.maxX,z1:HOUSE.minZ,z2:OFFICE_END,style:'honey'},
 {x1:EAST_WALL,x2:HOUSE.maxX,z1:OFFICE_END,z2:HOUSE.maxZ,style:'slate'},
];
const wingRooms:readonly Rect[]=([HOUSE_WING.minZ,...HOUSE_WING.crossWalls] as number[]).map((z1,i)=>({x1:HOUSE_WING.minX,x2:HOUSE_WING.maxX,z1,z2:[...HOUSE_WING.crossWalls,HOUSE_WING.maxZ][i],style:(['honey','linen','oak'] as const)[i]}));
const random=(initial:number)=>{let seed=initial;return()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);};
function floorPattern(ctx:CanvasRenderingContext2D,r:Rect,x:number,y:number,w:number,h:number,sx:number,sz:number,seed:number){
 const rng=random(seed);ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
 const style=r.style;
 if(style==='carpet'||style==='linen'){
  ctx.fillStyle=style==='carpet'?'#b3a79b':'#a6b6a3';ctx.fillRect(x,y,w,h);
  for(let i=0;i<w*h*.17;i++){
   ctx.fillStyle=i%3===0?'#fff4e33b':i%3===1?'#695e5040':'#ffffff22';
   ctx.fillRect(x+rng()*w,y+rng()*h,.7+rng()*1.4,.7+rng()*1.3);
  }
  for(let j=y;j<y+h;j+=4){ctx.fillStyle='#514b3e0c';ctx.fillRect(x,j,w,.7);}
 }else if(style==='stone'||style==='slate'){
  const tones=style==='stone'?['#cfbea4','#e0d0b6','#d8c6a9','#c9b89e']:['#a6bcb9','#bacdc5','#9aadae','#c5d2c8'];
  ctx.fillStyle=style==='stone'?'#938674':'#778e8d';ctx.fillRect(x,y,w,h);
  const tw=.63*sx,th=.63*sz;
  for(let j=0;j*th<h;j++)for(let i=-1;i*tw<w;i++){
   const px=x+i*tw+(j%2)*tw*.5,py=y+j*th;
   const tone=tones[Math.floor(rng()*tones.length)];
   ctx.fillStyle=tone;ctx.fillRect(px+.75,py+.75,tw-1.5,th-1.5);
   ctx.save();ctx.beginPath();ctx.rect(px+1,py+1,tw-2,th-2);ctx.clip();
   const stone=ctx.createLinearGradient(px,py,px+tw,py+th);stone.addColorStop(0,'#ffffff25');stone.addColorStop(.52,'#ffffff00');stone.addColorStop(1,'#514c4524');
   ctx.fillStyle=stone;ctx.fillRect(px,py,tw,th);
   for(let m=0;m<18;m++){ctx.fillStyle=m%2?'#ffffff19':'#4c544b17';ctx.fillRect(px+rng()*tw,py+rng()*th,.5+rng()*1.4,.5+rng()*1.2);}
   ctx.strokeStyle=style==='stone'?'#9c8b751b':'#6e868b24';ctx.lineWidth=.65;ctx.beginPath();const v=py+rng()*th;ctx.moveTo(px,v);ctx.bezierCurveTo(px+tw*.35,v+4,px+tw*.6,v-4,px+tw,v+2);ctx.stroke();ctx.restore();
   ctx.fillStyle='#ffffff35';ctx.fillRect(px+1,py+1,tw-2,.75);
   for(let k=0;k<4;k++){ctx.fillStyle='#6e6a5b16';ctx.fillRect(px+2+rng()*(tw-4),py+2+rng()*(th-4),1.5,1);}
  }
 }else{
  const tones=style==='oak'?['#b18558','#bd9368','#d2ac82','#c59a6c']:['#ddc39c','#d0af83','#e4ccaa','#c9a578'];
  ctx.fillStyle='#80664e';ctx.fillRect(x,y,w,h);
  const pw=style==='oak'?.36*sx:.28*sx,pl=1.65*sz;
  for(let i=0;i*pw<w;i++)for(let j=-1;j*pl<h;j++){
   const px=x+i*pw,py=y+j*pl+(i%3)*pl/3;
   ctx.fillStyle=tones[Math.floor(rng()*tones.length)];ctx.fillRect(px+.45,py+.6,pw-.9,pl-1.2);
   ctx.save();ctx.beginPath();ctx.rect(px+.5,py+.65,pw-1,pl-1.3);ctx.clip();
   const grain=ctx.createLinearGradient(px,py,px+pw,py);grain.addColorStop(0,'#60492b25');grain.addColorStop(.26,'#fff6db1c');grain.addColorStop(.72,'#ffffff00');grain.addColorStop(1,'#74502f2b');ctx.fillStyle=grain;ctx.fillRect(px,py,pw,pl);
   if(rng()<.36){const xx=px+pw*(.25+rng()*.5),yy=py+pl*(.2+rng()*.6);for(let n=0;n<3;n++){ctx.strokeStyle='#65472a33';ctx.lineWidth=.55;ctx.beginPath();ctx.ellipse(xx,yy,1+n*.7,2.1+n*2.7,.12,0,Math.PI*2);ctx.stroke();}}
   ctx.restore();
   ctx.fillStyle='#fff0d745';ctx.fillRect(px+.7,py+1,.65,pl-2);
   for(let k=0;k<7;k++){
    const xx=px+2+rng()*Math.max(1,pw-4);ctx.strokeStyle=k%2?'#6b482c33':'#fff2d040';ctx.lineWidth=.55;ctx.beginPath();ctx.moveTo(xx,py+1);ctx.bezierCurveTo(xx+1.7,py+pl*.3,xx-1.6,py+pl*.7,xx,py+pl-1);ctx.stroke();
   }
  }
 }
 // Broad edge shade baked into the floor rather than a live shadow map.
 const edge=Math.min(14,w*.10,h*.10);
 for(const [x0,y0,x1,y1] of [[x,y,x+edge,y],[x+w,y,x+w-edge,y],[x,y,x,y+edge],[x,y+h,x,y+h-edge]]){
  const g=ctx.createLinearGradient(x0,y0,x1,y1);g.addColorStop(0,'#49362638');g.addColorStop(1,'#49362600');ctx.fillStyle=g;
  ctx.fillRect(Math.min(x0,x1),Math.min(y0,y1),x0===x1?w:edge,y0===y1?h:edge);
 }
  // Broad daylight from the open-side windows, baked into the existing floor atlas.
 const glow=ctx.createRadialGradient(x+w*.58,y+h*.76,0,x+w*.58,y+h*.76,Math.max(w,h)*.63);
 glow.addColorStop(0,'rgba(255,239,196,.11)');glow.addColorStop(1,'rgba(255,239,196,0)');
 ctx.fillStyle=glow;ctx.fillRect(x,y,w,h);
 ctx.restore();
}
export function cottageFloor(parent:THREE.Group,wing=false){
 const b=wing?HOUSE_WING:HOUSE,w=b.maxX-b.minX,d=b.maxZ-b.minZ;
 const map=paintedMap(wing?'cottage-wing-v062':'cottage-main-v062',wing?384:1024,wing?768:768,ctx=>{
  const sx=ctx.canvas.width/w,sz=ctx.canvas.height/d;
  for(const [i,r] of (wing?wingRooms:cottageRooms).entries())floorPattern(ctx,r,(r.x1-b.minX)*sx,(r.z1-b.minZ)*sz,(r.x2-r.x1)*sx,(r.z2-r.z1)*sz,sx,sz,813+i*173);
 });
 const m=panel(parent,[(b.minX+b.maxX)/2,wing?.023:0,(b.minZ+b.maxZ)/2],[w,d],map,0xc5a47f);m.rotation.x=-Math.PI/2;return m;
}
function timberMap(){
 const map=paintedMap('solid-timber-v062',512,256,ctx=>{
  const rng=random(294),tones=['#d6b38a','#c9a178','#d9b98d','#cfa77d','#e0bd95','#d2ae86','#c59b72','#dabc96'];
  for(let row=0;row<8;row++){
   const y=row*32;ctx.fillStyle='#785439';ctx.fillRect(0,y,512,32);
   const bevel=ctx.createLinearGradient(0,y+1,0,y+31);bevel.addColorStop(0,'#f3d5b2');bevel.addColorStop(.18,tones[row]);bevel.addColorStop(.8,tones[row]);bevel.addColorStop(1,'#a17b54');
   ctx.fillStyle=bevel;ctx.fillRect(0,y+1.2,512,29.6);
   for(let k=0;k<19;k++){
    const v=y+3+rng()*24;ctx.strokeStyle=k%3?'#80573530':'#fff1d64a';ctx.lineWidth=.6+rng()*.5;ctx.beginPath();ctx.moveTo(0,v);ctx.bezierCurveTo(140,v+Math.sin(k+row)*2.7,370,v+Math.cos(k)*2.1,512,v);ctx.stroke();
   }
   // Subtle end-grain seams alternate on adjacent boards.
   const seamX=(row%3)*137+50;ctx.fillStyle='#77543846';ctx.fillRect(seamX,y+2,1.2,28);ctx.fillStyle='#f9dfb633';ctx.fillRect(seamX+1.3,y+3,.8,26);
   const knotX=30+rng()*450,knotY=y+16;
   for(let j=0;j<4;j++){ctx.strokeStyle='#7f542d35';ctx.beginPath();ctx.ellipse(knotX,knotY,4+j*7,1+j*1.8,.08,0,Math.PI*2);ctx.stroke();}
  }
 });
 if(map){map.wrapS=map.wrapT=THREE.RepeatWrapping;}return map;
}
let timber:THREE.MeshStandardMaterial|undefined;
/** World-aligned courses, using original wall volumes and one shared material. */
export function timberWall(parent:THREE.Group,size:[number,number,number],at:[number,number,number]){
 if(!timber){const map=timberMap();timber=new THREE.MeshStandardMaterial({map,color:map?0xffffff:0xc7a17d,roughness:.88});}
 const geometry=cube.clone(),uv=geometry.getAttribute('uv'),pos=geometry.getAttribute('position'),n=geometry.getAttribute('normal');
 for(let i=0;i<uv.count;i++){
  const x=at[0]+pos.getX(i)*size[0],y=at[1]+pos.getY(i)*size[1],z=at[2]+pos.getZ(i)*size[2];
  uv.setXY(i,(Math.abs(n.getX(i))>.5?z:x)/3.8,Math.abs(n.getY(i))>.5?z/2.24:y/2.24);
 }
 const wall=new THREE.Mesh(geometry,timber);wall.scale.set(...size);wall.position.set(...at);wall.receiveShadow=true;parent.add(wall);return wall;
}
export function kitchenAccent(){
 return paintedMap('kitchen-accent-v062',512,128,ctx=>{
  ctx.fillStyle='#6b8277';ctx.fillRect(0,0,512,128);
  for(let row=0;row<5;row++)for(let col=-1;col<16;col++){
   const x=col*38+(row%2)*19,y=row*26;
   const g=ctx.createLinearGradient(0,y,0,y+24);g.addColorStop(0,'#d2e2d6');g.addColorStop(.24,'#b8cdbb');g.addColorStop(.72,'#a0b9a7');g.addColorStop(1,'#81a18e');
   ctx.fillStyle=g;ctx.fillRect(x+1,y+1,36,24);ctx.fillStyle='#eaf3e76b';ctx.fillRect(x+2,y+2,34,1);ctx.fillStyle='#567b6b32';ctx.fillRect(x+2,y+23,34,1);ctx.fillRect(x+35,y+3,1,20);
  }
 });
}
