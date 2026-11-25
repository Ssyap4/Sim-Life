import {test} from 'node:test';
import assert from 'node:assert/strict';
import {HAPTIC_MS,hapticsEnabled,setHapticsEnabled,subtleHaptic} from '../../src/mobileHaptics';
test('haptic feedback stays short, opt-out and safe without platform support',()=>{
 assert.ok(Object.values(HAPTIC_MS).every(v=>v>0&&v<=20));
 const old=Object.getOwnPropertyDescriptor(globalThis,'navigator');const pulses:number[]=[];
 try{
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{vibrate:(ms:number)=>{pulses.push(ms);return true;}}});
 setHapticsEnabled(false);assert.equal(hapticsEnabled(),false);subtleHaptic();assert.equal(pulses.length,0);
 setHapticsEnabled(true);subtleHaptic('confirm');subtleHaptic('select');assert.deepEqual(pulses,[16]);
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{}});assert.doesNotThrow(()=>subtleHaptic());
 }finally{if(old)Object.defineProperty(globalThis,'navigator',old);else Reflect.deleteProperty(globalThis,'navigator');}
});
