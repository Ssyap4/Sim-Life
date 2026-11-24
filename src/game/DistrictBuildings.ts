import * as THREE from 'three';
import { batchRigidParts, cube, drum, type XYZ } from './ArtKit';
import { lettering, part, painted, round, trim, type LocationResources } from './LocationArt';
import { districtYaw, type DistrictSite } from '../shared/district';

const ivory = 0xddd6bd, graphite = 0x374b4e, oak = 0x9c674d;
const glass = 0x668486, glassEdge = 0xb5ccc3;
const roof = 0x42494a;
const glazing=new WeakMap<LocationResources,Map<string,THREE.MeshStandardMaterial>>();
type Frame = { group:THREE.Group; site:DistrictSite; face:number; lights:THREE.MeshStandardMaterial; resources:LocationResources };

function box(group:THREE.Group,size:XYZ,pos:XYZ,color:number) {
  return part(group,size,pos,color,cube,'ceramic');
}

function wall({group,site,face}:Frame,height:number,color:number,front:number) {
  box(group,[site.w,.24,site.d+.35],[0,.06,0],0x9b9581);
  box(group,[site.w,height,.28],[0,height/2,-face+.14],color);
  for(const side of [-1,1]) box(group,[.30,height,site.d],[side*(site.w/2-.15),height/2,0],color);
  box(group,[site.w,height-front,.24],[0,front+(height-front)/2,face-.12],color);
}

function pane(frame:Frame,x:number,y:number,width:number,height:number, type:'shelf'|'curtain'|'office'|'garage'|'atrium') {
  const {group,face,resources}=frame;
  let palette=glazing.get(resources);
  if(!palette){palette=new Map();glazing.set(resources,palette);}
  let material=palette.get(type);
  if(!material){
  const map=painted(resources,160,96,ctx=>{
    const palettes={shelf:['#405956','#9e9874','#bac6ac'],curtain:['#5b4b45','#ad7960','#d4aa8b'],
      office:['#37535d','#7f9e9c','#c4cfc3'],garage:['#35474c','#597376','#889a91'],atrium:['#3f5d59','#8a966e','#bbbe93']};
    const [base,mid,light]=palettes[type];
    ctx.fillStyle=base;ctx.fillRect(0,0,160,96);
    if(type==='shelf') for(let row=0;row<3;row++){
      const y=29+row*19;
      ctx.fillStyle='#827358';ctx.fillRect(9,y+10,142,3);
      for(let col=0;col<12;col++){
        ctx.fillStyle=['#aa7a52','#c6a875','#79987c','#d1c19a','#947265'][(row*2+col*3)%5];
        ctx.fillRect(13+col*11,y+(col%3),7,10-col%3);
      }
    } else if(type==='curtain') {
      for(let a=0;a<12;a++) {ctx.fillStyle=a%2?mid:light;ctx.fillRect(a*4,0,3,76-a*3);ctx.fillRect(160-a*4,0,3,76-a*3);}
      ctx.fillStyle=light;ctx.fillRect(48,65,64,5);ctx.fillRect(59,71,3,13);ctx.fillRect(99,71,3,13);
      ctx.beginPath();ctx.ellipse(72,54,6,8,0,0,Math.PI*2);ctx.ellipse(90,54,6,8,0,0,Math.PI*2);ctx.fill();
    } else {
      ctx.fillStyle=mid;ctx.fillRect(8,49,144,17);
      for(let a=0;a<3;a++){ctx.fillStyle=light;ctx.fillRect(15+a*49,38,26,17);ctx.fillRect(26+a*49,55,4,8);}
    }
    ctx.fillStyle='#b8d6c030';ctx.beginPath();ctx.moveTo(0,12);ctx.lineTo(142,0);ctx.lineTo(90,45);ctx.lineTo(0,63);ctx.fill();
    ctx.fillStyle='#d6e4d320';ctx.fillRect(0,0,160,22);
  });
  material=new THREE.MeshStandardMaterial({map,color:map?0xffffff:glass,roughness:.48,
    emissiveMap:map,emissive:0xeed8a3,emissiveIntensity:0});
  resources.materials.push(material);
  material.userData.window=true;
  palette.set(type,material);
  }
  const geometry=new THREE.PlaneGeometry(width,height);
  const mesh=new THREE.Mesh(geometry,material);
  mesh.position.set(x,y,face+.02);
  group.add(mesh);
  for(const side of [-1,1]){
    box(group,[.078,height+.12,.10],[x+side*width/2,y,face+.035],ivory);
    box(group,[width+.12,.075,.10],[x,y+side*height/2,face+.035],ivory);
  }
  box(group,[.037,height,.055],[x,y,face+.055],0x73827a);
  box(group,[width+.14,.085,.17],[x,y-height/2-.05,face+.06],oak);
}

function entrance({group,face,lights}:Frame,width:number, solid=false) {
  const h=2.38;
  trim(group,[width+.27,.19,.86],[0,.10,face+.36],0xc4b9a2);
  box(group,[width+.17,h+.12,.12],[0,h/2+.12,face+.024],ivory);
  box(group,[width-.10,h-.07,.11],[0,h/2+.11,face+.09],solid?0x537068:graphite);
  for(const side of [-1,1]){
    const x=side*width*.247;
    box(group,[width*.432,solid?.40:1.85,.016],[x,solid?1.91:1.43,face+.157],solid?0x8baca2:glass);
    box(group,[width*.425,.045,.028],[x,1.00,face+.175],glassEdge);
    trim(group,[.035,.32,.095],[side*.075,1.30,face+.201],0xdbbd83);
  }
  const lamp=new THREE.Mesh(drum,lights);
  lamp.position.set(0,2.56,face+.25);
  lamp.scale.set(.17,.09,.17);
  group.add(lamp);
}

function ledge(frame:Frame,width:number,y:number,depth:number,color:number) {
  const {group,face}=frame;
  box(group,[width,.13,depth],[0,y,face+depth*.34],color);
  box(group,[width,.065,.095],[0,y-.09,face+depth*.85],ivory);
}

function gable({group,site}:Frame,eave:number,rise:number,color:number) {
  const slope=Math.atan2(rise,site.w/2);
  for(const s of [-1,1]) {
    const board=box(group,[Math.hypot(site.w/2,rise)+.30,.17,site.d+.53],[s*site.w/4,eave+rise/2,0],color);
    board.rotation.z=-s*slope;
    for(let k=1;k<6;k++) {
      const piece=box(group,[.03,.035,site.d+.52],[s*k*site.w/12,eave+rise*(1-k/6)+.09,0],0x8b7868);
      piece.rotation.z=-s*slope;
    }
  }
  for(const side of [-1,1]) {
    const points=new Float32Array([-site.w/2,eave,side*site.d/2,site.w/2,eave,side*site.d/2,0,eave+rise,side*site.d/2]);
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(points,3));
    geometry.setIndex(side===1?[0,1,2]:[2,1,0]);
    geometry.computeVertexNormals();
    part(group,[1,1,1],[0,0,0],site.color,geometry,'ceramic');
  }
}

function roofDeck({group,site}:Frame,h:number, color:number, canopy=.54) {
  box(group,[site.w+.20,.20,site.d+.28],[0,h,0],color);
  for(const side of [-1,1]) box(group,[.11,.25,site.d],[side*site.w*.49,h+.17,0],roof);
  box(group,[site.w,.26,.14],[0,h+.14,-site.d*.49],roof);
  box(group,[site.w*.39,.43,Math.min(site.d*.63,2.5)],[0,h+.25,-site.d*.12],color);
  for(const x of [-.31,.31]) box(group,[.28,.20,.34],[x,h+.56,-site.d*.11],roof);
  box(group,[site.w+.26,.10,canopy],[0,h-.31,site.d/2+canopy*.35],ivory);
}

function pots(group:THREE.Group,x:number,z:number, scheme:number) {
  round(group,.24,.30,[x,.15,z],scheme?0x9a6955:0x72827b);
  round(group,.27,.075,[x,.31,z],0xd0aa8b);
  for(let n=0;n<6;n++){
    const theta=n*2.4;
    const bloom:XYZ=[x+.16*Math.sin(theta),.48+(n%3)*.08,z+.15*Math.cos(theta)];
    const leaf=part(group,[.052,.16,.069],[bloom[0],bloom[1]-.08,bloom[2]],0x68855e,drum,'fabric');
    leaf.rotation.z=Math.sin(theta)*.47;
    part(group,[.077,.054,.072],bloom,n%2?0xe7c390:(scheme?0xc57878:0xf0dfbd),drum,'ceramic');
  }
}

export function buildDistrictFacade(site:DistrictSite,resources:LocationResources, lights:THREE.MeshStandardMaterial) {
  const group=new THREE.Group();
  group.name=site.name;
  group.position.set(site.x,0,site.z);group.rotation.y=districtYaw(site);
  const face=site.d/2, w=site.w;
  const frame={group,site,face,resources,lights};
  if(site.place==='market') {
    wall(frame,3.85,0xacaca0,2.56);
    roofDeck(frame,3.85,site.color,1.1);
    box(group,[w+.16,.63,.24],[0,3.11,face+.12],site.color);
    box(group,[w+.10,.09,.13],[0,2.77,face+.23],0xb9b98e);
    for(const x of [-w*.311,w*.311]) pane(frame,x,1.42,1.96,1.87,'shelf');
    for(const x of [-w*.45,w*.45]) box(group,[.17,2.56,.38],[x,1.34,face+.11],0x456963);
    entrance(frame,1.68);
    for(const x of [-2.72,2.72]) {pots(group,x,face+.73,1); box(group,[.055,.51,.055],[x,.265,face+1.0],graphite);}
  } else if(site.place==='petshop'){
    wall(frame,3.65,0xe3d9be,2.55);roofDeck(frame,3.65,site.color);
    box(group,[w+.15,.34,.65],[0,2.76,face+.18],site.color);
    for(const x of [-1.75,1.75]){pane(frame,x,1.42,1.62,1.87,'shelf');box(group,[1.65,.12,.25],[x,.43,face+.07],0x7b9d81);}
    entrance(frame,1.45,true);
  } else if(site.place==='electronics'){
    wall(frame,3.85,0xc3d0d5,2.60);roofDeck(frame,3.85,site.color);
    box(group,[w+.15,.32,.53],[0,2.78,face+.15],site.color);
    for(const x of [-1.78,1.78]){pane(frame,x,1.45,1.68,1.95,'office');box(group,[1.70,.11,.24],[x,.42,face+.09],0x638c9d);}
    entrance(frame,1.48,true);
  } else if(site.place==='clothing'){
    wall(frame,3.65,0xd4c9bd,2.55);roofDeck(frame,3.65,site.color);
    box(group,[w+.13,.32,.62],[0,2.76,face+.18],site.color);
    for(const x of [-1.75,1.75]){
      pane(frame,x,1.40,1.56,1.95,'office');
      box(group,[1.56,.13,.25],[x,.43,face+.07],0xbcae9c);
    }
    entrance(frame,1.38,true);
  } else if(site.place==='cafe') {
    wall(frame,3.57,0xcda78a,2.51);gable(frame,3.59,.79,0x80574e);
    for(const x of [-1.58,1.58]){
      pane(frame,x,1.49,1.38,1.55,'curtain');
      for(const offset of [-.51,.51]) box(group,[.11,1.60,.09],[x+offset,1.52,face+.09],0xbd8d70);
    }
    entrance(frame,1.22,true);
    const canopy=new THREE.Group();
    canopy.position.set(0,2.59,face+.50);canopy.rotation.x=.21;
    for(let i=0;i<12;i++)box(canopy,[w*.92/12,.075,.92],[(i-5.5)*w*.92/12,0,0],i%2?0xc07b65:0xe3c2a2);
    group.add(canopy);batchRigidParts(canopy,true);
    for(const x of [-1.96,1.96]) pots(group,x,face+.46,0);
  } else if(site.place==='education'){
    wall(frame,4.10,0xd3b58a,2.62);roofDeck(frame,4.16,0xb38464);
    box(group,[w+.54,.30,.80],[0,2.73,face+.32],ivory);
    for(const x of [-2.27,-.93,.93,2.27]) box(group,[.19,2.58,.28],[x,1.32,face+.18],ivory);
    for(const x of [-1.68,1.68]) pane(frame,x,1.64,1.06,1.45,'atrium');
    for(const x of [-1.92,-.63,.63,1.92]) pane(frame,x,3.44,.77,.61,'office');
    entrance(frame,1.42,true);
  } else if(site.place==='work-it'){
    wall(frame,4.84,0x728482,2.57);roofDeck(frame,4.85,0x536d73);
    for(const x of [-1.63,0,1.63])pane(frame,x,3.57,1.38,1.45,'office');
    for(const x of [-1.61,1.61])pane(frame,x,1.47,1.22,1.49,'office');
    for(const x of [-2.13,-.835,.835,2.13])box(group,[.105,4.21,.20],[x,2.28,face+.085],0x456372);
    entrance(frame,1.18);ledge(frame,2.25,2.61,.79,graphite);
  } else if(site.place==='work-detail'){
    wall(frame,3.48,0x929b97,2.69);roofDeck(frame,3.49,site.color,1.15);
    for(const x of [-2.26,2.26]){
      box(group,[2.1,2.42,.11],[x,1.29,face+.02],0x526667);
      for(let i=0;i<13;i++) box(group,[2.00,.026,.025],[x,.19+i*.177,face+.087],0xa7aca2);
      pane(frame,x,1.79,1.73,.37,'garage');
      box(group,[1.59,.034,.055],[x,.38,face+.092],0xc8a076);
    }
    entrance(frame,1.27);
  } else if(site.place==='work-marketing'){
    wall(frame,3.77,0xb78465,2.57);gable(frame,3.79,.70,0x62554d);
    box(group,[w,.41,.12],[0,3.22,face+.044],0xa86d56);
    for(const x of [-1.65,1.65]) {
      pane(frame,x,1.62,1.34,1.67,'office');
      for(const side of [-1,1]) box(group,[.09,2.35,.19],[x+side*.73,1.47,face+.14],0xd5ab88);
    }
    for(let n=0;n<14;n++)box(group,[w-.12,.036,.015],[0,2.63+n*.065,face+.056],0xc59472);
    entrance(frame,1.25,true);
  } else if(site.place==='work-clinic'){
    wall(frame,3.35,0xbcc3ac,2.57);roofDeck(frame,3.37,site.color,.97);
    for(const x of [-1.91,1.91])pane(frame,x,1.49,1.52,1.34,'atrium');
    entrance(frame,1.57);ledge(frame,2.45,2.61,1.02,site.color);
    for(const x of [-2.71,2.71]) pots(group,x,face+.52,1);
  } else {
    for(const side of [-1,1]) {
      box(group,[.23,2.6,.75],[side*1.67,1.31,0],0x587660);
      box(group,[.35,.11,.81],[side*1.67,2.58,0],ivory);
    }
    box(group,[3.57,.44,.40],[0,2.68,face-.26],site.color);
  }
  // Park entrance stays an entrance sign; shops get freestanding ROOFTOP boards.
  if(site.place==='park'){
    box(group,[3.72,.72,.16],[0,2.70,face+.92],site.color);
    lettering(group,resources,[0,2.70,face+1.01],3.50,.62,site.sign,['#344f4d','#ffeed2']);
  }
  batchRigidParts(group,true);
  return group;
}

/** Compact, readable roof-mounted signs. Separate from facade LOD so the names
 * remain visible as the building switches between full and simplified meshes. */
export function buildRoofBillboard(site:DistrictSite,resources:LocationResources):THREE.Group {
  const board=new THREE.Group();
  board.name='Roof sign: '+site.place;
  if(site.place==='park')return board;

  // Eave/ridge heights match the actual roof shapes above (including gables).
  const rooflines={
    petshop:{eave:3.65,rise:.36,gable:false},
    electronics:{eave:3.85,rise:.36,gable:false},
    clothing:{eave:3.65,rise:.36,gable:false},
    market:{eave:3.85,rise:.36,gable:false},
    cafe:{eave:3.59,rise:.79,gable:true},
    education:{eave:4.16,rise:.36,gable:false},
    'work-it':{eave:4.85,rise:.36,gable:false},
    'work-detail':{eave:3.49,rise:.36,gable:false},
    'work-marketing':{eave:3.79,rise:.70,gable:true},
    'work-clinic':{eave:3.37,rise:.36,gable:false},
  } as const;
  const roofline=rooflines[site.place];
  const width=Math.min(site.w-.52,6.45),height=1.10;
  const bottom=roofline.eave+roofline.rise+.28;
  const centerY=bottom+height/2;
  const z=site.d/2-.23;
  const palette:Record<Exclude<DistrictSite['place'],'park'>,readonly [number,string,string]>={
    petshop:[0x39664d,'#39664d','#fff4d7'],
    electronics:[0x28546f,'#28546f','#e6faff'],
    clothing:[0x675771,'#675771','#fff3e6'],
    market:[0x275a4f,'#245649','#fff6d9'],
    cafe:[0x763f34,'#70392f','#fff0d9'],
    education:[0x795e41,'#715338','#fff3d4'],
    'work-it':[0x3b5e69,'#335766','#f4f6ed'],
    'work-detail':[0x43595d,'#40565a','#f6eee0'],
    'work-marketing':[0x804d3b,'#7a4b3d','#fff2d9'],
    'work-clinic':[0x4c6c5d,'#486b5b','#f5f1df'],
  };
  const [frameColor,background,ink]=palette[site.place];
  // A slightly proud front face, slim metal rim and two believable supports.
  box(board,[width+.20,height+.16,.18],[0,centerY,z],graphite);
  box(board,[width+.13,height+.09,.055],[0,centerY,z+.11],frameColor);
  for(const side of [-1,1]){
    const x=side*width*.32;
    const base=roofline.gable
      ? roofline.eave+roofline.rise*(1-Math.abs(x)/(site.w/2))
      : roofline.eave+.16;
    const length=Math.max(.12,bottom-base+.06);
    box(board,[.105,length,.13],[x,base+length/2,z-.10],0x556264);
    box(board,[.31,.08,.33],[x,base+.025,z-.10],graphite);
  }
  lettering(board,resources,[0,centerY,z+.149],width-.12,height-.14,site.sign,[background,ink]);
  return board;
}

/** One small shell per landmark keeps the full district readable at overview scale. */
export function distantDistrictFacade(site:DistrictSite) {
  const model=new THREE.Group(), {w,d}=site;
  const h=site.place==='work-it'?4.8:site.place==='education'?4.1:3.50;
  if(site.place==='park') {
    for(const x of [-1.68,1.68])box(model,[.24,2.65,.50],[x,1.33,0],site.color);
    box(model,[3.65,.43,.32],[0,2.65,0],site.color);
  } else {
    box(model,[w,h,d],[0,h/2,0],site.place==='market'?0xb7bbaa:site.color);
    const sloped=site.place==='cafe'||site.place==='work-marketing';
    const rise=.68;
    const surface=site.place==='cafe'?0x80574e:site.color;
    if(sloped){
      for(const side of [-1,1]){
        const panel=box(model,[Math.hypot(w/2,rise)+.24,.15,d+.42],[side*w/4,h+rise/2,0],surface);
        panel.rotation.z=-side*Math.atan2(rise,w/2);
      }
      box(model,[w*.31,.46,d-.15],[0,h+.19,0],site.color);
    } else {
      box(model,[w+.20,.23,d+.27],[0,h,0],surface);
      box(model,[w*.41,.39,d*.57],[0,h+.20,-.13],surface);
    }
    const z=d/2+.04;
    box(model,[1.28,2.23,.14],[0,1.11,z],graphite);
    for(const side of [-1,1]){
      box(model,[w*.25,1.19,.10],[side*w*.30,1.53,z],0x688887);
      box(model,[w*.26,.086,.14],[side*w*.30,.91,z],ivory);
      if(h>4.00)box(model,[w*.28,.81,.09],[side*w*.31,3.36,z],0x62858c);
    }
  }
  batchRigidParts(model,true);
  return model;
}
