import {painted} from './LocationArt';
import * as THREE from 'three';
import {cube,drum,softCube,orb,torus,plane,finish,batchRigidParts,type XYZ} from './ArtKit';
import type {LakeTent} from '../shared/lake';
type Resources={textures:THREE.Texture[];materials:THREE.Material[]};
const wood=0x8e6949,steel=0x41494b;
function part(g:THREE.Object3D,size:XYZ,pos:XYZ,color:number,geo:THREE.BufferGeometry=cube){
 const m=new THREE.Mesh(geo,finish(color,'fabric'));m.position.set(...pos);m.scale.set(...size);m.receiveShadow=true;g.add(m);return m;
}
function rod(g:THREE.Object3D,a:XYZ,b:XYZ,r:number,color:number){
 const p=new THREE.Vector3(...a),d=new THREE.Vector3(...b).sub(p);
 const m=part(g,[r,d.length(),r],p.addScaledVector(d,.5).toArray(),color,drum);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return m;
}
const tents={
 basic:{w:2.12,d:2.12,h:1.28,c:0x5b8064,trim:0x374b40,mode:0},
 nord:{w:2.50,d:2.45,h:1.56,c:0x9ca58b,trim:0x57644e,mode:1},
 family:{w:3.12,d:2.68,h:1.85,c:0xb89c73,trim:0x655b46,mode:2},
 summit:{w:3.48,d:2.78,h:2.08,c:0xd9c7a6,trim:0x8a785f,mode:3}
} as const;
export function buildDetailedTent(id:LakeTent,resources?:Resources){
 const g=new THREE.Group(),{w,d,h,c,trim,mode}=tents[id];
 const rows=12,cols=24;
 const point=(u:number,v:number):XYZ=>{
  const a=u*Math.PI;
  const shape=mode===0?.73+.27*Math.sin(v*Math.PI):mode===1?.83+.17*Math.sin(v*Math.PI):1;
  const x=mode===3?Math.sign(Math.cos(a))*Math.pow(Math.abs(Math.cos(a)),.52):Math.cos(a);
  const y=mode===3?Math.pow(Math.sin(a),.58):mode===1?1-Math.abs(2*u-1)*.92:Math.sin(a);
  return [x*w*.5*shape,.07+y*h*shape,(v-.5)*d];
 };
 const mat=new THREE.MeshStandardMaterial({color:c,roughness:.97,side:THREE.DoubleSide,vertexColors:true});
 resources?.materials.push(mat);
 const mesh=(positions:number[],idx:number[],colors:number[])=>{
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(idx);geo.computeVertexNormals();
  const m=new THREE.Mesh(geo,mat);m.receiveShadow=true;g.add(m);return m;
 };
 const ps:number[]=[],ix:number[]=[],cs:number[]=[];
 for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
  ps.push(...point(i/cols,j/rows));const shade=.89+.09*Math.sin(i/cols*Math.PI)+.025*Math.cos(j*2.7+i*.3);cs.push(shade,shade,shade);
 }
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+cols+1;ix.push(a,a+1,b,b,a+1,b+1);}
 mesh(ps,ix,cs);
 // Closed back and split front fabric with a clearly open central entrance.
 for(const v of [0,1]){
  const p:number[]=[],indices:number[]=[],colors:number[]=[];
  for(let i=0;i<=cols;i++){const top=point(i/cols,v),opening=v===1&&i>cols*.29&&i<cols*.71;
   const lower=opening?[top[0],Math.max(.16,top[1]-.22),top[2]]:[top[0],.07,top[2]];
   p.push(...top,...lower);colors.push(.88,.88,.88,.79,.79,.79);
   if(i){const a=i*2;indices.push(a-2,a-1,a,a,a-1,a+1);}
  }mesh(p,indices,colors);
 }
 // Poles/seams follow the actual cut of each tent.
 for(const v of mode<2?[0,.5,1]:[0,.25,.5,.75,1]){
  for(let i=0;i<cols;i++){const a=point(i/cols,v),b=point((i+1)/cols,v);a[1]+=.008;b[1]+=.008;rod(g,a,b,.012,trim);}
 }
 for(const side of [-1,1]){
  const a:XYZ=[side*w*.47,.065,-d*.49],b:XYZ=[side*w*.47,.065,d*.49];rod(g,a,b,.022,trim);
  rod(g,[side*w*.42,h*.55,-d*.36],[side*Math.min(1.93,w*.5+.2),.055,-d*.65],.009,0xddd0ac);
  part(g,[.028,.13,.028],[side*Math.min(1.93,w*.5+.2),.065,-d*.65],0x56605b,drum);
 }
 part(g,[w*.90,.046,d*.94],[0,.045,0],0x434a43);
 for(const side of [-1,1]){
  const x=side*w*.225,z=-d*.13;
  part(g,[w*.39,.105,d*.69],[x,.113,z],mode>1?0xc0ad91:0x667760,softCube);
  part(g,[w*.35,.105,d*.46],[x,.176,z+.16],mode===3?0xe1d8bd:side<0?0x879a82:0x9c8670,softCube);
  part(g,[w*.31,.11,.34],[x,.204,-d*.38],0xe8dfce,softCube);
  for(let k=0;k<4;k++)part(g,[w*.34,.006,.014],[x,.233,z+.10+k*.15],0xbbb19a);
 }
 // A small washable blanket for Verdell at the entrance between the sleeping lanes.
 part(g,[.40,.035,.43],[0,.077,d*.40+.015],0x8c7964,softCube);
 if(mode>0){
  const shade=part(g,[w*.86,.035,.54],[0,h*.76,d*.5+.22],c,softCube);shade.rotation.x=.12;
  for(const x of [-w*.40,w*.40])rod(g,[x,.04,d*.5+.43],[x,h*.76,d*.5+.43],.019,steel);
 }
 if(mode>=2){
  // Separate side window panels, ventilation seam and porch mat.
  for(const side of [-1,1]){
   const win=part(g,[.025,.48,.74],[side*w*.46,h*.36,-.23],0x647b79,softCube);win.rotation.z=side*-.24;
   rod(g,[side*w*.465,h*.13,-.60],[side*w*.465,h*.13,.14],.016,trim);
  }
  part(g,[1.12,.025,.42],[0,.019,d*.5+.32],0x9c896b,softCube);
 }
 if(mode===3){for(const x of [-.63,.63])part(g,[.48,.16,.42],[x,.16,-d*.46],0xe6d6be,softCube);part(g,[.20,.27,.20],[0,.18,-d*.32],0x926d41,drum);}
 // Rolled doorway flaps and a compact lantern.
 for(const x of [-w*.31,w*.31])rod(g,[x,.12,d*.5+.015],[x,h*.66,d*.5+.015],.033,trim);
 part(g,[.10,.14,.10],[0,h*.63,d*.46],0xffe6a5,drum);
 g.name='Lake tent '+id;batchRigidParts(g,true);return g;
}
export function buildCampFood(kind:'fish'|'soup'|'sausages'|'marshmallow'){
 const g=new THREE.Group();g.name='Camp food '+kind;
 if(kind==='fish'){
  const body=part(g,[.33,.115,.14],[0,.10,0],0xb48b51,orb);body.rotation.y=.12;
  part(g,[.24,.04,.11],[0,.16,0],0xc29d69,orb);
  const tail=new THREE.Mesh(new THREE.ConeGeometry(.15,.23,3),finish(0x9a723c,'fabric'));tail.rotation.z=-Math.PI/2;tail.position.set(.35,.10,0);g.add(tail);
  part(g,[.018,.016,.018],[-.25,.13,.10],0x282e29,orb);
  for(let i=0;i<4;i++){const x=-.15+i*.095;rod(g,[x,.19,-.075],[x+.035,.18,.075],.008,0x67452c);}
  for(const x of [-.10,.12])part(g,[.07,.009,.08],[x,.195,.025],0xe7d36b,drum);
 }else if(kind==='soup'){
  part(g,[.27,.28,.27],[0,.17,0],0x343b3c,drum);
  part(g,[.25,.014,.25],[0,.316,0],0xb88b47,drum);
  for(let i=0;i<9;i++){const a=i*2.399;part(g,[.055,.026,.045],[Math.cos(a)*.17,.329,Math.sin(a)*.17],i%3===0?0xc76c36:i%3===1?0xe6c47b:0x6a8b48,softCube);}
  const handle=part(g,[.29,.29,.29],[0,.30,0],steel,torus);handle.rotation.y=Math.PI/2;
 }else{
  for(const z of [-.12,.12]){rod(g,[-.37,.06,z],[.41,.06,z],.012,wood);
   for(let i=0;i<3;i++){const x=-.19+i*.16;
    if(kind==='sausages'){const p=part(g,[.052,.19,.052],[x,.11,z],0xa96036,drum);p.rotation.z=Math.PI/2;rod(g,[x-.04,.155,z-.04],[x+.025,.155,z+.04],.006,0x65402c);}
    else part(g,[.075,.075,.075],[x,.11,z],i===1?0xe1c293:0xf4ead8,softCube);
   }
  }
 }
 batchRigidParts(g,true);return g;
}
export function buildCampFire(resources:Resources){
 const g=new THREE.Group();g.name='Lake campfire';
 part(g,[.69,.035,.69],[0,.017,0],0x65574a,drum);
 for(let i=0;i<13;i++){const a=i*Math.PI*2/13;const m=part(g,[.13+(i%3)*.025,.11,.12],[Math.cos(a)*.57,.085,Math.sin(a)*.57],[0x77786c,0x9b9785,0x88877b][i%3],orb);m.rotation.y=a;}
 for(let i=0;i<5;i++){const a=i*Math.PI/5;rod(g,[Math.cos(a)*.37,.12,Math.sin(a)*.37],[-Math.cos(a)*.37,.19,-Math.sin(a)*.37],.075,0x69513a);}
 for(const x of [-.49,.49])for(const z of [-.39,.39])rod(g,[x,.05,z],[x,.58,z],.022,steel);
 for(let i=0;i<11;i++){const x=(i-5)*.084;rod(g,[x,.58,-.39],[x,.58,.39],.009,steel);}
 rod(g,[-.49,.58,-.4],[.49,.58,-.4],.021,steel);rod(g,[-.49,.58,.4],[.49,.58,.4],.021,steel);
 batchRigidParts(g,true);
 const food=new Map<string,THREE.Group>();for(const kind of ['fish','soup','sausages','marshmallow'] as const){const model=buildCampFood(kind);model.position.y=.58;model.visible=false;g.add(model);food.set(kind,model);}
 g.userData.setFood=(kind?:string)=>{for(const [id,m] of food)m.visible=id===kind;};
 const active=new THREE.Group();active.name='Campfire active';g.add(active);active.visible=false;
 // Three narrow intersecting flame curtains: feathered orange edges and pointed, dancing tongues.
 const flames=Array.from({length:3},(_,i)=>{
  const mat=new THREE.ShaderMaterial({uniforms:{time:{value:0},seed:{value:i*2.39}},transparent:true,side:THREE.DoubleSide,depthWrite:false,vertexShader:`
 varying vec2 uv0;void main(){uv0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
 `,fragmentShader:`
 uniform float time;uniform float seed;varying vec2 uv0;
 void main(){
  float y=uv0.y,t=time*4.5+seed,x=uv0.x-.5;
  float sway=.075*sin(t+y*9.)*y+.035*sin(t*1.7-y*13.)*y;
  float q=x-sway;
  float w=.38*pow(max(0.,1.-y),.69);
  float tip=.81+.12*sin(q*13.+t)+.07*sin(q*26.-t*1.3);
  float mask=(1.-smoothstep(w*.72,w,abs(q)))*(1.-smoothstep(tip-.09,tip,y))*smoothstep(0.,.10,y);
  float core=(1.-smoothstep(w*.22,w*.66,abs(q)))*(1.-smoothstep(.20,.80,y));
  vec3 col=mix(vec3(1.,.10,.012),vec3(1.,.49,.045),clamp(1.-abs(q)/max(.01,w),0.,1.));
  col=mix(col,vec3(1.,.91,.54),core*.91);
  gl_FragColor=vec4(col,mask*.91);
  #include <colorspace_fragment>
 }
 `});
  resources.materials.push(mat);
  const m=new THREE.Mesh(plane,mat);m.name='Campfire flame tongue';m.position.set(0,.45,0);m.rotation.y=i*Math.PI/3;m.scale.set(.73,.80,1);m.renderOrder=3;active.add(m);return m;
 });
 const emberMat=new THREE.MeshBasicMaterial({color:0xf48028});resources.materials.push(emberMat);
 const embers=new THREE.InstancedMesh(new THREE.SphereGeometry(.023,5,4),emberMat,16);active.add(embers);
 const cloud=painted(resources,64,64,ctx=>{const gr=ctx.createRadialGradient(32,32,1,32,32,31);gr.addColorStop(0,'rgba(200,191,174,0.72)');gr.addColorStop(.38,'rgba(177,173,163,0.38)');gr.addColorStop(1,'rgba(160,160,160,0)');ctx.fillStyle=gr;ctx.fillRect(0,0,64,64);});
 const smoke=Array.from({length:5},()=>{const mat=new THREE.SpriteMaterial({map:cloud,color:0xb8b3a9,transparent:true,opacity:.08,depthWrite:false});resources.materials.push(mat);const m=new THREE.Sprite(mat);m.renderOrder=4;active.add(m);return m;});
 const light=new THREE.PointLight(0xff9a42,2.0,5,2);light.position.y=.53;active.add(light);
 const t=new THREE.Object3D();
 g.userData.setLit=(lit:boolean)=>{active.visible=lit;};
 g.userData.animate=(time:number)=>{if(!active.visible)return;
  for(let i=0;i<flames.length;i++){const m=flames[i];m.material.uniforms.time.value=time;const k=.94+.09*Math.sin(time*5.1+i*2.1);m.scale.y=.80*k;m.position.y=.12+.40*k;}
  for(let i=0;i<16;i++){const age=(time*.67+i*.147)%1,a=i*2.399;t.position.set(Math.cos(a)*(.12+age*.24),.23+age*.91,Math.sin(a)*(.12+age*.20));t.scale.setScalar(Math.max(.04,1-age));t.updateMatrix();embers.setMatrixAt(i,t.matrix);}embers.instanceMatrix.needsUpdate=true;
  for(let i=0;i<smoke.length;i++){const age=(time*.31+i/5)%1;smoke[i].position.set(age*.62,.58+age*1.35,.15*Math.sin(i+time*.6));smoke[i].scale.setScalar(.13+age*.49);smoke[i].material.opacity=.21*Math.sin(age*Math.PI);}
  light.intensity=2.3+.32*Math.sin(time*7)+.20*Math.sin(time*12.7);
 };
 return g;
}
