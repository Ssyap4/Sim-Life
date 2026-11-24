import type {CharacterId} from '../shared/protocol';

type Limb={x:number;y:number;z:number;bend:number;end:number};
type RestPose={roll:number;lift:number;headYaw:number;headPitch:number;headRoll:number;chestPitch:number;arms:[Limb,Limb];legs:[Limb,Limb]};
const limb=(x:number,y:number,z:number,bend:number,end=0):Limb=>({x,y,z,bend,end});
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const smooth=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};
const mixLimb=(a:Limb,b:Limb,t:number):Limb=>({x:mix(a.x,b.x,t),y:mix(a.y,b.y,t),z:mix(a.z,b.z,t),bend:mix(a.bend,b.bend,t),end:mix(a.end,b.end,t)});

/** Authored relaxed joint angles in resident-local axes. Root and mattress
 * anchor never move horizontally. Side turns are bounded toward the outer
 * edge of each sleeping lane; neither sleeper rolls into the other. */
export function sleepPosture(id:CharacterId,seconds:number,awake=false):RestPose{
 const sign=id==='vlad'?-1:1;
 const time=Math.max(0,seconds),cycle=(time+(id==='vlad'?0:39))%92;
 // Long quiet holds, with one slow roll out and back per cycle.
 const side=awake?(id==='vlad'?.26:.66):smooth((cycle-31)/4)*(1-smooth((cycle-77)/4));
 const back:RestPose={
  roll:sign*.13,lift:0,headYaw:sign*.19,headPitch:.025,headRoll:sign*.035,chestPitch:.018,
  arms:[limb(-.06,.96,-.08,-1.27,-.10),limb(-.18,-.12,.16,-.32,.10)],
  legs:[limb(-.24,.06,-.055,.49,-.16),limb(-.065,-.08,.045,.16,-.12)],
 };
 if(id==='alina'){back.arms.reverse();back.legs.reverse();for(const l of back.arms){l.y=-l.y;l.z=-l.z;}for(const l of back.legs){l.y=-l.y;l.z=-l.z;}}
 const lower=limb(-.57,sign*.18,sign*.10,-1.65,.12);
 const upper=limb(-.19,sign*.88,sign*.11,-1.28,-.12);
 const curled=limb(-.60,0,0,1.04,-.10);
 const loose=limb(-.31,0,0,.56,-.10);
 const turn:RestPose={roll:sign*.88,lift:-.025,headYaw:-sign*.10,headPitch:.065,headRoll:sign*.045,chestPitch:.075,
  arms:id==='vlad'?[lower,upper]:[upper,lower],
  legs:id==='vlad'?[loose,curled]:[curled,loose]};
 return {roll:mix(back.roll,turn.roll,side),lift:mix(back.lift,turn.lift,side),
  headYaw:mix(back.headYaw,turn.headYaw,side),headPitch:mix(back.headPitch,turn.headPitch,side),headRoll:mix(back.headRoll,turn.headRoll,side),chestPitch:mix(back.chestPitch,turn.chestPitch,side),
  arms:[mixLimb(back.arms[0],turn.arms[0],side),mixLimb(back.arms[1],turn.arms[1],side)],
  legs:[mixLimb(back.legs[0],turn.legs[0],side),mixLimb(back.legs[1],turn.legs[1],side)]};
}