import {MathUtils} from 'three';
import type {PetIdleGesture} from './PetIdle';
import type {PetId} from '../shared/pets';

/** Local, additive performance channels. No root translation, timers, rewards
 * or world events. Four legs are ordered FL, HL, FR, HR. */
export type PetPerformance={
 y:number;z:number;pitch:number;roll:number;headPitch:number;headYaw:number;headRoll:number;
 headDrop:number;jaw:number;spine:number;tail:number;ear:number;eye:number;
 pawY:number[];pawZ:number[];pawPitch:number[];knee:number[];
};
export const newPetPerformance=():PetPerformance=>({
 y:0,z:0,pitch:0,roll:0,headPitch:0,headYaw:0,headRoll:0,headDrop:0,jaw:0,spine:0,tail:0,ear:0,eye:0,
 pawY:[0,0,0,0],pawZ:[0,0,0,0],pawPitch:[0,0,0,0],knee:[0,0,0,0],
});
export const PET_PERFORMANCES={
 verdell:['shake','yawn','sitLook','backStretch','earScratch','pawLick','downRest','sniffSweep','lookBack'],
 simba:['yawn','faceWash','arch','knead','stalk','earScratch','lookBack','sideStretch','pawLick'],
} as const satisfies Record<PetId,readonly PetIdleGesture[]>;
const ease=(t:number,a:number,b:number)=>MathUtils.smoothstep(t,a,b);
const window=(t:number,a:number,b:number,c:number,d:number)=>ease(t,a,b)*(1-ease(t,c,d));
export function samplePetPerformance(p:PetPerformance,id:PetId,gesture:PetIdleGesture|null,t:number,w:number):PetPerformance{
 p.y=p.z=p.pitch=p.roll=p.headPitch=p.headYaw=p.headRoll=p.headDrop=p.jaw=p.spine=p.tail=p.ear=p.eye=0;
 p.pawY.fill(0);p.pawZ.fill(0);p.pawPitch.fill(0);p.knee.fill(0);
 if(!gesture||w<=0)return p;
 const dog=id==='verdell',beat=Math.sin(t*7),front=[0,2],hind=[1,3];
 const fold=(legs:number[],v:number)=>{for(const i of legs){p.pawY[i]+=v*.11;p.knee[i]+=v*.58;p.pawPitch[i]-=v*.38;}};
 switch(gesture){
 case 'shake': {
  // Nose leads, then shoulders and hips, then ears and short tail settle.
  const a=window(t,.24,.55,2.0,2.7)*w;
  p.headYaw=.42*a*Math.sin(t*25);p.headRoll=.24*a*Math.sin(t*25);
  p.roll=.12*a*Math.sin(t*25-1.1);p.spine=.19*a*Math.sin(t*25-1.8);
  p.tail=.42*a*Math.sin(t*25-2.2);p.ear=.27*a*Math.sin(t*25-.4);p.eye=.32*a;
  break;
 }
 case 'yawn': {
  const a=window(t,.35,.95,1.8,2.65)*w;
  p.headPitch=-.29*a;p.headDrop=-.025*a;p.jaw=(dog?.085:.40)*a;p.eye=.86*a;
  p.ear=.13*a;p.pitch=-.035*a;break;
 }
 case 'sitLook': {
  const a=window(t,.15,.8,2.35,3.2)*w;
  p.y=-.095*a;p.pitch=-.23*a;p.headPitch=.14*a;p.headYaw=.39*a*Math.sin(t*2.7);
  p.headRoll=.14*a*Math.sin(t*2.7);fold(hind,a);
  for(const i of hind){p.pawZ[i]+=.10*a;p.pawPitch[i]+=.60*a;}break;
 }
 case 'backStretch': {
  const a=window(t,.25,.85,2.0,2.9)*w;
  p.pitch=.18*a;p.y=-.065*a;p.headPitch=.21*a;p.spine=.13*a;
  for(const i of front){p.pawZ[i]+=.15*a;p.pawPitch[i]-=.38*a;p.pawY[i]+=.07*a;p.knee[i]+=.42*a;}
  for(const i of hind){p.pawZ[i]-=.07*a;p.pawPitch[i]+=.15*a;}break;
 }
 case 'earScratch': {
  const a=window(t,.2,.7,2.25,3.0)*w,stroke=.55+.45*Math.sin(t*18);
  p.y=-.08*a;p.pitch=-.15*a;p.roll=.11*a;p.headRoll=-.24*a;p.headYaw=.18*a;
  fold(hind,a*.62);p.pawY[1]+=.15*a*stroke;p.pawPitch[1]-=.9*a*stroke;
  p.pawZ[1]+=.16*a;p.knee[1]+=.65*a;break;
 }
 case 'pawLick': case 'faceWash': {
  const a=window(t,.2,.65,2.3,3.05)*w,stroke=.55+.45*Math.sin(t*9);
  p.y=-.055*a;p.headPitch=.42*a;p.headYaw=-.22*a;p.headDrop=.07*a;
  p.pawY[0]=.23*a*(.75+.25*stroke);p.pawZ[0]=.18*a;
  p.pawPitch[0]=-1.05*a;p.knee[0]=.45*a;p.jaw=(dog?.022:.12)*a*stroke;
  if(gesture==='faceWash'){p.headRoll=.20*a*beat;p.pawZ[0]+=.06*a*beat;p.eye=.50*a;}
  break;
 }
 case 'downRest': {
  const a=window(t,.2,.9,2.3,3.15)*w;
  p.y=-.15*a;p.headDrop=.13*a;p.headPitch=.19*a;p.eye=.45*a;
  fold(front,a);fold(hind,a);for(const i of front)p.pawZ[i]+=.17*a;break;
 }
 case 'sniffSweep': {
  const a=window(t,.15,.5,2.5,3.1)*w;
  p.pitch=.095*a;p.y=-.035*a;p.headDrop=.14*a;p.headPitch=.63*a;p.headYaw=.45*a*Math.sin(t*4);
  p.headRoll=.08*a*Math.sin(t*4);p.tail=.18*a*beat;break;
 }
 case 'arch': {
  const a=window(t,.2,.85,2.15,3.0)*w;
  p.y=.055*a;p.spine=.35*a;p.headPitch=.20*a;p.headDrop=.04*a;p.tail=.25*a;
  for(let i=0;i<4;i++){p.pawY[i]-=.055*a;p.pawZ[i]+=(i%2===0?-.055:.055)*a;}break;
 }
 case 'knead': {
  const a=window(t,.25,.8,2.4,3.1)*w;
  p.y=-.10*a;p.headPitch=.21*a;p.headDrop=.075*a;p.eye=.38*a;
  for(const i of front){const k=.5+.5*Math.sin(t*9+(i===2?Math.PI:0));p.pawY[i]=a*.13*k;p.pawZ[i]=a*(.10+.07*k);p.pawPitch[i]=-.48*a*k;p.knee[i]=.45*a*k;}
  fold(hind,.4*a);break;
 }
 case 'stalk': {
  const a=window(t,.2,.7,2.4,3.05)*w;
  p.y=-.13*a;p.pitch=.08*a;p.headDrop=.045*a;p.headPitch=-.11*a;p.headYaw=.13*a*Math.sin(t*2);
  p.tail=.28*a*Math.sin(t*4);fold(front,.65*a);fold(hind,.8*a);break;
 }
 case 'lookBack': {
  const a=window(t,.2,.75,2.2,3.0)*w;
  p.headYaw=.87*a;p.headRoll=-.12*a;p.spine=.19*a;p.tail=-.31*a;
  p.ear=.15*a;break;
 }
 case 'sideStretch': {
  const a=window(t,.2,.75,2.1,3.05)*w;
  p.y=-.075*a;p.roll=.18*a;p.spine=-.15*a;p.headYaw=-.32*a;p.headPitch=-.15*a;
  for(const i of front){p.pawZ[i]+=.13*a;p.pawY[i]+=.07*a;p.pawPitch[i]-=.27*a;}
  fold(hind,.5*a);break;
 }
 }
 return p;
}