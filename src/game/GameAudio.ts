// Procedural sounds plus local CC0 recordings; no third-party requests at runtime.
import {AUDIO_BANK} from './AudioBank';
import {audioSpatial} from './AudioSpace';
import {isSpeakerTrack,type SpeakerTrackId} from '../shared/speakerCatalog';
export type AudioChannel = 'master'|'ambient'|'effects'|'pets'|'ui'|'music'|'voices';
export const AUDIO_DEFAULTS:Record<AudioChannel,number>={master:.75,ambient:.42,effects:.65,pets:.65,ui:.38,music:.32,voices:.68};
export const AUDIO_LABELS:Record<AudioChannel,string>={master:'Общая громкость',ambient:'Окружение',effects:'Действия и предметы',pets:'Питомцы',ui:'Интерфейс',music:'Музыка',voices:'Голоса персонажей'};
type Point={x:number;z:number};
type Bus=Exclude<AudioChannel,'master'>;
export type Sound=SpeakerTrackId|'stepWood'|'stepGrass'|'stepTile'|'paw'|'click'|'confirm'|'error'|'door'|'flush'|'water'|'cook'|'eat'|'keyboard'|'paper'|'dish'|'squeak'|'spring'|'scratch'|'bark'|'meow'|'purr'|'bird'|'cricket'|'wind'|'room'|'street'|'cafe'|'fire'|'ring'|'hit'|'feeder'|'music'|'mediaCozy'|'mediaDrama'|'mediaSuspense'|'mediaAction'|'mediaComedy'|'mediaTalk'|'mediaTech'|'voiceVlad'|'voiceAlina'|'laughVlad'|'laughAlina'|'clap'|'kiss'|'cloth'|'toothbrush'|'swing'|'bounce'|'scoreMorning'|'scoreEvening'|'scorePark'|'scoreDance'|'shower'|'drink'|'rain'|'thunder'|'vacuum'|'mediaFight'|'mediaRace'|'clipper'|'crowd'|'engine';
type Spec={length:number;noise?:number;freq?:number;end?:number;harmonics?:number;filter?:number;pulses?:number;loop?:boolean};
const specs:Record<Exclude<Sound,SpeakerTrackId>,Spec>={
 clipper:{length:1.6,noise:.18,freq:118,harmonics:.85,loop:true},crowd:{length:4,noise:.35,filter:.18,loop:true},engine:{length:1.4,freq:84,end:165,noise:.18,harmonics:.6},
 shower:{length:2,noise:.85,filter:.43,loop:true},drink:{length:.52,noise:.4,filter:.24,pulses:2},rain:{length:4,noise:.85,filter:.38,loop:true},thunder:{length:2.4,noise:.8,filter:.025},vacuum:{length:2.5,noise:.42,freq:180,filter:.25,loop:true},mediaFight:{length:8,loop:true},mediaRace:{length:8,loop:true},
 stepWood:{length:.19,noise:.7,freq:95,end:45,filter:.2},stepGrass:{length:.22,noise:.9,filter:.48,pulses:2},stepTile:{length:.14,noise:.55,freq:250,end:90,filter:.7},paw:{length:.085,noise:.75,filter:.48},
 click:{length:.065,freq:640,end:410,noise:.16},confirm:{length:.26,freq:620,end:950,harmonics:.2},error:{length:.16,freq:260,end:155},door:{length:.37,noise:.65,freq:105,end:45,filter:.24,pulses:2},
 flush:{length:2,noise:1,filter:.23,pulses:1},water:{length:2,noise:1,filter:.55,loop:true},cook:{length:1.6,noise:.94,filter:.73,loop:true},eat:{length:.19,noise:.85,filter:.35,pulses:2},
 keyboard:{length:.065,noise:.45,filter:.42,pulses:2},paper:{length:.32,noise:.9,filter:.62,pulses:3},dish:{length:.25,freq:1060,end:990,harmonics:.45,noise:.12},
 squeak:{length:.22,freq:990,end:540,harmonics:.4,pulses:2},spring:{length:.28,freq:420,end:970,harmonics:.35,pulses:3},scratch:{length:.32,noise:1,filter:.65,pulses:4},
 bark:{length:.29,freq:380,end:155,harmonics:.9,noise:.45,pulses:1},meow:{length:.65,freq:460,end:290,harmonics:.62,noise:.035},purr:{length:1.4,freq:29,end:29,harmonics:.5,noise:.22,loop:true},
 bird:{length:.52,freq:2350,end:3700,pulses:3},cricket:{length:.36,freq:4100,end:4300,pulses:5},
 wind:{length:3.1,noise:1,filter:.025,loop:true},room:{length:2.3,noise:.3,filter:.025,loop:true},street:{length:3.3,noise:.75,filter:.035,loop:true},cafe:{length:3.1,noise:.75,filter:.085,loop:true},fire:{length:2.2,noise:1,filter:.47,loop:true},ring:{length:.65,freq:880,end:660,pulses:3},hit:{length:.075,noise:.6,freq:740,end:180},feeder:{length:.72,noise:.8,freq:180,end:85,pulses:8,filter:.52},music:{length:8,loop:true},mediaCozy:{length:16,loop:true},mediaDrama:{length:16,loop:true},mediaSuspense:{length:16,loop:true},mediaAction:{length:8,loop:true},mediaComedy:{length:8,loop:true},mediaTalk:{length:12,loop:true},mediaTech:{length:8,loop:true},voiceVlad:{length:1.7},voiceAlina:{length:1.65},laughVlad:{length:1.15},laughAlina:{length:1.1},clap:{length:.16,noise:.95,filter:.55},kiss:{length:.17,noise:.7,filter:.5,freq:290,end:100},cloth:{length:.35,noise:.85,filter:.18},toothbrush:{length:.35,noise:1,filter:.7,pulses:5},swing:{length:.4,noise:.55,filter:.22,freq:370,end:320},bounce:{length:.085,noise:.3,freq:970,end:420},scoreMorning:{length:24,loop:true},scoreEvening:{length:24,loop:true},scorePark:{length:24,loop:true},scoreDance:{length:16,loop:true}
};
export type MediaDevice='tv'|'desktop'|'laptop'|'smartSpeaker'|'stereo';
export const MEDIA_DEVICE_GAIN:Record<MediaDevice,number>={tv:.24,desktop:.16,laptop:.11,smartSpeaker:.34,stereo:.45};
export function musicFor(place:string,night:boolean):Sound|undefined{return place==='home'?(night?'scoreEvening':'scoreMorning'):place==='park'?'scorePark':undefined;}
const scores={
 scoreMorning:{beat:.75,roots:[48,55,45,53,48,55,53,55],melody:[72,76,79,76,74,77,79,74,69,72,76,72,69,72,77,72,72,76,79,84,83,79,77,74,77,76,72,69,74,77,79,74]},
 scoreEvening:{beat:.75,roots:[45,53,48,55,45,53,48,52],melody:[69,72,76,72,69,72,77,72,67,72,76,74,67,71,74,71,69,72,76,81,77,76,72,69,67,72,76,72,68,71,76,71]},
 scorePark:{beat:.75,roots:[55,50,52,48,55,50,48,50],melody:[74,79,83,79,74,78,81,78,76,79,83,79,72,76,79,76,74,79,81,83,81,78,74,78,76,79,84,79,74,78,81,78]},
 scoreDance:{beat:.5,roots:[48,45,53,55,48,45,53,55],melody:[72,76,79,76,69,72,76,72,77,81,84,81,74,79,83,79,72,79,76,79,69,76,72,76,77,84,81,84,74,83,79,83]}
} as const;
const hz=(midi:number)=>440*2**((midi-69)/12);
export function scoreSample(sound:keyof typeof scores,t:number):number{
 const s=scores[sound],step=Math.floor(t/s.beat),part=t/s.beat-step,root=s.roots[Math.floor(step/4)%8],f=hz(s.melody[step%32]),age=part*s.beat;
 const pluck=Math.min(1,age/.018)*Math.exp(-age*3.5);
 const chordAge=(t%(s.beat*4)),chordEnv=Math.min(1,chordAge/.08)*Math.min(1,(s.beat*4-chordAge)/.12);
 const note=(freq:number,sec:number)=>Math.sin(2*Math.PI*freq*sec)+.22*Math.sin(4*Math.PI*freq*sec)+.09*Math.sin(6*Math.PI*freq*sec);
 return .29*pluck*note(f,age)+.14*chordEnv*note(hz(root),chordAge)+.09*chordEnv*note(hz(root+7),chordAge)+(sound==='scoreDance'?.12*Math.sin(2*Math.PI*65*age)*Math.exp(-age*13):0);
}
export function mediaSound(content:string):Sound{
 if(['ufc6','mk1','smash','switchSports'].includes(content))return 'mediaFight';
 if(['forza6','marioKart'].includes(content))return 'mediaRace';
 if(content==='concert'||content==='music')return 'scoreDance';
 if(['horror','thriller','crime'].includes(content))return 'mediaSuspense';
 if(['drama','romance'].includes(content))return 'mediaDrama';
 if(['action','racing','strategy'].includes(content))return 'mediaAction';
 if(content==='comedy')return 'mediaComedy';
 if(['broadcast','lesson','vlog','cooking'].includes(content))return 'mediaTalk';
 if(content==='tech')return 'mediaTech';
 return 'mediaCozy';
}
export function petPlaybackRate(sound:Sound,random:number):number{return sound==='meow'?1.20+random*.16:sound==='bark'?1.04+random*.13:.93+random*.14;}
export function crossedCue(previous:number,current:number,at:number):boolean{return current>=at&&previous<at&&current-previous<=.4;}
export function speakingTurn(leads:boolean,time:number):boolean{const phase=time%8;return leads?phase>=.35&&phase<1.55:phase>=3.65&&phase<6.15;}
export function clampVolume(v:unknown,fallback:number):number{return typeof v==='number'&&Number.isFinite(v)?Math.min(1,Math.max(0,v)):fallback;}
export function readAudioSettings(raw:string|null):Record<AudioChannel,number>{
 try{const value=JSON.parse(raw??'null');return Object.fromEntries(Object.entries(AUDIO_DEFAULTS).map(([k,v])=>[k,clampVolume(value?.[k],v)])) as Record<AudioChannel,number>;}catch{return {...AUDIO_DEFAULTS};}
}
export function spatialGain(distance:number):number{return 1/(1+(Math.max(0,distance)/4)**2);}
export function ambientFor(place:string,outside:boolean):Sound{return place==='park'||(place==='home'&&outside)?'wind':place==='district'||place==='industrial'?'street':place==='cafe'||['market','clothing','petshop','electronics'].includes(place)?'cafe':'room';}
export function activitySound(activity:string|null,pose:string):{sound:Sound;interval:number;loop?:boolean}|undefined{
 if(activity==='shower')return {sound:'shower',interval:0,loop:true};
 if(activity&&['wash','washHands','bath','dishes'].includes(activity))return {sound:'water',interval:0,loop:true};
 if(activity&&['cook','grill','prep'].includes(activity))return {sound:'cook',interval:0,loop:true};
 if(activity==='teeth')return {sound:'toothbrush',interval:0,loop:true};
 if(activity==='eat')return {sound:'eat',interval:1.4};
 if(activity==='music')return {sound:'music',interval:0,loop:true};
 if(activity==='coffee'||activity==='tea')return {sound:'drink',interval:5};
 if(activity&&['read','journal','tidy'].includes(activity))return {sound:'paper',interval:2.6};
 if(activity==='toilet')return {sound:'flush',interval:1000};
 if(pose==='work'&&activity!=='games')return {sound:'keyboard',interval:1.15};
 return undefined;
}
const storageKey='simlife.audio.v1';
function initial(){try{return readAudioSettings(localStorage.getItem(storageKey));}catch{return {...AUDIO_DEFAULTS};}}
type Voice={source:AudioBufferSourceNode;gain:GainNode;pan?:StereoPannerNode;filter?:BiquadFilterNode;sound:Sound;bus:Bus;recorded:boolean;volume:number;point?:Point;range:number};
type AudioWeather={kind:string;season:string;wind:number};
const bank=AUDIO_BANK as Partial<Record<Sound,readonly string[]>>;
export class GameAudio {
 private context:AudioContext|undefined;
 private master:GainNode|undefined;
 private buses=new Map<Bus,GainNode>();
 private buffers=new Map<Sound,AudioBuffer>();
 private loading=false;
 private recordings=new Map<Sound,AudioBuffer[]>();
 private recordingLoads=new Map<Sound,Promise<void>>();
 private recordingFailed=new Set<Sound>();
 private lastVariant=new Map<Sound,number>();
 private right:Point={x:1,z:0};
 private nextThunder=0;
 private previewSerial=0;
 private previewVoice?:Voice;
 private trackLoads=new Set<SpeakerTrackId>();
 private failedTracks=new Set<SpeakerTrackId>();
 private speaking=false;
 private loops=new Map<string,Voice>();
 private voices=new Set<Voice>();
 private beats=new Map<string,{sound:Sound;next:number}>();
 private values=initial();
 private playing=false;
 private paused=false;
 private hidden=false;
 private scene='';
 private background:Sound|undefined;
 private keyedVoices=new Map<string,Set<Voice>>();
 private listener:Point={x:0,z:0};
 private sceneKeys=new Set<string>();
 private lastUI=0;
 private cueTimes=new Map<string,number>();
 get settings(){return {...this.values};}
 setVolume(key:AudioChannel,value:number){this.values[key]=clampVolume(value,AUDIO_DEFAULTS[key]);if(key==='master'&&this.values[key]===0)this.clearScene();try{localStorage.setItem(storageKey,JSON.stringify(this.values));}catch{}this.mix();}
 private mix(){const c=this.context;if(!c||!this.master)return;this.master.gain.setTargetAtTime(this.hidden?0:this.values.master,c.currentTime,.035);for(const [key,node] of this.buses)node.gain.setTargetAtTime(key==='ui'||(!this.paused&&this.playing)?this.values[key]:0,c.currentTime,.045);}
 install(root:HTMLElement){
  const unlock=()=>{void this.unlock();};root.addEventListener('pointerdown',unlock,{capture:true});root.addEventListener('touchend',unlock,{capture:true,passive:true});root.addEventListener('keydown',unlock,{capture:true});
  root.addEventListener('click',event=>{const target=event.target;if(target instanceof Element&&target.closest('button:not(:disabled)')&&!target.closest('[data-audio-setting]')){const now=performance.now();if(now-this.lastUI>85){this.lastUI=now;this.play('click','ui',.18);}}},{capture:true});
  document.addEventListener('visibilitychange',()=>{this.hidden=document.hidden;this.mix();if(this.hidden){this.clearScene();void this.context?.suspend().catch(()=>{});}else{void this.context?.resume().catch(()=>{});}});
 }
 async unlock(){if(this.hidden)return;try{if(!this.context){const C=window.AudioContext??(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;if(!C)return;const c=this.context=new C();this.master=c.createGain();this.master.gain.value=0;if(typeof c.createDynamicsCompressor==='function'){const limiter=c.createDynamicsCompressor();limiter.threshold.value=-16;limiter.knee.value=12;limiter.ratio.value=3;limiter.attack.value=.008;limiter.release.value=.24;this.master.connect(limiter).connect(c.destination);}else this.master.connect(c.destination);for(const key of ['ambient','effects','pets','ui','music','voices'] as const){const g=c.createGain();g.gain.value=0;g.connect(this.master);this.buses.set(key,g);}this.mix();}if(!this.loading){this.loading=true;void this.loadRecordings();}if(this.context.state==='suspended')await this.context.resume();}catch{/* audio must never block gameplay */}}
 setPlaying(value:boolean){if(this.playing===value)return;this.playing=value;if(!value)this.clearScene();this.mix();}
 setPaused(value:boolean){if(this.paused===value)return;this.paused=value;if(value)this.clearScene();this.mix();}
 private async loadRecordings(){for(const batch of [['click','confirm','error'],['meow','bark','room'],['voiceVlad','voiceAlina','laughVlad','laughAlina'],['door','dish','water','cook'],['shower','keyboard','purr','scoreMorning']] as Sound[][])await Promise.all(batch.map(s=>this.loadRecorded(s)));}
 private loadRecorded(sound:Sound):Promise<void>{
  const files=bank[sound],c=this.context;if(!files||!c||this.recordings.has(sound)||this.recordingFailed.has(sound))return Promise.resolve();const existing=this.recordingLoads.get(sound);if(existing)return existing;
  const task=Promise.allSettled(files.map(async file=>{const r=await fetch('/audio/v2/'+file);if(!r.ok)throw Error('Missing local sound');return c.decodeAudioData(await r.arrayBuffer());})).then(results=>{const clips=results.flatMap(r=>r.status==='fulfilled'&&r.value.duration>0?[r.value]:[]);if(clips.length)this.recordings.set(sound,clips);else this.recordingFailed.add(sound);}).finally(()=>this.recordingLoads.delete(sound));this.recordingLoads.set(sound,task);return task;
 }
 private chooseRecording(sound:Sound):AudioBuffer|undefined{const clips=this.recordings.get(sound);if(!clips?.length){void this.loadRecorded(sound);return;}const old=this.lastVariant.get(sound)??-1;const next=clips.length===1?0:(old+1+Math.floor(Math.random()*(clips.length-1)))%clips.length;this.lastVariant.set(sound,next);return clips[next];}
 private ready(bus:Bus){return !!this.context&&this.context.state==='running'&&!this.hidden&&this.values.master>0&&this.values[bus]>0&&(bus==='ui'||(this.playing&&!this.paused));}
 private buffer(sound:Sound):AudioBuffer{
  const cached=this.buffers.get(sound);if(cached)return cached;if(isSpeakerTrack(sound))throw new Error('Music not loaded');const c=this.context!,s=specs[sound],rate=22050,n=Math.ceil(rate*s.length),b=c.createBuffer(1,n,rate),data=b.getChannelData(0);
  let low=0,phase=0,mediaLow=0,seed=137+sound.charCodeAt(0)*17;
  for(let i=0;i<n;i++){const t=i/rate,u=i/n;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const white=seed/2147483648-1;low+=(white-low)*(s.filter??.3);
   const edge=s.loop?Math.min(1,t/.07,(s.length-t)/.07):Math.min(1,t/.012)*Math.pow(1-u,1.55);
   const pulse=s.pulses?Math.pow(Math.max(0,Math.sin(u*s.pulses*Math.PI)),2):1;
   const frequency=(s.freq??0)+((s.end??s.freq??0)-(s.freq??0))*u+(sound==='meow'?Math.sin(u*Math.PI)*250:0);phase+=2*Math.PI*frequency/rate;
   let tone=s.freq?Math.sin(phase)+(s.harmonics??0)*(.6*Math.sin(phase*2)+.35*Math.sin(phase*3)+.2*Math.sin(phase*5)):0;
   let noise=(s.noise??0)*(low*.85+white*.15);
   if(sound==='fire'||sound==='cook')noise*=.25+(seed%43===0?2.7:.4);
   if(sound==='wind'||sound==='street'||sound==='cafe')noise*=.65+.25*Math.sin(t*2.4);
   if(sound==='music'){const notes=[261.63,329.63,392,329.63,220,261.63,329.63,261.63,196,246.94,293.66,246.94,220,261.63,329.63,392];const beat=t*2,index=Math.min(15,Math.floor(beat)),f=notes[index],env=Math.exp(-(beat-index)*4)*Math.min(1,(beat-index)*35);tone=.18*env*(Math.sin(2*Math.PI*f*t)+.2*Math.sin(4*Math.PI*f*t));}
   if(sound in scores)tone=scoreSample(sound as keyof typeof scores,t);
   if(sound.startsWith('media')){
    // Distant programme texture: soft speech-like formants and slow ambience,
    // not the old arcade arpeggios or repeating heavy bass hits.
    const minor=sound==='mediaSuspense'||sound==='mediaDrama',fast=sound==='mediaAction'||sound==='mediaTech';
    const root=minor?146.83:174.61, phraseTime=t*(sound==='mediaComedy'?3.7:2.8),k=Math.floor(phraseTime),p=phraseTime-k;
    const f=[123,145,132,158,112,139][k%6]*(1+.055*Math.sin(p*Math.PI));phase+=2*Math.PI*f/rate;
    const env=Math.sin(Math.PI*p)**1.4*(k%9===7||k%9===8?0:1);
    const vowel=[540,390,710,460,620,350][k%6],second=[1200,1650,1050,1450,1820,980][k%6];
    let murmur=0;for(let h=2;h<=12;h++){const hz=f*h;const form=Math.exp(-(((hz-vowel)/230)**2))+.35*Math.exp(-(((hz-second)/360)**2));murmur+=Math.sin(phase*h)*form/Math.sqrt(h);}
    const speech=sound==='mediaTalk'?.29:sound==='mediaComedy'?.20:.13;
    const pad=.035*(Math.sin(2*Math.PI*root*t)+.55*Math.sin(2*Math.PI*root*(minor?1.1892:1.2599)*t))*(.5+.5*Math.sin(t*.72)**2);
    mediaLow+=(speech*env*murmur+pad-mediaLow)*.16;
    tone=mediaLow;noise=low*(.025+(fast?.035:.012)*Math.sin(t*1.7)**2);
   }
   if(sound.startsWith('voice')||sound.startsWith('laugh')){
    const female=sound.endsWith('Alina'),laugh=sound.startsWith('laugh'),base=female?235:132;
    const syllable=t*(laugh?5.2:3.3),k=Math.floor(syllable),part=syllable-k;
    const contour=[1,.86,1.24,1.04,.77,1.12],f=base*contour[k%6]*(1+.11*Math.sin(part*Math.PI));
    phase+=2*Math.PI*f/rate;
    const vowel=[650,400,830,520,350,730][k%6],vowel2=[1200,1850,1350,2100,900,1600][k%6];
    const form=(hz:number)=>Math.exp(-(((hz-vowel)/260)**2))+.55*Math.exp(-(((hz-vowel2)/440)**2));
    tone=0;for(let h=1;h<=13;h++)tone+=Math.sin(phase*h)*form(f*h)/Math.sqrt(h);
    const syllableEnv=Math.min(1,part*9)*Math.pow(Math.max(0,1-part),.65);
    tone*=.52*syllableEnv;noise=.12*white*(1-syllableEnv);
   }
   data[i]=Math.tanh((tone*.38+noise*.78)*pulse*edge);
  }this.buffers.set(sound,b);return b;
 }
 private voice(sound:Sound,bus:Bus,volume:number,position?:Point,loop=false,offset=0,range=4):Voice|undefined{
  if(['stepWood','stepGrass','stepTile','paw'].includes(sound)||!this.ready(bus)||this.voices.size>=24)return;const c=this.context!,recording=this.chooseRecording(sound);if(bank[sound]&&!recording&&!this.recordingFailed.has(sound)&&typeof c.decodeAudioData==='function')return;const source=c.createBufferSource(),gain=c.createGain();gain.gain.value=0;source.buffer=recording??this.buffer(sound);source.loop=loop;source.playbackRate.value=loop?1:sound==='meow'||sound==='bark'?petPlaybackRate(sound,Math.random()):.94+Math.random()*.12;
  let filter:BiquadFilterNode|undefined,pan:StereoPannerNode|undefined;let output:AudioNode=gain;source.connect(gain);if(position&&typeof c.createBiquadFilter==='function'){filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=15000;output.connect(filter);output=filter;}if(position&&typeof c.createStereoPanner==='function'){pan=c.createStereoPanner();output.connect(pan);output=pan;}output.connect(this.buses.get(bus)!);
  const v:Voice={source,gain,pan,filter,sound,bus,recorded:!!recording,volume,range,point:position?{...position}:undefined};this.voices.add(v);this.position(v,volume,position);source.onended=()=>{this.voices.delete(v);source.disconnect();gain.disconnect();pan?.disconnect();filter?.disconnect();};source.start(0,Math.max(0,offset)%(source.buffer?.duration||1));return v;
 }
 private position(v:Voice,volume:number,point?:Point){const c=this.context!,profile=point?audioSpatial(this.listener,point,this.scene,this.right,v.range):{gain:1,cutoff:15000,pan:0};v.volume=volume;v.point=point?{x:point.x,z:point.z}:undefined;v.gain.gain.setTargetAtTime(Math.max(0,volume)*profile.gain,c.currentTime,.055);v.filter?.frequency.setTargetAtTime(Math.min(profile.cutoff,v.sound.startsWith('media')?5700:15000),c.currentTime,.07);v.pan?.pan.setTargetAtTime(profile.pan,c.currentTime,.05);}
 play(sound:Sound,bus:Bus='effects',volume=.5,point?:Point){try{this.voice(sound,bus,volume,point);}catch{/* unavailable audio is harmless */}}
 async preview(sound:Sound,bus:Bus,volume=.72){const serial=++this.previewSerial;try{this.previewVoice?.source.stop();}catch{}await this.unlock();await this.loadRecorded(sound);if(serial!==this.previewSerial||!this.ready(bus))return;try{const v=this.voice(sound,bus,volume);this.previewVoice=v;if(v)v.source.stop(this.context!.currentTime+Math.min(3,v.source.buffer?.duration??3));}catch{}}
 media(key:string,device:MediaDevice,content:string,point:Point){const sound=mediaSound(content);this.loop('media-'+key,sound,sound==='music'||sound.startsWith('score')?'music':'effects',MEDIA_DEVICE_GAIN[device],point);}
 speakerMusic(key:string,track:SpeakerTrackId,volume:number,point:Point,offset:number,range=4){
  const id='media-speaker-'+key;this.sceneKeys.add(id);
  if(!this.ready('music')){this.stop(id);return;}
  if(!this.buffers.has(track)){
   this.stop(id);
   if(!this.trackLoads.has(track)&&!this.failedTracks.has(track)){
    this.trackLoads.add(track);const c=this.context!;
    void fetch('/audio/speakers/'+track+'.wav').then(r=>{if(!r.ok)throw Error('Music unavailable');return r.arrayBuffer();}).then(b=>c.decodeAudioData(b)).then(buffer=>{this.buffers.set(track,buffer);const active=new Set([...this.loops.values()].map(v=>v.sound));for(const name of this.buffers.keys())if(isSpeakerTrack(name)&&this.buffers.size>18&&name!==track&&!active.has(name))this.buffers.delete(name);}).catch(()=>this.failedTracks.add(track)).finally(()=>this.trackLoads.delete(track));
   }return;
  }
  this.loop(id,track,'music',volume,point,offset,range);
 }
 saySpeaker(message:string,assistant:string,volume:number,point:Point){
  if(!this.ready('voices')||!('speechSynthesis' in window))return;
  try{const synth=window.speechSynthesis,voices=synth.getVoices().filter(v=>v.localService&&v.lang.toLowerCase().startsWith('ru'));
   const preferred=voices.find(v=>/milena|katya|alena|irina|tatiana|female|юлия|ирина|милена|екатерина/i.test(v.name))??voices[0];if(!preferred)return;
   const u=new SpeechSynthesisUtterance(message);u.lang='ru-RU';u.voice=preferred;u.rate=assistant==='Siri'?.96:1;u.pitch=assistant==='Google Assistant'?.95:1.08;
   u.volume=Math.max(0,Math.min(1,volume*this.values.master*this.values.voices*audioSpatial(this.listener,point,this.scene,this.right).gain));
   if(this.speaking)synth.cancel();this.speaking=true;u.onend=u.onerror=()=>{this.speaking=false;};synth.speak(u);
  }catch{/* local voice may be unavailable */}
 }
 private stop(key:string){const v=this.loops.get(key);if(!v)return;this.loops.delete(key);try{v.gain.gain.setTargetAtTime(0,this.context!.currentTime,.025);v.source.stop(this.context!.currentTime+.12);}catch{}}
 private clearScene(){this.previewSerial++;if(this.speaking&&typeof window!=='undefined'&&'speechSynthesis' in window){window.speechSynthesis.cancel();this.speaking=false;}for(const key of this.loops.keys())this.stop(key);for(const v of this.voices)if(v.bus!=='ui'){try{v.source.stop();}catch{}}this.keyedVoices.clear();this.beats.clear();this.cueTimes.clear();this.sceneKeys.clear();this.scene='';}
 beginFrame(place:string,listener:Point,night:boolean,outside:boolean,weather?:AudioWeather,right:Point={x:1,z:0}){if(!this.playing||this.paused||this.hidden||!this.context||this.context.state!=='running'||this.values.master===0)return false;if(this.scene!==place){this.clearScene();this.scene=place;this.nextThunder=performance.now()+9000;}this.listener={x:listener.x,z:listener.z};this.right=right;this.background=musicFor(place,night);this.sceneKeys.clear();const sound=ambientFor(place,outside);const outdoor=place==='park'||place==='district'||place==='industrial'||place==='home'&&outside;this.loop('ambient',sound,'ambient',sound==='room'?.10:sound==='wind'?.16:.23);const natural=place==='park'||place==='home';const wet=weather?.kind==='rain'||weather?.kind==='storm';if(natural&&outdoor&&!wet&&weather?.season!=='winter'){if(!night)this.loop('nature','bird','ambient',.21);else if(weather?.season==='summer'||weather?.season==='spring')this.loop('nature','cricket','ambient',.17);}if(wet&&(place==='home'||outdoor)){this.loop('weather','rain','ambient',outdoor?.38:.095);if(weather?.kind==='storm'&&performance.now()>this.nextThunder){this.nextThunder=performance.now()+13000+Math.random()*19000;this.play('thunder','ambient',outdoor?.28:.12);}}return true;}
 loop(key:string,sound:Sound,bus:Bus,volume:number,point?:Point,offset=0,range=4){this.sceneKeys.add(key);if(!this.ready(bus)){this.stop(key);return;}let v=this.loops.get(key);if(v?.sound!==sound||v&&!v.recorded&&this.recordings.has(sound)){this.stop(key);v=this.voice(sound,bus,volume,point,true,offset,range);if(v)this.loops.set(key,v);}else if(v){v.range=range;this.position(v,volume,point);}}
 private keyedPlay(key:string,sound:Sound,bus:Bus,volume:number,point?:Point){try{const v=this.voice(sound,bus,volume,point);if(!v)return;let set=this.keyedVoices.get(key);if(!set){set=new Set();this.keyedVoices.set(key,set);}set.add(v);const onended=v.source.onended;v.source.onended=e=>{onended?.call(v.source,e);set!.delete(v);if(!set!.size&&this.keyedVoices.get(key)===set)this.keyedVoices.delete(key);};}catch{}}
 beat(key:string,sound:Sound,bus:Bus,interval:number,volume:number,point?:Point){this.sceneKeys.add(key);for(const v of this.keyedVoices.get(key)??[])this.position(v,volume,point);const now=performance.now(),old=this.beats.get(key);if(!old||old.sound!==sound||now>=old.next){if(bank[sound]&&!this.recordings.has(sound)&&!this.recordingFailed.has(sound)&&typeof this.context?.decodeAudioData==='function'){void this.loadRecorded(sound);return;}this.beats.set(key,{sound,next:now+interval*1000});this.keyedPlay(key,sound,bus,volume,point);}}

 cue(key:string,time:number,events:readonly {at:number;sound:Sound}[],bus:Bus,volume:number,point?:Point){this.sceneKeys.add(key);for(const v of this.keyedVoices.get(key)??[])this.position(v,volume,point);const prev=this.cueTimes.get(key);this.cueTimes.set(key,time);if(time<0)return;const previous=prev===undefined||time<prev?Math.max(0,time-.10):prev;for(const e of events)if(crossedCue(previous,time,e.at))this.keyedPlay(key,e.sound,bus,volume,point);}
 clearWorld(){this.clearScene();}
 endFrame(){if(this.background&&![...this.sceneKeys].some(k=>k.startsWith('media-')||k==='dance'||this.loops.get(k)?.bus==='music'&&k!=='score'))this.loop('score',this.background,'music',.39);for(const [key,voices] of this.keyedVoices)if(!this.sceneKeys.has(key)){for(const v of voices)try{v.source.stop();}catch{}this.keyedVoices.delete(key);}for(const key of this.cueTimes.keys())if(!this.sceneKeys.has(key))this.cueTimes.delete(key);for(const key of this.loops.keys())if(!this.sceneKeys.has(key))this.stop(key);for(const key of this.beats.keys())if(!this.sceneKeys.has(key))this.beats.delete(key);}
}
export const gameAudio=new GameAudio();
