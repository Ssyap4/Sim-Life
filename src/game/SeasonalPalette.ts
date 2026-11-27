import * as THREE from 'three';
import type {weatherAt} from '../shared/weather';
const season={value:0},snow={value:0},wet={value:0};
export type SeasonalSurface='ground'|'lawn'|'plants'|'grass'|'paving';
export function applySeason(w:ReturnType<typeof weatherAt>,visualKind=w.kind){
 season.value=w.season==='spring'?0:w.season==='summer'?1:w.season==='autumn'?2:3;
 snow.value=visualKind==='snow'?Math.max(.75,w.snow):w.snow;
 wet.value=visualKind==='rain'||visualKind==='storm'?1:0;
}
/** Outdoor-only palette and wet roughness, shared uniforms; no extra draw pass. */
export function seasonalMaterial<T extends THREE.Material>(material:T,kind:SeasonalSurface):T{
 const previous=material.onBeforeCompile.bind(material);
 material.onBeforeCompile=(shader,renderer)=>{
  previous(shader,renderer);
  shader.uniforms.seasonIndex=season;shader.uniforms.snowCover=snow;shader.uniforms.seasonWet=wet;
  const ground=kind==='ground'||kind==='lawn'||kind==='paving';
  if(ground){
   shader.vertexShader='varying vec2 seasonalXZ;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nseasonalXZ=(modelMatrix*vec4(position,1.)).xz;');
  }
  shader.fragmentShader='uniform float seasonIndex, snowCover, seasonWet;\n'+(ground?'varying vec2 seasonalXZ;\n':'')+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
  vec3 base=diffuseColor.rgb;
  float green=smoothstep(-0.04,0.07,base.g-base.r)*smoothstep(-0.03,0.06,base.g-base.b);
  float mask=${kind==='lawn'?'1.0':kind==='ground'?'max(green,0.32)':kind==='paving'?'0.0':'green'};
  if(seasonIndex>1.5 && seasonIndex<2.5)base=mix(base,vec3(base.g*1.22,base.g*.73,base.b*.58),mask*.82);
  if(seasonIndex>2.5)base=mix(base,vec3(dot(base,vec3(.30,.59,.11))),mask*.50);
  ${ground?'float patches=.5+.5*sin(seasonalXZ.x*2.7+sin(seasonalXZ.y*1.8))*sin(seasonalXZ.y*3.1+seasonalXZ.x*.9);':'float patches=.5;'}
  base=mix(base,vec3(.76,.83,.89),snowCover*${kind==='lawn'?'(.89+.08*patches)':kind==='ground'?'mask*(.81+.11*patches)':kind==='paving'?'(.07+.22*smoothstep(.57,.98,patches))':'mask*.63'});
  base*=1.0-seasonWet*${kind==='paving'?'(.13+.15*patches)':kind==='ground'||kind==='lawn'?'.17':'.045'};
  diffuseColor.rgb=base;`);
  if(ground&&material instanceof THREE.MeshStandardMaterial)shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
  roughnessFactor=mix(roughnessFactor,${kind==='paving'?'.31':'.70'},seasonWet*(.55+.45*patches));`);
 };
 material.customProgramCacheKey=()=> 'simlife-season-v2:'+kind;
 return material;
}
