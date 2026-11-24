import type { CharacterId } from './protocol';
export const BADMINTON_SECONDS=45;
type Strike={role:CharacterId;time:number;x:number;z:number;height:number;arc:number};
const targets=[
 [0,1.65,1.62,.85],[-.65,1.94,2.05,.68],
 [.85,1.90,1.78,.76],[.90,1.43,1.62,.47],
 [-.95,1.32,2.02,.82],[-.95,1.92,1.58,.68],
 [.45,1.85,2.10,.62],[.40,1.33,1.81,.43],
 [-.45,1.48,1.65,.70],[1.05,1.85,2.04,.90],
 [1.0,1.40,1.88,.52],[-.65,1.35,1.58,.65],
 [-.90,1.95,2.05,.74],[.85,1.93,1.95,.48],
 [.55,1.50,1.70,.73],[.05,1.65,2.04,.58],
] as const;
export const STRIKES:readonly Strike[]=targets.map(([x,z,height,arc],i)=>({role:i%2?'alina':'vlad',time:2+i*2.55,x,z:(i%2?-1:1)*z,height,arc}));
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(v:number)=>{const t=clamp(v);return t*t*(3-2*t);};
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
export const badmintonStrikes=(winner:CharacterId='alina'):readonly Strike[]=>winner==='alina'?STRIKES:STRIKES.map(s=>({...s,role:s.role==='vlad'?'alina':'vlad',x:-s.x,z:-s.z}));
export function badmintonPlayer(role:CharacterId,t:number,winner:CharacterId='alina'){
 const side=role==='vlad'?1:-1, strikes=badmintonStrikes(winner).filter(s=>s.role===role);
 let prev={x:0,z:1.85*side,time:0}, next:Strike|undefined;
 for(const s of strikes){if(s.time>=t){next=s;break;}prev=s;}
 if(!next){const f=smooth((t-prev.time-.4)/2.2);return {x:mix(prev.x,0,f),z:mix(prev.z,1.85*side,f),hit:0,height:1.65,aim:0};}
 const begin=Math.max(prev.time+.45,next.time-2.05);
 const f=smooth((t-begin)/Math.max(.1,next.time-.38-begin));
 const before=next.time-t;
 const after=t-prev.time;
 const hit=before<.72?Math.sin(Math.PI*.5*clamp((.72-before)/.72)):after>=0&&after<.35?1-after/.35:0;
 const active=after<.35&&before>.72?strikes.find(s=>s.time===prev.time):next;
 return {x:mix(prev.x,next.x,f),z:mix(prev.z,next.z,f),hit,height:active?.height??1.65,aim:Math.sign(next.x-prev.x)};
}
export function strikePoint(s:Strike){const side=s.role==='vlad'?1:-1;return {x:s.x-side*.52,y:s.height,z:s.z-side*.49};}
export function badmintonShuttle(t:number,winner:CharacterId='alina'){
 const strikes=badmintonStrikes(winner),first=strikes[0],last=strikes.at(-1)!;
 if(t<first.time){const p=strikePoint(first),f=smooth(t/first.time);return {x:p.x,y:mix(.98,p.y,f)+.22*Math.sin(f*Math.PI),z:p.z+.12*(1-f),dx:0,dy:1,dz:-1};}
 for(let i=0;i<strikes.length-1;i++){const a=strikes[i],b=strikes[i+1];if(t>b.time)continue;
  const f=clamp((t-a.time)/(b.time-a.time)),u=strikePoint(a),v=strikePoint(b),curve=(i%3-1)*.16;
  return {x:mix(u.x,v.x,f)+curve*Math.sin(Math.PI*f),y:mix(u.y,v.y,f)+4*a.arc*f*(1-f),z:mix(u.z,v.z,f),dx:v.x-u.x+Math.PI*curve*Math.cos(Math.PI*f),dy:v.y-u.y+4*a.arc*(1-2*f),dz:v.z-u.z};
 }
 const p=strikePoint(last),f=clamp((t-last.time)/2.5),side=winner==='alina'?1:-1;return {x:mix(p.x,.55*side,f),y:mix(p.y,.055,f)+.8*Math.sin(Math.PI*f),z:mix(p.z,1.45*side,f),dx:.55*side-p.x,dy:.055-p.y+.8*Math.PI*Math.cos(Math.PI*f),dz:1.45*side-p.z};
}
export function badmintonWinner(random:()=>number=Math.random):CharacterId{return random()<.5?'vlad':'alina';}
