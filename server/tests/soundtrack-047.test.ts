import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {GameAudio,TrackQueue,shuffleTracks,musicVolume,DEFAULT_MUSIC_VOLUME} from '../../src/game/GameAudio';
import {SOUNDTRACK} from '../../src/game/Soundtrack';
test('eight long original compositions, no old sound assets',()=>{
 assert.equal(SOUNDTRACK.length,8);assert.ok(SOUNDTRACK.reduce((n,t)=>n+t.seconds,0)>1800);
 const directory='public/audio/soundtrack';
 assert.deepEqual(readdirSync('public/audio'),['soundtrack']);
 assert.equal(readdirSync(directory).filter(f=>f.endsWith('.mp3')).length,8);
 for(const t of SOUNDTRACK){assert.ok(t.seconds>200&&t.seconds<300);const b=readFileSync(directory+'/'+t.file);assert.ok(b.length>500000&&b.length<2000000);assert.ok(b.toString('ascii',0,3)==='ID3'||b[0]===255&&((b[1]&224)===224));}
});
test('shuffle cycles cover all songs without immediate repetitions',()=>{
 const q=new TrackQueue(8,()=>.32);let previous=-1;
 for(let cycle=0;cycle<30;cycle++){const list=Array.from({length:8},()=>q.next());assert.equal(new Set(list).size,8);assert.notEqual(list[0],previous);previous=list[7];}
 assert.deepEqual(shuffleTracks(1,0,()=>0),[0]);
 assert.equal(musicVolume(-1),0);assert.equal(musicVolume(2),1);assert.equal(musicVolume(NaN),DEFAULT_MUSIC_VOLUME);
});
test('one player advances automatically, preserves pause position, mutes and resumes',async()=>{
 class FakeAudio {
  static instances:FakeAudio[]=[];src='';currentTime=0;volume=1;muted=false;paused=true;ended=false;loop=false;preload='';listeners=new Map<string,(()=>void)[]>();
  constructor(){FakeAudio.instances.push(this);}
  setAttribute(){}
  addEventListener(event:string,fn:()=>void){const list=this.listeners.get(event)??[];list.push(fn);this.listeners.set(event,list);}
  emit(event:string){for(const fn of this.listeners.get(event)??[])fn();}
  load(){this.currentTime=0;this.ended=false;}
  async play(){this.paused=false;this.emit('playing');}
  pause(){this.paused=true;}
 }
 const saved=Object.getOwnPropertyDescriptor(globalThis,'Audio'),win=Object.getOwnPropertyDescriptor(globalThis,'window');
 Object.defineProperty(globalThis,'Audio',{value:FakeAudio,configurable:true});Object.defineProperty(globalThis,'window',{value:{},configurable:true});
 try {
  const audio=new GameAudio();audio.setPlaying(true);await audio.unlock();
  const p=FakeAudio.instances[0];assert.ok(p.src.endsWith('.mp3'));assert.equal(p.paused,false);assert.equal(p.loop,false);
  const old=p.src;p.currentTime=80;audio.setPaused(true);assert.equal(p.paused,true);audio.setPaused(false);assert.equal(p.currentTime,80);assert.equal(p.paused,false);
  p.ended=true;p.emit('ended');assert.notEqual(p.src,old);assert.equal(FakeAudio.instances.length,1);
  audio.setVolume(0);assert.equal(p.muted,true);audio.setVolume(.2);assert.equal(p.muted,false);assert.equal(p.volume,.2);
  audio.setPlaying(false);assert.equal(p.paused,true);assert.equal(p.muted,true);
 } finally {if(saved)Object.defineProperty(globalThis,'Audio',saved);else Reflect.deleteProperty(globalThis,'Audio');if(win)Object.defineProperty(globalThis,'window',win);else Reflect.deleteProperty(globalThis,'window');}
});
