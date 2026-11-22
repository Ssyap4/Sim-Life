import * as THREE from 'three';
import { finish, type XYZ } from './ArtKit';
import { DISTRICT_BEDS, DISTRICT_TREES, DISTRICT_PATHS, DISTRICT_PLAZA, DISTRICT_OBSTACLES } from '../shared/district';
import { pointIsClear } from './navigation';

const stem = new THREE.CylinderGeometry(.56,1,1,7);
const tip = new THREE.ConeGeometry(1,1,10);
const needle = new THREE.ConeGeometry(1,1,8);
const canopy = new THREE.IcosahedronGeometry(1,1);
const leaf = new THREE.IcosahedronGeometry(1,0);
const lowCanopy = new THREE.IcosahedronGeometry(1,0);
const petal = new THREE.IcosahedronGeometry(1,0);
const tuft = (() => {
  const g = new THREE.BufferGeometry();
  const vertices:number[]=[];
  for(let i=0;i<5;i++){
    const x=(i-2)*.073,z=(i%2-.5)*.084;
    vertices.push(x-.031,0,z,x+.029,0,z,x+.040*(i-2),.20+(i%3)*.063,z-.034);
  }
  g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  g.computeVertexNormals();
  return g;
})();
export const districtPlantGeometry=[stem,tip,needle,canopy,leaf,lowCanopy,petal,tuft];

type Record = { geometry:THREE.BufferGeometry; color:number; at:XYZ; scale:XYZ; yaw:number; rz:number; basis?:THREE.Quaternion };
class Nursery {
  private groups = new Map<string,Record[]>();
  add(geometry:THREE.BufferGeometry,color:number,at:XYZ,scale:XYZ,yaw=0,rz=0,basis?:THREE.Quaternion) {
    const key=geometry.uuid;
    const list=this.groups.get(key) ?? [];
    list.push({geometry,color,at,scale,yaw,rz,basis});this.groups.set(key,list);
  }
  branch(base:XYZ,end:XYZ,radius:number,color:number) {
    const endPoint=new THREE.Vector3(...end), start=new THREE.Vector3(...base);
    const delta=endPoint.sub(start);
    const q=new THREE.Quaternion().setFromUnitVectors(THREE.Object3D.DEFAULT_UP,delta.clone().normalize());
    this.add(stem,color,start.addScaledVector(delta,.5).toArray(),[radius,delta.length(),radius],0,0,q);
  }
  finish(target:THREE.Group, grassMaterial?:THREE.MeshStandardMaterial) {
    const transform=new THREE.Object3D();
    const rgb=new THREE.Color();
    for(const entries of this.groups.values()){
      const geometry=entries[0].geometry;
      const mesh=new THREE.InstancedMesh(geometry,geometry===tuft && grassMaterial ? grassMaterial : finish(0xffffff),entries.length);
      mesh.name='District vegetation';
      for(let i=0;i<entries.length;i++){
        const {at,scale,yaw,rz,basis,color}=entries[i];
        transform.position.set(...at);transform.scale.set(...scale);transform.rotation.set(0,yaw,rz);
        if(basis)transform.quaternion.copy(basis);
        transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);
        mesh.setColorAt(i,rgb.setHex(color));
      }
      mesh.computeBoundingSphere();
      target.add(mesh);
    }
  }
}

const species = {
  birch: { trunk:0xcccbc0, bough:0x877d68, colors:[0x798955,0x9cab62,0xc3bf75], tall:3.32, breadth:1.11, branches:7 },
  linden: { trunk:0x695649, bough:0x756752, colors:[0x617b55,0x82935f,0xa5a975], tall:3.38, breadth:1.34, branches:8 },
  maple: { trunk:0x806b51, bough:0x846d51, colors:[0x94723f,0xb78c4f,0xcaa65f], tall:3.00, breadth:1.43, branches:8 },
  ornamental: { trunk:0x806b58, bough:0x8a6859, colors:[0x9b767b,0xc38e91,0xdcb7a4], tall:2.48, breadth:1.05, branches:6 },
  spruce: { trunk:0x6d5646, bough:0x767155, colors:[0x4c6758,0x597866,0x698376], tall:4.12, breadth:1.03, branches:7 },
} as const;

function seedRandom(seed:number) {
  return () => {
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    return seed/4294967296;
  };
}

function plantTree(near:Nursery,far:Nursery,x:number,z:number,type:keyof typeof species,scale:number,index:number) {
  const style=species[type], random=seedRandom(30477+1509*index);
  const h=style.tall*scale,w=style.breadth*scale;
  const leanX=(random()-.5)*.43*scale,leanZ=(random()-.5)*.27*scale;
  const foot:XYZ=[x,0,z], fork:XYZ=[x+leanX*.44,h*.48,z+leanZ*.54], top:XYZ=[x+leanX,h*.92,z+leanZ];
  const radius=(type==='birch'?.089:.13)*scale;
  for(const buffer of [near,far]){
    buffer.branch(foot,fork,radius,style.trunk);
    buffer.branch(fork,top,radius*.63,style.trunk);
  }
  if(type==='birch') for(let i=0;i<7;i++){
    const hy=.24+i*h*.101, f=hy/h;
    const angle=i*2.38;
    near.add(leaf,0x626359,[x+leanX*f+Math.cos(angle)*radius*.71,hy,z+leanZ*f+Math.sin(angle)*radius*.72],[.041,.024,.065],angle);
  }
  if(type==='spruce') {
    for(let level=0;level<6;level++){
      const t=level/6,r=(1-t*.81)*w,y=h*(.38+t*.62);
      const color=style.colors[level%3];
      near.add(needle,color,[x+leanX*t,y,z+leanZ*t],[r,h*(.31-.12*t),r*.87],level*.31);
      if(level%2===0)far.add(tip,color,[x+leanX*t,y,z+leanZ*t],[r,h*.40,r*.87],level*.31);
      for(let k=0;k<5;k++){
        const angle=k*Math.PI*.4+level*.58;
        near.add(needle,style.colors[(k+level)%3],[x+Math.sin(angle)*r*.55,y-.22,z+Math.cos(angle)*r*.55],
          [r*.39,h*.17,r*.38],angle,.24);
      }
    }
    return;
  }
  const long=type==='birch';
  far.add(lowCanopy,style.colors[0],[x+leanX,h*.75,z+leanZ],[w*.80,h*(long?.33:.27),w*.65],index*.46);
  far.add(lowCanopy,style.colors[1],[x-.25*w,h*.91,z+.09*w],[w*.63,h*.25,w*.69],index*.62);
  for(let b=0;b<style.branches;b++){
    const angle=(b+index*.63)*2.39996;
    const radius=(.39+random()*.59)*w;
    const y=h*(.60+(b%4)*.11+random()*.09);
    const end:XYZ=[x+Math.sin(angle)*radius+leanX,y,z+Math.cos(angle)*radius*.82+leanZ];
    const origin:XYZ=[fork[0],h*(.42+b%3*.084),fork[2]];
    const middle:XYZ=[origin[0]+(end[0]-origin[0])*.55,y-.26*scale,origin[2]+(end[2]-origin[2])*.55];
    near.branch(origin,middle,scale*.051,style.bough);
    near.branch(middle,end,scale*.034,style.bough);
    for(let u=0;u<2;u++){
      const dx=(random()-.5)*.63*w,dz=(random()-.5)*.65*w;
      near.add(canopy,style.colors[(u+b)%3],[end[0]+dx,y+.16+random()*.35,end[2]+dz],
        [(.35+random()*.22)*w,(long?.61:.41)*scale,(.38+random()*.22)*w],angle+u*.32);
    }
  }
  near.add(canopy,style.colors[2],[top[0],h*.96,top[2]],[w*.5,h*.19,w*.45],index);
}

const flowerColors=[0xe6c390,0xe0b2a2,0xe7d9a3,0xaf8da5,0xeae0c8];
function flowers(nursery:Nursery,x:number,z:number,w:number,d:number,scheme:number,seed:number,count:number) {
  const random=seedRandom(seed);
  for(let n=0;n<count;n++){
    const px=x+(random()-.5)*w,pz=z+(random()-.5)*d,h=.14+random()*.33;
    const hue=flowerColors[(scheme+n%3)%flowerColors.length], angle=random()*6.28;
    nursery.add(stem,0x6b8655,[px,h*.49,pz],[.012,h,.012],angle,.12);
    nursery.add(leaf,0x7e965e,[px+.034,h*.40,pz],[.077,.027,.035],angle,.38);
    if(scheme%3===0){
      for(let k=0;k<5;k++){
        const u=angle+k*2*Math.PI/5;
        nursery.add(petal,0xefe7ca,[px+.047*Math.sin(u),h,pz+.048*Math.cos(u)],[.027,.012,.042],u);
      }
      nursery.add(petal,0xc69949,[px,h+.01,pz],[.027,.022,.025]);
    } else if(scheme%3===1){
      for(let k=0;k<3;k++){
        const u=angle+k*2*Math.PI/3;
        nursery.add(petal,hue,[px+.025*Math.sin(u),h+.033,pz+.025*Math.cos(u)],[.029,.050,.027],u,.22);
      }
    } else {
      for(let k=0;k<4;k++){
        const u=angle+k*2.39;
        nursery.add(petal,hue,[px+.049*Math.sin(u),h+(k%2)*.055,pz+.049*Math.cos(u)],[.039,.033,.043],u);
      }
    }
  }
}

export function buildDistrictPlants(root:THREE.Group, materialPool:THREE.Material[]) {
  const regions=new Map<string,{near:Nursery;far:Nursery;group:THREE.Group;distant:THREE.Group;x:number;z:number}>();
  for(const [index,[x,z,type,scale]] of DISTRICT_TREES.entries()){
    const col=Math.floor(x/12),row=Math.floor(z/12), key=String(col)+'/'+row;
    let region=regions.get(key);
    if(!region){
      region={near:new Nursery(),far:new Nursery(),group:new THREE.Group(),distant:new THREE.Group(),x:col*12+6,z:row*12+6};
      regions.set(key,region);
    }
    plantTree(region.near,region.far,x,z,type,scale,index);
  }
  for(const r of regions.values()){
    r.near.finish(r.group);r.far.finish(r.distant);
    root.add(r.group,r.distant);r.distant.visible=false;
  }
  const displays = new Map<string,{nursery:Nursery;group:THREE.Group;x:number;z:number}>();
  function gardenAt(x:number,z:number) {
    const col=Math.floor(x/9),row=Math.floor(z/9), key=col+'/'+row;
    let cached=displays.get(key);
    if(!cached){
      cached={nursery:new Nursery(),group:new THREE.Group(),x:col*9+4.5,z:row*9+4.5};
      displays.set(key,cached);
    }
    return cached.nursery;
  }
  const random=seedRandom(70244);
  for(const [i,bed] of DISTRICT_BEDS.entries()) {
    const garden=gardenAt(bed.x,bed.z);
    flowers(garden,bed.x,bed.z,bed.w-.22,bed.d-.19,bed.scheme,i*851+15,16);
    for(let k=0;k<5;k++)garden.add(lowCanopy,k%2?0x6a875d:0x80975d,
      [bed.x+(k/4-.5)*bed.w*.85,.135,bed.z+(k%2-.5)*.34],[.28,.17,.24],k*.67);
  }
  const extra=[
    [-23.48,-21.66,1.48,1.2,0],[-18,-20.1,1.02,.66,1],[-8.96,-21.8,1.18,.62,3],
    [-5.09,-20.6,.93,.72,1],[4.31,-21,1.30,1.2,2],[9.2,-20.90,1.72,.53,1],
    [17.68,-21.19,1.16,.81,0],[22.79,-20.61,1.46,.79,2],
    [1.05,5.65,1.37,.67,1],[7.75,5.63,1.27,.68,0],[19.4,-11.35,2.3,.79,3],
  ];
  for(const [i,[x,z,w,d,scheme]] of extra.entries())flowers(gardenAt(x,z),x,z,w,d,scheme,i*567+85,11);
  const grassMat=new THREE.MeshStandardMaterial({ color:0xffffff,side:THREE.DoubleSide,roughness:1 });
  materialPool.push(grassMat);
  const wind={value:0};
  grassMat.onBeforeCompile = shader => {
    shader.uniforms.districtWind=wind;
    shader.vertexShader='uniform float districtWind;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\ntransformed.x += transformed.y * transformed.y * sin(districtWind * 1.58 + instanceMatrix[3].x * 0.8 + instanceMatrix[3].z * 0.63)*0.76;');
  };
  let planted=0;
  for(let attempt=0;attempt<980&&planted<480;attempt++){
    const x=(random()-.5)*52,z=-8.6+(random()-.5)*44;
    if(!pointIsClear({x,z},DISTRICT_OBSTACLES,{minX:-28,maxX:28,minZ:-31,maxZ:15}))continue;
    if([...DISTRICT_PATHS,DISTRICT_PLAZA].some(p=>Math.abs(x-p.x)<p.w/2+.18&&Math.abs(z-p.z)<p.d/2+.18))continue;
    const scale=.62+random()*.65;
    gardenAt(x,z).add(tuft,[0x78905a,0x9aa767,0xa5a86e,0x668651][planted%4],
      [x,.009,z],[scale,scale,scale],random()*6.28);
    planted++;
  }
  for(const display of displays.values()){
    display.nursery.finish(display.group,grassMat);root.add(display.group);
  }
  function update(camera:THREE.Camera,seconds:number) {
    wind.value=seconds;
    const bias=camera.userData.compactLow?4:0;
    for(const r of regions.values()){
      const distance=Math.hypot(camera.position.x-r.x,camera.position.z-r.z,camera.position.y*.90);
      const far=r.distant.visible?distance>25-bias:distance>27-bias;
      r.distant.visible=far;r.group.visible=!far;
    }
    for(const display of displays.values()){
      display.group.visible=Math.hypot(camera.position.x-display.x,camera.position.z-display.z,camera.position.y*.60)<30-bias;
    }
  }
  return update;
}
