import assert from 'node:assert/strict';
import test from 'node:test';
import {AUDIO_DEFAULTS,readAudioSettings,clampVolume,ambientFor,spatialGain,activitySound} from '../../src/game/GameAudio';
test('audio settings default and corrupted storage are safe',()=>{assert.deepEqual(readAudioSettings(null),AUDIO_DEFAULTS);assert.deepEqual(readAudioSettings('broken'),AUDIO_DEFAULTS);assert.deepEqual(readAudioSettings('{"master":0,"music":2,"ui":-1,"pets":"x"}'),{...AUDIO_DEFAULTS,master:0,music:1,ui:0});assert.equal(clampVolume(NaN,.5),.5);});
test('sound fades with distance, never louder than near listener',()=>{assert.equal(spatialGain(0),1);assert.equal(spatialGain(4),.5);assert.ok(spatialGain(12)<spatialGain(8));});
test('ambience follows indoor/outdoor scene',()=>{assert.equal(ambientFor('home',false),'room');assert.equal(ambientFor('home',true),'wind');assert.equal(ambientFor('park',false),'wind');assert.equal(ambientFor('district',false),'street');assert.equal(ambientFor('petshop',false),'cafe');});
test('continuous and intermittent actions have distinct cues',()=>{assert.deepEqual(activitySound('shower','idle'),{sound:'water',interval:0,loop:true});assert.equal(activitySound('cook','idle')?.sound,'cook');assert.equal(activitySound('eat','sit')?.sound,'eat');assert.equal(activitySound(null,'work')?.sound,'keyboard');assert.equal(activitySound('music','sit')?.sound,'music');assert.equal(activitySound(null,'sleep'),undefined);});

import {mediaSound,MEDIA_DEVICE_GAIN,petPlaybackRate} from '../../src/game/GameAudio';
test('media follows program genre and device output',()=>{assert.equal(mediaSound('horror'),'mediaSuspense');assert.equal(mediaSound('concert'),'scoreDance');assert.notEqual(mediaSound('comedy'),mediaSound('racing'));assert.ok(MEDIA_DEVICE_GAIN.laptop<MEDIA_DEVICE_GAIN.desktop);assert.ok(MEDIA_DEVICE_GAIN.stereo>MEDIA_DEVICE_GAIN.smartSpeaker);});
test('pet recordings use short high-pitched variation',()=>{assert.ok(petPlaybackRate('meow',0)>petPlaybackRate('bark',0));assert.ok(petPlaybackRate('meow',1)>petPlaybackRate('meow',0));});

import {crossedCue,speakingTurn} from '../../src/game/GameAudio';
test('animation cue fires once at the contact, never after a long jump',()=>{assert.equal(crossedCue(.95,1.03,1),true);assert.equal(crossedCue(1.03,1.12,1),false);assert.equal(crossedCue(.1,4,1),false);});
test('conversation windows alternate without concurrent speaking starts',()=>{for(let t=0;t<24;t+=.05)assert.equal(speakingTurn(true,t)&&speakingTurn(false,t),false);assert.equal(speakingTurn(true,.7),true);assert.equal(speakingTurn(false,4),true);});

import {musicFor,scoreSample,GameAudio} from '../../src/game/GameAudio';
test('original scores select context and contain distinct finite samples',()=>{assert.equal(musicFor('home',false),'scoreMorning');assert.equal(musicFor('home',true),'scoreEvening');assert.equal(musicFor('park',false),'scorePark');assert.equal(musicFor('market',false),undefined);assert.notEqual(scoreSample('scoreMorning',.53),scoreSample('scorePark',.53));for(const name of ['scoreMorning','scoreEvening','scorePark','scoreDance'] as const)for(let t=0;t<16;t+=.031)assert.ok(Number.isFinite(scoreSample(name,t)));assert.equal(readAudioSettings('{"music":0}').voices,AUDIO_DEFAULTS.voices);});

test('mixer stops cancelled action, scene change, pause and sign-out for independent clients',async()=>{
 const sources:{stopped:boolean;loop:boolean;stop:()=>void}[]=[];
 const param=()=>({value:0,setTargetAtTime(){}});
 class Context {
  state='running';currentTime=0;
  destination={};
  createGain(){return {gain:param(),connect(target:unknown){return target},disconnect(){}};}
  createBuffer(_channels:number,length:number,rate:number){const data=new Float32Array(length);return {length,sampleRate:rate,duration:length/rate,getChannelData(){return data;}};}
  createBufferSource(){const source={stopped:false,loop:false,playbackRate:param(),buffer:null,onended:null,connect(target:unknown){return target;},disconnect(){},start(){},stop(){this.stopped=true;}};sources.push(source);return source;}
  createStereoPanner(){return {pan:param(),connect(target:unknown){return target;},disconnect(){}};}
 }
 const original=Object.getOwnPropertyDescriptor(globalThis,'window');
 Object.defineProperty(globalThis,'window',{configurable:true,value:{AudioContext:Context}});
 try{
  const a=new GameAudio(),b=new GameAudio();a.setPlaying(true);b.setPlaying(true);a.setVolume('music',0);b.setVolume('music',0);
  await a.unlock();await b.unlock();
  assert.equal(a.beginFrame('home',{x:0,z:0},false,false),true);
  a.loop('shower','water','effects',.3,{x:0,z:0});a.beat('speech','voiceVlad','voices',8,.3);a.endFrame();
  const ambient=sources[0],shower=sources[1],speech=sources[2];
  assert.equal(shower.stopped,false);assert.equal(speech.stopped,false);
  b.beginFrame('home',{x:0,z:0},false,false);b.loop('tv','mediaCozy','effects',.3);b.endFrame();const other=sources.at(-1)!;
  a.beginFrame('home',{x:0,z:0},false,false);a.endFrame();assert.equal(shower.stopped,true);assert.equal(speech.stopped,true);assert.equal(ambient.stopped,false);assert.equal(other.stopped,false);
  a.beginFrame('park',{x:0,z:0},false,false);a.endFrame();assert.equal(ambient.stopped,true);
  a.setPaused(true);assert.equal(a.beginFrame('park',{x:0,z:0},false,false),false);assert.equal(other.stopped,false);
  b.setPlaying(false);assert.equal(other.stopped,true);assert.equal(b.beginFrame('home',{x:0,z:0},false,false),false);
 }finally{if(original)Object.defineProperty(globalThis,'window',original);else Reflect.deleteProperty(globalThis,'window');}
});
