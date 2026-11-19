import {
  PETS, PET_IDS, type PetId, type PetAction,
} from '../src/shared/pets';
import { names, type CharacterId, type GameState } from '../src/shared/protocol';

export type PetResult =
  | { ok: true; state: GameState; message: string }
  | { ok: false; reason: string };

const clamp = (number: number): number => Math.max(0, Math.min(100, number));
/** Pets are family members. No real-time health penalties or forced purchases. */
export function applyPetAction(
  source: GameState,
  role: CharacterId,
  pet: string,
  action: string,
): PetResult {
  if (!PET_IDS.some((id) => id === pet)) return { ok: false, reason: 'Неизвестный питомец' };
  if (!['buyFood', 'feed', 'play', 'pet', 'brush'].includes(action))
    return { ok: false, reason: 'Неизвестное действие питомца' };
  const id = pet as PetId;
  const kind = action as PetAction;
  const next = structuredClone(source);
  const data = next.pets[id];
  const spec = PETS[id];
  const actor = next.characters[role];
  let message = '';

  switch (kind) {
    case 'buyFood':
      if (next.money < spec.foodPrice)
        return { ok: false, reason: 'В семейном бюджете не хватает денег на корм' };
      if (next.petFood[id] > 24 - spec.foodAmount)
        return { ok: false, reason: 'Корма уже достаточно, сначала используйте запасы' };
      next.money -= spec.foodPrice;
      next.petFood[id] += spec.foodAmount;
      message = names[role] + ': куплен ' + spec.foodName + ' (+' + spec.foodAmount + ')';
      break;
    case 'feed':
      if (next.petFood[id] <= 0)
        return { ok: false, reason: 'Корм для ' + spec.name + ' закончился, сначала купи ещё' };
      next.petFood[id]--;
      data.satiety = clamp(data.satiety + 27);
      data.happiness = clamp(data.happiness + 6);
      data.bond = clamp(data.bond + 3);
      message = names[role] + ' покормил(а) питомца ' + spec.name;
      break;
    case 'play':
      if (actor.energy < 5) return { ok: false, reason: 'Для игры с питомцем нужно немного отдохнуть' };
      if (data.satiety < 8) return { ok: false, reason: spec.name + ' проголодался — сначала покорми' };
      data.satiety = clamp(data.satiety - 7);
      data.happiness = clamp(data.happiness + 18);
      data.bond = clamp(data.bond + 9);
      actor.energy = clamp(actor.energy - 5);
      actor.mood = clamp(actor.mood + 5);
      message = names[role] + ' играет с ' + spec.name;
      break;
    case 'pet':
      data.happiness = clamp(data.happiness + 9);
      data.bond = clamp(data.bond + 6);
      actor.mood = clamp(actor.mood + 3);
      message = names[role] + ' гладит ' + spec.name;
      break;
    case 'brush':
      data.happiness = clamp(data.happiness + 7);
      data.bond = clamp(data.bond + 11);
      actor.mood = clamp(actor.mood + 2);
      message = names[role] + ' ухаживает за шерстью ' + spec.name;
      break;
  }
  // Keep the authoritative character position consistent with the visual
  // approach. Pets may idle-wander cosmetically, but their care marker is stable.
  if (kind !== 'buyFood') {
    actor.x = spec.home.x;
    actor.z = spec.home.z + 0.78;
    actor.pose = 'idle';
  }
  next.revision++;
  return { ok: true, state: next, message };
}
