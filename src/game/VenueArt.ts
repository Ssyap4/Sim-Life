import * as THREE from 'three';
import {cube,softCube,drum,orb,plane,finish,batchRigidParts,type XYZ} from './ArtKit';
import {buildConsoleModel} from './ConsoleArt';
import {drawConsoleFrame} from './ConsoleFrames';
import {stopUfcHighlight} from './UfcHighlights';
import {VENUE_GAMES,venueWinner,venueScoreAt,bowlingHit,hockeyPad,type VenueGame} from '../shared/venue';
import type {ConsoleMatch} from '../shared/consoleCatalog';
import type {Station} from '../shared/locations';
export type VenuePlay={game:VenueGame;match:ConsoleMatch;started:number};
const wood=0xb98659,ink=0x343e4c,cream=0xf2e5ce,teal=0x428e88;
function part(g:THREE.Object3D,size:XYZ,pos:XYZ,color:number,geo:THREE.BufferGeometry=cube){
 const m=new THREE.Mesh(geo,finish(color,geo===drum?'metal':'fabric'));m.scale.set(...size);m.position.set(...pos);m.receiveShadow=true;g.add(m);return m;
}
function table(g:THREE.Group,w:number,d:number,h=.78,color=wood){
 for(const x of [-w*.40,w*.40])for(const z of [-d*.37,d*.37])part(g,[.10,h,.10],[x,h/2,z],ink);
 part(g,[w,.12,d],[0,h,0],color,softCube);
}
function seat(g:THREE.Group,z:number){part(g,[.56,.10,.55],[0,.44,z],teal,softCube);for(const x of [-.22,.22])for(const a of [-.20,.20])part(g,[.065,.43,.065],[x,.22,z+a],ink);part(g,[.56,.46,.10],[0,.69,z+Math.sign(z)*.26],teal,softCube);}
function display(g:THREE.Group,textures:THREE.Texture[],materials:THREE.Material[],w:number,h:number,y:number,z:number){
 part(g,[w+.12,h+.12,.10],[0,y,z],ink,softCube);
 if(typeof document==='undefined')return undefined;
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=144;
 const c=canvas.getContext('2d');if(!c)return;
 const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;textures.push(tex);
 const mat=new THREE.MeshBasicMaterial({map:tex});materials.push(mat);
 const m=new THREE.Mesh(plane,mat);m.position.set(0,y,z+.065);m.scale.set(w,h,1);g.add(m);
 return {c,tex};
}
export function buildVenueStation(station:Station,textures:THREE.Texture[],materials:THREE.Material[]){
 const root=new THREE.Group(),fixed=new THREE.Group(),moving=new THREE.Group();root.add(fixed,moving);root.position.set(station.center.x,0,station.center.z);
 if(station.action.kind!=='venue')return root;
 const game=station.action.facility,w=station.width,d=station.depth;
 let render:((t:number,play?:VenuePlay)=>void)|undefined;
 if(game==='reception'){part(fixed,[w,.95,d],[0,.475,0],ink,softCube);part(fixed,[w+.08,.09,d+.08],[0,.98,0],wood);part(fixed,[.38,.25,.10],[-.50,1.14,-.12],0x526d7b);}
 else if(game==='venueBowling'){
  part(fixed,[w,.10,d],[0,.05,0],wood);
  for(let i=0;i<8;i++)part(fixed,[.012,.008,d-.1],[-1.28+i*.36,.105,0],0x936a48);
  for(const x of [-1.40,1.40])part(fixed,[.17,.085,d],[x,.11,0],ink,softCube);
  part(fixed,[w,.32,.28],[0,.26,-d/2+.15],ink);
  const ball=part(moving,[.12,.12,.12],[0,.24,d/2-.16],0x386f9c,orb);
  const pins:THREE.Group[]=[];for(let row=0;row<4;row++)for(let i=0;i<=row;i++){const pin=new THREE.Group();pin.position.set((i-row/2)*.24,.11,-d/2+.47+row*.23);part(pin,[.080,.24,.080],[0,.12,0],cream,drum);part(pin,[.052,.07,.052],[0,.24,0],0xd35d54,drum);part(pin,[.062,.07,.062],[0,.30,0],cream,orb);moving.add(pin);pins.push(pin);}
  render=(t,play)=>{const active=!!play,cycle=t%7,turn=Math.floor(t/7)%2,roll=Math.max(0,Math.min(1,(cycle-1.6)/2.0)),hit=play?bowlingHit(play.match,Math.min(9,Math.floor(t/7))):0;
   ball.position.set((turn?1:-1)*.52*(1-roll)+Math.sin(roll*Math.PI)*.20,.24, d/2-.16-roll*(d-.72));ball.rotation.x=-roll*24;ball.visible=active&&t<70&&cycle>=1.6&&cycle<4.2;
   pins.forEach((pin,i)=>{const fallen=active&&t<70&&cycle>3.4&&cycle<6.4&&i<hit;pin.rotation.x=fallen?1.40:0;pin.rotation.z=fallen?(i%2?.54:-.54):0;});};
 }else if(game==='venueHockey'){
  table(fixed,w,d,.76,0xe4e9e9);
  for(const x of [-w/2,w/2])part(fixed,[.07,.15,d],[x,.87,0],ink);
  for(const z of [-d/2,d/2])for(const x of [-.49,.49])part(fixed,[.48,.15,.07],[x,.87,z],ink);
  part(fixed,[w,.01,.025],[0,.83,0],0xcf5858);
  const puck=part(moving,[.095,.035,.095],[0,.85,0],0x212b36,drum);
  const pads=[-1,1].map(side=>part(moving,[.13,.07,.13],[0,.88,side*.92],side<0?0xc64f4d:0x5084c4,drum));
  render=(t,play)=>{const phase=play?t*1.65:0;puck.position.set(Math.sin(phase*1.73)*.57,.85,Math.sin(phase)*1.09);pads.forEach((m,i)=>{const p=hockeyPad(i?'alina':'vlad',play?t:0);m.position.x=p.x;m.position.z=p.z;});};
 }else if(game==='venueBilliards'){
  table(fixed,w,d,.83,0x468d68);
  for(const x of [-w/2,w/2])part(fixed,[.11,.15,d],[x,.91,0],wood);
  for(const z of [-d/2,d/2])part(fixed,[w,.15,.11],[0,.91,z],wood);
  for(const x of [-1.12,0,1.12])for(const z of [-.64,.64])part(fixed,[.085,.016,.085],[x,.912,z],ink,drum);
  const colors=[0xf1df63,0x356fa5,0xd55947,0x805ca2,0xec9852,0x5c9c7d,0x262b30,0xeae2d0];
  const balls=colors.map((color,i)=>part(moving,[.051,.051,.051],[-.7+(i%4)*.36,.944,-.16+Math.floor(i/4)*.24],color,orb));
  render=(t,play)=>{balls.forEach((b,i)=>{const step=Math.floor(t/5),p=(t%5)/5;b.visible=!play||i>Math.floor(t/12)-1;b.position.set(-.70+(i%4)*.36+(play?.match?Math.sin(step*1.7+i+p*Math.PI)*.24:0),.944,-.16+Math.floor(i/4)*.24+(play?Math.sin(i*2.7+step+p*Math.PI)*.20:0));});};
 }else if(game==='venueJenga'||game==='venueUno'){
  table(fixed,w,.86,.75,wood);seat(fixed,-.61);seat(fixed,.61);
  if(game==='venueJenga'){
   const blocks:THREE.Mesh[]=[];for(let level=0;level<9;level++)for(let i=0;i<3;i++){const b=part(moving,[.34,.075,.106],[level%2?(i-1)*.112:0,.855+level*.075,level%2?0:(i-1)*.112],i%2?0xc89964:0xe0b584);b.rotation.y=level%2?Math.PI/2:0;blocks.push(b);}
   const origins=blocks.map(b=>b.position.clone()),angles=blocks.map(b=>b.rotation.y);
   render=(t,play)=>{const cycle=Math.floor(t/4.5),p=t%4.5/4.5,collapse=!!play&&t>VENUE_GAMES.venueJenga.seconds-4;
    blocks.forEach((b,i)=>{b.position.copy(origins[i]);b.rotation.set(0,angles[i],0);if(!play)return;
     const moved=(play.match.seed+cycle*5)%21;const removed=Array.from({length:Math.min(cycle,12)},(_,j)=>(play.match.seed+j*5)%21);const slot=removed.indexOf(i);if(slot>=0){b.position.set((slot%3-1)*.112,1.53+Math.floor(slot/3)*.075,0);b.rotation.y=Math.PI/2;}else if(i===moved){const phase=Math.min(1,p*1.8);b.position.x+=Math.sin(Math.PI*phase)*.36;b.position.y=THREE.MathUtils.lerp(origins[i].y,1.53+Math.floor(cycle/3)*.075,phase);}
     if(collapse){const fall=Math.min(1,(t-(VENUE_GAMES.venueJenga.seconds-4))/1.3);b.position.x+=fall*Math.sin(i*2.4)*.52;b.position.z+=fall*Math.cos(i*1.8)*.35;b.position.y=.85+(1-fall)*(origins[i].y-.85);b.rotation.z=fall*Math.sin(i*2.2)*1.4;}
    });};
  }else{
   const colors=[0xd94e49,0x468bc2,0xefd15a,0x53a66c];
   const pile=part(moving,[.14,.026,.22],[.17,.83,0],ink,softCube),top=part(moving,[.14,.010,.22],[-.15,.84,0],colors[0]);
   const hands=Array.from({length:14},(_,i)=>part(moving,[.105,.013,.16],[(i%7-3)*.10,.83,i<7?-.28:.28],colors[i%4],softCube));
   render=(t,play)=>{const n=Math.floor(t/4),score=play?venueScoreAt('venueUno',play.match,t):undefined;top.material=finish(colors[(n+(play?.match.seed??0))%4]);pile.position.y=.83;hands.forEach((b,i)=>{const count=score?.[i<7?0:1]??7;b.visible=i%7<count;b.rotation.y=(i%7-3)*.07;});};
  }
 }else if(game==='venueUfc'){
  part(fixed,[w,.035,d],[0,.022,0],0x596c78);
  part(fixed,[w-.15,.42,.90],[0,.23,1.15],0x4a6977,softCube);
  part(fixed,[w-.15,.55,.18],[0,.68,1.53],0x4a6977,softCube);
  for(const x of [-1.65,1.65])part(fixed,[.20,.34,.90],[x,.53,1.15],0x4a6977,softCube);
  part(fixed,[w-.25,.52,.62],[0,.26,-1.80],wood,softCube);
  const ps5=buildConsoleModel('console-ps5');ps5.position.set(1.05,.54,-1.70);fixed.add(ps5);
  const screen=display(fixed,textures,materials,3.10,1.744,1.65,-1.97);
  let frame=-2;
  render=(t,play)=>{const n=play?Math.floor(t*15):-1;if(!screen||n===frame)return;frame=n;if(play)drawConsoleFrame(screen.c,'ufc6',t,play.match);else{stopUfcHighlight(screen.c);screen.c.fillStyle='#192532';screen.c.fillRect(0,0,256,144);screen.c.fillStyle='#f5e9d8';screen.c.textAlign='center';screen.c.font='bold 28px sans-serif';screen.c.fillText('UFC 6',128,70);screen.c.font='12px sans-serif';screen.c.fillText('PS5 · LOCAL VERSUS',128,93);}screen.tex.needsUpdate=true;};
 }
 if(game!=='reception'&&game!=='venueUfc'){
  const scoreMount=new THREE.Group();fixed.add(scoreMount);
  const bowling=game==='venueBowling';
  if(!bowling){scoreMount.position.set(-w/2-.26,0,-.12);scoreMount.rotation.y=.35;part(scoreMount,[.25,.04,.24],[0,.02,0],ink,softCube);part(scoreMount,[.055,.90,.055],[0,.46,0],ink);}
  const scoreScreen=display(scoreMount,textures,materials,bowling?1.30:.78,bowling?.58:.36,bowling?1.63:1.04,bowling?-d/2+.08:0),old=render;let previous='';
  render=(t,play)=>{old?.(t,play);if(!scoreScreen)return;
   const score=play?venueScoreAt(game,play.match,t):undefined,done=!!play&&t>=VENUE_GAMES[game].seconds-3;
   const label=done?(venueWinner(play!.match)==='vlad'?'VLAD WINS':'ALINA WINS'):score?score.join(' : '):game==='venueJenga'?'JENGA':VENUE_GAMES[game].name;
   if(label===previous)return;previous=label;const c=scoreScreen.c;c.fillStyle='#192532';c.fillRect(0,0,256,144);c.fillStyle='#f5e9d8';c.textAlign='center';c.font='bold 20px sans-serif';c.fillText('VLAD     ALINA',128,34);c.font='bold 37px sans-serif';c.fillText(label,128,98,240);scoreScreen.tex.needsUpdate=true;
  };
 }
 batchRigidParts(fixed,true);
 root.userData.animateVenue=render;
 return root;
}
export function animateVenueStation(station:THREE.Group,seconds:number,play?:VenuePlay){
 const active=play&&station.name===play.game?play:undefined;
 if(!active&&station.userData.venueIdle===true)return;station.userData.venueIdle=!active;
 (station.userData.animateVenue as undefined|((t:number,p?:VenuePlay)=>void))?.(active?Math.max(0,seconds-active.started):0,active);
}
