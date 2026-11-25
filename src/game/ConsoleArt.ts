import * as THREE from 'three';
import {softCube,drum,finish,batchRigidParts} from './ArtKit';
import {CONSOLES,type ConsoleSku} from '../shared/consoleCatalog';
export function buildConsoleModel(sku:ConsoleSku){
 const g=new THREE.Group();g.name=CONSOLES[sku].name;
 const part=(size:[number,number,number],pos:[number,number,number],color:number,geo:THREE.BufferGeometry=softCube)=>{
  const m=new THREE.Mesh(geo,finish(color,'metal'));m.scale.set(...size);m.position.set(...pos);g.add(m);return m;
 };
 if(sku==='console-ps5'){
  part([.29,.075,.18],[0,.05,0],0x242a32);
  for(const side of [-1,1]){const plate=part([.32,.024,.21],[0,.05+side*.036,0],0xf5f4f1);plate.rotation.z=side*.035;}
  part([.15,.006,.01],[.065,.059,.094],0x20232a);
  part([.09,.006,.009],[-.075,.084,.099],0x80b4f3);
  for(const x of [-.092,-.058])part([.018,.008,.01],[x,.053,.093],0x10151b);
 }else{
  part([.26,.116,.135],[0,.061,0],0x25292d);
  part([.20,.13,.04],[0,.075,-.032],0x151b21);
  part([.20,.09,.005],[0,.079,-.006],0x324858);
  for(const side of [-1,1]){part([.033,.13,.047],[side*.115,.075,-.03],side<0?0x6bb9dd:0xd77f75);part([.01,.008,.01],[side*.115,.108,.001],0x20262a,drum);}
  part([.17,.008,.005],[0,.066,.069],0x49535e);
 }
 batchRigidParts(g,true);const bounds=new THREE.Box3().setFromObject(g),size=bounds.getSize(new THREE.Vector3()),m=CONSOLES[sku];
 const scale=Math.min(m.width/size.x,m.depth/size.z,m.height/size.y);const root=new THREE.Group();g.scale.setScalar(scale);g.position.y=-bounds.min.y*scale;root.add(g);return root;
}