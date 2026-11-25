/** Quiet, opt-out touch feedback. Real vibration only on supported browsers. */
const STORAGE_KEY='simlife-mobile-haptic-v1';
export type HapticKind='select'|'confirm'|'place'|'error';
export const HAPTIC_MS:Readonly<Record<HapticKind,number>>={select:8,confirm:16,place:12,error:20};
export const HAPTIC_COOLDOWN=85;
let preference:boolean|undefined,last=-Infinity;
export function hapticsEnabled():boolean{
 if(preference!==undefined)return preference;
 try{return localStorage.getItem(STORAGE_KEY)!=='false';}catch{return true;}
}
export function setHapticsEnabled(value:boolean):void{
 preference=value;try{localStorage.setItem(STORAGE_KEY,String(value));}catch{}
}
export function subtleHaptic(kind:HapticKind='select'):void{
 if(!hapticsEnabled()||typeof navigator==='undefined'||typeof navigator.vibrate!=='function')return;
 if(typeof document!=='undefined'&&document.hidden)return;
 const now=performance.now();if(now-last<HAPTIC_COOLDOWN)return;
 try{if(navigator.vibrate(HAPTIC_MS[kind]))last=now;}catch{}
}
const controls='button,[role="button"],input[type="checkbox"],input[type="radio"],summary,select,[data-touch-feedback]';
function control(target:EventTarget|null):HTMLElement|null{
 if(!(target instanceof Element))return null;
 const el=target.closest<HTMLElement>(controls);
 if(!el||el.closest('[disabled],[aria-disabled="true"],[inert],[hidden]'))return null;
 if(el.closest('[data-no-haptic]')||el.matches('[data-haptics]'))return null;
 return el;
}
export function installTouchFeedback(root:HTMLElement):void{
 let pressed:HTMLElement|null=null,x=0,y=0,pointer=-1;
 const clear=()=>{pressed?.classList.remove('touch-pressed');pressed=null;pointer=-1;};
 root.addEventListener('pointerdown',e=>{
  if(e.pointerType==='mouse'||!e.isPrimary||e.button!==0)return;
  clear();const el=control(e.target);if(!el)return;
  pressed=el;x=e.clientX;y=e.clientY;pointer=e.pointerId;el.classList.add('touch-pressed');
 },{passive:true,capture:true});
 window.addEventListener('pointermove',e=>{if(e.pointerId===pointer&&Math.hypot(e.clientX-x,e.clientY-y)>10)clear();},{passive:true,capture:true});
 window.addEventListener('pointerup',e=>{if(e.pointerId===pointer)clear();},{passive:true,capture:true});
 window.addEventListener('pointercancel',clear,{passive:true,capture:true});
 window.addEventListener('blur',clear);
 root.addEventListener('scroll',clear,{passive:true,capture:true});
 root.addEventListener('click',e=>{
  if(!e.isTrusted||e.detail===0||!window.matchMedia('(any-pointer: coarse)').matches)return;
  const el=control(e.target);if(!el)return;
  subtleHaptic(el.matches('[data-haptic="confirm"],button[type="submit"]')?'confirm':'select');
 },{capture:true});
}
