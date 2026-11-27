import * as THREE from 'three';
import {cube,drum,orb,finish,batchRigidParts,type XYZ} from './ArtKit';
import {type LocationResources} from './LocationArt';
import {STATIONS,type PlaceId} from '../shared/locations';
import {VENUE_GAMES} from '../shared/venue';
import {SPA_PASSES,SPA_MASSAGE_PRICE} from '../shared/spa';
import {FITNESS_PASSES,FITNESS_BAR,SAUNA_PRICE} from '../shared/fitness';
import {BARBER_SERVICES} from '../shared/barber';
import {CLINIC_SERVICES} from '../shared/health';
import {signs,type Label} from './ShopDetail061';
export const detailedLeisure=['venue','fitness','spa','barber','clinic'] as const;
const rub=(price:number)=>price.toLocaleString('ru-RU')+' ₽';
const lines=(entries:readonly {name:string;price:number}[])=>entries.map(v=>v.name+'  '+rub(v.price));
/** Stationary details only: no new colliders, seats, activity timers or costs.
 * All wall signs share an atlas and geometry is color-batched per location. */
export function addLeisureDetail(root:THREE.Group,place:PlaceId,resources:LocationResources){
 if(!(detailedLeisure as readonly string[]).includes(place))return;
 const g=new THREE.Group();g.name='Leisure detail 061 '+place;root.add(g);
 const labels:Label[]=[];
 const piece=(size:XYZ,position:XYZ,color:number,geometry:THREE.BufferGeometry=cube)=>{
  const m=new THREE.Mesh(geometry,finish(color,'wood'));m.position.set(...position);m.scale.set(...size);m.receiveShadow=true;g.add(m);return m;
 };
 const board=(position:XYZ,size:[number,number],title:string,content:string[],color:string)=>{
  piece([size[0]+.10,size[1]+.10,.055],[position[0],position[1],position[2]-.045],0x475357);
  labels.push({position,size,title,lines:content,color});
 };
 const rail=(x:number,y:number,z:number,w:number,d:number,c:number)=>{
  piece([w,.065,d],[x,y,z],c);piece([w,.033,.035],[x,y+.045,z+d/2],0xd4c4a8);
 };
 const cabinet=(x:number,z:number,w:number,h:number,c:number)=>{
  piece([w,h,.22],[x,h/2,z],c);
  for(const side of [-1,1]){
   piece([w*.46,h-.09,.02],[x+side*w*.25,h/2,z+.12],0xe4e5db);
   piece([.028,.13,.033],[x+side*.065,h*.52,z+.145],0x7b9294);
  }
  piece([w+.07,.05,.27],[x,h+.025,z],0xf3ebd7);
 };
 const towel=(x:number,y:number,z:number,c:number)=>{for(let i=0;i<3;i++)piece([.32,.055,.22],[x,y+i*.055,z],c);};
 const bottle=(x:number,y:number,z:number,c:number)=>{piece([.062,.17,.062],[x,y+.085,z],c,drum);piece([.036,.045,.036],[x,y+.19,z],0xd7d8cb,drum);};
 const counter=(x:number,z:number)=>{
  piece([.18,.065,.22],[x+.25,1.08,z+.13],0x384950);
  piece([.12,.012,.09],[x+.25,1.12,z+.075],0xa6c8c8);
  piece([.18,.12,.19],[x+.53,1.1,z-.10],0x798488);
  piece([.11,.013,.08],[x+.53,1.166,z-.10],0xf4eee2);
 };
 if(place==='venue'){
  const games=Object.values(VENUE_GAMES);
  board([-6.3,1.55,-6.76],[3.25,.86],'BOWLING',lines(games.slice(0,1)),'#516b88');
  board([-1.45,1.52,-6.76],[3.3,.86],'АРКАДА',lines(games.slice(1,3)),'#426f72');
  board([2.35,1.52,-6.76],[3.25,.86],'НАСТОЛЬНЫЕ ИГРЫ',lines(games.slice(3,5)),'#746885');
  board([6.9,1.52,-6.76],[3.6,.86],'PS5 · UFC 6',lines(games.slice(5)),'#354e75');
  // Colored wall stripes delineate each zone. No floor-level obstacles.
  for(const [x,w,c] of [[-6.2,3.8,0x6a8fae],[-1.6,3.2,0x72a59b],[2.3,3.2,0x9a88ac],[6.9,4.0,0x6e8cb6]] as const){
   piece([w,.12,.08],[x,2.50,-6.74],c);
   piece([w,.08,.08],[x,.38,-6.75],c);
  }
  // Existing bowling lane: inlaid foul line and aiming chevrons, not additional obstacles.
  const bowl=STATIONS.venue.find(s=>s.id==='venue-bowling')!;
  piece([bowl.width-.30,.008,.036],[bowl.center.x,.111,bowl.center.z+2.55],0x795b43);
  for(let i=0;i<5;i++){
   const x=bowl.center.x+(i-2)*.34,z=bowl.center.z+.92+Math.abs(i-2)*.16;
   for(const side of [-1,1]){const m=piece([.025,.008,.12],[x+side*.028,.111,z],0x806444);m.rotation.y=side*.51;}
  }
  // Bowling-ball rack recessed at rear of the lane, above the existing pin guard.
  rail(-6.2,.64,-6.69,2.65,.24,0x536d7a);
  for(let i=0;i<5;i++)piece([.103,.103,.103],[-7.18+i*.49,.78,-6.68],[0x527da2,0xd18d56,0x66a191,0xb17998,0x51677c][i],orb);
  // Wall-mounted cue rack. It never intersects the active billiard table.
  for(let i=0;i<5;i++){
   const x=1.62+i*.32;
   piece([.026,1.10,.026],[x,.96,-6.72],0xb18a61,drum);
   piece([.032,.22,.032],[x,.49,-6.72],0x514b44,drum);
  }
  rail(2.26,.36,-6.71,1.8,.14,0x695a4d);
  counter(-7.5,4.7);
 }else if(place==='fitness'){
  board([-6.0,2.16,-6.74],[4.0,.62],'CARDIO',['Разминка · выносливость'],'#3d626b');
  board([-.65,2.16,-6.74],[4.0,.62],'STRENGTH',['Силовая тренировка'],'#4d626a');
  board([5.0,2.16,-6.74],[4.0,.62],'PULSE FITNESS',['Сила · движение · восстановление'],'#406d67');
  // Wall mirror panes high enough not to project into the exercise routes.
  for(const x of [-7.3,-4.55,-1.8,.95,3.7,6.45]){
   piece([2.55,.83,.045],[x,.92,-6.77],0x56737e);
   piece([2.44,.72,.025],[x,.92,-6.73],0xb6ced0);
   piece([.044,.70,.012],[x-.94,.92,-6.71],0xd9e6e4);
  }
  board([-8.83,1.70,4.20],[1.8,1.15],'АБОНЕМЕНТЫ',lines(Object.values(FITNESS_PASSES)),'#46726e');
  // rotate the left-wall board and its back in place to face the hall.
  const last=labels.at(-1)!;last.angle=Math.PI/2;
  const back=g.children.at(-1)!;back.position.set(-8.88,1.70,4.2);back.rotation.y=Math.PI/2;
  const bar=STATIONS.fitness.find(s=>s.id==='fitness-bar')!;
  labels.push({position:[bar.center.x,1.48,bar.center.z+.04],size:[2.02,.52],title:'FIT BAR',lines:lines(Object.values(FITNESS_BAR).slice(0,3)),color:'#4c716b',angle:Math.PI});
  for(let i=0;i<4;i++)bottle(bar.center.x-.65+i*.23,1.02,bar.center.z-.18,[0x97c6d6,0xe7b57a,0xe5e0cb,0x91b69d][i]);
  labels.push({position:[7.1,2.18,2.20],size:[1.82,.38],title:'САУНА · '+rub(SAUNA_PRICE),lines:[],color:'#806c56'});
 }else if(place==='spa'){
  board([-6.2,1.8,-6.69],[3.15,.88],'LAGUNA SPA',lines(Object.values(SPA_PASSES)),'#557c70');
  board([2.85,1.8,-6.69],[2.55,.76],'РЕЛАКС',['Массаж · '+rub(SPA_MASSAGE_PRICE),'Бассейн · джакузи · сауна'],'#638879');
  // Under the existing rear windows, a shallow ledge with folded linen.
  for(const x of [-6.6,-3.6,2.4,5.4]){
   rail(x,.76,-6.72,1.7,.20,0xa18b71);
   for(const dx of [-.38,.38])towel(x+dx,.83,-6.69,dx<0?0xf0ebdc:0x9dbcb5);
  }
  for(const s of STATIONS.spa.filter(s=>s.action.kind==='spa'&&s.action.facility==='spaLocker')){
   // Numbered lockers and ventilation slots on the existing doors.
   for(let i=0;i<3;i++){
    const x=s.center.x+(i-1)*.52;
    for(let k=0;k<3;k++)piece([.20,.012,.014],[x,1.37+k*.037,s.center.z-.024],0x56756d);
   }
  }
  // Brass rail and warm linen accents at reception, outside water surfaces.
  piece([1.66,.08,.035],[-4,.68,2.79],0xc2aa7e);
  counter(-4,2.4);
 }else if(place==='barber'){
  // Keep the three original mirrors visible. Small price board between them.
  board([-5.83,1.65,-1.7],[2.5,.88],'BRO · УСЛУГИ',lines(Object.values(BARBER_SERVICES).slice(0,2)),'#57473b');
  labels.at(-1)!.angle=Math.PI/2;const firstBack=g.children.at(-1)!;firstBack.position.set(-5.89,1.65,-1.7);firstBack.rotation.y=Math.PI/2;
  for(const x of [-3,0,3]){
   for(const dx of [-.70,.70])piece([.075,1.18,.07],[x+dx,1.43,-4.73],0xe3c693);
   rail(x,.73,-4.55,1.72,.27,0x9d7753);
   for(let i=0;i<3;i++)bottle(x-.45+i*.29,.89,-4.58,[0x4d635c,0x74858a,0xb49b73][i]);
  }
  // On the existing side wall, a narrow full service board.
  board([-5.83,1.65,2.0],[2.7,1.16],'ПРАЙС',lines(Object.values(BARBER_SERVICES).slice(2)),'#56473d');
  labels.at(-1)!.angle=Math.PI/2;
  const back=g.children.at(-1)!;back.position.set(-5.89,1.65,2);back.rotation.y=Math.PI/2;
  counter(-3.8,2.5);
 }else{
  const c=Object.values(CLINIC_SERVICES).filter(v=>v.price>0);
  for(const [x,title] of [[-3.7,'ПРИЁМ ВРАЧА'],[0,'ДИАГНОСТИКА'],[3.7,'ПРОЦЕДУРНАЯ']] as const){
   cabinet(x,-4.74,2.1,.69,0x89b0ad);
   board([x,2.14,-4.73],[2.22,.47],title,[],'#4e8b88');
   for(let i=0;i<3;i++)bottle(x-.41+i*.32,.75,-4.68,[0xe9e5d7,0xa0c7ca,0x829eaa][i]);
  }
  // Wall-mounted dispenser and chart, no additional medical actions.
  piece([.20,.32,.11],[-5.83,1.16,-.65],0xe3eee8);
  piece([.13,.09,.13],[-5.82,.98,-.65],0x7fa7a7);
  board([-5.83,1.74,1.85],[2.65,1.24],'ДОБРЫЙ ДОКТОР',lines(c),'#548b88');
  labels.at(-1)!.angle=Math.PI/2;
  const back=g.children.at(-1)!;back.position.set(-5.89,1.74,1.85);back.rotation.y=Math.PI/2;
  counter(-3.8,2.5);
 }
 batchRigidParts(g,true);signs(g,labels,resources);
 g.userData.labels=labels;
 g.traverse(o=>{if(o instanceof THREE.Mesh)o.raycast=()=>{};});
 return g;
}