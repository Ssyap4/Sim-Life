import * as THREE from 'three';
import type {WeatherKind} from '../shared/weather';
import type { PlaceId } from '../shared/locations';
import { HOUSE, HOUSE_WING } from '../shared/home';

const skies = {
  overcast: { tint:0xa4b6bf, cloud:.63, direct:.53, near:30, far:98 },
  fog:      { tint:0xc3ccc1, cloud:.72, direct:.62, near:4, far:33 },
  rain:     { tint:0x90a6af, cloud:.69, direct:.48, near:16, far:68 },
  snow:     { tint:0xc5d3d7, cloud:.70, direct:.71, near:13, far:67 },
  storm:    { tint:0x748699, cloud:.80, direct:.34, near:11, far:58 },
} as const;
type Weather = keyof typeof skies;

function precipitation(snow:boolean, storm:boolean) {
  const count=snow?180:storm?288:208;
  const vertices=[], ends=[];
  let seed=1951;
  const random=()=>(seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296;
  for(let i=0;i<count;i++) {
    const point=[random()*20,random()*9,random()*20];
    vertices.push(...point);ends.push(0);
    if(!snow){vertices.push(...point);ends.push(.26+random()*.14);}
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('tail',new THREE.Float32BufferAttribute(ends,1));
  const uniforms={
    seconds:{value:0}, center:{value:new THREE.Vector2()}, home:{value:0},
    roof:{value:new THREE.Vector4(HOUSE.minX-.24,HOUSE_WING.maxX+.24,HOUSE.minZ-.20,HOUSE.maxZ+.20)},
    dpr:{value:1},
  };
  // The world-space lattice wraps around the camera target. Panning reveals
  // neighbouring drops instead of dragging a screen-space overlay with the UI.
  const material=new THREE.ShaderMaterial({
    uniforms, transparent:true, depthWrite:false,
    vertexShader:`
      attribute float tail;
      uniform float seconds, home, dpr;
      uniform vec2 center;
      uniform vec4 roof;
      varying float opacity;
      void main(){
        float t=seconds;
        vec3 p=position;
        p.y=mod(p.y-t*${snow?'0.95':'7.2'},9.0)+tail;
        p.x+=${snow?'sin(position.z+t*.74)*.48':'p.y*-.18'};
        p.z+=${snow?'cos(position.x+t*.53)*.22':'p.y*.07'};
        p.xz=center+mod(p.xz-center+10.0,20.0)-10.0;
        opacity=smoothstep(0.0,.4,p.y)*(1.0-smoothstep(7.6,9.0,p.y))
          *(1.0-smoothstep(7.5,10.0,max(abs(p.x-center.x),abs(p.z-center.y))));
        if(home>.5 && p.x>roof.x && p.x<roof.y && p.z>roof.z && p.z<roof.w)opacity=0.0;
        vec4 mv=modelViewMatrix*vec4(p,1.0);
        gl_Position=projectionMatrix*mv;
        gl_PointSize=dpr*clamp((18.0+8.0*fract(position.z))/max(.1,-mv.z),1.8,4.8);
      }`,
    fragmentShader:`varying float opacity;
      void main(){
        float alpha=opacity*${snow?'(.82*(1.0-smoothstep(.23,.50,length(gl_PointCoord-.5))))':'.50'};
        gl_FragColor=vec4(${snow?'vec3(.93,.96,1.)':'vec3(.72,.84,.91)'},alpha);
        #include <colorspace_fragment>
      }`,
  });
  const batch=snow?new THREE.Points(geometry,material):new THREE.LineSegments(geometry,material);
  batch.name=snow?'Snow flurries':'Rain streaks';
  batch.frustumCulled=false;
  return {batch,uniforms};
}

export class WeatherArt {
  private mode: Weather | undefined;
  private readonly preview?:Weather;
  private readonly safe:boolean;
  private readonly cached=new Map<Weather,ReturnType<typeof precipitation>>();
  private readonly tint=new THREE.Color();
  private particles?: ReturnType<typeof precipitation>;
  private readonly reducedMotion:boolean;
  private stormLight?:THREE.DirectionalLight;
  private stormBase=0;

  constructor(query:string, motionLimited:boolean, safe:boolean) {
    const name=new URLSearchParams(query).get('weather')??'';
    this.reducedMotion=motionLimited;this.safe=safe;
    if(Object.hasOwn(skies,name)){this.preview=name as Weather;this.change(this.preview);}
  }

  private change(mode:Weather|undefined){
    if(mode===this.mode)return false;
    this.particles?.batch.removeFromParent();
    this.mode=mode;this.particles=undefined;
    if(mode){
      this.tint.setHex(skies[mode].tint);
      if(!this.reducedMotion&&!this.safe&&['rain','snow','storm'].includes(mode)){
        if(!this.cached.has(mode))this.cached.set(mode,precipitation(mode==='snow',mode==='storm'));
        this.particles=this.cached.get(mode);
      }
    }
    this.stormLight=undefined;
    return true;
  }
  setWeather(kind:WeatherKind,scene:THREE.Scene,place:PlaceId){
    if(this.change(this.preview??(kind==='clear'?undefined:kind)))this.enter(scene,place);
  }
  get haze(){
    if(this.mode==='fog')return .95;
    return this.mode ? skies[this.mode].cloud : .21;
  }

  enter(scene:THREE.Scene, place:PlaceId) {
    if(!this.particles)return;
    this.particles.batch.removeFromParent();
    if(['park','industrial','district','home','lake'].includes(place)){
      scene.add(this.particles.batch);
      this.particles.uniforms.home.value=Number(place==='home');
    }
  }

  light(scene:THREE.Scene,place:PlaceId,sun:THREE.DirectionalLight,ambient:THREE.HemisphereLight) {
    if(!this.mode){
      this.stormLight=undefined;
      if(scene.fog instanceof THREE.Fog){
        // Clear weather must not hide a distant home overview (camera max 88).
        scene.fog.near=place==='home'?125:place==='district'?125:place==='lake'?85:place==='fitness'?85:49;
        scene.fog.far=place==='home'?185:place==='district'?171:place==='lake'?115:place==='fitness'?115:75;
      }
      return;
    }
    const preset=skies[this.mode];
    // Distant mist follows daylight luminance, including the darkest hours.
    const outdoors=['home','district','park','industrial','lake'].includes(place);
    if(!outdoors){this.stormLight=undefined;return;}
    const sky=scene.background as THREE.Color;
    const brightness=THREE.MathUtils.clamp(.26+sun.intensity*.34,.32,1);
    sky.lerp(this.tint,preset.cloud).multiplyScalar(brightness);
    const fog=scene.fog;
    if(fog instanceof THREE.Fog&&outdoors){
      fog.color.copy(sky);
      // The home overview camera is much farther away than the park camera.
      // Weather must never erase the entire cutaway house at normal zoom.
      fog.near=place==='home'?Math.max(110,preset.near):preset.near;
      fog.far=place==='home'?Math.max(185,preset.far):preset.far;
    }
    sun.intensity*=preset.direct;
    this.stormLight=this.mode==='storm'&&!this.reducedMotion&&outdoors?sun:undefined;
    this.stormBase=sun.intensity;
    ambient.color.lerp(this.tint,.22);
    if(place==='home')ambient.intensity*=1.06;
  }

  frame(seconds:number, target:THREE.Vector3, dpr:number) {
    if(this.stormLight){
      const flash=Math.max(0,1-Math.abs((seconds%19)-13)*1.2);
      this.stormLight.intensity=this.stormBase*(1+flash*flash*.78);
    }
    if(!this.particles?.batch.parent)return;
    const {uniforms}=this.particles;
    uniforms.center.value.set(target.x,target.z);
    uniforms.seconds.value=seconds;
    uniforms.dpr.value=dpr;
  }
}
