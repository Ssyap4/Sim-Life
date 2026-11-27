import type {CareId} from '../shared/vanity';
export type CarePhase='hold'|'dispense'|'apply'|'lip'|'bomb'|'relax'|'shave'|'bodyCream'|'shampoo'|'hairMask'|'rinse'|'dry'|'straighten'|'curl';
const smooth=(n:number)=>{const x=Math.max(0,Math.min(1,n));return x*x*(3-2*x);};
const envelope=(t:number,start:number,end:number)=>smooth((t-start)/.65)*smooth((end-t)/.65);
export function careFrame(id:CareId,t:number):{phase:CarePhase;blend:number;stroke:number}{
 const a=Math.max(0,Number.isFinite(t)?t:0),stroke=Math.sin(a*3.1);
 if(id.startsWith('bathHair')){const end=id==='bathHairWash'?45:id==='bathHairMask'?90:180;const phase=a<5?'hold':a<23?'shampoo':a>=end-13?'rinse':id!=='bathHairWash'&&a<38?'hairMask':'relax';return {phase,blend:phase==='relax'?0:smooth((a%6)/.55)*(1-smooth(((a%6)-5.25)/.65)),stroke};}
 if(id==='hairDry'||id==='hairStraight'||id==='hairCurl'){const p=a%12;return {phase:p<2?'hold':id==='hairDry'?'dry':id==='hairStraight'?'straighten':'curl',blend:envelope(p,p<2?0:2,p<2?2:12),stroke};}
 if(id.startsWith('bath')){
  if(a<4.2)return {phase:'bomb',blend:envelope(a,0,4.2),stroke:smooth(a/3.5)};
  if((id==='bathShave'||id==='bathRitual')&&a>=16&&a<31)return {phase:'shave',blend:envelope(a,16,31),stroke};
  if((id==='bathMilk'||id==='bathRitual')&&a>=34&&a<49)return {phase:'bodyCream',blend:envelope(a,34,49),stroke};
  return {phase:'relax',blend:0,stroke};
 }
 const p=a%12;
 if(id==='lipCare')return p<2.2?{phase:'hold',blend:smooth(p/.6),stroke}:{phase:'lip',blend:envelope(p,2.2,12),stroke};
 if(['hydrate','serum','faceMask','handCream','skin'].includes(id)){
  if(p<1.6)return {phase:'hold',blend:smooth(p/.6),stroke};
  if(p<4)return {phase:'dispense',blend:envelope(p,1.6,4),stroke};
  return {phase:'apply',blend:envelope(p,4,12),stroke};
 }
 return {phase:'hold',blend:0,stroke};
}
export function usesCareContact(id:CareId){return id.startsWith('bath')||['hydrate','serum','faceMask','handCream','skin','lipCare','hairDry','hairStraight','hairCurl'].includes(id);}
