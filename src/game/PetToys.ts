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
