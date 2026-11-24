import * as THREE from 'three';
import {softCube,drum,finish,batchRigidParts} from './ArtKit';
import {VACUUM_MODELS,type VacuumSku} from '../shared/vacuumCatalog';
export function buildVacuumModel(sku:VacuumSku){
 const g=new THREE.Group(),m=VACUUM_MODELS[sku],robot=new THREE.Group(),dock=new THREE.Group();
 const dark=sku==='vacuum-roborock',premium=sku==='vacuum-dreame',color=dark?0x333a40:0xedece6,trim=dark?0x14191e:0xa8a9a5;
 function part(parent:THREE.Group,size:[number,number,number],p:[number,number,number],c:number,round=false){
  const mesh=new THREE.Mesh(round?drum:softCube,finish(c,'metal'));mesh.scale.set(round?size[0]/2:size[0],size[1],round?size[2]/2:size[2]);mesh.position.set(...p);parent.add(mesh);
 }
 part(dock,[m.width,.035,m.depth],[0,.0175,0],trim);
 const h=dark||premium?m.height:.13;
 part(dock,[m.width-.035,h,.31],[0,h/2,-.215],color);
 part(dock,[m.width-.11,.055,.012],[0,h*.75,-.05],0x22282b);
 if(dark||premium){part(dock,[m.width-.10,.10,.02],[0,h*.35,-.05],trim);part(dock,[.08,.018,.016],[0,h*.90,-.045],0x82bbad);}
 part(robot,[.37,.073,.37],[0,.046,0],color,true);
 part(robot,[.375,.023,.375],[0,.026,0],trim,true);
 part(robot,[.105,.032,.105],[0,.098,-.055],trim,true);
 part(robot,[.085,.008,.085],[0,.118,-.055],color,true);
 part(robot,[.045,.008,.022],[0,.088,.08],0x6cbdb0);
 for(const x of [-.12,.12])part(robot,[.055,.026,.095],[x,.012,0],0x272b30);
 batchRigidParts(dock,true);batchRigidParts(robot,true);
 robot.name='Vacuum moving body';robot.position.z=.18;g.add(dock,robot);return g;
}