import * as THREE from 'three';
import {softCube,drum,orb,finish,batchRigidParts} from './ArtKit';
import type {SpeakerSku} from '../shared/speakerCatalog';
export function buildSpeakerModel(sku:SpeakerSku){
 const g=new THREE.Group(),alice=sku==='speaker-alice',google=sku==='speaker-google';
 function part(geometry:THREE.BufferGeometry,size:[number,number,number],pos:[number,number,number],color:number){
  const m=new THREE.Mesh(geometry,finish(color,'fabric'));m.scale.set(...size);m.position.set(...pos);g.add(m);return m;
 }
 if(alice){
  part(softCube,[.34,.43,.34],[0,.235,0],0x303539);
  part(softCube,[.33,.043,.33],[0,.447,0],0x24282b);
  part(softCube,[.20,.027,.012],[0,.36,.173],0x151a1e);
  for(const x of [-.045,.045])part(softCube,[.018,.009,.013],[x,.474,.015],0x7f8e94);
  part(softCube,[.14,.008,.025],[0,.474,-.075],0x9160dd);
 }else if(google){
  part(drum,[.18,.13,.18],[0,.075,0],0x929ba1);
  part(orb,[.19,.15,.19],[0,.24,0],0xf3f1eb);
  const cap=part(softCube,[.26,.025,.28],[0,.355,0],0xf6f4ef);cap.rotation.x=-.18;
  for(const [i,c] of [0x4285f4,0xea4335,0xfbbc05,0x34a853].entries())part(orb,[.012,.008,.012],[(i-1.5)*.045,.373,-.018],c);
 }else{
  part(drum,[.205,.31,.205],[0,.19,0],0x3f4248);
  part(orb,[.205,.105,.205],[0,.10,0],0x3f4248);
  part(orb,[.205,.10,.205],[0,.32,0],0x3f4248);
  part(drum,[.15,.017,.15],[0,.412,0],0x25282f);
  part(drum,[.055,.006,.055],[0,.424,0],0x8193c4);
 }
 batchRigidParts(g,true);return g;
}
