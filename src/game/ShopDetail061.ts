import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {cube,drum,orb,plane,finish,batchRigidParts,type XYZ} from './ArtKit';
import {painted,type LocationResources} from './LocationArt';
import {CAFE_MENU,STATIONS,type PlaceId} from '../shared/locations';
import {PET_SHOP_FOOD} from '../shared/petShop';
import {ELECTRONICS,electronicsFor} from '../shared/electronics';

export type Label={position:XYZ;size:[number,number];title:string;lines:string[];color:string;angle?:number};
const colors={cream:0xf2e5d0,wood:0x9d7753,dark:0x514b43,green:0x6a927f,steel:0x79949f};
const rub=(price:number)=>price.toLocaleString('ru-RU')+' ₽';
const supported=['cafe','petshop','clothing','electronics'] as const;
export type DetailedShop=typeof supported[number];
export function isDetailedShop(place:PlaceId):place is DetailedShop{return (supported as readonly string[]).includes(place);}

/** The entire location's signage uses one atlas and one draw call.
 * These are decorative, not a second catalog or a second checkout. */
export function signs(g:THREE.Group,labels:Label[],resources:LocationResources){
 if(!labels.length)return;
 const cols=4,rows=Math.ceil(labels.length/cols),cw=256,ch=128;
 const map=painted(resources,cols*cw,rows*ch,ctx=>{
  for(const [i,l] of labels.entries()){
   const x=i%cols*cw,y=Math.floor(i/cols)*ch;
   ctx.fillStyle=l.color;ctx.fillRect(x,y,cw,ch);
   ctx.strokeStyle='#ffffff66';ctx.lineWidth=2;ctx.strokeRect(x+4,y+4,cw-8,ch-8);
   ctx.fillStyle='#fff5e3';ctx.textAlign='center';ctx.textBaseline='middle';
   ctx.font=l.lines.length?'bold 23px system-ui':'bold 37px system-ui';ctx.fillText(l.title,x+cw/2,y+(l.lines.length?24:64),cw-18);
   ctx.font='600 15px system-ui';
   for(const [j,line] of l.lines.slice(0,4).entries())ctx.fillText(line,x+cw/2,y+49+j*18,cw-18);
  }
 });
 const mat=new THREE.MeshBasicMaterial({map,color:map?0xffffff:0xd9cbb4});
 resources.materials.push(mat);
 const parts=labels.map((l,i)=>{
  const geo=plane.clone(),uv=geo.getAttribute('uv');
  for(let n=0;n<uv.count;n++)uv.setXY(n,(i%cols+.005+uv.getX(n)*.99)/cols,(rows-1-Math.floor(i/cols)+.01+uv.getY(n)*.98)/rows);
  geo.scale(l.size[0],l.size[1],1);geo.rotateY(l.angle??0);geo.translate(...l.position);return geo;
 });
 const geometry=mergeGeometries(parts)!;parts.forEach(p=>p.dispose());
 const mesh=new THREE.Mesh(geometry,mat);mesh.name='Shop detail catalog atlas';mesh.raycast=()=>{};g.add(mesh);
}
/** Only embellish wall surfaces and existing stations. Keep all routes,
 * interaction anchors, products, prices and meal surfaces unchanged. */
export function addShopDetail(root:THREE.Group,place:PlaceId,resources:LocationResources){
 if(!isDetailedShop(place))return;
 const g=new THREE.Group();g.name='Shop detail 061 '+place;root.add(g);
 const labels:Label[]=[];
 const piece=(size:XYZ,position:XYZ,color:number,geometry:THREE.BufferGeometry=cube)=>{
  const m=new THREE.Mesh(geometry,finish(color,'wood'));m.position.set(...position);m.scale.set(...size);m.receiveShadow=true;g.add(m);return m;
 };
 const board=(position:XYZ,size:[number,number],title:string,lines:string[],color:string)=>{
  piece([size[0]+.09,size[1]+.09,.055],[position[0],position[1],position[2]-.04],colors.dark);
  labels.push({position,size,title,lines,color});
 };
 const rail=(x:number,y:number,z:number,w:number,d:number,c:number)=>{
  piece([w,.055,d],[x,y,z],c);piece([w,.045,.045],[x,y+.037,z+d/2-.022],colors.cream);
 };
 const checkout=(x:number,z:number,accent:number)=>{
  // Real card terminal, receipt printer and scanner on the existing counter.
  piece([.18,.065,.24],[x+.25,1.08,z+.13],0x384950);
  piece([.125,.012,.09],[x+.25,1.12,z+.075],0x9eb7ba);
  for(const dx of [-.04,0,.04])for(const dz of [0,.038,.076])piece([.025,.012,.025],[x+.25+dx,1.118,z+.125+dz],0xd0d5ce);
  piece([.20,.12,.19],[x+.54,1.10,z-.15],0x616d70);
  piece([.12,.012,.08],[x+.54,1.166,z-.15],colors.cream);
  piece([.83,.08,.028],[x,.83,z+.417],accent);
 };
 if(place==='cafe'){
  // Two real menu boards with prices from the current cafe catalog.
  const entries=Object.values(CAFE_MENU);
  board([-3.9,1.96,-4.75],[3.25,1.05],'КОФЕ И ДЕСЕРТЫ',entries.slice(0,4).map(v=>v.name+'  '+rub(v.price)),'#516858');
  board([3.9,1.96,-4.75],[3.25,1.05],'ГОРЯЧИЕ БЛЮДА',entries.slice(4).map(v=>v.name+'  '+rub(v.price)),'#785745');
  for(const x of [-.97,.45]){
   rail(x,1.72,-4.70,1.28,.32,colors.wood);
   for(let j=0;j<4;j++){
    piece([.064,.125,.064],[x-.43+j*.28,1.827,-4.67],colors.cream,drum);
    piece([.069,.018,.069],[x-.43+j*.28,1.756,-4.67],0xdbc2a2,drum);
   }
  }
  // Open bakery case on the pickup counter, kept clear of the register.
  const pickup=STATIONS.cafe.find(s=>s.id==='pickup')!.center;
  piece([.74,.06,.36],[pickup.x+.29,1.30,pickup.z-.16],colors.wood);
  piece([.72,.05,.36],[pickup.x+.29,1.55,pickup.z-.16],colors.wood);
  for(const x of [-.06,.64])piece([.045,.52,.36],[pickup.x+x,1.29,pickup.z-.16],colors.dark);
  for(const y of [1.365,1.615])for(let i=0;i<3;i++){
   const x=pickup.x+.07+i*.21;
   piece([.088,.055,.092],[x,y,pickup.z-.12],y<1.5?0xc7904e:0xd6b17c,orb);
   piece([.096,.013,.096],[x,y-.057,pickup.z-.12],colors.cream,drum);
  }
  for(const s of STATIONS.cafe.filter(s=>s.action.kind==='dine')){
   for(const x of [-.39,.39])piece([.35,.007,.28],[s.center.x+x,1.001,s.center.z-.22],0xa7b29a);
  }
 }else if(place==='petshop'){
  for(const s of STATIONS.petshop){
   if(s.action.kind==='pet-food-display'){
    const {pet,form}=s.action,products=PET_SHOP_FOOD.filter(p=>p.pet===pet&&p.id.includes('-'+form+'-'));
    const x=s.center.x,z=s.center.z;
    // Raised back shelf makes the display a stocked two-tier product fixture.
    piece([2.31,.78,.045],[x,1.28,z-.423],0x8eafa1);
    rail(x,1.54,z-.24,2.29,.34,colors.green);
    for(const side of [-1,1])piece([.045,.73,.32],[x+side*1.13,1.24,z-.24],colors.green);
    for(const [i,p] of products.entries()){
     const px=x+(i-1.5)*.55;
     if(form==='dry'){
      piece([.37,.39,.22],[px,1.77,z-.24],p.color);
      piece([.37,.038,.22],[px,1.975,z-.24],0xf0dfbb);
      piece([.27,.15,.012],[px,1.79,z-.122],colors.cream);
     }else{
      for(const dx of [-.09,.09])for(const y of [1.62,1.75,1.88]){
       piece([.076,.12,.076],[px+dx,y,z-.24],p.color,drum);
       piece([.077,.014,.077],[px+dx,y+.063,z-.24],0xe8dbc4,drum);
      }
     }
     labels.push({position:[px,1.574,z-.057],size:[.50,.097],title:rub(p.price),lines:[],color:'#4c7162'});
    }
   }else if(s.action.kind==='pet-furniture-display'){
    const x=s.center.x,z=s.center.z;
    piece([2.25,.84,.04],[x,1.0,z-.46],0x89ac99);
    for(const dx of [-.96,0,.96])piece([.035,.74,.035],[x+dx,1.02,z-.422],colors.cream);
   }else if(s.action.kind==='pet-checkout')checkout(s.center.x,s.center.z,0x759d88);
  }
  board([-3.65,1.85,-4.75],[3.1,1.0],'ДЛЯ СОБАК',['Сухие и влажные корма','Лакомства · игрушки'],'#577f69');
  board([3.65,1.85,-4.75],[3.1,1.0],'ДЛЯ КОШЕК',['Домики · когтеточки','Миски · кормушки'],'#66838b');
 }else if(place==='electronics'){
  for(const s of STATIONS.electronics){
   if(s.action.kind==='electronics-display'){
    const x=s.center.x,z=s.center.z;
    const items=electronicsFor(s.action.category);
    piece([2.32,.08,.05],[x,.88,z+.512],colors.steel);
    for(const [i,id] of items.entries()){
     const px=x+(i-1)*.74;
     // Low bases are behind the existing products: no replacement GLBs.
     piece([.65,.022,.15],[px,.924,z+.35],0xacc1ca);
     labels.push({position:[px,.68,z+.482],size:[.64,.15],title:rub(ELECTRONICS[id].price),lines:[],color:'#425c72'});
    }
   }else if(s.action.kind==='electronics-checkout')checkout(s.center.x,s.center.z,0x7796aa);
   else if(s.action.kind==='speaker-display'||s.action.kind==='vacuum-display'||s.action.kind==='console-display'){
    piece([s.width-.13,.06,.055],[s.center.x,.46,s.center.z+s.depth/2+.033],0x819faf);
   }
  }
  for(const [x,title,lines] of [[-3.8,'РАБОЧАЯ ЗОНА',['Ноутбуки и компьютеры','Выберите подходящую модель']],[0,'МУЛЬТИМЕДИА',['Телевизоры · смартфоны','Домашние развлечения']],[4.0,'УМНЫЙ ДОМ',['Колонки · роботы-пылесосы','Кофемашины']]] as const)
   board([x,1.79,-4.75],[3.2,1.0],title,[...lines],'#405e72');
 }else{
  // Clothing rack fronts, folded outfits, accessories and a full-length mirror.
  for(const s of STATIONS.clothing){
   const {x,z}=s.center;
   if(s.action.kind==='clothes-rack'){
    piece([2.18,.065,.70],[x,.29,z],0xc6ad96);
    for(let i=0;i<5;i++){
     const px=x+(i-2)*.40;
     for(const side of [-1,1]){
      piece([.122,.095,.25],[px+side*.075,.375,z+.10],i%2?0xd9d3ca:0x596069);
      piece([.13,.027,.265],[px+side*.075,.32,z+.10],0xece1cf);
     }
    }
   }else if(s.action.kind==='clothes-checkout')checkout(x,z,0xa18b9d);
  }
  for(const y of [.8,1.19,1.58]){
   rail(0,y,-4.75,2.68,.29,0xb7a090);
   for(let i=0;i<4;i++)for(let j=0;j<3;j++)
    piece([.43,.052,.23],[-.91+i*.60,y+.06+j*.055,-4.73],[0xbb8b93,0x8d9cb2,0xe5d6c3,0x738a7b][(i+j)%4]);
  }
  board([0,2.12,-4.75],[2.65,.60],'ПОВСЕДНЕВНАЯ ОДЕЖДА',[],'#8a7181');
  piece([1.28,1.88,.075],[2.08,1.17,-4.77],0xb8a29a);
  piece([1.14,1.74,.032],[2.08,1.17,-4.715],0xb6ccd0);
  piece([.055,1.60,.013],[1.68,1.20,-4.694],0xe0e7e4);
 }
 batchRigidParts(g,true);
 signs(g,labels,resources);
 g.userData.labels=labels;
 g.traverse(o=>{if(o instanceof THREE.Mesh)o.raycast=()=>{};});
 return g;
}