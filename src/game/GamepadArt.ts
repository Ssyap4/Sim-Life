import * as THREE from 'three';
import {softCube,drum,finish} from './ArtKit';
import type {ConsoleSku} from '../shared/consoleCatalog';
// Controller coordinates: +z toward television, y up. Wrist anchors behind grips.
export const CONTROLLER_GRIP=.087;
export function buildGamepad(sku:ConsoleSku){
 const g=new THREE.Group(),ps=sku==='console-ps5',shell=ps?0xf0f1f3:0x373c45;
 const part=(size:[number,number,number],pos:[number,number,number],color:number,geo:THREE.BufferGeometry=softCube)=>{
  const m=new THREE.Mesh(geo,finish(color,'metal'));m.scale.set(...size);m.position.set(...pos);g.add(m);return m;
 };
 part([.172,.037,.082],[0,0,.006],shell);
 for(const side of [-1,1]){
  const grip=part([.056,.049,.104],[side*.067,-.013,-.027],shell);grip.rotation.y=side*.22;
  part([.040,.018,.023],[side*.059,.017,.045],0x20252b);
  part([.025,.012,.025],[side*.038,.026,-.005],0x191f26,drum);
  part([.021,.006,.021],[side*.038,.034,-.005],0x50545a,drum);
 }
 part([.066,.007,.041],[0,.022,.007],ps?0x242932:0x171d24);
 part([.009,.004,.009],[0,.026,-.031],0x70b4fa);
 for(const side of [-1,1])for(const [dx,dz] of [[-.013,0],[.013,0],[0,-.013],[0,.013]])
  part([.010,.005,.010],[side*.066+dx,.023,.019+dz],side<0?0x32383e:0x858e9a,drum);
 return g;
}
