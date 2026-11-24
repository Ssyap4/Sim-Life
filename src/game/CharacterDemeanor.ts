import type { Needs } from '../shared/protocol';

/** A visual-only, bounded mood layer for the lightweight existing character rig.
 * Never changes navigation roots, gameplay needs, scene hierarchy or animations.
 * Important chore/contact poses win over casual body language. */
export type DemeanorNeeds = Pick<Needs,'mood'|'energy'|'hunger'>;
export interface DemeanorPose {
  /** Extra 3D smile in the existing facial controller, 0..0.18. */
  smile: number;
  /** Small upper-body forward lean (radians), <=0.055. */
  shoulders: number;
  /** Subtle downward gaze (radians), <=0.10. */
  gaze: number;
  /** Person's willingness to acknowledge a nearby partner visually. */
  friendly: boolean;
}
const clamp = (value:number) => Number.isFinite(value) ? Math.max(0,Math.min(100,value)) : 50;

/** Low energy and low mood are meaningful even between occasional yawns.
 * Never slouch during a real activity, seated action, contact or sleep. */
export function characterDemeanor(
  needs:DemeanorNeeds|null, mode:'idle'|'walking'|'busy'|'sleep',
):DemeanorPose {
  if(!needs||mode==='busy'||mode==='sleep')
    return {smile:0,shoulders:0,gaze:0,friendly:false};
  const mood=clamp(needs.mood),energy=clamp(needs.energy),hunger=clamp(needs.hunger);
  const dull=Math.max(0,(52-mood)/52);
  const tired=Math.max(0,(44-energy)/44);
  const hungry=Math.max(0,(34-hunger)/34);
  const bright=Math.max(0,(mood-62)/38) * Math.max(0.2,Math.min(1,(energy-18)/52));
  const walking=mode==='walking';
  // Existing locomotion and contact separation are always preserved.
  return {
    smile:Math.min(.18,bright*.18),
    shoulders:Math.min(walking?.025:.055,dull*.030+tired*.033),
    gaze:Math.min(walking?.045:.10,dull*.072+tired*.043+hungry*.015),
    friendly:mood>=48&&energy>=25&&hunger>=16,
  };
}

/** Server-selected emotion, rendered on the existing rig only. Negative smile
 * offsets suppress the idle smile; the authored GLB has no frown/brow key. */
import type { EmotionId } from '../shared/emotions';
export interface ExpressivePose extends DemeanorPose {
  lids:number; swing:number; tilt:number;
}
type Expression = readonly [smile:number, shoulders:number, gaze:number, lids:number, swing:number, tilt:number];
const expressions:Record<EmotionId,Expression> = {
  happy:        [.29,-.022,-.035,.035,1.12,.025],
  inspired:     [.17,-.030,-.048,0,1.08,-.022],
  calm:         [.055,-.012,0,.075,.92,.012],
  tired:        [-.09,.092,.135,.32,.66,.012],
  hungry:       [-.06,.042,.075,.10,.85,0],
  uncomfortable:[-.10,.070,.10,.18,.76,-.025],
  lonely:       [-.07,.035,.095,.12,.84,.04],
  bored:        [-.06,.044,.045,.19,.79,-.045],
  sad:          [-.12,.075,.15,.18,.72,.035],
  tense:        [-.10,-.012,.025,.15,.87,-.012],
};
export function expressiveDemeanor(needs:DemeanorNeeds|null,mode:'idle'|'walking'|'busy'|'sleep',
  emotion:EmotionId|null):ExpressivePose {
  const base=characterDemeanor(needs,mode);
  if(!needs||mode==='busy'||mode==='sleep'||!emotion)
    return {...base,lids:0,swing:1,tilt:0};
  const [smile,shoulders,gaze,lids,swing,tilt]=expressions[emotion];
  const walk=mode==='walking';
  return {smile,shoulders:shoulders*(walk?.45:1),gaze:gaze*(walk?.55:1),
    lids,swing:walk?swing:1,tilt:tilt*(walk?.45:1),
    friendly:base.friendly&&!['sad','tense','uncomfortable','tired'].includes(emotion)};
}