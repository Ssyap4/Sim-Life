import {painted} from './LocationArt';
import {paintGround} from './LandscapeGround';
import {buildDetailedTent,buildCampFire} from './LakeCampArt';
import * as THREE from 'three';
import {cube,drum,softCube,orb,finish,batchRigidParts,type XYZ} from './ArtKit';
import {PlantBatch,growTree,growShrub,landscapeRandom} from './LandscapePlants';
import {LAKE_TENTS,LAKE_FIRE_SEAT_OFFSET,type LakeTent,type LakeState} from '../shared/lake';
import type {Station} from '../shared/locations';
type Resources={textures:THREE.Texture[];materials:THREE.Material[]};
const wood=0x9a7049,grass=0x82995d;
function box(g:THREE.Object3D,size:XYZ,pos:XYZ,color:number,geometry:THREE.BufferGeometry=cube){
 const m=new THREE.Mesh(geometry,finish(color,'wood'));m.position.set(...pos);m.scale.set(...size);m.receiveShadow=true;g.add(m);return m;
}
export const buildLakeTent=buildDetailedTent;
export function lakeStation(s:Station,resources:Resources){
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
   // Rental counter: folded tents, labelled bait jars, reels and rolled sleeping mats.
   for(let i=0;i<4;i++){const x=-1.85+i*.42;box(g,[.34,.19,.28],[x,1.98,-1.13],[0x5c8064,0x9ca58b,0xb89c73,0xd9c7a6][i],softCube);box(g,[.035,.195,.29],[x,1.98,-1.13],0x41483b);}
   for(let i=0;i<3;i++){const x=.15+i*.28;box(g,[.16,.22,.16],[x,.13+1.00,.84],0x8e7855,drum);box(g,[.17,.045,.17],[x,1.25,.84],0x485448,drum);box(g,[.13,.09,.015],[x,1.13,.93],0xe8dfc7);}
   for(let i=0;i<3;i++){const roll=box(g,[.19,.47,.19],[-2.08+i*.39,.30,-.45],0x879a73,drum);roll.rotation.z=Math.PI/2;}
   const signMap=painted(resources,512,96,ctx=>{ctx.fillStyle='#314b3b';ctx.fillRect(0,0,512,96);ctx.strokeStyle='#c9b991';ctx.strokeRect(4,4,504,88);ctx.fillStyle='#fff0ce';ctx.font='bold 34px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('КЕМПИНГ И РЫБАЛКА',256,48);});
   const signMat=new THREE.MeshBasicMaterial({map:signMap,color:0xffffff});resources.materials.push(signMat);const sign=new THREE.Mesh(new THREE.PlaneGeometry(3.9,.45),signMat);sign.position.set(0,2.54,1.90);g.add(sign);
   for(let i=0;i<3;i++){const rod=box(g,[.035,1.8,.035],[1.40+i*.28,1.10,-1.15],0x39463d,drum);rod.rotation.z=-.12;}
  }else if(s.action.facility==='pitch'){
   box(g,[4.10,.035,3.55],[0,.018,0],0xb8aa81,softCube);
   for(const x of [-1.95,1.95])for(const z of [-1.65,1.65])box(g,[.08,.32,.08],[x,.16,z],wood);
   const models=new Map<LakeTent,THREE.Group>();
   for(const id of Object.keys(LAKE_TENTS) as LakeTent[]){const t=buildLakeTent(id,resources);t.position.z=-.13;t.visible=false;g.add(t);models.set(id,t);}
   g.userData.tents=models;
  }else if(s.action.facility==='fire'){
   const fire=buildCampFire(resources);g.add(fire);g.userData.fire=fire;
   // Low logs and small side table around the stone fire pit.
   for(const side of [-1,1]){box(g,[.38,.10,.74],[side*LAKE_FIRE_SEAT_OFFSET,.35,0],wood,softCube);for(const dz of [-.26,.26])box(g,[.19,.32,.11],[side*LAKE_FIRE_SEAT_OFFSET,.17,dz],0x72583d);}
   box(g,[.40,.07,.45],[1.36,.48,-.76],wood);for(const dx of [-.13,.13])for(const dz of [-.16,.16])box(g,[.05,.44,.05],[1.36+dx,.23,-.76+dz],wood);
  }else if(s.action.facility==='rest'){
   box(g,[1.8,.10,.55],[0,.44,0],wood,softCube);for(const x of [-.72,.72]){box(g,[.12,.44,.47],[x,.22,0],0x53574d);box(g,[.08,.55,.08],[x,.69,-.27],0x53574d);}box(g,[1.8,.37,.09],[0,.80,-.28],wood,softCube);g.rotation.y=Math.PI/2;
  }else if(s.action.facility==='swim'){
   box(g,[.7,.05,1.1],[.20,.025,0],0xbca67a,softCube);box(g,[.065,.85,.065],[-.3,.425,.65],wood);box(g,[.34,.28,.05],[-.3,.79,.65],0x527f87,softCube);
  }else if(s.action.facility==='dog'){
   box(g,[2.15,.025,1.55],[0,.016,0],0x92a86d,softCube);
   const stick=box(g,[.055,.45,.055],[.65,.05,.22],wood,drum);stick.rotation.z=Math.PI/2;
  }else if(s.action.facility==='toilet'){
   box(g,[1.65,.10,1.65],[0,.05,0],wood);box(g,[1.65,2.25,.12],[0,1.15,-.77],0x8b775b);
   for(const x of [-.77,.77])box(g,[.12,2.25,1.65],[x,1.15,0],0x8b775b);
   box(g,[1.85,.13,1.85],[0,2.35,0],0x405e4e);
   box(g,[1.55,2.12,.08],[0,1.13,.77],0x776b56);
   box(g,[.07,.08,.07],[.48,1.05,.83],0xc6bd98);
   box(g,[.25,.25,.03],[0,1.77,.83],0xe9e3ca);
   box(g,[.44,.38,.48],[0,.24,-.18],0xe5e3d9,softCube);box(g,[.45,.08,.53],[0,.45,-.18],0xf1eee2,softCube);box(g,[.43,.44,.17],[0,.60,-.48],0xe5e3d9,softCube);
   box(g,[.17,.08,.035],[0,1.76,.86],0x426151);
  }else if(s.action.facility==='wash'){
   for(const x of [-.58,.58])box(g,[.07,1.0,.07],[x,.5,0],0x666a63);
   box(g,[1.40,.12,.68],[0,1.00,0],0x9b9d92,softCube);
   box(g,[.56,.055,.40],[0,1.07,0],0x526463,softCube);
   box(g,[.06,.22,.06],[0,1.19,-.23],0x9eaaa9,drum);
   box(g,[.06,.045,.22],[0,1.28,-.15],0xc4cdca,softCube);
   box(g,[.13,.18,.12],[.45,1.15,-.15],0x87a5a2,softCube);
  }else if(s.action.facility==='fish'){
   if(s.id!=='lake-pier')box(g,[1.25,.10,1.38],[.20,.04,0],wood);
   box(g,[.28,.33,.32],[-.27,.20,.42],0x69795c,softCube);
  }
 }
 return g;
}
export function syncLakeTents(stations:Map<string,THREE.Group>,visits:LakeState|undefined,now=0){
 for(const [id,g] of stations){const models=g.userData.tents as Map<LakeTent,THREE.Group>|undefined;if(!models){const fire=g.userData.fire as THREE.Group|undefined;if(fire){const v=Object.values(visits??{}).find(v=>v.pitch===id.replace('lake-fire-','lake-pitch-'));fire.userData.setLit(!!v?.fire&&v.until>now);}continue;}
 const visit=Object.values(visits??{}).find(v=>v.pitch===id);for(const [sku,m] of models)m.visible=visit?.tent===sku;}
}
// An irregular lake footprint with a narrow western bank and curved far shore.
function lakeEdge(v:number){
 const z=(v-.5)*29.0,cap=Math.pow(Math.max(0,Math.sin(v*Math.PI)),.58);
 return {z,left:4.83+.18*Math.sin(z*.57)+.08*Math.sin(z*1.17),right:5.25+18.5*cap+.34*Math.sin(z*.46)*cap};
}
function lakeSurface(){
 const pos:number[]=[],uv:number[]=[],idx:number[]=[];const rows=64,cols=20;
 for(let j=0;j<=rows;j++){const v=j/rows,e=lakeEdge(v);for(let i=0;i<=cols;i++){const u=i/cols;pos.push(THREE.MathUtils.lerp(e.left,e.right,u),.012,e.z);uv.push(u,v);}}
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+cols+1;idx.push(a,b,a+1,b,b+1,a+1);}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();return geo;
}
export function buildLakeLandscape(root:THREE.Group,resources:Resources){
 const ground=new THREE.Group();root.add(ground);
 const area={x:5.7,z:0,w:46,d:33};
 box(ground,[area.w,.42,area.d],[area.x,-.23,0],grass);
 const map=painted(resources,1024,1024,ctx=>{
  paintGround(ctx,area,[
   {x:-12,z:-10,w:6,d:7,ink:[56,109,62],opacity:.58},
   {x:-1,z:0,w:7,d:25,ink:[144,168,103],opacity:.45},
   {x:23,z:0,w:8,d:29,ink:[68,115,63],opacity:.62}
  ],54129);
  const px=(x:number)=>(x-area.x+area.w/2)/area.w*1024,pz=(z:number)=>(z+area.d/2)/area.d*1024;
  function trail(points:XYZ[],width:number){ctx.lineJoin='round';ctx.lineCap='round';for(const [color,w] of [['#ae9b71',width+5],['#c8b68c',width]] as const){ctx.strokeStyle=color;ctx.lineWidth=w;ctx.beginPath();points.forEach(([x,,z],i)=>i?ctx.lineTo(px(x),pz(z)):ctx.moveTo(px(x),pz(z)));ctx.stroke();}}
  trail([[-5,0,13.4],[-6.9,0,9],[-6.6,0,5],[-7.1,0,0],[-6.7,0,-6],[-7.1,0,-11.2]],32);
  for(const z of [-5.7,3.3,11.0])trail([[-11,0,z],[-7,0,z+.1],[-1.5,0,z+.4],[3.6,0,z]],24);
  trail([[3.7,0,-12],[4.0,0,-5],[3.8,0,0],[4.0,0,7],[3.6,0,12]],27);
 });
 const gm=new THREE.MeshStandardMaterial({map,color:map?0xffffff:grass,roughness:1});resources.materials.push(gm);
 const gmsh=new THREE.Mesh(new THREE.PlaneGeometry(area.w,area.d),gm);gmsh.rotation.x=-Math.PI/2;gmsh.position.set(area.x,-.012,0);gmsh.receiveShadow=true;root.add(gmsh);
 // Sand/pebble ribbon follows the actual shore, rather than a rectangular border.
 const shoreP:number[]=[],shoreI:number[]=[];
 for(let j=0;j<=64;j++){const e=lakeEdge(j/64);shoreP.push(e.left-.78,-.003,e.z,e.left+.10,-.003,e.z,e.right-.10,-.003,e.z,e.right+.75,-.003,e.z);
 if(j){const a=(j-1)*4,b=j*4;shoreI.push(a,b,a+1,b,b+1,a+1,a+2,b+2,a+3,b+2,b+3,a+3);}}
 const shoreGeo=new THREE.BufferGeometry();shoreGeo.setAttribute('position',new THREE.Float32BufferAttribute(shoreP,3));shoreGeo.setIndex(shoreI);shoreGeo.computeVertexNormals();
 const shore=new THREE.Mesh(shoreGeo,finish(0xc5b78d,'fabric'));shore.receiveShadow=true;root.add(shore);
 // Public pier: the server permits walking only through this two-metre corridor.
 for(let i=0;i<28;i++)box(ground,[.19,.13,2.1],[4.18+i*.187,.02,-3],i%4===0?0xb99563:0xa98658);
 for(const x of [4.5,6.6,8.75])for(const z of [-3.9,-2.1])box(ground,[.12,.64,.12],[x,.20,z],0x72583e);
 for(const z of [-3.9,-2.1])box(ground,[4.4,.09,.10],[6.62,.49,z],0x84613c);
 const plants=new PlantBatch(),rng=landscapeRandom(65381);
 const trees:XYZ[]=[];
 for(let i=0;i<17;i++)trees.push([-16.5-rng()*.7,0,-14.5+i*1.8]);
 for(let i=0;i<18;i++){const v=(i+.5)/18,e=lakeEdge(v);trees.push([e.right+1.05+rng()*1.8,0,e.z]);}
 for(let i=0;i<17;i++)trees.push([-15+i*1.55,0,-15.6-rng()*.5],[-15+i*1.55,0,15.4+rng()*.5]);
 for(const [i,[x,,z]] of trees.entries()){growTree(plants,x,z,i%4?'spruce':'birch',.94+(i%5)*.11,741+i*31,i%3!==0);if(i%2===0)growShrub(plants,x+.55,0,z+.45,.70,.42,.70,i%4,773+i);}
 // Plants and rounded pebbles are kept outside the character corridor.
 for(let i=0;i<46;i++){const z=-13.6+i*.60;if(Math.abs(z+3)<1.35)continue;const e=lakeEdge(z/29+.5),x=e.left+.10+rng()*.20;
  for(let k=0;k<4;k++){const a=rng()*6.283;plants.stem(0x687f45,[x,0,z],[x+.12*Math.cos(a),.24+rng()*.43,z+.12*Math.sin(a)],.012);plants.blade(0x809653,[x,.14,z],[.045,.26,.04],a,.50);}
  if(i%3===0)box(ground,[.10+rng()*.10,.075,.11],[e.left-.17,.04,z],0x8c8d7b,orb);
 }
 plants.attach(root,'Lake forest and reeds');
 // Small lily clusters and water rocks, batched into one rigid group.
 for(let i=0;i<20;i++){const z=-12+rng()*24;if(Math.abs(z+3)<1.5)continue;const e=lakeEdge(z/29+.5),x=e.left+.5+rng()*1.1;
  box(ground,[.13+rng()*.07,.008,.13],[x,.024,z],i%2?0x68884a:0x54783b,drum);
  if(i%5===0)box(ground,[.05,.05,.05],[x,.048,z],0xe3b3bd,orb);
 }
 // Low wooden lanterns with inexpensive emissive faces and baked pools of light.
 const lanterns=new THREE.Group();lanterns.name='Lake trail lanterns';root.add(lanterns);
 const lanternGlow=new THREE.MeshStandardMaterial({color:0xffe6ad,emissive:0xffb95d,emissiveIntensity:0});resources.materials.push(lanternGlow);
 const glowMap=painted(resources,64,64,ctx=>{const gr=ctx.createRadialGradient(32,32,1,32,32,32);gr.addColorStop(0,'rgba(255,195,103,0.55)');gr.addColorStop(.4,'rgba(255,185,90,0.22)');gr.addColorStop(1,'rgba(255,185,90,0)');ctx.fillStyle=gr;ctx.fillRect(0,0,64,64);});
 const glowMat=new THREE.MeshBasicMaterial({map:glowMap,transparent:true,opacity:.65,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});resources.materials.push(glowMat);
 const pools=new THREE.Group();pools.visible=false;lanterns.add(pools);
 for(const [x,z] of [[-7.5,12],[-7.5,7],[-7.5,1],[-7.5,-5],[-7.5,-11],[2.5,-10],[2.5,-3],[2.5,4],[2.5,11],[-12.4,8]]){box(ground,[.10,.74,.10],[x,.37,z],0x72583e);box(ground,[.25,.06,.25],[x,.75,z],0x405447);box(ground,[.26,.07,.26],[x,.99,z],0x405447);const bulb=new THREE.Mesh(cube,lanternGlow);bulb.scale.set(.18,.20,.18);bulb.position.set(x,.86,z);lanterns.add(bulb);const pool=new THREE.Mesh(new THREE.PlaneGeometry(2.5,2.5),glowMat);pool.rotation.x=-Math.PI/2;pool.position.set(x,.005,z);pools.add(pool);}
 batchRigidParts(ground,true);
 // A tiny baked silhouette strip of the actual far-bank trees. Projected across the lake with
 // reflected camera rays and ripples; no render-to-texture pass or second scene render.
 const reflection=painted(resources,512,128,ctx=>{
  ctx.clearRect(0,0,512,128);
  const far=trees.slice(17,35);
  for(const [i,[, ,z]] of far.entries()){
   const x=(z+14.5)/29*512,w=18+(i%5)*3,h=82+(i%4)*9;
   ctx.fillStyle='#594c37';ctx.fillRect(x-2,128-h*.4,4,h*.4);
   if(i%4===0){
    ctx.fillStyle='#3f694f';ctx.beginPath();ctx.ellipse(x,128-h*.65,w*.57,h*.36,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#527b50';ctx.beginPath();ctx.ellipse(x-w*.18,128-h*.79,w*.38,h*.25,0,0,Math.PI*2);ctx.fill();
   }else{
    for(let k=0;k<4;k++){const y=128-h+k*h*.18,ww=w*(.30+k*.18);ctx.fillStyle=['#315543','#254b3b','#375f48','#2a4d3e'][k];ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-ww,y+h*.37);ctx.lineTo(x+ww,y+h*.37);ctx.closePath();ctx.fill();}
   }
  }
 });
 // View-dependent fresnel, moving normals, shoreline caustics and stylized tree reflections.
 const mat=new THREE.ShaderMaterial({uniforms:{time:{value:0},night:{value:0},reflection:{value:reflection}},side:THREE.DoubleSide,vertexShader:`
 varying vec2 uv0;varying vec3 wp;
 void main(){uv0=uv;vec4 p=modelMatrix*vec4(position,1.);wp=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,fragmentShader:`
 uniform float time;uniform float night;uniform sampler2D reflection;varying vec2 uv0;varying vec3 wp;
 void main(){
 vec2 p=wp.xz;float t=time;
 float a=sin(dot(p,vec2(2.2,1.15))-t*.85);
 float b=sin(dot(p,vec2(-1.3,3.7))+t*.66);
 float c=sin(dot(p,vec2(5.5,.75))+t*.58);
 float d=sin(dot(p,vec2(1.9,-6.8))-t*.49);
 float wave=(a+b*.52+c*.25+d*.12)/1.89;
 vec3 n=normalize(vec3(.085*cos(dot(p,vec2(2.2,1.15))-t*.85)+.025*c,1.,.07*cos(dot(p,vec2(-1.3,3.7))+t*.66)+.025*d));
 vec3 v=normalize(cameraPosition-wp);
 float fresnel=pow(1.-clamp(dot(n,v),0.,1.),2.5);
 float edge=min(min(uv0.x,1.-uv0.x),min(uv0.y,1.-uv0.y)*.9);
 float deep=smoothstep(.005,.17,edge);
 vec3 shall=vec3(.26,.39,.24),depth=vec3(.016,.115,.155);
 float caustic=pow(abs(sin(p.x*7.+a*.9)*sin(p.y*8.+b*.8)),3.);
 vec3 col=mix(shall,depth,deep)+vec3(.17,.22,.13)*caustic*(1.-deep)*.35;
 vec3 sky=mix(vec3(.09,.23,.31),vec3(.30,.46,.54),.55+.45*wave);
 col=mix(col,sky,.11+.56*fresnel);
 float silhouette=pow(abs(sin(p.y*1.25+wave*.22)*sin(p.y*.35+.8)),2.);
 float bankReflection=exp(-edge*12.)*silhouette;
 col=mix(col,vec3(.035,.105,.065),bankReflection*(.22+.24*fresnel));
 // Reflect the far-shore silhouettes in water-space, distorted by the animated normal.
 float cap=pow(max(0.,sin(uv0.y*3.14159265)),.58);
 float farX=5.25+18.5*cap+.34*sin(wp.z*.46)*cap;
 vec3 r=reflect(-v,n);
 float hit=max(0.,farX-wp.x)/max(.18,r.x);
 float refZ=wp.z+clamp(r.z*hit,-5.,5.)+wave*.18;
 float refY=hit*max(.12,r.y)*.55;
 vec4 treeColor=texture2D(reflection,vec2(clamp((refZ+14.5)/29.,0.,1.),clamp(refY/6.,0.,1.)));
 float valid=step(0.,r.x)*(1.-smoothstep(4.5,6.,refY))*step(0.,refY);
 col=mix(col,treeColor.rgb*.47,treeColor.a*valid*(.42+.36*fresnel));
 // Small oblique, narrow surface ripples and broken highlights, not an even dotted grid.
 float lines=sin(dot(p,vec2(8.9,1.4))+1.9*sin(dot(p,vec2(.6,2.4))+t*.56)-t*1.3);
 float breaks=.5+.5*sin(dot(p,vec2(1.7,4.1))+b*.7+t*.38);
 float rip=smoothstep(.955,.999,lines)*smoothstep(.35,.85,breaks);
 col+=vec3(.045,.085,.10)*rip*(.52+.48*fresnel);

 vec3 sun=normalize(vec3(-.55,.80,.25));float spec=pow(max(0.,dot(reflect(-sun,n),v)),36.);
 col+=vec3(.84,.72,.44)*spec*.67+vec3(.22,.32,.34)*pow(max(wave,0.),6.)*.45;
 float rim=1.-smoothstep(.0,.017,edge);col=mix(col,vec3(.63,.72,.56),rim*.20);
 col=mix(col,col*vec3(.16,.27,.46)+vec3(.006,.014,.032),night);
 gl_FragColor=vec4(col,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});
 resources.materials.push(mat);
 const water=new THREE.Mesh(lakeSurface(),mat);water.name='Lake water surface';root.add(water);
 const waves=new THREE.Group();root.add(waves);
 const rings=Array.from({length:6},(_,i)=>{const m=new THREE.MeshBasicMaterial({color:0xc9f0e2,transparent:true,opacity:.2,depthWrite:false,side:THREE.DoubleSide});resources.materials.push(m);const r=new THREE.Mesh(new THREE.RingGeometry(.96,1,32),m);r.rotation.x=-Math.PI/2;r.position.set(7+i*1.1,.022,-10+(i*7)%20);waves.add(r);return r;});
 return {animate(t:number){mat.uniforms.time.value=t;for(let i=0;i<rings.length;i++){const k=(t*.21+i*.173)%1;rings[i].scale.setScalar(.10+k*.72);rings[i].material.opacity=.19*Math.sin(k*Math.PI);}},setNight(n:boolean){mat.uniforms.night.value=n?1:0;lanternGlow.emissiveIntensity=n?1.8:0;pools.visible=n;}};
}

export function syncLakeCutaway(stations:Map<string,THREE.Group>,occupied:ReadonlySet<string>){for(const [id,g] of stations){const models=g.userData.tents as Map<LakeTent,THREE.Group>|undefined;if(models)for(const m of models.values())if(m.userData.shell)m.userData.shell.visible=!occupied.has(id);}}
