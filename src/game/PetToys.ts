import * as THREE from 'three';
import {orb,softCube,batchRigidParts,finish} from './ArtKit';
import type {PetId} from '../shared/pets';

/** Actual toys appear only during the server-backed play interaction.
 * No autonomous rewards or phantom items in inventory. */
export function createPetPlayToy(id:PetId): THREE.Group {
  const group=new THREE.Group();
  const part=(color:number,x:number,y:number,z:number,sx:number,sy:number,sz:number,
    geom:THREE.BufferGeometry=orb): THREE.Mesh=>{
    const mesh=new THREE.Mesh(geom,finish(color,'fabric'));
    mesh.position.set(x,y,z);
    mesh.scale.set(sx,sy,sz);
    group.add(mesh);
    return mesh;
  };
  if(id==='verdell'){
    // Familiar rubber fetch ball with curved contrasting seams.
    part(0x68a8a1,0,0,0,.105,.101,.105);
    for(let i=0;i<4;i++){
      const angle=i*Math.PI/2;
      const stripe=part(0xf7c46d,Math.cos(angle)*.074,.028,
        Math.sin(angle)*.074,.044,.022,.035,softCube);
      stripe.rotation.y=angle;
      stripe.rotation.z=-.32;
    }
    part(0xf1e9d3,0,.091,0,.028,.009,.028);
  } else {
    // Simba's fabric mouse, with ears, eyes, and a curled tail.
    part(0xb88c98,0,.032,0,.118,.054,.066);
    part(0xd49ca7,-.073,.073,.042,.031,.028,.017);
    part(0xd49ca7,.015,.073,.046,.030,.027,.017);
    part(0x302c36,-.070,.043,.077,.013,.014,.010);
    part(0x302c36,.011,.043,.079,.013,.014,.010);
    part(0xd97077,-.037,.027,.094,.018,.014,.016);
    for(let i=0;i<4;i++){
      const segment=part(0xc87989,.038+i*.027,.018+i*.014,-.058-i*.036,
        .018,.013,.040,softCube);
      segment.rotation.y=-.40;
      segment.rotation.x=.12*i;
    }
  }
  batchRigidParts(group,true);
  group.visible=false;
  return group;
}

/** Three permanent, lightweight household toys; independent from manual fetch. */
export function createDogToy(kind:import('../shared/pets').DogToyKind):THREE.Group{
  const group=new THREE.Group();
  const part=(color:number,x:number,y:number,z:number,w:number,h:number,d:number,geometry=orb)=>{
    const mesh=new THREE.Mesh(geometry,finish(color,'fabric'));
    mesh.position.set(x,y,z);mesh.scale.set(w*.5,h*.5,d*.5);group.add(mesh);return mesh;
  };
  if(kind==='ball'){
    part(0x68b83e,0,.095,0,.19,.19,.19);
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3;
      part(0x9cd56a,Math.sin(a)*.086,.095,Math.cos(a)*.086,.027,.037,.027);
    }
  }else if(kind==='rope'){
    for(let i=0;i<13;i++){
      const x=(i-6)*.025;
      const strand=part(i%2?0x356e9a:0xd6a36a,x,.035+Math.sin(i*1.4)*.009,Math.cos(i*1.4)*.018,.048,.044,.045);
      strand.rotation.z=i*.45;
    }
    for(const sign of [-1,1]){
      part(0x407c9c,sign*.165,.042,0,.08,.07,.07);
      for(let j=0;j<4;j++)part(j%2?0xd9b17e:0x407c9c,sign*(.20+j*.012),.023,.022*(j-1.5),.045,.017,.022);
    }
  }else{
    // Marfa: soft lavender plush rabbit, floppy ears, stitched features.
    part(0xb19baa,0,.065,-.025,.16,.115,.21);
    part(0xc7b2c0,0,.083,.090,.135,.125,.12);
    for(const side of [-1,1]){
      part(0xb19baa,side*.067,.045,.055,.064,.065,.115).rotation.y=side*.36;
      part(0xb19baa,side*.053,.043,-.13,.075,.065,.105).rotation.y=side*.3;
      part(0xb19baa,side*.047,.093,.16,.055,.047,.125).rotation.y=side*.40;
      part(0xe6b7bb,side*.049,.117,.163,.026,.013,.073).rotation.y=side*.40;
      part(0x483942,side*.037,.105,.145,.013,.015,.012);
    }
    part(0xe7c2c5,0,.088,.153,.026,.016,.017);
    part(0xe7d8d7,0,.056,-.14,.06,.06,.065);
  }
  group.name='Dog toy '+kind;
  batchRigidParts(group,true);
  return group;
}

export function createShopToy(kind:import('../shared/petToys').ShopToyKind):THREE.Group{
 const group=new THREE.Group();
 const part=(color:number,x:number,y:number,z:number,w:number,h:number,d:number,geo:THREE.BufferGeometry=orb,parent:THREE.Group=group)=>{
  const mesh=new THREE.Mesh(geo,finish(color,'fabric'));mesh.position.set(x,y,z);mesh.scale.set(w*.5,h*.5,d*.5);parent.add(mesh);return mesh;
 };
 if(kind==='bone'){
  part(0xeba76b,0,.055,0,.24,.09,.085);
  for(const side of [-1,1])for(const z of [-.041,.041])part(0xeba76b,side*.115,.055,z,.10,.10,.10);
  for(const x of [-.06,0,.06])part(0xfbd098,x,.10,0,.025,.012,.045,softCube);
 }else if(kind==='ring'){
  for(let i=0;i<20;i++){const a=i*Math.PI/10;part(i%2?0x4b9cbb:0x347f9b,Math.cos(a)*.115,.041,Math.sin(a)*.115,.075,.077,.075);}
 }else if(kind==='puzzle'){
  part(0x688f71,0,.035,0,.38,.07,.30,softCube);
  for(const x of [-.11,.11])for(const z of [-.07,.07])part(0xf2c285,x,.073,z,.105,.03,.105);
  for(const x of [-.11,.11]){
   const lid=new THREE.Group();lid.name='Puzzle lid';lid.position.set(x,.087,0);group.add(lid);
   part(0xce755e,0,0,0,.15,.03,.14,softCube,lid);part(0xf3d498,0,.024,0,.045,.045,.045,orb,lid);
  }
  return group;
 }else if(kind==='mouse'){
  const m=createPetPlayToy('simba');m.visible=true;group.add(m);
 }else if(kind==='spring'){
  for(let i=0;i<30;i++){
   const a=i*Math.PI*.43;part(0x6cc9a3,Math.cos(a)*.047,.067+Math.sin(a)*.047,(i-14.5)*.008,.024,.024,.024);
  }
 }else{
  part(0xe6b777,0,.025,0,.25,.05,.25);
  const top=new THREE.Group();top.name='Feather stalk';top.position.y=.04;group.add(top);
  for(let i=0;i<11;i++)part(0x4d6568,0,.014+i*.019,0,.026,.03,.026,orb,top);
  for(let i=0;i<5;i++){const a=i*1.26;const feather=part(i%2?0xe8a6bf:0x7fbac0,Math.cos(a)*.045,.25,Math.sin(a)*.045,.08,.19,.035,orb,top);feather.rotation.y=a;feather.rotation.z=.46;}
  return group;
 }
 group.name='Shop toy '+kind;batchRigidParts(group,true);return group;
}
