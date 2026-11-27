import {MathUtils} from 'three';
const smooth=(t:number,a:number,b:number)=>MathUtils.smoothstep(t,a,b);
const pulse=(t:number,a:number,b:number,c:number,d:number)=>smooth(t,a,b)*(1-smooth(t,c,d));
/** Shared clock for the pet and the object it plays with. No physics or rewards. */
export function toyPhrase(time:number,kind:string){
 const t=((time%4.8)+4.8)%4.8;
 const pickup=kind==='rope'||kind==='bone'||kind==='ring'||kind==='marfa';
 const lower=pickup?Math.max(pulse(t,0,.55,.95,1.35),pulse(t,3.0,3.55,4.0,4.6)):0;
 const grip=pickup?pulse(t,.65,1.15,3.55,4.15):0;
 const strike=pulse(t,.55,1.0,1.25,1.6);
 const displaced=pulse(t,1.0,1.5,2.1,3.5);
 return {lower,grip,strike,displaced,shake:grip*Math.sin(t*9)};
}