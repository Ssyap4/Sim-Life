import * as THREE from 'three';
import { FURNITURE_BY_ID, FURNITURE_FINISHES, type FurnitureFinish } from '../shared/furniture';
import { batchRigidParts, cube, softCube, drum, orb, finish } from './ArtKit';

function createBody(sku:string,finishId:FurnitureFinish):THREE.Group {
  const info=FURNITURE_BY_ID.get(sku);
  if(!info)throw new Error('Unknown furniture: '+sku);
  const color=FURNITURE_FINISHES[finishId];
  const root=new THREE.Group();
  root.name=info.name;
  const w=info.width,d=info.depth,h=info.height;
  const main=color.main,light=color.light,dark=color.dark,cloth=color.fabric;
  const block=(width:number,height:number,depth:number,x:number,y:number,z:number,
    tint:number,soft=false,material:'wood'|'fabric'|'ceramic'|'metal'='wood') => {
    const mesh=new THREE.Mesh(soft?softCube:cube,finish(tint,material));
    mesh.scale.set(width,height,depth);
    mesh.position.set(x,y,z);
    mesh.castShadow=false;mesh.receiveShadow=true;
    root.add(mesh);
    return mesh;
  };
  const oval=(width:number,height:number,depth:number,x:number,y:number,z:number,tint:number,
    material:'wood'|'fabric'|'ceramic'|'metal'='fabric')=>{
    const mesh=new THREE.Mesh(orb,finish(tint,material));
    mesh.scale.set(width,height,depth);mesh.position.set(x,y,z);
    mesh.receiveShadow=true;root.add(mesh);return mesh;
  };
  const post=(x:number,z:number,top:number,thickness=.075,shade=dark)=>{
    block(thickness,top,thickness,x,top/2,z,shade);
  };
  const legged=(top:number,thick:number,legH:number,tint=main)=>{
    block(w,thick,d,0,top-thick/2,0,tint,true);
    for(const x of [-w/2+.12,w/2-.12])
      for(const z of [-d/2+.12,d/2-.12])post(x,z,legH,.085,dark);
  };
  switch(info.shape) {
    case 'sofa':case 'corner':case 'armchair':case 'daybed': {
      const baseY=.42;
      block(w,.34,d,0,baseY,0,cloth,true,'fabric');
      block(w,.39,.19,0,.63,-d/2+.095,main,true,'fabric');
      if(info.shape!=='daybed') {
        for(const x of [-w/2+.11,w/2-.11])
          block(.19,.35,d-.14,x,.54,0,main,true,'fabric');
      }else {
        block(.13,.45,d,-w/2+.07,.57,0,main,true,'fabric');
      }
      for(let n=0;n<(w>2.4?3:w>1.4?2:1);n++){
        const count=w>2.4?3:w>1.4?2:1;
        block((w-.34)/count-.045,.14,d*.58,
          (n-(count-1)/2)*((w-.29)/count),.65,.10,cloth,true,'fabric');
        oval((w-.42)/count*.41,.18,.10,
          (n-(count-1)/2)*((w-.29)/count),.89,-d/2+.21,light);
      }
      if(info.shape==='corner')block(w*.38,.29,d*.56,w*.28,.35,d*.25,cloth,true,'fabric');
      for(const x of [-w/2+.18,w/2-.18])
        for(const z of [-d/2+.20,d/2-.20])post(x,z,.21,.095,dark);
      break;
    }
    case 'ottoman': {
      block(w,.30,d,0,.33,0,cloth,true,'fabric');
      for(const x of [-w/2+.11,w/2-.11])for(const z of [-d/2+.11,d/2-.11])post(x,z,.18,.08);
      break;
    }
    case 'bench': {
      legged(.47,.11,.38);
      block(w-.1,.12,d-.07,0,.51,0,cloth,true,'fabric');
      break;
    }
    case 'bed': {
      block(w,.24,d,0,.30,0,main,true);
      block(w-.10,.21,d-.10,0,.51,0,0xf4eddd,true,'fabric');
      block(w-.16,.075,d*.58,0,.63,d*.13,cloth,true,'fabric');
      block(w,.78,.15,0,.48,-d/2+.08,main,true);
      for(const x of [-w*.22,w*.22])block(Math.min(.48,w*.39),.095,.34,
        x,.68,-d/2+.36,light,true,'fabric');
      for(const x of [-w/2+.12,w/2-.12])for(const z of [-d/2+.12,d/2-.12])post(x,z,.16,.09);
      break;
    }
    case 'wardrobe':case 'dresser':case 'sideboard':case 'nightstand': {
      const bodyH=h-.10;
      block(w,bodyH,d,0,.1+bodyH/2,0,main);
      block(w-.12,bodyH-.12,.035,0,.13+bodyH/2,d/2+.018,light);
      const doors=info.shape==='wardrobe'?(w>1.8?3:2):info.shape==='sideboard'?2:1;
      const drawer=info.shape==='dresser'||info.shape==='nightstand';
      if(drawer) for(let i=0;i<(h>.7?3:2);i++) {
        const drawerH=(bodyH-.14)/(h>.7?3:2);
        block(w-.13,.025,.02,0,.19+i*drawerH+drawerH/2,d/2+.044,dark);
        block(.17,.033,.034,0,.24+i*drawerH+drawerH/2,d/2+.06,dark,false,'metal');
      }
      else for(let i=0;i<doors;i++) {
        const x=(i-(doors-1)/2)*((w-.10)/doors);
        block(.018,bodyH-.11,.029,x+(w-.1)/doors/2,.16+bodyH/2,d/2+.043,dark);
        block(.028,.16,.049,x+.105,bodyH*.55,d/2+.055,dark,false,'metal');
      }
      if(sku.includes('mirror'))
        block((w-.14)/doors-.1,bodyH-.18,.033,-(w-.10)/doors/2,.18+bodyH/2,d/2+.075,
          0x9ab7c0,false,'ceramic');
      for(const x of [-w/2+.10,w/2-.10])post(x,-d/2+.10,.10,.08);
      break;
    }
    case 'shelves': {
      block(.075,h,d,-w/2+.038,h/2,0,main);
      block(.075,h,d,w/2-.038,h/2,0,main);
      block(w,.08,d,0,h-.05,0,main);
      for(let i=1;i<5;i++) {
        const y=(h-.10)*i/5;
        block(w-.13,.055,d,0,y,0,light);
        for(let j=0;j<3;j++) {
          const bx=-w*.30+j*w*.27;
          block(.07,.18+.04*((i+j)%3),.19,bx,y+.11,-d*.04,
            [dark,cloth,main][(i+j)%3]);
        }
      }
      break;
    }
    case 'table':case 'desk': {
      legged(h,Math.min(.11,h*.22),h-.12);
      if(info.shape==='desk') {
        block(w*.31,.10,d*.58,w*.29,h-.21,-d*.14,light);
        block(w*.08,.28,d*.14,w*.36,h-.28,d*.23,dark);
      }
      if(sku==='table-round') {
        // Faceted circular-look top from scaled cylinder, at very low geometry cost.
        const disc=new THREE.Mesh(drum,finish(main,'wood'));
        disc.scale.set(w*.50,.063,d*.50);
        disc.position.y=h-.09;
        root.add(disc);
      }
      break;
    }
    case 'chair': {
      block(w,.09,d,0,.47,0,cloth,true,'fabric');
      for(const x of [-w/2+.075,w/2-.075])
        for(const z of [-d/2+.075,d/2-.075])post(x,z,.45,.066);
      block(w,.43,.075,0,.70,-d/2+.04,main,true);
      break;
    }
    case 'stool': {
      legged(h,.09,h-.08);
      break;
    }
    case 'lamp': {
      block(.26,.05,.26,0,.035,0,dark);
      const pole=new THREE.Mesh(drum,finish(dark,'metal'));
      pole.scale.set(.032,h*.32,.032);
      pole.position.set(0,h*.48,0);root.add(pole);
      const shade=new THREE.Mesh(drum,finish(light,'fabric'));
      shade.scale.set(sku==='lamp-tripod'?.25:.20,.18,.21);
      shade.position.set(0,h-.27,0);root.add(shade);
      if(sku==='lamp-sphere')oval(.205,.205,.205,0,h-.21,0,light,'ceramic');
      if(sku==='lamp-tripod')
        for(const angle of [0,2.09,4.18]) {
          const support=block(.05,h*.52,.055,Math.sin(angle)*.12,h*.26,Math.cos(angle)*.12,main);
          support.rotation.z=Math.sin(angle)*-.16;
        }
      break;
    }
    case 'plant': {
      const pot=new THREE.Mesh(drum,finish(light,'ceramic'));
      pot.scale.set(w*.34,.235,d*.34);pot.position.y=.25;root.add(pot);
      block(.055,h*.55,.055,0,h*.48,0,dark);
      for(let i=0;i<5;i++) {
        const theta=(i/5)*Math.PI*2;
        oval(w*.33,.23,d*.28,Math.cos(theta)*w*.25,
          h*.62+(i%2)*.17,Math.sin(theta)*d*.23,
          i%2?0x67855d:0x507963);
      }
      oval(w*.27,.22,d*.30,0,h*.91,0,0x7a9869);
      break;
    }
    case 'rug': {
      block(w,.027,d,0,.021,0,cloth,true,'fabric');
      block(w-.17,.008,d-.17,0,.042,0,main,true,'fabric');
      for(const x of [-w/2+.09,w/2-.09])
        block(.035,.009,d-.20,x,.045,0,dark);
      break;
    }
    case 'mirror': {
      block(w,h,.10,0,h/2,0,main,true);
      block(w-.12,h-.18,.035,0,h/2,.075,0x97bdc5,false,'ceramic');
      block(w-.15,.018,.027,0,h*.71,.101,0xc2d9df);
      block(w*.65,.018,.027,0,h*.40,.100,0xb1cbd4);
      break;
    }
  }
  batchRigidParts(root,true);
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
