import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {weatherAt} from '../../src/shared/weather';
import {clockAt} from '../../src/shared/life';
import {WeatherArt} from '../../src/game/WeatherArt';
import {seasonalMaterial,applySeason} from '../../src/game/SeasonalPalette';

test('same game clock yields the same forecast, stable fronts and plausible seasonal ranges',()=>{
 const seen=new Map<string,Set<string>>();
 let winterSnow=0,summerSnow=0,meanWinter=0,meanSummer=0,nWinter=0,nSummer=0;
 for(let day=1;day<=365;day++)for(let minute=0;minute<1440;minute+=360){
  const c={day,minute},w=weatherAt(c);
  assert.deepEqual(w,weatherAt(clockAt((day-1)*1440+minute)));
  assert.equal(w.kind,weatherAt({day,minute:minute+359}).kind);
  assert.ok(w.temp>=-25&&w.temp<=40&&w.snow>=0&&w.snow<=1);
  const kinds=seen.get(w.season)??new Set();kinds.add(w.kind);seen.set(w.season,kinds);
  if(w.season==='winter'){assert.equal(w.snow,1);winterSnow+=w.snow;meanWinter+=w.temp;nWinter++;}
  if(w.season==='summer'){summerSnow+=w.snow;meanSummer+=w.temp;nSummer++;}
 }
 assert.ok(seen.get('winter')!.has('snow')&&seen.get('summer')!.has('storm'));
 assert.ok(!seen.get('summer')!.has('snow')&&!seen.get('winter')!.has('storm'));
 assert.ok(winterSnow>nWinter*.35&&summerSnow===0);
 assert.ok(meanSummer/nSummer>meanWinter/nWinter+18);
});
test('live particles switch in one batch, recover clear fog and never enter shop',()=>{
 const scene=new THREE.Scene();scene.background=new THREE.Color(0xffffff);scene.fog=new THREE.Fog(0xffffff,49,75);
 const art=new WeatherArt('',false,false),sun=new THREE.DirectionalLight(),ambient=new THREE.HemisphereLight();
 art.enter(scene,'home');
 art.setWeather('rain',scene,'home');const rain=scene.children[0];assert.equal(scene.children.length,1);
 art.setWeather('snow',scene,'home');assert.ok(scene.children[0] instanceof THREE.Points);assert.equal(scene.children.length,1);
 art.setWeather('rain',scene,'home');assert.equal(scene.children[0],rain);
 art.setWeather('fog',scene,'home');art.light(scene,'home',sun,ambient);assert.equal(scene.children.length,0);assert.ok(scene.fog.far>=185);
 art.setWeather('clear',scene,'home');art.light(scene,'home',sun,ambient);assert.equal(scene.fog.near,125);assert.equal(scene.fog.far,185);
 art.setWeather('storm',scene,'home');art.enter(scene,'cafe');assert.equal(scene.children.length,0);
 const before=sun.intensity;art.light(scene,'cafe',sun,ambient);assert.equal(sun.intensity,before);
});
test('seasonal materials share uniforms and preserve existing shader hooks',()=>{
 const material=new THREE.MeshLambertMaterial();let previous=false;
 material.onBeforeCompile=()=>{previous=true;};
 seasonalMaterial(material,'plants');
 const shader={uniforms:{},vertexShader:'',fragmentShader:'#include <color_fragment>'} as any;
 material.onBeforeCompile(shader,null as any);
 assert.ok(previous);assert.ok(shader.fragmentShader.includes('snowCover'));
 applySeason({...weatherAt({day:300,minute:0}),season:'winter',snow:.7});
 assert.equal(shader.uniforms.seasonIndex.value,3);assert.equal(shader.uniforms.snowCover.value,.7);
 applySeason(weatherAt({day:10,minute:0}));assert.equal(shader.uniforms.seasonIndex.value,1);
 const lawn=seasonalMaterial(new THREE.MeshStandardMaterial(),'lawn');
 const turf={uniforms:{},vertexShader:'',fragmentShader:'#include <color_fragment>'} as any;
 lawn.onBeforeCompile(turf,null as any);
 assert.ok(turf.fragmentShader.includes('float mask=1.0;')&&turf.fragmentShader.includes('snowCover*(.89+.08*patches)'));
});
test('forecast cache is isolated from mutable clocks and returned values',()=>{
 const clock={day:10,minute:360},first=weatherAt(clock),expected={...first};
 first.snow=999;first.temp=999;assert.deepEqual(weatherAt(clock),expected);
 clock.minute=721;assert.deepEqual(weatherAt(clock),weatherAt({day:10,minute:721}));
 clock.day=28;assert.equal(weatherAt(clock).season,'winter');assert.equal(weatherAt(clock).snow,1);
 clock.day=10;clock.minute=360;assert.deepEqual(weatherAt(clock),expected);
});
