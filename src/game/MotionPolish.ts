import type {CharacterId} from '../shared/protocol';
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(v:number)=>{const x=clamp(v);return x*x*(3-2*x);};
/** Cosmetic weight transfer only. No delay or displacement of navigation. */
export function seatTransfer(blend:number,seated:boolean){
 const b=clamp(blend),w=4*b*(1-b);
 return {lean:w*(seated?.16:.23),gaze:w*(seated?.045:.025),hands:w*(seated?.065:.095)};
}
/** Bounded, continuous tempo modulation; preserves contacts and task timing. */
export function taskCadence(seconds:number,role:CharacterId,rate:number){
 const t=Math.max(0,Number.isFinite(seconds)?seconds:0),phase=role==='vlad'?0:1.6;
 return t*rate+.26*Math.sin(t*.85+phase)-.26*Math.sin(phase)+.12*Math.sin(t*1.9);
}
export function chewPulse(seconds:number,envelope:number,role:CharacterId){
 const t=Math.max(0,Number.isFinite(seconds)?seconds:0);
 return clamp(envelope)*(.32+.68*(.5+.5*Math.sin(t*(role==='vlad'?12:10.4)))**2);
}
/** Distinct strokes and short reading pauses with the hand following the glass. */
export function phoneStroke(seconds:number,role:CharacterId){
 const t=Math.max(0,Number.isFinite(seconds)?seconds:0),period=role==='vlad'?4.2:4.7;
 const round=Math.floor(t/period),phase=t%period,active=round%4!==3;
 const contact=active?smooth((phase-.65)/.3)*(1-smooth((phase-1.75)/.4)):0;
 const travel=smooth((phase-.95)/.8);
 const approach=smooth(phase/.65)*(1-smooth((phase-2.15)/.55));
 return {contact,z:active?(-.035+.07*(round%3===1?1-travel:travel))*approach:0};
}
