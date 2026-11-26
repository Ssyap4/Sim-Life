import * as THREE from 'three';
import {cube,drum,softCube,finish,batchRigidParts,type XYZ} from './ArtKit';
import {PlantBatch,growTree,growShrub} from './LandscapePlants';
import {LAKE_TENTS,type LakeTent,type LakeState} from '../shared/lake';
import type {Station} from '../shared/locations';
type Resources={textures:THREE.Texture[];materials:THREE.Material[]};
const wood=0x9a7049,grass=0x82995d;
function box(g:THREE.Object3D,size:XYZ,pos:XYZ,color:number,geometry:THREE.BufferGeometry=cube){
 const m=new THREE.Mesh(geometry,finish(color,'wood'));m.position.set(...pos);m.scale.set(...size);m.receiveShadow=true;g.add(m);return m;
}
function cloth(g:THREE.Group,w:number,d:number,h:number,color:number,style:number){
 const points:number[]=[],indices:number[]=[];
 const rows=12,cols=10;
 for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
  const t=i/cols*Math.PI,z=(j/rows-.5)*d;
  const end=style===0?(.78+.22*Math.sin(j/rows*Math.PI)):style===3?(.94+.06*Math.sin(j/rows*Math.PI)):1;
  points.push(Math.cos(t)*w*.5*end,.07+Math.sin(t)*h*end,z);
 }
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+cols+1;indices.push(a,b,a+1,b,b+1,a+1);}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geo.setIndex(indices);geo.computeVertexNormals();
 const mat=new THREE.MeshStandardMaterial({color,roughness:.92,side:THREE.DoubleSide});const mesh=new THREE.Mesh(geo,mat);g.add(mesh);
 // Arched frame and rear closure, open entrance facing +Z.
 const back=new THREE.Shape();back.moveTo(-w*.5,.07);
 for(let i=0;i<=cols;i++){const t=Math.PI-i/cols*Math.PI;back.lineTo(Math.cos(t)*w*.5,.07+Math.sin(t)*h);}
 back.lineTo(w*.5,.07);back.closePath();
 const rear=new THREE.Mesh(new THREE.ShapeGeometry(back),mat);rear.position.z=-d/2+.006;g.add(rear);
 box(g,[w*.92,.055,d*.96],[0,.05,0],0x38413b);
 for(const side of [-1,1])box(g,[.065,.07,d*.99],[side*w*.49,.045,0],0x4d5650);
 for(const side of [-1,1]){box(g,[w*.37,.09,d*.62],[side*w*.23,.11,-d*.13],style>1?0xc2a988:0x7d8c75,softCube);box(g,[w*.31,.095,.34],[side*w*.23,.18,-d*.36],0xe9dfbd,softCube);}
 if(style>0){box(g,[w*.98,.045,.72],[0,h*.79,d*.5+.32],color).rotation.x=.12;for(const x of [-w*.44,w*.44])box(g,[.037,h*.78,.037],[x,h*.39,d*.5+.61],0x5b625d,drum);}
}
export function buildLakeTent(id:LakeTent){
 const g=new THREE.Group(),i=Object.keys(LAKE_TENTS).indexOf(id);
 cloth(g,[2.15,2.50,3.15,3.50][i],[2.25,2.55,3.05,3.30][i],[1.30,1.56,1.88,2.05][i],[0x58785a,0x899178,0xb18a5d,0xcdbb97][i],i);
 g.name='Lake tent '+id;batchRigidParts(g,true);return g;
}
export function lakeStation(s:Station){
 const g=new THREE.Group();g.position.set(s.center.x,0,s.center.z);
 if(s.action.kind==='door'){
  for(const x of [-1.25,1.25])box(g,[.23,2.6,.24],[x,1.30,0],wood);
  box(g,[2.85,.35,.30],[0,2.53,0],wood);
 }else if(s.action.kind==='lake'){
  if(s.action.facility==='rental'){
   box(g,[5.2,.12,3.2],[0,.06,0],wood);
   box(g,[5.2,2.5,.20],[0,1.27,-1.5],wood);
   for(const x of [-2.5,2.5])box(g,[.18,2.45,3.0],[x,1.25,0],wood);
   for(const side of [-1,1])box(g,[2.85,.14,3.65],[side*1.30,2.66,0],0x405e4e).rotation.z=side*-.20;
   box(g,[2.1,.95,.54],[.95,.49,.8],0x856047);
   box(g,[2.23,.09,.65],[.95,.99,.8],0xc6ac83);
   box(g,[.28,.25,.13],[.65,1.15,.75],0x3e474b);
   for(let j=0;j<3;j++){box(g,[1.55,.085,.38],[-1.42,.65+j*.54,-1.14],wood);for(let i=0;i<3;i++)box(g,[.31,.28,.30],[-1.92+i*.50,.84+j*.54,-1.14],[0x81935f,0xb89c6d,0x57747b][(i+j)%3],softCube);}
   for(let i=0;i<3;i++){const rod=box(g,[.035,1.8,.035],[1.40+i*.28,1.10,-1.15],0x39463d,drum);rod.rotation.z=-.12;}
  }else if(s.action.facility==='pitch'){
   box(g,[4.10,.035,3.55],[0,.018,0],0xb8aa81,softCube);
   for(const x of [-1.95,1.95])for(const z of [-1.65,1.65])box(g,[.08,.32,.08],[x,.16,z],wood);
   const models=new Map<LakeTent,THREE.Group>();
   for(const id of Object.keys(LAKE_TENTS) as LakeTent[]){const t=buildLakeTent(id);t.visible=false;g.add(t);models.set(id,t);}
   g.userData.tents=models;
  }else if(s.action.facility==='fish'){
   box(g,[1.25,.10,1.38],[.20,.04,0],wood);
   box(g,[.28,.33,.32],[-.27,.20,.42],0x69795c,softCube);
  }
 }
 return g;
}
export function syncLakeTents(stations:Map<string,THREE.Group>,visits:LakeState|undefined){
 for(const [id,g] of stations){const models=g.userData.tents as Map<LakeTent,THREE.Group>|undefined;if(!models)continue;
 const visit=Object.values(visits??{}).find(v=>v.pitch===id);for(const [sku,m] of models)m.visible=visit?.tent===sku;}
}
export function buildLakeLandscape(root:THREE.Group,resources:Resources){
 const ground=new THREE.Group();root.add(ground);
 box(ground,[21.5,.38,29.0],[-5.65,-.20,0],grass);
 box(ground,[2.0,.04,28.2],[4.15,-.005,0],0xc4b38a);
 box(ground,[1.75,.026,26],[-6.95,.018,0],0xc4af81);
 for(const z of [-9,1,9])box(ground,[13.0,.026,1.35],[-5.5,.019,z+2],0xc2ae83);
 // Far shore and forest backdrop; no additional collision objects in the walkable area.
 box(ground,[4.8,.42,30],[25.2,-.18,0],0x708750);
 const plants=new PlantBatch();
 const trees:XYZ[]=[];
 for(let i=0;i<15;i++)trees.push([-16.5,0,-13+i*1.85],[23.8+(i%3)*1.3,0,-14+i*1.95]);
 for(let i=0;i<13;i++)trees.push([-15+i*1.5,0,-14.5],[-15+i*1.5,0,14.7]);
 for(const [i,[x,,z]] of trees.entries()){growTree(plants,x,z,i%3?'spruce':'birch',.88+(i%5)*.11,741+i*31,true);if(i%2===0)growShrub(plants,x+.55,0,z+.45,.70,.42,.70,i%4,773+i);}
 plants.attach(root,'Lake forest');
 batchRigidParts(ground);
 // Lightweight animated water: procedural wind waves, bank gradient and stylized tree-reflection bands.
 const mat=new THREE.ShaderMaterial({uniforms:{time:{value:0},night:{value:0}},vertexShader:`
 varying vec2 uv0;varying vec3 wp;
 void main(){uv0=uv;vec4 p=modelMatrix*vec4(position,1.);wp=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,fragmentShader:`
 uniform float time;uniform float night;varying vec2 uv0;varying vec3 wp;
 void main(){
 float a=sin(wp.x*3.1+wp.z*1.3-time*1.4);
 float b=sin(wp.x*1.4-wp.z*4.4+time*.9);
 float c=sin(wp.x*6.8+wp.z*.6+time*.7);
 float wave=(a+b*.6+c*.25)/1.85;
 float edge=smoothstep(0.,.20,min(uv0.x,1.-uv0.x));
 vec3 shallow=vec3(.26,.55,.49),deep=vec3(.075,.28,.38);
 vec3 col=mix(shallow,deep,edge);
 float tree=pow(abs(sin(wp.z*1.04+wave*.32)*sin(wp.z*.27+.8)),3.);
 col=mix(col,vec3(.10,.23,.18),tree*smoothstep(.35,1.,uv0.x)*.46);
 float glint=pow(max(0.,wave),7.);
 col+=vec3(.40,.55,.49)*glint*.48;
 col=mix(col,col*vec3(.36,.43,.70)+vec3(.015,.02,.055),night);
 gl_FragColor=vec4(col,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});
 resources.materials.push(mat);
 const water=new THREE.Mesh(new THREE.PlaneGeometry(19.2,29),mat);water.rotation.x=-Math.PI/2;water.position.set(14.55,-.025,0);root.add(water);
 const waves=new THREE.Group();root.add(waves);
 const rings=Array.from({length:6},(_,i)=>{const m=new THREE.MeshBasicMaterial({color:0xc9f0e2,transparent:true,opacity:.2,depthWrite:false,side:THREE.DoubleSide});resources.materials.push(m);const r=new THREE.Mesh(new THREE.RingGeometry(.94,1,32),m);r.rotation.x=-Math.PI/2;r.position.set(7+i*2.5,.003,-11+(i*7)%23);waves.add(r);return r;});
 return {animate(t:number){mat.uniforms.time.value=t;for(let i=0;i<rings.length;i++){const k=(t*.21+i*.173)%1;rings[i].scale.setScalar(.12+k*.85);rings[i].material.opacity=.25*Math.sin(k*Math.PI);}},setNight(n:boolean){mat.uniforms.night.value=n?1:0;}};
}
