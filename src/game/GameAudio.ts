import {SOUNDTRACK} from './Soundtrack';

export const DEFAULT_MUSIC_VOLUME=.28;
const KEY='simlife.soundtrack.v1';
export function musicVolume(raw:unknown,fallback=DEFAULT_MUSIC_VOLUME){return typeof raw==='number'&&Number.isFinite(raw)?Math.max(0,Math.min(1,raw)):fallback;}
function initialVolume(){try{const raw=localStorage.getItem(KEY);return raw===null?DEFAULT_MUSIC_VOLUME:musicVolume(JSON.parse(raw));}catch{return DEFAULT_MUSIC_VOLUME;}}
export function shuffleTracks(count:number,previous=-1,random:()=>number=Math.random):number[]{
 const list=Array.from({length:count},(_,i)=>i);
 for(let i=list.length-1;i>0;i--){const j=Math.min(i,Math.max(0,Math.floor(random()*(i+1))));[list[i],list[j]]=[list[j],list[i]];}
 if(list.length>1&&list[0]===previous){const j=1+Math.min(list.length-2,Math.max(0,Math.floor(random()*(list.length-1))));[list[0],list[j]]=[list[j],list[0]];}
 return list;
}
export class TrackQueue{
 private queue:number[]=[];
 private current=-1;
 constructor(private count=SOUNDTRACK.length,private random= Math.random){}
 next(){if(!this.queue.length)this.queue=shuffleTracks(this.count,this.current,this.random);this.current=this.queue.shift()??-1;return this.current;}
 get index(){return this.current;}
}

/** One streaming media element, one gain node, no game effects, no per-frame work.
 * Intro/outro fades are baked into the original tracks. Safari reuses the same
 * media element for every song, allowing the initial user gesture to carry over. */
export class GameAudio {
 private player?:HTMLAudioElement;
 private context?:AudioContext;
 private gain?:GainNode;
 private playing=false;
 private paused=false;
 private hidden=false;
 private unlocked=false;
 private primed=false;
 private value=initialVolume();
 private queue=new TrackQueue();
 private installed=false;
 private errors=0;
 private listeners=new Set<()=>void>();
 private generation=0;
 get volume(){return this.value;}
 get currentTrack(){return SOUNDTRACK[this.queue.index];}
 get trackCount(){return SOUNDTRACK.length;}
 subscribe(listener:()=>void){this.listeners.add(listener);return ()=>this.listeners.delete(listener);}
 private changed(){for(const listener of this.listeners)listener();}
 install(root:HTMLElement){
  if(this.installed)return;this.installed=true;this.hidden=document.hidden;
  const gesture=(event:Event)=>{
   const target=event.target;
   // Prime on actual entry tap (the server's ready response is asynchronous).
   const entry=target instanceof Element&&!!target.closest('.enter-button');
   if(this.playing||entry)void this.unlock(entry);
  };
  root.addEventListener('pointerdown',gesture,{capture:true});
  root.addEventListener('touchend',gesture,{capture:true,passive:true});
  root.addEventListener('click',gesture,{capture:true});
  root.addEventListener('keydown',gesture,{capture:true});
  document.addEventListener('visibilitychange',()=>{this.hidden=document.hidden;this.sync();});
 }
 private ensure(){
  if(this.player)return;
  const p=this.player=new Audio();
  p.preload='metadata';p.loop=false;p.setAttribute('playsinline','');
  p.addEventListener('ended',()=>{if(this.playing&&!this.paused&&!this.hidden){this.advance();}else this.primed=false;});
  p.addEventListener('error',()=>{if(this.playing&&++this.errors<SOUNDTRACK.length)this.advance();else this.changed();});
  p.addEventListener('playing',()=>{this.errors=0;this.changed();});
  const C=window.AudioContext??(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
  if(C)try{const c=this.context=new C();const gain=this.gain=c.createGain();gain.gain.value=0;c.createMediaElementSource(p).connect(gain).connect(c.destination);}catch{this.context=undefined;this.gain=undefined;}
  this.choose();
 }
 private choose(){
  const index=this.queue.next();const track=SOUNDTRACK[index];if(!this.player||!track)return;
  this.generation++;this.player.src='/audio/soundtrack/'+track.file;this.player.load();this.changed();
 }
 private mix(){
  const audible=this.playing&&!this.paused&&!this.hidden;
  const volume=audible?this.value:0;
  if(this.gain&&this.context){this.gain.gain.setTargetAtTime(volume,this.context.currentTime,.12);if(this.player)this.player.muted=volume===0;}
  else if(this.player){this.player.volume=volume;this.player.muted=volume===0;}
 }
 private async start(){
  const p=this.player;if(!p)return;const generation=this.generation;
  try{if(this.context?.state==='suspended')void this.context.resume().catch(()=>{});await p.play();if(generation===this.generation){this.unlocked=true;this.changed();}}catch{/* A fresh gesture can retry on mobile autoplay restrictions. */}
 }
 async unlock(prime=false){
  if(this.hidden)return;
  try{this.ensure();if(this.playing&&!this.paused){this.mix();await this.start();}
   else if(prime&&!this.playing){this.primed=true;this.mix();await this.start();window.setTimeout(()=>{if(!this.playing){this.primed=false;this.player?.pause();}},8000);}}
  catch{/* audio must not block gameplay */}
 }
 private sync(){
  this.mix();
  if(!this.player)return;
  if(!this.playing||this.paused||this.hidden){if(!this.playing)this.primed=false;this.player.pause();return;}
  if(this.player.ended)this.choose();
  if(this.unlocked||this.primed)void this.start();
 }
 setPlaying(value:boolean){if(this.playing===value&&value)return;this.playing=value;this.sync();}
 setPaused(value:boolean){if(this.paused===value)return;this.paused=value;this.sync();}
 setVolume(value:number){this.value=musicVolume(value);try{localStorage.setItem(KEY,JSON.stringify(this.value));}catch{}this.mix();this.changed();}
 private advance(){if(!this.player)return;this.choose();this.sync();}
 next(){if(!this.player)return;this.errors=0;this.advance();}
}
export const gameAudio=new GameAudio();
