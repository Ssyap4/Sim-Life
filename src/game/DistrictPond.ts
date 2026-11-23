import * as THREE from 'three';
import { DISTRICT_POND } from '../shared/district';
import { finish, type XYZ } from './ArtKit';
import { painted, type LocationResources } from './LocationArt';
import { landscapeRandom, PlantBatch } from './LandscapePlants';

const limestone = [0xa58f78,0xc0a889,0xb09e88,0xcbbaa0];

function waterPaint(ctx: CanvasRenderingContext2D) {
  const {width,height}=ctx.canvas;
  const ripple=landscapeRandom(58274);
  const water=ctx.createRadialGradient(width*.57,height*.62,width*.065,width*.5,height*.50,width*.52);
  water.addColorStop(0,'#447d91');
  water.addColorStop(.52,'#649eaa');
  water.addColorStop(1,'#9bc8ba');
  ctx.fillStyle=water;
  ctx.fillRect(0,0,width,height);
  for(let i=0;i<80;i++){
    const x=ripple()*width,z=ripple()*height,w=3+ripple()*18;
    ctx.strokeStyle=i%2?'#e0efdd3a':'#3b78893d';
    ctx.lineWidth=.5+ripple()*.9;
    ctx.beginPath();
    ctx.moveTo(x-w,z);
    ctx.quadraticCurveTo(x,z-2.9,x+w,z+.8);
    ctx.stroke();
  }
  for(let i=0;i<17;i++){
    const x=ripple()*width,z=ripple()*height;
    ctx.fillStyle='#def0de60';
    ctx.fillRect(x,z,2+ripple()*8,1);
  }
}

export function buildDistrictPond(root: THREE.Group, resources: LocationResources) {
  const {x,z,radiusX, radiusZ}=DISTRICT_POND;
  const pond=new THREE.Group();
  pond.name='Garden pond';
  pond.position.set(x,0,z);
  root.add(pond);

  const earth=new THREE.Mesh(new THREE.CylinderGeometry(1,1,.13,36),finish(0x857b67,'ceramic'));
  earth.scale.set(radiusX,.90,radiusZ);
  earth.position.y=.036;
  pond.add(earth);
  const map=painted(resources,256,256,waterPaint);
  const waterMat=new THREE.MeshStandardMaterial({map,color:map?0xffffff:0x78aaab,roughness:.62});
  resources.materials.push(waterMat);
  const surface=new THREE.Mesh(new THREE.CircleGeometry(1,48),waterMat);
  surface.scale.set(radiusX*.94,radiusZ*.94,1);
  surface.rotation.x=-Math.PI/2;
  surface.position.y=.100;
  pond.add(surface);

  // The flattened bank stones are below the crowns and follow the collision ellipse.
  const plants=new PlantBatch(), random=landscapeRandom(11893);
  for(let i=0;i<32;i++){
    const a=i/32*Math.PI*2, px=Math.cos(a)*radiusX*.97,pz=Math.sin(a)*radiusZ*.97;
    plants.cluster(limestone[i%4],[px,.115+random()*.022,pz],
      [.128+random()*.065,.072+random()*.038,.125+random()*.047],a,true);
  }
  for(const [i,a] of [1.18,2.48,3.78,5.72].entries()){
    for(let j=0;j<8;j++){
      const angle=a+(j-3.5)*.047;
      const at: XYZ=[Math.cos(angle)*radiusX*.96,.14,Math.sin(angle)*radiusZ*.95];
      const h=.26+random()*.34, lean=(j-3.5)*.058;
      const top: XYZ=[at[0]+Math.cos(a)*.11,at[1]+h,at[2]+Math.sin(a)*.15];
      plants.stem(j%2?0x547b56:0x738957,at,top,.012);
      plants.blade(j%2?0x699567:0x8faa63,[at[0],at[1]+h*.44,at[2]],
        [.042,.056,h*.58],a,1.21,lean);
      if((j+i)%3===0)plants.bud(0x8b6546,top,[.029,.061,.028],a,.04);
    }
  }
  for(const [i,[px,pz]] of [[-.85,-.42],[.61,.41],[1.31,-.12],[-.16,.89]].entries()){
    // Folded leaves hint at the characteristic slit in the lily pad.
    plants.blade(0x649464,[px,.115,pz],[.18,.043,.21],i*2.2,0);
    plants.blade(0x7fa46b,[px+.15,.118,pz+.13],[.10,.032,.14],i*3.7,0);
    if(i%2===0)for(let petal=0;petal<5;petal++){
      const angle=petal*2*Math.PI/5+i;
      plants.bud(petal%2?0xe9add1:0xf4d4e8,[px+Math.sin(angle)*.053,.15,pz+Math.cos(angle)*.053],
        [.040,.032,.067],angle,-.48);
    }
  }
  plants.attach(pond,'Pond stones, reeds and water lilies');

  const ripples:number[]=[];
  for(const [rx,rz,cx,cz] of [[.37,.13,-.70,-.35],[.54,.18,.60,.33],[.73,.23,.18,-.37]]) {
    for(let i=0;i<18;i++)for(const step of [i,i+1]){
      const a=step/18*5.22+.65;
      ripples.push(Math.cos(a)*rx+cx,.117,Math.sin(a)*rz+cz);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(ripples,3));
  const glow=new THREE.LineBasicMaterial({color:0xe3f1e4,transparent:true,opacity:.26,depthWrite:false});
  resources.materials.push(glow);
  const reflection=new THREE.LineSegments(geometry,glow);
  pond.add(reflection);
  return (seconds:number)=>{
    reflection.position.x=Math.sin(seconds*.64)*.034;
    reflection.position.z=Math.sin(seconds*.53)*.029;
    glow.opacity=.25+Math.sin(seconds*1.28)*.082;
  };
}
