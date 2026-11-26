import * as THREE from 'three';
import {buildFamilyCar} from './FamilyCarArt';
import {batchRigidParts} from './ArtKit';
import {weatherAt} from '../shared/weather';
import type {GameClock} from '../shared/life';
import type {CarRide} from '../shared/carRide';
import {rideProgress} from '../shared/carRide';

/** Single cached lightweight scene, rendered by the game's existing WebGL renderer. */
export class CarRideScene {
  readonly scene=new THREE.Scene();
  readonly camera=new THREE.PerspectiveCamera(53,1,.1,135);
  private readonly car=buildFamilyCar(true);
  private readonly headlamps:THREE.SpotLight[]=[];
  private readonly ground=new THREE.MeshStandardMaterial({color:0x829c64});
  private readonly road=new THREE.MeshStandardMaterial({color:0x525b62});
  private readonly verge=new THREE.MeshStandardMaterial({color:0xb8aa8e});
  private readonly foliage=new THREE.MeshStandardMaterial({color:0x567b46});
  private readonly grass=new THREE.MeshStandardMaterial({color:0x729351,roughness:1});
  private readonly hill=new THREE.MeshStandardMaterial({color:0x708e70,roughness:1});
  private readonly warmWindow=new THREE.MeshStandardMaterial({color:0x88afbd,roughness:.7,emissive:0xffbd70,emissiveIntensity:0});
  private readonly roadGlow=new THREE.MeshBasicMaterial({color:0xffdca2,transparent:true,opacity:.08,depthWrite:false});
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
    const white=mat(0xece6d6),bark=mat(0x736047),pine=mat(0x365a42),wall=mat(0xe6cfb0),roof=mat(0x805a50),metal=mat(0x677780),windowMat=this.warmWindow;
    const fence=mat(0xa89880),stone=mat(0x8e9694),signBlue=mat(0x39778a),trim=mat(0xd7d8c9),dark=mat(0x515e58);
    const glowDisk=new THREE.CircleGeometry(1,24);
    const mesh=(parent:THREE.Object3D,g:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>{
      const v=new THREE.Mesh(g,m);v.position.set(x,y,z);v.scale.set(w,h,d);parent.add(v);return v;
    };
    mesh(scene,box,this.ground,0,-.23,22,150,.25,185);
    mesh(scene,box,this.verge,0,-.10,22,9.7,.1,185);
    mesh(scene,box,this.road,0,-.04,22,7.4,.08,185);
    for(const side of [-1,1])mesh(scene,box,white,side*3.47,.012,22,.12,.02,185);
    // Distant low-poly silhouettes give the moving foreground a sense of depth.
    for(const side of [-1,1])for(let i=0;i<5;i++){
      const x=side*(32+(i%2)*12),z=-50+i*40;
      mesh(scene,sphere,this.hill,x,-1.7,z,15+(i%3)*6,5+(i%2)*2.5,26);
    }
    for(let i=0;i<9;i++){
      const segment=new THREE.Group();this.segments.push(segment);scene.add(segment);
      for(const z of [-8,0,8])mesh(segment,box,white,0,.015,z,.13,.025,3.8);
      for(const side of [-1,1]){
        const x=side*(side===1?7.6+(i%3)*1.6:14.5+(i%3)*1.6),z=(side===1?4:-4);
        mesh(segment,box,bark,x,1.15,z,.26,2.3,.26);
        if(i%2){
          for(let tier=0;tier<3;tier++)mesh(segment,cone,pine,x,2.65+tier*.82,z,1.55-tier*.37,2.35-tier*.23,1.55-tier*.37);
        }else{
          mesh(segment,sphere,this.foliage,x,3.15,z,1.42,1.75,1.36);
          mesh(segment,sphere,this.foliage,x+.85,2.95,z+.32,1.05,1.23,1.02);
          mesh(segment,sphere,this.foliage,x-.64,3.31,z-.32,.91,1.21,.94);
        }
        for(let tier=0;tier<3;tier++)mesh(segment,cone,pine,side*(side===1?12:18),2.25+tier*1.0,z+7,1.85-tier*.42,3.1-tier*.38,1.85-tier*.42);
        mesh(segment,sphere,this.foliage,side*6.6,.43,z+5,.85,.55,.72);
        for(let j=0;j<4;j++){
          const gx=side*(5.3+(j%2)*.7),gz=z-5+j*2.7;
          mesh(segment,cone,this.grass,gx,.15,gz,.19,.3+(j%3)*.07,.15);
        }
        // Low reflector posts and stones are kept clear of the driving lane.
        if(i%2===1){mesh(segment,box,trim,side*4.25,.36,z,.11,.72,.13);mesh(segment,box,dark,side*4.25,.58,z-.075,.12,.13,.025);}
        if(i%3===1)mesh(segment,sphere,stone,side*6.3,.16,z-1.6,.48,.28,.37);
        const forest=new THREE.Group();forest.name='roadside-forest';segment.add(forest);
        const fx=side*(side===1?9.6+(i%3)*1.5:15.5+(i%3)*1.5),fz=z-5;
        mesh(forest,box,bark,fx,1.35,fz,.22,2.7,.22);
        for(let tier=0;tier<3;tier++)mesh(forest,cone,pine,fx,2.7+tier*.92,fz,1.7-tier*.4,2.7-tier*.25,1.7-tier*.4);
        mesh(forest,sphere,this.foliage,side*8.6,.65,z+1,1.2,.7,.9);batchRigidParts(forest);
        const building=new THREE.Group();building.name='roadside-house';segment.add(building);
        if(i%3!==2){
          const bx=side*(side===1?10.9:15.7),bz=z-7,h=i%3===0?3.5:4.7;
          mesh(building,box,wall,bx,h/2,bz,4.7,h,5.4);
          const r=mesh(building,cone,roof,bx,h+.85,bz,3.85,1.8,3.85);r.rotation.y=Math.PI/4;
          const face=bx-side*2.38;
          for(const wz of [-1.6,1.55]){
            mesh(building,box,trim,face,h*.65,bz+wz,.10,1.18,1.35);
            mesh(building,box,windowMat,face-side*.06,h*.65,bz+wz,.035,.92,1.12);
          }
          mesh(building,box,bark,face-side*.07,.95,bz,.12,1.9,.85);
          mesh(building,box,stone,bx-side*2.75,.075,bz,.8,.15,1.3);
          const f=side*(side===1?7.1:12.0);
          for(const dz of [-3,-1,1,3])mesh(building,box,fence,f,.48,bz+dz,.12,.96,.13);
          for(const y of [.29,.68])mesh(building,box,fence,f,y,bz,.08,.105,6.1);
          batchRigidParts(building);
        }
        if(i%4===2&&side===1){
          const sx=side*4.9,sz=z+3;
          mesh(building,box,metal,sx,1.05,sz,.085,2.1,.085);
          mesh(building,box,trim,sx,2.04,sz,.86,.54,.10);
          mesh(building,box,signBlue,sx,2.04,sz-.061,.75,.43,.025);
          // Simple directional arrow, not a fictional street name.
          mesh(building,box,trim,sx,2.04,sz-.08,.09,.26,.01);
          const a=mesh(building,box,trim,sx-.065,2.13,sz-.08,.09,.18,.01);a.rotation.z=-Math.PI/4;
          const b=mesh(building,box,trim,sx+.065,2.13,sz-.08,.09,.18,.01);b.rotation.z=Math.PI/4;
          batchRigidParts(building);
        }
        if(i%2===0&&side===1){
          mesh(segment,box,metal,side*4.5,2.7,0,.12,5.4,.12);
          mesh(segment,box,metal,side*4.15,5.35,0,.82,.1,.12);
          this.lamps.push(mesh(segment,box,this.lamp,side*3.85,5.27,0,.48,.12,.24));
          const glow=mesh(segment,glowDisk,this.roadGlow,side*3.1,.018,0,1.9,2.8,1);glow.rotation.x=-Math.PI/2;
        }
      }
      batchRigidParts(segment);
    }
    this.car.position.set(1.7,.025,0);this.car.rotation.y=0;scene.add(this.car);
    const shade=new THREE.Mesh(new THREE.CircleGeometry(1,32),new THREE.MeshBasicMaterial({color:0x171d24,transparent:true,opacity:.32,depthWrite:false}));shade.rotation.x=-Math.PI/2;shade.position.set(1.7,.018,0);shade.scale.set(1.12,2.52,1);scene.add(shade);
    const lightMat=new THREE.MeshBasicMaterial({color:0xfff0cc});
    const rearMat=new THREE.MeshBasicMaterial({color:0xc23836});
    for(const side of [-1,1]){
      this.lights.push(mesh(this.car,box,lightMat,side*.69,1.025,2.40,.29,.12,.025));
      this.lights.push(mesh(this.car,box,rearMat,side*.865,1.07,-2.405,.11,.21,.025));
      const light=new THREE.SpotLight(0xffe6bc,40,22,.38,.72,1.5);light.position.set(1.7+side*.69,1.02,2.45);light.target.position.set(1.7+side*.45,.0,13);light.castShadow=false;scene.add(light,light.target);this.headlamps.push(light);
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
      this.ambient.intensity=night?1.28:cloudy?1.8:2.2;
      this.sun.intensity=night?.7:cloudy?.65:2.3;
      this.sun.color.setHex(night?0xa9c8ff:0xffe6c6);
      this.ground.color.setHex(this.snowy?0xdbe4e6:w.season==='autumn'?0x999064:0x829c64);
      this.foliage.color.setHex(w.season==='autumn'?0xb78a48:0x567b46);
      this.grass.color.setHex(this.snowy?0xcbd6d4:w.season==='autumn'?0xa99a64:0x729351);
      this.hill.color.setHex(this.snowy?0xc8d4d8:w.season==='autumn'?0x99926f:0x708e70);
      this.warmWindow.emissiveIntensity=night?.48:evening?.2:0;
      this.roadGlow.opacity=night?.13:evening?.06:0;
      this.road.color.setHex(w.kind==='rain'||w.kind==='storm'?0x3c474f:0x525b62);
      this.lamp.color.setHex(night||evening?0xffd697:0xbfc6c4);
      this.lights.forEach(l=>l.visible=night||evening||cloudy);
      this.headlamps.forEach(l=>l.visible=night||evening||w.kind==='fog'||w.kind==='rain'||w.kind==='storm');
      for(const s of this.segments)for(const child of s.children){
        if(child.name==='roadside-house')child.visible=!this.rural;
        if(child.name==='roadside-forest')child.visible=this.rural;
      }
      this.precipitation.visible=['rain','storm','snow'].includes(w.kind);
      (this.precipitation.material as THREE.PointsMaterial).size=w.kind==='snow'?.13:.055;
    }
    const p=rideProgress(ride,now),t=p*(ride.endsAt-ride.startedAt)/1000;
    for(let i=0;i<this.segments.length;i++)this.segments[i].position.z=((i*24-t*14+72)%216+216)%216-72;
    this.car.position.y=.025+Math.sin(t*9)*.012;
    for(const child of this.car.children)if(child.name==='travel-wheel')child.rotation.x=t*14/.43;
    const reduced=typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
    const angle=reduced?-.42:-.42-2.05*(.5-.5*Math.cos(p*Math.PI));
    this.camera.aspect=Math.max(.35,aspect);
    // Horizontal FOV is much narrower in portrait; fit the entire SUV at every orbit angle.
    const distance=Math.max(9.8,6.65/(2*Math.tan(53*Math.PI/360)*Math.max(.35,aspect)));
    this.camera.position.set(1.7+Math.sin(angle)*distance,4.8+Math.sin(p*Math.PI)*.6,-Math.cos(angle)*distance);
    this.camera.lookAt(1.7,1.05,.10);this.camera.updateProjectionMatrix();
    if(this.precipitation.visible){
      for(let i=0;i<150;i++){this.drops[3*i]=((i*73%137)/137-.5)*17;
        this.drops[3*i+1]=((i*.713-t*(this.weather==='snow'?.8:5))%7+7)%7;
        this.drops[3*i+2]=((i*37%139)/139*28-t*5%28+28)%28-12;}
      this.precipitation.geometry.attributes.position.needsUpdate=true;
    }
  }
}
