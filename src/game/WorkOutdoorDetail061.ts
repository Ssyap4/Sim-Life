import * as THREE from 'three';
import {cube,drum,finish,batchRigidParts,type XYZ} from './ArtKit';
import {type LocationResources} from './LocationArt';
import {STATIONS,type PlaceId} from '../shared/locations';
import {signs,type Label} from './ShopDetail061';
export const detailedRemaining=['education','work-it','work-detail','work-marketing','work-clinic','industrial','park','lake','market'] as const;
/** Surface-mounted props and flush markings, never additional navigation obstacles. */
export function addWorkOutdoorDetail(root:THREE.Group,place:PlaceId,resources:LocationResources){
 if(!(detailedRemaining as readonly string[]).includes(place))return;
 const g=new THREE.Group();g.name='Remaining detail 061 '+place;root.add(g);
 const labels:Label[]=[];
 const piece=(size:XYZ,position:XYZ,color:number,geometry:THREE.BufferGeometry=cube)=>{
  const m=new THREE.Mesh(geometry,finish(color,'wood'));m.position.set(...position);m.scale.set(...size);m.receiveShadow=true;g.add(m);return m;
 };
 const sign=(position:XYZ,size:[number,number],title:string,lines:string[],color:string,angle=0)=>{
  const b=piece([size[0]+.06,size[1]+.06,.045],[position[0]-.035*Math.sin(angle),position[1],position[2]-.035*Math.cos(angle)],0x5c5143);
  b.rotation.y=angle;labels.push({position,size,title,lines,color,angle});
 };
 const rail=(x:number,y:number,z:number,w:number,c:number)=>{
  piece([w,.065,.22],[x,y,z],c);piece([w,.035,.038],[x,y+.043,z+.11],0xd5c4a6);
 };
 const folder=(x:number,y:number,z:number,c:number,h=.24)=>{
  piece([.105,h,.15],[x,y+h/2,z],c);piece([.055,.052,.009],[x,y+h*.68,z+.080],0xe9e3ce);
 };
 const bottles=(x:number,y:number,z:number,colors:number[])=>{
  colors.forEach((c,i)=>{piece([.059,.19,.059],[x+i*.20,y+.095,z],c,drum);piece([.032,.04,.032],[x+i*.20,y+.207,z],0xd5d8d1,drum);});
 };
 const wallBoard=(z:number,title:string,lines:string[],color:string)=>{
  sign([-5.79,1.73,z],[2.65,.91],title,lines,color,Math.PI/2);
 };
 const mark=(x:number,z:number,w:number,d:number,c:number,y=.025)=>{
  piece([w,.004,d],[x,y,z],c);
 };
 const arrow=(x:number,z:number,angle:number,c:number,y=.025)=>{
  const parts=[piece([.08,.005,.34],[0,y,0],c),piece([.08,.005,.20],[-.066,y,-.15],c),piece([.08,.005,.20],[.066,y,-.15],c)];
  parts[1].rotation.y=-.72;parts[2].rotation.y=.72;
  for(const p of parts){const px=p.position.x,pz=p.position.z;p.position.x=x+px*Math.cos(angle)+pz*Math.sin(angle);p.position.z=z-px*Math.sin(angle)+pz*Math.cos(angle);p.rotation.y+=angle;}
 };
 if(place==='education'){
  wallBoard(-2.8,'УЧЕБНЫЙ ЦЕНТР',['Аудитория · лаборатория','Практическая зона'],'#58766d');
  wallBoard(.8,'ПОТЕНЦИАЛ',['Книги · курсы · программы','Навыки и сертификаты'],'#8b765d');
  for(const x of [-4.25,4.2]){
   rail(x,.96,-4.73,2.0,0xa9825c);
   for(let i=0;i<8;i++)folder(x-.77+i*.21,1.01,-4.70,[0xaab7a0,0x829eaa,0xc3a17b][i%3],.18+i%3*.045);
  }
  for(const s of STATIONS.education.filter(s=>s.action.kind==='education'&&s.action.room==='lab')){
   for(const dx of [-.63,.63])piece([.085,.024,.10],[s.center.x+dx+.24,.889,s.center.z+.11],0x52636b);
  }
 }else if(place.startsWith('work-')){
  const type=place.slice(5);
  const theme=type==='it'?{color:'#4c6772',a:0x709a9d,b:0xb1c3ba,title:'ПРОЕКТЫ',lines:['Планирование · разработка','Проверка · сдача проекта']}:type==='marketing'?{color:'#936e83',a:0xb68b98,b:0xd9c7b1,title:'КРЕАТИВНАЯ ЗОНА',lines:['Идеи · контент · аналитика','Работа с клиентами']}:type==='detail'?{color:'#526771',a:0x677e89,b:0xc2aa76,title:'ЗОНА ДЕТЕЙЛИНГА',lines:['Мойка · полировка · уход','Инструменты и расходники']}:{color:'#528377',a:0x7eaa99,b:0xc0d4c7,title:'ВЕТЕРИНАРИЯ',lines:['Приём · осмотр','Карточки пациентов']};
  wallBoard(-2.65,theme.title,theme.lines,theme.color);
  // Slim wall shelving below the actual window ledges.
  for(const x of [-3.9,3.88]){
   rail(x,.86,-4.73,2.15,theme.a);
   if(type==='clinic'||type==='detail'){
    bottles(x-.72,.91,-4.69,[theme.a,theme.b,0xe3dbc7,0x667c78,0xc19d78]);
    for(let i=0;i<3;i++)piece([.30,.055,.16],[x+.61,.93+i*.055,-4.69],theme.b);
   }else for(let i=0;i<8;i++)folder(x-.79+i*.22,.91,-4.68,[theme.a,theme.b,0xd7b98d][i%3],.19+.035*(i%3));
  }
  if(type==='detail'){
   // Safety stripes are flat and stay on the existing bay boundary.
   for(const x of [-.70,1.58,4.43])for(let i=0;i<14;i++)mark(x,-4.58+i*.36,.055,.16,0x625e56,.026);
   // Tools mounted on the existing wall, not in the vehicle aisle.
   for(let i=0;i<5;i++){piece([.038,.34,.038],[-5.79,1.10,-.5+i*.27],0x54666d,drum);piece([.045,.085,.14],[-5.78,1.28,-.5+i*.27],0xb4bec0);}
  }else if(type==='it'||type==='marketing'){
   const desk=STATIONS[place].find(s=>s.action.kind==='career'&&s.action.station==='desk');
   if(desk){
    const {x,z}=desk.center;
    piece([.13,.027,.20],[x-desk.width*.36,.88,z+.12],0x43575c);
    piece([.10,.009,.16],[x-desk.width*.36,.898,z+.12],theme.b);
   }
  }
 }else if(place==='industrial'){
  for(const s of STATIONS.industrial.filter(s=>s.action.kind==='warehouse')){
   const {x,z}=s.center,front=z+s.depth/2;
   const c=s.id.includes('ozon')?'#2859b7':'#8b327b';
   for(const side of [-1,1]){
    sign([x+side*1.94,2.33,front+.16],[1.50,.28],side<0?'ПРИЁМ':'ОТГРУЗКА',[],c);
    for(let i=0;i<5;i++)mark(x+side*1.94-.64+i*.32,front+.42,.18,.31,0xc9a94f,.035);
   }
   for(const side of [-1,1])mark(x+side*2.85,front+1.12,.06,1.1,0xe1cc86,.035);
   arrow(x,front+1.1,0,0xf0dec0,.035);
  }
 }else if(place==='market'){
  wallBoard(-2.45,'СВЕЖИЕ ПРОДУКТЫ',['Овощи · фрукты · выпечка','Молочные продукты'],'#4f7564');
  wallBoard(.75,'ПОКУПКИ',['Выберите товары','Оплатите на кассе'],'#6a8067');
  for(const x of [-.45,.45])mark(x,3.00,.055,.65,0x678879,.028);
  arrow(0,3.45,0,0x678879,.028);
  mark(0,2.72,.95,.055,0x678879,.028);
 }else if(place==='park'){
  // Painted wayfinding only, in existing paved walkways. No posts across paths.
  for(const [x,z,angle] of [[-2.68,3.75,0],[2.52,3.75,Math.PI/2],[2.52,.37,0],[-2.68,.37,Math.PI]] as const)arrow(x,z,angle,0xe6d9ba,.009);

 }else if(place==='lake'){
  // Camp identifiers fixed to existing corner posts; they do not narrow paths.
  for(const s of STATIONS.lake.filter(s=>s.action.kind==='lake'&&s.action.facility==='pitch')){
   const {x,z}=s.center;
   sign([x-1.95,.25,z+1.70],[.25,.16],s.id.slice(-1),[],'#5e7557');
  }
  for(const z of [-10,-6,4,9])arrow(3.30,z,Math.PI/2,0xe9dcba,.009);
  arrow(-6.9,9,Math.PI,0xf0dfbb,.009);
 }
 batchRigidParts(g,true);signs(g,labels,resources);
 g.userData.labels=labels;
 g.traverse(o=>{if(o instanceof THREE.Mesh)o.raycast=()=>{};});
 return g;
}