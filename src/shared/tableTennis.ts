import type { CharacterId } from './protocol';
export const TABLE_TENNIS_SECONDS=60;
const lanes=[0,-.34,.42,.26,-.46,-.12,.44,-.40,.12,.36,-.28,.47,-.41,.14,.33,-.35,.41,-.16,-.42,.30,.08,-.39,.42,.12];
export const tennisStrikes=(winner:CharacterId='alina')=>lanes.map((x,i)=>{
 const role:CharacterId=(i%2===0)===(winner==='alina')?'vlad':'alina';
 const side=role==='vlad'?-1:1;
 return {role,time:1.5+i*2.4,x:winner==='alina'?x:-x,z:side*(1.20+(i%3)*.035),y:1.04+(i%4)*.045};
});
const clamp=(v:number)=>Math.min(1,Math.max(0,v));
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const smooth=(v:number)=>{const t=clamp(v);return t*t*(3-2*t);};
export function tennisBall(t:number,winner:CharacterId='alina'){
 const hits=tennisStrikes(winner),first=hits[0],last=hits.at(-1)!;
 if(t<first.time){const f=clamp(t/first.time);return {x:first.x,y:lerp(.91,first.y,f)+.22*Math.sin(f*Math.PI),z:first.z};}
 for(let i=0;i<hits.length-1;i++){const a=hits[i],b=hits[i+1];if(t>b.time)continue;
  const f=clamp((t-a.time)/(b.time-a.time)),split=.70+(i%3)*.035;
  const bx=lerp(a.x,b.x,.78)+(i%2?.06:-.06),bz=Math.sign(b.z)*(.56+(i%3)*.13),by=.823;
  if(f<=split){const u=f/split;return {x:lerp(a.x,bx,u),y:lerp(a.y,by,u)+(.23+(i%4)*.065)*4*u*(1-u),z:lerp(a.z,bz,u)};}
  const u=(f-split)/(1-split);return {x:lerp(bx,b.x,u),y:lerp(by,b.y,u)+.08*4*u*(1-u),z:lerp(bz,b.z,u)};
 }
 const f=clamp((t-last.time)/2.9),side=winner==='vlad'?1:-1;
 if(f<.68){const u=f/.68;return {x:lerp(last.x,.50*side,u),y:lerp(last.y,.823,u)+.35*4*u*(1-u),z:lerp(last.z,.90*side,u)};}
 const u=(f-.68)/.32;return {x:lerp(.50*side,.60*side,u),y:lerp(.823,.025,u)+.10*Math.sin(Math.PI*u),z:lerp(.90*side,1.69*side,u)};
}
export function tennisPlayer(role:CharacterId,t:number,winner:CharacterId='alina'){
 const hits=tennisStrikes(winner).filter(h=>h.role===role);const side=role==='vlad'?-1:1;
 const next=hits.find(h=>h.time>=t),prev=hits.filter(h=>h.time<t).at(-1);
 const target=(h:typeof hits[number]|undefined)=>h?Math.max(-.42,Math.min(.42,h.x-side*.20)):0;
 const x=next?lerp(target(prev),target(next),smooth((t-Math.max(prev?.time??0,next.time-1.5))/Math.max(.1,next.time-.20-Math.max(prev?.time??0,next.time-1.5)))):lerp(target(prev),0,smooth((t-(prev?.time??0))/.9));
 const strike=next&&next.time-t<.60?next:prev&&t-prev.time<.32?prev:undefined;
 const hit=strike?strike.time>=t?smooth(1-(strike.time-t)/.60):1-smooth((t-strike.time)/.32):0;
 return {x,hit,side,strike};
}
