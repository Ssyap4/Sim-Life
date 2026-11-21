import * as THREE from 'three';
import { FURNITURE_BY_ID, FURNITURE_FINISHES, type FurnitureFinish } from '../shared/furniture';
import { batchRigidParts, cube, softCube, drum, orb, finish } from './ArtKit';

const taperedShade=new THREE.CylinderGeometry(.73,1,1,14);

// One source of geometry for BOTH the shop photographs and the actual objects.
// Each named design has recognisable, lightweight features, not generic emoji art.
function createBody(sku:string,finishId:FurnitureFinish):THREE.Group {
  const info=FURNITURE_BY_ID.get(sku);
  if(!info)throw new Error('Unknown furniture: '+sku);
  const color=FURNITURE_FINISHES[finishId];
  const root=new THREE.Group();
  root.name=info.name;
  const w=info.width,d=info.depth,h=info.height;
  const main=color.main,light=color.light,dark=color.dark,cloth=color.fabric;
  type Surface='wood'|'fabric'|'ceramic'|'metal';
  const block=(width:number,height:number,depth:number,x:number,y:number,z:number,
    tint:number,soft=false,material:Surface='wood') => {
    const mesh=new THREE.Mesh(soft?softCube:cube,finish(tint,material));
    mesh.scale.set(width,height,depth);mesh.position.set(x,y,z);
    mesh.castShadow=false;mesh.receiveShadow=true;
    root.add(mesh);return mesh;
  };
  const oval=(rx:number,ry:number,rz:number,x:number,y:number,z:number,tint:number,
    material:Surface='fabric')=>{
    const mesh=new THREE.Mesh(orb,finish(tint,material));
    mesh.scale.set(rx,ry,rz);mesh.position.set(x,y,z);
    mesh.receiveShadow=true;root.add(mesh);return mesh;
  };
  const cylinder=(rx:number,ry:number,rz:number,x:number,y:number,z:number,tint:number,
    material:Surface='wood')=>{
    const mesh=new THREE.Mesh(drum,finish(tint,material));
    mesh.scale.set(rx,ry,rz);mesh.position.set(x,y,z);
    root.add(mesh);return mesh;
  };
  const post=(x:number,z:number,top:number,thickness=.075,shade=dark)=>{
    block(thickness,top,thickness,x,top/2,z,shade);
  };
  const fourLegs=(top:number,edge=.12,thickness=.075,shade=dark)=>{
    for(const x of [-w/2+edge,w/2-edge])
      for(const z of [-d/2+edge,d/2-edge])post(x,z,top,thickness,shade);
  };
  switch(info.shape){
    case 'sofa':case 'corner':case 'armchair':case 'daybed':{
      const isDay=info.shape==='daybed';
      const isChair=info.shape==='armchair';
      const isCorner=info.shape==='corner';
      // Low base, raised upholstered seat, readable backrests and arms.
      block(w*.96,h*.29,d*.88,0,h*.32,0,main,true,'fabric');
      block(w*.93,h*.15,d*.70,0,h*.56,d*.06,cloth,true,'fabric');
      block(w*.97,h*.53,d*.19,0,h*.71,-d*.39,main,true,'fabric');
      if(!isDay){
        for(const x of [-w*.43,w*.43])
          block(w*.13,h*.38,d*.80,x,h*.61,d*.04,main,true,'fabric');
      }else{
        block(w*.10,h*.46,d*.86,-w*.43,h*.58,0,main,true,'fabric');
      }
      const count=isChair?1:w>2.4?3:w>1.5?2:1;
      for(let n=0;n<count;n++){
        const cx=(n-(count-1)/2)*w*.73/count;
        block(w*.72/count,h*.11,d*.53,cx,h*.62,d*.11,cloth,true,'fabric');
        block(w*.74/count,h*.30,d*.13,cx,h*.76,-d*.29,light,true,'fabric');
      }
      if(isCorner){
        // Chaise runs towards the viewer: a genuine L-shaped sectional.
        block(w*.38,h*.36,d*.75,w*.29,h*.41,d*.31,cloth,true,'fabric');
        block(w*.35,h*.10,d*.65,w*.29,h*.60,d*.35,light,true,'fabric');
      }
      if(isChair&&sku==='chair-nest'){
        // Rounded bucket silhouette, in contrast with the padded Cloud chair.
        oval(w*.40,h*.25,d*.21,0,h*.72,-d*.27,cloth);
        for(const x of [-w*.34,w*.34])oval(w*.13,h*.22,d*.27,x,h*.53,0,main);
      }
      if(isChair&&sku==='chair-cloud'){
        oval(w*.28,h*.14,d*.26,0,h*.67,d*.08,light);
        oval(w*.28,h*.19,d*.10,0,h*.78,-d*.31,cloth);
      }
      if(sku==='sofa-nord')block(w*.83,h*.055,d*.12,0,h*.30,d*.42,dark);
      if(sku==='sofa-luna')for(const x of [-w*.20,w*.20])
        oval(w*.07,h*.09,d*.045,x,h*.82,-d*.20,light);
      if(sku==='sofa-micro')oval(w*.23,h*.10,d*.21,0,h*.60,d*.12,light);
      fourLegs(h*.16,.18,.085);
      break;
    }
    case 'ottoman':{
      oval(w*.46,h*.35,d*.46,0,h*.56,0,cloth);
      block(w*.70,h*.11,d*.70,0,h*.19,0,main,true,'fabric');
      for(const x of [-w*.28,w*.28])for(const z of [-d*.28,d*.28])
        post(x,z,h*.17,.045);
      oval(w*.065,h*.028,d*.065,0,h*.91,0,light);
      break;
    }
    case 'bench':{
      block(w,h*.14,d,0,h*.72,0,main,true);
      block(w*.95,h*.17,d*.90,0,h*.87,0,cloth,true,'fabric');
      fourLegs(h*.67,.12,.085);
      break;
    }
    case 'bed':{
      block(w,h*.18,d,0,h*.25,0,main,true);
      block(w*.96,h*.19,d*.95,0,h*.44,0,0xf4eddd,true,'fabric');
      block(w*.96,h*.065,d*.55,0,h*.57,d*.21,cloth,true,'fabric');
      block(w,h*.82,d*.075,0,h*.51,-d*.47,main,true,'fabric');
      if(sku==='bed-aurora'){
        for(const x of [-w*.25,0,w*.25])
          block(w*.31,h*.46,d*.08,x,h*.59,-d*.45,cloth,true,'fabric');
      }else if(sku==='bed-line'){
        block(w*.95,h*.09,d*.10,0,h*.89,-d*.44,dark,true);
        block(w*.94,h*.11,d*.05,0,h*.15,d*.47,dark,true);
      }else{
        block(w*.90,h*.08,d*.055,0,h*.89,-d*.46,light,true);
      }
      const pillows=w>1.5?2:1;
      for(let i=0;i<pillows;i++){
        const x=(i-(pillows-1)/2)*w*.44;
        block(w*.37/pillows*1.7,h*.11,d*.18,x,h*.63,-d*.30,light,true,'fabric');
      }
      fourLegs(h*.15,.11,.09);
      break;
    }
    case 'wardrobe':case 'dresser':case 'sideboard':case 'nightstand':{
      const bodyH=h*.90;
      if(info.shape==='sideboard'){
        // Genuine open compartment: do not hide it behind a solid cabinet body.
        block(w,bodyH*.08,d*.94,0,h*.18,-d*.01,main);
        block(w,bodyH*.08,d*.94,0,h*.93,-d*.01,main);
        for(const x of [-w*.47,w*.14,w*.47])
          block(w*.045,bodyH*.86,d*.94,x,h*.55,-d*.01,main);
        block(w*.96,bodyH*.86,.035,0,h*.55,-d*.46,dark);
      }else block(w,bodyH,d*.94,0,h*.55,-d*.01,main,true);
      block(w*.96,h*.045,d*.98,0,h*.98,-d*.01,light,true);
      const isDrawers=info.shape==='dresser'||info.shape==='nightstand';
      if(isDrawers){
        const n=info.shape==='nightstand'?2:3;
        for(let i=0;i<n;i++){
          const drawerH=bodyH*.83/n;
          const y=h*.20+(i+.5)*drawerH;
          block(w*.91,drawerH*.91,.027,0,y,d*.47,light,true);
          if(sku==='dresser-nora'){
            for(const x of [-w*.23,w*.23])
              block(w*.14,.029,.032,x,y,d*.50,dark,true,'metal');
          }else block(w*.19,.035,.03,0,y,d*.50,dark,true,'metal');
        }
      }else if(info.shape==='sideboard'){
        // Two closed doors and a distinct open storage compartment.
        for(let i=0;i<2;i++){
          const x=-w*.30+i*w*.28;
          block(w*.265,bodyH*.77,.027,x,h*.53,d*.47,light,true);
          block(.026,h*.15,.04,x+w*.08,h*.56,d*.50,dark,true,'metal');
        }
        for(let i=0;i<3;i++)block(w*.29,.036,d*.79,w*.31,h*(.26+i*.24),0,dark);
      }else{
        const doors=sku==='wardrobe-wide'?3:2;
        for(let i=0;i<doors;i++){
          const doorW=w*.92/doors;
          const x=(i-(doors-1)/2)*doorW;
          const mirrored=sku==='wardrobe-mirror'&&i===0;
          block(doorW*.96,bodyH*.89,.033,x,h*.55,d*.475,
            mirrored?0x94bac5:light,true,mirrored?'ceramic':'wood');
          if(mirrored)block(doorW*.80,bodyH*.73,.019,x,h*.55,d*.499,0xb2d1d9,false,'ceramic');
          block(.03,h*.12,.047,x+(i%2===0?doorW*.27:-doorW*.27),h*.52,d*.51,
            dark,true,'metal');
        }
        if(sku==='wardrobe-tall')block(w*.87,.045,.05,0,h*.24,d*.50,dark);
      }
      for(const x of [-w*.39,w*.39])for(const z of [-d*.34,d*.34])
        post(x,z,h*.11,.06);
      break;
    }
    case 'shelves':{
      block(.065,h,d,-w*.47,h/2,0,main);
      block(.065,h,d,w*.47,h/2,0,main);
      block(w,.06,d,0,h*.975,0,main);
      block(w,.065,d,0,h*.045,0,main);
      const levels=sku==='shelf-open'?4:5;
      for(let i=1;i<levels;i++){
        const y=h*i/levels;
        block(w*.94,.045,d,0,y,0,light);
      }
      if(sku==='shelf-open'){
        for(const x of [-w*.15,w*.15])block(.045,h*.92,d*.91,x,h*.50,0,main);
        for(let i=0;i<levels;i++){
          const x=(i%2===0?-w*.30:w*.31);
          oval(w*.08,h*.08,d*.14,x,h*(i+.5)/levels,-d*.09,cloth,'ceramic');
        }
      }else{
        for(let i=0;i<levels-1;i++)for(let j=0;j<7;j++){
          const x=-w*.37+j*w*.115;
          const bh=h*(.115+.018*((i+j)%3));
          block(w*.065,bh,d*.40,x,h*(i+.08)/levels+bh*.5,-d*.07,
            [dark,cloth,light,main][(i+j)%4]);
        }
      }
      break;
    }
    case 'table':case 'desk':{
      if(sku==='table-round'){
        // Not a rectangular table with a disc laid on top.
        cylinder(w*.49,h*.065,d*.49,0,h*.93,0,main);
        cylinder(w*.085,h*.42,d*.085,0,h*.50,0,dark);
        cylinder(w*.29,h*.045,d*.29,0,h*.075,0,main);
      }else if(sku==='table-coffee'){
        oval(w*.47,h*.09,d*.45,0,h*.85,0,main,'wood');
        for(const x of [-w*.30,w*.30])
          for(const z of [-d*.23,d*.23])post(x,z,h*.74,.045);
        block(w*.55,.035,d*.48,0,h*.39,0,light);
      }else{
        block(w,h*.13,d,0,h*.92,0,main,true);
        fourLegs(h*.84,.115,.075,sku==='desk-simple'?dark:main);
        if(sku==='table-family'){
          block(w*.70,.065,.06,0,h*.55,-d*.39,dark);
          block(.06,h*.45,d*.75,0,h*.42,0,dark);
        }
        if(info.shape==='desk'){
          const isLarge=sku==='desk-large';
          block(w*.30,h*.38,d*.61,w*.32,h*.66,-d*.12,light,true);
          const drawers=isLarge?3:1;
          for(let i=0;i<drawers;i++){
            const y=h*(.49+i*.115);
            block(w*.265,h*.085,.032,w*.32,y,d*.20,main,true);
            block(w*.075,.025,.045,w*.32,y,d*.235,dark,false,'metal');
          }
          if(isLarge){
            block(w*.36,.055,d*.25,-w*.23,h*.54,-d*.29,light);
            block(w*.04,h*.22,d*.06,-w*.39,h*.68,-d*.32,dark);
          }
        }
      }
      break;
    }
    case 'chair':{
      const padded=sku==='chair-padded';
      block(w*.94,h*.11,d*.90,0,h*.53,0,padded?cloth:main,true,padded?'fabric':'wood');
      fourLegs(h*.47,.075,.062);
      if(padded){
        block(w*.92,h*.37,d*.14,0,h*.78,-d*.37,cloth,true,'fabric');
        oval(w*.32,h*.13,d*.12,0,h*.79,-d*.29,light);
      }else{
        for(const x of [-w*.41,w*.41])block(.058,h*.41,.06,x,h*.77,-d*.41,main);
        for(const y of [h*.75,h*.92])
          block(w*.80,h*.065,d*.055,0,y,-d*.41,main,true);
      }
      break;
    }
    case 'stool':{
      block(w,h*.18,d,0,h*.88,0,main,true);
      fourLegs(h*.79,.085,.067);
      block(w*.72,.05,.06,0,h*.30,-d*.33,dark);
      break;
    }
    case 'lamp':{
      if(sku==='lamp-tripod'){
        for(const angle of [0,2.094,4.189]){
          const support=block(.048,h*.84,.046,Math.sin(angle)*w*.22,h*.42,
            Math.cos(angle)*d*.22,main);
          support.rotation.z=Math.sin(angle)*-.24;
          support.rotation.x=Math.cos(angle)*.24;
        }
        cylinder(w*.34,h*.13,d*.34,0,h*.82,0,cloth,'fabric');
        cylinder(w*.24,h*.035,d*.24,0,h*.96,0,light,'fabric');
      }else if(sku==='lamp-sphere'){
        cylinder(w*.25,h*.05,d*.25,0,h*.045,0,dark,'metal');
        cylinder(.027,h*.80,.027,0,h*.41,0,dark,'metal');
        oval(w*.43,w*.43,d*.43,0,h*.89,0,0xf6e8c8,'ceramic');
      }else{
        cylinder(w*.35,h*.04,d*.35,0,h*.04,0,dark,'metal');
        cylinder(.027,h*.75,.027,0,h*.40,0,dark,'metal');
        // Wide fabric lampshade with contrasting upper and lower edge.
        const shade=new THREE.Mesh(taperedShade,finish(cloth,'fabric'));
        shade.scale.set(w*.39,h*.21,d*.39);shade.position.y=h*.84;
        root.add(shade);
        cylinder(w*.27,h*.023,d*.27,0,h*.94,0,light,'fabric');
        cylinder(w*.39,h*.018,d*.39,0,h*.74,0,dark,'metal');
      }
      break;
    }
    case 'plant':{
      const mini=sku==='plant-mini',monstera=sku==='plant-monstera';
      cylinder(w*.28,h*(mini?.17:.14),d*.28,0,h*.15,0,light,'ceramic');
      cylinder(w*.30,h*.018,d*.30,0,h*(mini?.29:.26),0,dark,'ceramic');
      if(mini){
        for(let i=0;i<8;i++){
          const a=i*Math.PI/4;
          const leaf=oval(w*.075,h*.22,d*.09,Math.sin(a)*w*.16,
            h*.55,Math.cos(a)*d*.15,i%2?0x5f967b:0x83ae81);
          leaf.rotation.z=Math.sin(a)*-.42;leaf.rotation.x=Math.cos(a)*.42;
        }
        oval(w*.10,h*.16,d*.10,0,h*.76,0,0x96b894);
      }else if(monstera){
        for(let i=0;i<7;i++){
          const a=i*Math.PI*2/7;
          block(.025,h*.51,.025,Math.sin(a)*w*.16,h*.50,
            Math.cos(a)*d*.16,0x56785b);
          const leaf=oval(w*.20,h*.07,d*.16,Math.sin(a)*w*.31,
            h*(.65+(i%3)*.10),Math.cos(a)*d*.30,
            i%2?0x497d59:0x75a66a);
          leaf.rotation.y=a;
          leaf.rotation.z=Math.sin(a)*-.42;
        }
      }else{
        block(.045,h*.65,.045,0,h*.49,0,0x705943);
        for(let i=0;i<10;i++){
          const a=i*2.39996;
          oval(w*.17,h*.12,d*.14,Math.sin(a)*w*.24,
            h*(.55+(i%5)*.082),Math.cos(a)*d*.23,
            i%2?0x54814b:0x779e5d);
        }
      }
      break;
    }
    case 'rug':{
      block(w,.022,d,0,.016,0,cloth,true,'fabric');
      block(w*.94,.006,d*.93,0,.030,0,main,true,'fabric');
      if(sku==='rug-weave'){
        for(let i=0;i<7;i++)
          block(w*.84,.005,d*.013,0,.035,-d*.40+i*d*.133,
            i%2?light:dark,false,'fabric');
      }else{
        for(const x of [-w*.39,w*.39])
          block(w*.023,.007,d*.87,x,.037,0,dark,false,'fabric');
        for(const z of [-d*.40,d*.40])
          block(w*.80,.007,d*.026,0,.037,z,light,false,'fabric');
        for(const x of [-w*.22,w*.22])
          for(const z of [-d*.18,d*.18])
            oval(w*.06,.005,d*.07,x,.038,z,light);
      }
      break;
    }
    case 'mirror':{
      // Faceted rounded/arched top and silvery interior; NOT a wardrobe door.
      block(w*.95,h*.75,d*.34,0,h*.40,0,main,true);
      oval(w*.47,h*.19,d*.19,0,h*.80,0,main,'wood');
      block(w*.83,h*.69,.022,0,h*.42,d*.19,0x91b5c4,true,'ceramic');
      oval(w*.41,h*.14,.018,0,h*.79,d*.19,0xb2d1d9,'ceramic');
      block(w*.69,.012,.012,0,h*.43,d*.21,0xdae8eb);
      if(sku==='mirror-wide')
        for(const x of [-w*.42,w*.42])
          block(.022,h*.76,.05,x,h*.41,d*.18,dark);
      break;
    }
  }
  batchRigidParts(root,true);
  // Physics and saved placement dimensions remain unchanged. Trim visual
  // details to the legal footprint instead of invalidating existing saves.
  const bounds=new THREE.Box3().setFromObject(root);
  const maxX=Math.max(-bounds.min.x,bounds.max.x);
  const maxZ=Math.max(-bounds.min.z,bounds.max.z);
  if(maxX>0)root.scale.x=Math.min(1,w/(2*maxX));
  if(maxZ>0)root.scale.z=Math.min(1,d/(2*maxZ));
  if(bounds.max.y>0)root.scale.y=Math.min(1,h/bounds.max.y);
  return root;
}
export function buildFurnishingModel(sku:string,finishId:FurnitureFinish):THREE.Group {
  return createBody(sku,finishId);
}
export function createPlacementGhost(sku:string,finishId:FurnitureFinish):THREE.Group {
  const ghost=createBody(sku,finishId);
  ghost.name='Предпросмотр размещения';
  const copies=new Map<THREE.Material,THREE.MeshStandardMaterial>();
  ghost.traverse(child=>{
    if(!(child instanceof THREE.Mesh))return;
    const old=child.material as THREE.MeshStandardMaterial;
    let material=copies.get(old);
    if(!material){
      material=old.clone();material.transparent=true;material.opacity=.58;
      material.depthWrite=false;material.emissive.setHex(0x173b2c);
      copies.set(old,material);
    }
    child.material=material;
  });
  return ghost;
}
