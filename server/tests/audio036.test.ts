import assert from 'node:assert/strict';
import test from 'node:test';
import {AUDIO_DEFAULTS,readAudioSettings,clampVolume,ambientFor,spatialGain,activitySound} from '../../src/game/GameAudio';
test('audio settings default and corrupted storage are safe',()=>{assert.deepEqual(readAudioSettings(null),AUDIO_DEFAULTS);assert.deepEqual(readAudioSettings('broken'),AUDIO_DEFAULTS);assert.deepEqual(readAudioSettings('{"master":0,"music":2,"ui":-1,"pets":"x"}'),{...AUDIO_DEFAULTS,master:0,music:1,ui:0});assert.equal(clampVolume(NaN,.5),.5);});
test('sound fades with distance, never louder than near listener',()=>{assert.equal(spatialGain(0),1);assert.equal(spatialGain(4),.5);assert.ok(spatialGain(12)<spatialGain(8));});
test('ambience follows indoor/outdoor scene',()=>{assert.equal(ambientFor('home',false),'room');assert.equal(ambientFor('home',true),'wind');assert.equal(ambientFor('park',false),'wind');assert.equal(ambientFor('district',false),'street');assert.equal(ambientFor('petshop',false),'cafe');});
test('continuous and intermittent actions have distinct cues',()=>{assert.deepEqual(activitySound('shower','idle'),{sound:'water',interval:0,loop:true});assert.equal(activitySound('cook','idle')?.sound,'cook');assert.equal(activitySound('eat','sit')?.sound,'eat');assert.equal(activitySound(null,'work')?.sound,'keyboard');assert.equal(activitySound('music','sit')?.sound,'music');assert.equal(activitySound(null,'sleep'),undefined);});

import {mediaSound,MEDIA_DEVICE_GAIN,petPlaybackRate} from '../../src/game/GameAudio';
test('media follows program genre and device output',()=>{assert.equal(mediaSound('horror'),'mediaSuspense');assert.equal(mediaSound('concert'),'music');assert.notEqual(mediaSound('comedy'),mediaSound('racing'));assert.ok(MEDIA_DEVICE_GAIN.laptop<MEDIA_DEVICE_GAIN.desktop);assert.ok(MEDIA_DEVICE_GAIN.stereo>MEDIA_DEVICE_GAIN.smartSpeaker);});
test('pet recordings use short high-pitched variation',()=>{assert.ok(petPlaybackRate('meow',0)>petPlaybackRate('bark',0));assert.ok(petPlaybackRate('meow',1)>petPlaybackRate('meow',0));});

import {crossedCue,speakingTurn} from '../../src/game/GameAudio';
test('animation cue fires once at the contact, never after a long jump',()=>{assert.equal(crossedCue(.95,1.03,1),true);assert.equal(crossedCue(1.03,1.12,1),false);assert.equal(crossedCue(.1,4,1),false);});
test('conversation windows alternate without concurrent speaking starts',()=>{for(let t=0;t<24;t+=.05)assert.equal(speakingTurn(true,t)&&speakingTurn(false,t),false);assert.equal(speakingTurn(true,.7),true);assert.equal(speakingTurn(false,4),true);});
