import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AUDIO_BANK} from '../../src/game/AudioBank';
import {audioSpatial,audioWallCount,insideHome,conversationCueTimes} from '../../src/game/AudioSpace';
import {mediaSound,activitySound} from '../../src/game/GameAudio';
test('every local audio asset has a valid mono PCM header and non-silent samples',()=>{
 let bytes=0,count=0;
 for(const names of Object.values(AUDIO_BANK))for(const name of names){const b=readFileSync(new URL('../../public/audio/v2/'+name,import.meta.url));assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WAVE');assert.equal(b.readUInt16LE(22),1);assert.equal(b.readUInt32LE(24),24000);assert.equal(b.readUInt16LE(34),16);assert.ok(b.length>1000&&b.length<2000000);let peak=0;for(let i=44;i+1<b.length;i+=2)peak=Math.max(peak,Math.abs(b.readInt16LE(i)));assert.ok(peak>400&&peak<32767,name);bytes+=b.length;count++;}
 assert.ok(count>=70);assert.ok(bytes<25*1024*1024);
 for(const key of ['voiceVlad','voiceAlina','door','dish','meow','laughVlad'] as const)assert.ok(AUDIO_BANK[key].length>=2,key);
});
test('wall occlusion respects open bedroom doorway, wing and camera orientation',()=>{
 const source={x:-6,z:-5},listener={x:-2,z:-5};assert.ok(audioWallCount(listener,source,'home')>=1);assert.equal(audioWallCount(listener,source,'park'),0);
 assert.equal(audioWallCount({x:-2,z:-3.6},{x:-6,z:-3.6},'home'),0);
 const closed=audioSpatial(listener,source,'home'),open=audioSpatial(listener,source,'park');assert.ok(closed.gain<open.gain&&closed.cutoff<open.cutoff);assert.equal(insideHome({x:13,z:-4}),true);assert.equal(insideHome({x:18,z:-4}),false);
 assert.equal(audioSpatial({x:0,z:0},{x:0,z:4},'park',{x:0,z:1}).pan,.8);assert.ok(audioSpatial(listener,source,'park',{x:1,z:0},8).gain>open.gain);
});
test('real action types and distinct console audio are routed correctly',()=>{
 assert.equal(mediaSound('ufc6'),'mediaFight');assert.equal(mediaSound('forza6'),'mediaRace');assert.equal(mediaSound('broadcast'),'mediaTalk');assert.equal(activitySound('teeth','idle')?.loop,true);assert.equal(activitySound('shower','idle')?.sound,'shower');assert.equal(activitySound('coffee','idle')?.sound,'drink');
 for(let i=0;i<5;i++){assert.equal(conversationCueTimes(true,i*8+.8)[0],i*8+.42);assert.equal(conversationCueTimes(false,i*8+4)[0],i*8+3.72);}
});
