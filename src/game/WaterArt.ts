import * as THREE from 'three';
export type WaterKind='spa'|'jacuzzi'|'home'|'pond';
// Same world-space four-wave normal and oblique broken ripples as LakeArt.
// No framebuffer reflection, extra render pass, or per-frame mesh rebuilding.
export function makeWater(kind:WaterKind){
 const indoor=kind==='spa'||kind==='jacuzzi',natural=kind==='pond';
 const shallow=natural?[.23,.37,.25]:kind==='home'?[.22,.58,.61]:[.30,.64,.65];
 const deep=natural?[.025,.14,.17]:kind==='home'?[.045,.30,.39]:[.045,.34,.43];
 return new THREE.ShaderMaterial({
  uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{
   time:{value:0},night:{value:0},natural:{value:natural?1:0},indoor:{value:indoor?1:0},
   amplitude:{value:kind==='jacuzzi'?1.25:natural?.72:.90},
   shallow:{value:new THREE.Vector3(...shallow)},deepColor:{value:new THREE.Vector3(...deep)}
  }]),transparent:!natural,depthWrite:natural,side:THREE.DoubleSide,fog:true,
  vertexShader:`
   varying vec2 uv0;varying vec3 wp;
   #include <fog_pars_vertex>
   void main(){
    uv0=uv;vec4 p=modelMatrix*vec4(position,1.);wp=p.xyz;
    vec4 mvPosition=viewMatrix*p;gl_Position=projectionMatrix*mvPosition;
    #include <fog_vertex>
   }`,
  fragmentShader:`
   uniform float time,night,natural,indoor,amplitude;
   uniform vec3 shallow,deepColor;
   varying vec2 uv0;varying vec3 wp;
   #include <fog_pars_fragment>
   void main(){
    vec2 p=wp.xz;float t=time;
    float a=sin(dot(p,vec2(2.2,1.15))-t*.85);
    float b=sin(dot(p,vec2(-1.3,3.7))+t*.66);
    float c=sin(dot(p,vec2(5.5,.75))+t*.58);
    float d=sin(dot(p,vec2(1.9,-6.8))-t*.49);
    float wave=(a+b*.52+c*.25+d*.12)/1.89;
    vec3 n=normalize(vec3(amplitude*(.085*cos(dot(p,vec2(2.2,1.15))-t*.85)+.025*c),1.,amplitude*(.07*cos(dot(p,vec2(-1.3,3.7))+t*.66)+.025*d)));
    vec3 v=normalize(cameraPosition-wp);
    float fresnel=pow(1.-clamp(dot(n,v),0.,1.),2.5);
    float rectEdge=min(min(uv0.x,1.-uv0.x),min(uv0.y,1.-uv0.y));
    float edge=mix(rectEdge,(1.-length(uv0*2.-1.))*.5,natural);
    float deep=smoothstep(.005,.22,edge);
    float caustic=pow(abs(sin(p.x*7.+a*.9)*sin(p.y*8.+b*.8)),3.);
    vec3 col=mix(shallow,deepColor,deep)+vec3(.17,.22,.19)*caustic*(.55-.27*deep);
    vec3 sky=mix(vec3(.12,.28,.37),vec3(.48,.65,.70),.55+.45*wave);
    vec3 ray=reflect(-v,n);
    float ceiling=pow(.5+.5*sin(ray.x*19.+ray.z*7.+wave*.7),12.);
    sky=mix(sky,vec3(.72,.80,.76),ceiling*.48*indoor);
    col=mix(col,sky,.10+.57*fresnel);
    float bank=exp(-max(edge,0.)*12.)*pow(abs(sin(p.y*1.25+wave*.22)*sin(p.y*.35+.8)),2.);
    col=mix(col,vec3(.035,.105,.065),natural*bank*(.20+.30*fresnel));
    float lines=sin(dot(p,vec2(8.9,1.4))+1.9*sin(dot(p,vec2(.6,2.4))+t*.56)-t*1.3);
    float breaks=.5+.5*sin(dot(p,vec2(1.7,4.1))+b*.7+t*.38);
    float rip=smoothstep(.94,.999,lines)*smoothstep(.35,.85,breaks);
    col+=vec3(.07,.12,.13)*rip*(.52+.48*fresnel);
    vec3 sun=normalize(vec3(-.55,.80,.25));
    float spec=pow(max(0.,dot(reflect(-sun,n),v)),36.);
    col+=vec3(.84,.80,.65)*spec*.67+vec3(.22,.32,.34)*pow(max(wave,0.),6.)*.45;
    float rim=1.-smoothstep(.0,.017,edge);
    col=mix(col,vec3(.69,.82,.76),rim*.18);
    col=mix(col,col*vec3(.21,.35,.55)+vec3(.009,.025,.048),night*(1.-indoor));
    float alpha=mix(clamp(.43+.23*deep+.27*fresnel+.13*spec,.43,.91),1.,natural);
    gl_FragColor=vec4(col,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
   }`
 });
}
export function updateWater(mat:THREE.ShaderMaterial,time:number,night=0){
 mat.uniforms.time.value=time;mat.uniforms.night.value=THREE.MathUtils.clamp(night,0,1);
}
