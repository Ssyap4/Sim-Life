// Procedural sounds plus local CC0 recordings; no third-party requests at runtime.
export type AudioChannel = 'master'|'ambient'|'effects'|'pets'|'ui'|'music';
export const AUDIO_DEFAULTS:Record<AudioChannel,number>={master:.75,ambient:.42,effects:.65,pets:.65,ui:.38,music:.25};
export const AUDIO_LABELS:Record<AudioChannel,string>={master:'Общая громкость',ambient:'Окружение',effects:'Действия и предметы',pets:'Питомцы',ui:'Интерфейс',music:'Музыка'};
type Point={x:number;z:number};
type Bus=Exclude<AudioChannel,'master'>;
export type Sound='stepWood'|'stepGrass'|'stepTile'|'paw'|'click'|'confirm'|'error'|'door'|'flush'|'water'|'cook'|'eat'|'keyboard'|'paper'|'dish'|'squeak'|'spring'|'scratch'|'bark'|'meow'|'purr'|'bird'|'cricket'|'wind'|'room'|'street'|'cafe'|'fire'|'ring'|'hit'|'feeder'|'music';
type Spec={length:number;noise?:number;freq?:number;end?:number;harmonics?:number;filter?:number;pulses?:number;loop?:boolean};
const specs:Record<Sound,Spec>={
 stepWood:{length:.19,noise:.7,freq:95,end:45,filter:.2},stepGrass:{length:.22,noise:.9,filter:.48,pulses:2},stepTile:{length:.14,noise:.55,freq:250,end:90,filter:.7},paw:{length:.085,noise:.75,filter:.48},
 click:{length:.065,freq:640,end:410,noise:.16},confirm:{length:.26,freq:620,end:950,harmonics:.2},error:{length:.16,freq:260,end:155},door:{length:.37,noise:.65,freq:105,end:45,filter:.24,pulses:2},
 flush:{length:2,noise:1,filter:.23,pulses:1},water:{length:2,noise:1,filter:.55,loop:true},cook:{length:1.6,noise:.94,filter:.73,loop:true},eat:{length:.19,noise:.85,filter:.35,pulses:2},
 keyboard:{length:.09,noise:.72,freq:370,end:160,filter:.72},paper:{length:.32,noise:.9,filter:.62,pulses:3},dish:{length:.25,freq:1060,end:990,harmonics:.45,noise:.12},
 squeak:{length:.22,freq:990,end:540,harmonics:.4,pulses:2},spring:{length:.28,freq:420,end:970,harmonics:.35,pulses:3},scratch:{length:.32,noise:1,filter:.65,pulses:4},
 bark:{length:.29,freq:380,end:155,harmonics:.9,noise:.45,pulses:1},meow:{length:.65,freq:460,end:290,harmonics:.62,noise:.035},purr:{length:1.4,freq:29,end:29,harmonics:.5,noise:.22,loop:true},
 bird:{length:.52,freq:2350,end:3700,pulses:3},cricket:{length:.36,freq:4100,end:4300,pulses:5},
 wind:{length:3.1,noise:1,filter:.025,loop:true},room:{length:2.3,noise:.3,filter:.025,loop:true},street:{length:3.3,noise:.75,filter:.035,loop:true},cafe:{length:3.1,noise:.75,filter:.085,loop:true},fire:{length:2.2,noise:1,filter:.47,loop:true},ring:{length:.65,freq:880,end:660,pulses:3},hit:{length:.075,noise:.6,freq:740,end:180},feeder:{length:.72,noise:.8,freq:180,end:85,pulses:8,filter:.52},music:{length:8,loop:true}
};
export function clampVolume(v:unknown,fallback:number):number{return typeof v==='number'&&Number.isFinite(v)?Math.min(1,Math.max(0,v)):fallback;}
export function readAudioSettings(raw:string|null):Record<AudioChannel,number>{
 try{const value=JSON.parse(raw??'null');return Object.fromEntries(Object.entries(AUDIO_DEFAULTS).map(([k,v])=>[k,clampVolume(value?.[k],v)])) as Record<AudioChannel,number>;}catch{return {...AUDIO_DEFAULTS};}
}
export function spatialGain(distance:number):number{return 1/(1+(Math.max(0,distance)/4)**2);}
export function ambientFor(place:string,outside:boolean):Sound{return place==='park'||(place==='home'&&outside)?'wind':place==='district'||place==='industrial'?'street':place==='cafe'||['market','clothing','petshop','electronics'].includes(place)?'cafe':'room';}
export function activitySound(activity:string|null,pose:string):{sound:Sound;interval:number;loop?:boolean}|undefined{
 if(activity&&['shower','wash','washHands','bath','dishes','teeth'].includes(activity))return {sound:'water',interval:0,loop:true};
 if(activity&&['cook','grill','prep'].includes(activity))return {sound:'cook',interval:0,loop:true};
 if(activity==='eat')return {sound:'eat',interval:1.4};
 if(activity==='music')return {sound:'music',interval:0,loop:true};
 if(activity==='coffee'||activity==='tea')return {sound:'water',interval:0,loop:true};
 if(activity&&['read','journal','tidy'].includes(activity))return {sound:'paper',interval:2.6};
 if(activity==='toilet')return {sound:'flush',interval:1000};
 if(pose==='work'||activity==='games')return {sound:'keyboard',interval:.45};
 return undefined;
}
const storageKey='simlife.audio.v1';
function initial(){try{return readAudioSettings(localStorage.getItem(storageKey));}catch{return {...AUDIO_DEFAULTS};}}
type Voice={source:AudioBufferSourceNode;gain:GainNode;pan?:StereoPannerNode;sound:Sound;bus:Bus};
class GameAudio {
 private context:AudioContext|undefined;
 private master:GainNode|undefined;
 private buses=new Map<Bus,GainNode>();
 private buffers=new Map<Sound,AudioBuffer>();
 private loading=false;
 private loops=new Map<string,Voice>();
 private voices=new Set<Voice>();
 private beats=new Map<string,{sound:Sound;next:number}>();
 private values=initial();
 private playing=false;
 private paused=false;
 private hidden=false;
 private scene='';
 private listener:Point={x:0,z:0};
 private lastAmbient=0;
 private sceneKeys=new Set<string>();
 private lastStep=new Map<string,{x:number;z:number;distance:number}>();
 private lastUI=0;
 get settings(){return {...this.values};}
 setVolume(key:AudioChannel,value:number){this.values[key]=clampVolume(value,AUDIO_DEFAULTS[key]);if(key==='master'&&this.values[key]===0)this.clearScene();try{localStorage.setItem(storageKey,JSON.stringify(this.values));}catch{}this.mix();}
 private mix(){const c=this.context;if(!c||!this.master)return;this.master.gain.setTargetAtTime(this.hidden?0:this.values.master,c.currentTime,.035);for(const [key,node] of this.buses)node.gain.setTargetAtTime(key==='ui'||(!this.paused&&this.playing)?this.values[key]:0,c.currentTime,.045);}
 install(root:HTMLElement){
  const unlock=()=>{void this.unlock();};root.addEventListener('pointerdown',unlock,{capture:true});root.addEventListener('touchend',unlock,{capture:true,passive:true});root.addEventListener('keydown',unlock,{capture:true});
  root.addEventListener('click',event=>{const target=event.target;if(target instanceof Element&&target.closest('button:not(:disabled)')&&!target.closest('[data-audio-setting]')){const now=performance.now();if(now-this.lastUI>85){this.lastUI=now;this.play('click','ui',.18);}}},{capture:true});
  document.addEventListener('visibilitychange',()=>{this.hidden=document.hidden;this.mix();if(this.hidden){this.clearScene();void this.context?.suspend().catch(()=>{});}else{void this.context?.resume().catch(()=>{});}});
 }
 async unlock(){if(this.hidden)return;try{if(!this.context){const C=window.AudioContext??(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;if(!C)return;const c=this.context=new C();this.master=c.createGain();this.master.gain.value=0;this.master.connect(c.destination);for(const key of ['ambient','effects','pets','ui','music'] as const){const g=c.createGain();g.gain.value=0;g.connect(this.master);this.buses.set(key,g);}this.mix();}if(!this.loading){this.loading=true;void this.loadRecordings();}if(this.context.state==='suspended')await this.context.resume();}catch{/* audio must never block gameplay */}}
 setPlaying(value:boolean){if(this.playing===value)return;this.playing=value;if(!value)this.clearScene();this.mix();}
 setPaused(value:boolean){if(this.paused===value)return;this.paused=value;if(value)this.clearScene();this.mix();}
 private async loadRecordings(){const c=this.context!;for(const sound of ["meow","bark"] as Sound[]){try{const response=await fetch('/audio/'+sound+'.mp3');if(!response.ok)continue;const decoded=await c.decodeAudioData(await response.arrayBuffer());if(decoded.duration>0&&decoded.duration<4)this.buffers.set(sound,decoded);}catch{/* procedural fallback */}}}
 private ready(bus:Bus){return !!this.context&&this.context.state==='running'&&!this.hidden&&this.values.master>0&&this.values[bus]>0&&(bus==='ui'||(this.playing&&!this.paused));}
 private buffer(sound:Sound):AudioBuffer{
  const cached=this.buffers.get(sound);if(cached)return cached;const c=this.context!,s=specs[sound],rate=22050,n=Math.ceil(rate*s.length),b=c.createBuffer(1,n,rate),data=b.getChannelData(0);
  let low=0,phase=0,seed=137+sound.charCodeAt(0)*17;
  for(let i=0;i<n;i++){const t=i/rate,u=i/n;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const white=seed/2147483648-1;low+=(white-low)*(s.filter??.3);
   const edge=s.loop?Math.min(1,t/.07,(s.length-t)/.07):Math.min(1,t/.012)*Math.pow(1-u,1.55);
   const pulse=s.pulses?Math.pow(Math.max(0,Math.sin(u*s.pulses*Math.PI)),2):1;
   const frequency=(s.freq??0)+((s.end??s.freq??0)-(s.freq??0))*u+(sound==='meow'?Math.sin(u*Math.PI)*250:0);phase+=2*Math.PI*frequency/rate;
   let tone=s.freq?Math.sin(phase)+(s.harmonics??0)*(.6*Math.sin(phase*2)+.35*Math.sin(phase*3)+.2*Math.sin(phase*5)):0;
   let noise=(s.noise??0)*(low*.85+white*.15);
   if(sound==='fire'||sound==='cook')noise*=.25+(seed%43===0?2.7:.4);
   if(sound==='wind'||sound==='street'||sound==='cafe')noise*=.65+.25*Math.sin(t*2.4);
   if(sound==='music'){const notes=[261.63,329.63,392,329.63,220,261.63,329.63,261.63,196,246.94,293.66,246.94,220,261.63,329.63,392];const beat=t*2,index=Math.min(15,Math.floor(beat)),f=notes[index],env=Math.exp(-(beat-index)*4)*Math.min(1,(beat-index)*35);tone=.18*env*(Math.sin(2*Math.PI*f*t)+.2*Math.sin(4*Math.PI*f*t));}
   data[i]=Math.tanh((tone*.38+noise*.78)*pulse*edge);
  }this.buffers.set(sound,b);return b;
 }
 private voice(sound:Sound,bus:Bus,volume:number,position?:Point,loop=false):Voice|undefined{
  if(!this.ready(bus)||this.voices.size>=24)return;const c=this.context!,source=c.createBufferSource(),gain=c.createGain();gain.gain.value=0;source.buffer=this.buffer(sound);source.loop=loop;source.playbackRate.value=loop?1:.93+Math.random()*.14;
  let pan:StereoPannerNode|undefined;if(position&&typeof c.createStereoPanner==='function'){pan=c.createStereoPanner();source.connect(gain).connect(pan).connect(this.buses.get(bus)!);}else source.connect(gain).connect(this.buses.get(bus)!);
  const v={source,gain,pan,sound,bus};this.voices.add(v);this.position(v,volume,position);source.onended=()=>{this.voices.delete(v);source.disconnect();gain.disconnect();pan?.disconnect();};source.start();return v;
 }
 private position(v:Voice,volume:number,point?:Point){const c=this.context!;const dx=point?point.x-this.listener.x:0,dz=point?point.z-this.listener.z:0;v.gain.gain.setTargetAtTime(volume*(point?spatialGain(Math.hypot(dx,dz)):1),c.currentTime,.025);v.pan?.pan.setTargetAtTime(Math.max(-.8,Math.min(.8,dx/8)),c.currentTime,.025);}
 play(sound:Sound,bus:Bus='effects',volume=.5,point?:Point){try{this.voice(sound,bus,volume,point);}catch{/* unavailable audio is harmless */}}
 private stop(key:string){const v=this.loops.get(key);if(!v)return;this.loops.delete(key);try{v.gain.gain.setTargetAtTime(0,this.context!.currentTime,.025);v.source.stop(this.context!.currentTime+.12);}catch{}}
 private clearScene(){for(const key of this.loops.keys())this.stop(key);for(const v of this.voices)if(v.bus!=='ui'){try{v.source.stop();}catch{}}this.beats.clear();this.lastStep.clear();this.sceneKeys.clear();this.scene='';}
 beginFrame(place:string,listener:Point,night:boolean,outside:boolean){if(!this.playing||this.paused||this.hidden||!this.context||this.context.state!=='running'||this.values.master===0)return false;if(this.scene!==place){this.clearScene();this.scene=place;this.lastAmbient=0;}this.listener=listener;this.sceneKeys.clear();const sound=ambientFor(place,outside);this.loop('ambient',sound,'ambient',sound==='room'?.12:.26);const now=performance.now();if(now>this.lastAmbient&&sound!=='room'&&sound!=='cafe'){this.lastAmbient=now+3500+Math.random()*6500;this.play(night?'cricket':'bird','ambient',night?.14:.17);}return true;}
 loop(key:string,sound:Sound,bus:Bus,volume:number,point?:Point){this.sceneKeys.add(key);if(!this.ready(bus)){this.stop(key);return;}let v=this.loops.get(key);if(v?.sound!==sound){this.stop(key);v=this.voice(sound,bus,volume,point,true);if(v)this.loops.set(key,v);}else if(v)this.position(v,volume,point);}
 beat(key:string,sound:Sound,bus:Bus,interval:number,volume:number,point?:Point){this.sceneKeys.add(key);const now=performance.now(),old=this.beats.get(key);if(!old||old.sound!==sound||now>=old.next){this.beats.set(key,{sound,next:now+interval*1000});this.play(sound,bus,volume,point);}}
 step(key:string,p:Point,moving:boolean,sound:Sound,pet=false){this.sceneKeys.add(key);const prev=this.lastStep.get(key);let distance=prev&&moving?prev.distance+Math.hypot(p.x-prev.x,p.z-prev.z):0;if(distance>(pet?.34:.52)){if(distance<2)this.play(sound,pet?'pets':'effects',pet?.16:.37,p);distance=0;}this.lastStep.set(key,{x:p.x,z:p.z,distance});}
 endFrame(){for(const key of this.loops.keys())if(!this.sceneKeys.has(key))this.stop(key);for(const key of this.beats.keys())if(!this.sceneKeys.has(key))this.beats.delete(key);for(const key of this.lastStep.keys())if(!this.sceneKeys.has(key))this.lastStep.delete(key);}
}
export const gameAudio=new GameAudio();
