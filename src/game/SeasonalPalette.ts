import * as THREE from 'three';
import type {weatherAt} from '../shared/weather';
const season={value:0},snow={value:0},wet={value:0};
export function applySeason(w:ReturnType<typeof weatherAt>){
 season.value=w.season==='spring'?0:w.season==='summer'?1:w.season==='autumn'?2:3;
 snow.value=w.snow;wet.value=w.kind==='rain'||w.kind==='storm'?1:0;
}
/** One uniform-only material extension. No new meshes, textures, shadow passes
 * or per-frame traversal. Preserve timber, paving and indoor materials. */
export function seasonalMaterial<T extends THREE.Material>(material:T,kind:'ground'|'plants'|'grass'):T{
 const previous=material.onBeforeCompile.bind(material);
 material.onBeforeCompile=(shader,renderer)=>{
  previous(shader,renderer);
  shader.uniforms.seasonIndex=season;shader.uniforms.snowCover=snow;shader.uniforms.seasonWet=wet;
  shader.fragmentShader='uniform float seasonIndex, snowCover, seasonWet;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
  vec3 base=diffuseColor.rgb;
  float green=smoothstep(-0.04,0.07,base.g-base.r)*smoothstep(-0.03,0.06,base.g-base.b);
  float mask=${kind==='ground'?'max(green,0.32)':'green'};
  if(seasonIndex>1.5 && seasonIndex<2.5)base=mix(base,vec3(base.g*1.22,base.g*.73,base.b*.58),mask*.82);
  if(seasonIndex>2.5)base=mix(base,vec3(dot(base,vec3(.30,.59,.11))),mask*.50);
  base=mix(base,vec3(.76,.83,.89),snowCover*${kind==='ground'?'mask*.92':'mask*.63'});
  base*=1.0-seasonWet*${kind==='ground'?'.15':'.045'};
  diffuseColor.rgb=base;`);
 };
 material.customProgramCacheKey=()=> 'simlife-season-v1:'+kind;
 return material;
}