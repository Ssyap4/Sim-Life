import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {WeatherArt} from '../../src/game/WeatherArt';

test('one precipitation batch follows outdoor scenes and leaves interiors clear',()=>{
  const home=new THREE.Scene(),park=new THREE.Scene(),shop=new THREE.Scene();
  for(const mode of ['rain','snow','storm']){
    const weather=new WeatherArt('?weather='+mode,false,false);
    weather.enter(home,'home');
    assert.equal(home.children.length,1);
    const batch=home.children[0] as THREE.Points | THREE.LineSegments;
    assert.ok(batch instanceof (mode==='snow'?THREE.Points:THREE.LineSegments));
    assert.ok(batch.geometry.getAttribute('position').count<=576);
    weather.enter(park,'park');
    weather.frame(3,new THREE.Vector3(2,0,6),2);
    assert.equal(home.children.length,0);
    assert.equal(park.children[0],batch);
    weather.enter(shop,'cafe');
    assert.equal(park.children.length+shop.children.length,0);
  }
});

test('clear, reduced motion and recovery mode allocate no visible particle batch',()=>{
  for(const [query,reduced,safe] of [
    ['',false,false],['?weather=fog',false,false],['?weather=unknown',false,false],
    ['?weather=storm',true,false],['?weather=snow',false,true],
  ] as const){
    const weather=new WeatherArt(query,reduced,safe),scene=new THREE.Scene();
    weather.enter(scene,'district');
    weather.frame(13,new THREE.Vector3(),2);
    assert.equal(scene.children.length,0);
  }
});

test('distance fog affects outdoor views and keeps the shop interior depth range',()=>{
  const weather=new WeatherArt('?weather=fog',false,false);
  for(const place of ['district','cafe'] as const){
    const scene=new THREE.Scene();
    scene.fog=new THREE.Fog(0xffffff,49,75);scene.background=new THREE.Color(0xffffff);
    weather.light(scene,place,new THREE.DirectionalLight(),new THREE.HemisphereLight());
    assert.equal(scene.fog.far,place==='district'?33:75);
  }
});
