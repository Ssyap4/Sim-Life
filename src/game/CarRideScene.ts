import * as THREE from 'three';
import {buildFamilyCar} from './FamilyCarArt';
import {weatherAt} from '../shared/weather';
import type {GameClock} from '../shared/life';
import type {CarRide} from '../shared/carRide';
import {rideProgress} from '../shared/carRide';

/** Single cached lightweight scene, rendered by the game's existing WebGL renderer. */
export class CarRideScene {
  readonly scene=new THREE.Scene();
  readonly camera=new THREE.PerspectiveCamera(49,1,.1,135);
  private readonly car=buildFamilyCar();
  private readonly ground=new THREE.MeshStandardMaterial({color:0x829c64});
  private readonly road=new THREE.MeshStandardMaterial({color:0x525b62});
  private readonly verge=new THREE.MeshStandardMaterial({color:0xb8aa8e});
  private readonly foliage=new THREE.MeshStandardMaterial({color:0x567b46});
  private readonly lamp=new THREE.MeshBasicMaterial({color:0xe9ddd0});
  private readonly ambient=new THREE.HemisphereLight(0xe8f4ff,0xb6a28d,2);
  private readonly sun=new THREE.DirectionalLight(0xffe6c6,2.4);
  private readonly segments:THREE.Group[]=[];
  private readonly lamps:THREE.Mesh[]=[];
  private readonly lights:THREE.Mesh[]=[];
  private readonly precipitation:THREE.Points;
  private readonly drops=new Float32Array(150*3);
  private snowy=false;
  private weather='clear';
  private rural=false;
  private key='';
  constructor(){
    const scene=this.scene;
    scene.add(this.ambient,this.sun);this.sun.position.set(-12,20,-8);
    const box=new THREE.BoxGeometry(1,1,1),cone=new THREE.ConeGeometry(1,1,7),sphere=new THREE.IcosahedronGeometry(1,1);
    const mat=(color:number)=>new THREE.MeshStandardMaterial({color,roughness:.9});
    const white=mat(0xece6d6),bark=mat(0x736047),pine=mat(0x365a42),wall=mat(0xe6cfb0),roof=mat(0x805a50),metal=mat(0x677780),windowMat=mat(0x88afbd);
    const mesh=(parent:THREE.Object3D,g:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>{
      const v=new THREE.Mesh(g,m);v.position.set(x,y,z);v.scale.set(w,h,d);parent.add(v);return v;
    };
    mesh(scene,box,this.ground,0,-.23,22,150,.25,185);
    mesh(scene,box,this.verge,0,-.10,22,9.7,.1,185);
    mesh(scene,box,this.road,0,-.04,22,7.4,.08,185);
    for(const side of [-1,1])mesh(scene,box,white,side*3.47,.012,22,.12,.02,185);
    for(let i=0;i<9;i++){
      const segment=new THREE.Group();this.segments.push(segment);scene.add(segment);
      for(const z of [-8,0,8])mesh(segment,box,white,0,.015,z,.13,.025,3.8);
      for(const side of [-1,1]){
        const x=side*(7.6+(i%3)*1.6),z=(side===1?4:-4);
        mesh(segment,box,bark,x,1.15,z,.26,2.3,.26);
        mesh(segment,i%2?cone:sphere,i%2?pine:this.foliage,x,3.05,z,1.6,2.7,1.6);
        mesh(segment,cone,pine,side*12,2.8,z+7,2.1,5.6,2.1);
        const building=new THREE.Group();building.name='roadside-house';segment.add(building);
        if(i%3===0){
          mesh(building,box,wall,side*17,1.8,z,6,3.6,5);
          const r=mesh(building,cone,roof,side*17,4.35,z,4.5,2.3,4);r.rotation.y=Math.PI/4;
          mesh(building,box,windowMat,side*13.97,2.0,z, .06,1.05,1.4);
        }
        if(i%2===0){
          mesh(segment,box,metal,side*4.5,2.7,0,.12,5.4,.12);
          mesh(segment,box,metal,side*4.15,5.35,0,.82,.1,.12);
          this.lamps.push(mesh(segment,box,this.lamp,side*3.85,5.27,0,.48,.12,.24));
        }
      }
    }
    this.car.position.set(1.7,.025,0);this.car.rotation.y=0;scene.add(this.car);
    const shade=new THREE.Mesh(new THREE.CircleGeometry(1,32),new THREE.MeshBasicMaterial({color:0x171d24,transparent:true,opacity:.32,depthWrite:false}));shade.rotation.x=-Math.PI/2;shade.position.set(1.7,.018,0);shade.scale.set(1.12,2.52,1);scene.add(shade);
    const lightMat=new THREE.MeshBasicMaterial({color:0xfff0cc});
    const rearMat=new THREE.MeshBasicMaterial({color:0xc23836});
    for(const side of [-1,1]){
      this.lights.push(mesh(this.car,box,lightMat,side*.69,1.025,2.40,.29,.12,.025));
      this.lights.push(mesh(this.car,box,rearMat,side*.865,1.07,-2.405,.11,.21,.025));
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(this.drops,3));
    this.precipitation=new THREE.Points(geo,new THREE.PointsMaterial({color:0xe5f0ff,size:.09,transparent:true,opacity:.65}));
    this.precipitation.frustumCulled=false;scene.add(this.precipitation);
  }
  frame(ride:CarRide,clock:GameClock,aspect:number,now=Date.now()):void{
    const key=ride.startedAt+':'+ride.to;
    if(key!==this.key){
      this.key=key;
      const w=weatherAt(clock),night=clock.minute<360||clock.minute>=1200,evening=!night&&(clock.minute>=1080||clock.minute<450);
      this.weather=w.kind;this.snowy=w.snow>.4;this.rural=ride.from==='lake'||ride.to==='lake';
      const cloudy=['overcast','rain','storm','fog','snow'].includes(w.kind);
      const sky=night?0x182b48:evening?0xc7a3a0:cloudy?0xa9bbc5:0xb3d9eb;
      this.scene.background=new THREE.Color(sky);this.scene.fog=new THREE.Fog(sky,w.kind==='fog'?9:24,w.kind==='fog'?41:110);
      this.ambient.intensity=night?.85:cloudy?1.8:2.2;
      this.sun.intensity=night?.25:cloudy?.65:2.3;
      this.ground.color.setHex(this.snowy?0xdbe4e6:w.season==='autumn'?0x999064:0x829c64);
      this.foliage.color.setHex(w.season==='autumn'?0xb78a48:0x567b46);
      this.road.color.setHex(w.kind==='rain'||w.kind==='storm'?0x3c474f:0x525b62);
      this.lamp.color.setHex(night||evening?0xffd697:0xbfc6c4);
      this.lights.forEach(l=>l.visible=night||evening||cloudy);
      for(const s of this.segments)s.children.filter(c=>c.name==='roadside-house').forEach(c=>c.visible=!this.rural);
      this.precipitation.visible=['rain','storm','snow'].includes(w.kind);
      (this.precipitation.material as THREE.PointsMaterial).size=w.kind==='snow'?.13:.055;
    }
    const p=rideProgress(ride,now),t=p*(ride.endsAt-ride.startedAt)/1000;
    for(let i=0;i<this.segments.length;i++)this.segments[i].position.z=((i*24-t*14+72)%216+216)%216-72;
    this.car.position.y=.025+Math.sin(t*9)*.012;
    const reduced=typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
    const angle=reduced?-.42:-.42-2.05*(.5-.5*Math.cos(p*Math.PI));
    this.camera.aspect=Math.max(.35,aspect);
    const distance=aspect<.75?9.8:8.6;
    this.camera.position.set(1.7+Math.sin(angle)*distance,4.1+Math.sin(p*Math.PI)*.65,-Math.cos(angle)*distance);
    this.camera.lookAt(1.5,.9,1.9);this.camera.updateProjectionMatrix();
    if(this.precipitation.visible){
      for(let i=0;i<150;i++){this.drops[3*i]=((i*73%137)/137-.5)*17;
        this.drops[3*i+1]=((i*.713-t*(this.weather==='snow'?.8:5))%7+7)%7;
        this.drops[3*i+2]=((i*37%139)/139*28-t*5%28+28)%28-12;}
      this.precipitation.geometry.attributes.position.needsUpdate=true;
    }
  }
}
