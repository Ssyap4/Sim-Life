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
