import type { PetId } from './pets';
import { PET_ROAM } from './pets';

/** Preferences among EXISTING, nav-validated wandering points.
 * The route solver must still approve a path and handle another pet occupying
 * the target; this helper never teleports a pet or bypasses hunger/sleep. */
export function preferredPetWanderTarget(
  id: PetId, gameMinute: number, random: () => number = Math.random,
): number {
  const hour = Number.isFinite(gameMinute)
    ? ((Math.floor(gameMinute / 60) % 24) + 24) % 24 : 12;
  const daytime=hour>=7 && hour<20;
  // Verdell loves sniffing round the garden by day, checking the front
  // rooms in the evening. Simba favors quiet warm nooks of the house,
  // occasionally visiting the entrance and lawn like an independent cat.
  const favorites:readonly number[] = id==='verdell'
    ? daytime ? [7,8,9,10] : [0,1,4,5]
    : daytime ? [2,3,4,5] : [0,2,4,5];
  const chance=Math.min(.999999,Math.max(0,random()));
  const options=chance<.70?favorites:PET_ROAM.map((_,index)=>index);
  return options[Math.floor(Math.min(.999999,Math.max(0,random()))*options.length)];
}
