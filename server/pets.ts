import { HOME_FLOOR } from '../src/shared/home';
import {
  PETS, PET_IDS, PET_ROAM, PET_SPEED, PET_BOWL_CAPACITY, PET_AUTO_EAT_BELOW, PET_EAT_SATIETY_GAIN,
  PET_FOOD_MAX_REFILLS, petApproach, petDestination, type PetId, type PetAction, type PetRoutine,
} from '../src/shared/pets';
import { names, type CharacterId, type GameState } from '../src/shared/protocol';
import { addLedger } from '../src/shared/economy';
import { placeObstacles } from '../src/shared/locations';
import { GAME_MINUTES_PER_REAL_SECOND } from '../src/shared/life';
import { planWalk, sampleWalk } from '../src/game/navigation';

export type PetResult =
  | { ok: true; state: GameState; message: string }
  | { ok: false; reason: string };

const clamp = (number: number): number => Math.max(0, Math.min(100, number));
const homeObstacles = placeObstacles('home');

export function petCarePoint(state: GameState, id: PetId, action?: PetAction) {
  return petApproach(action === 'feed' ? PETS[id].bowl : state.pets[id].position,
    homeObstacles, HOME_FLOOR);
}

export function pausePetRoutine(state: GameState, id: PetId, now: number): void {
  const pet = state.pets[id];
  if (!pet.routine) return;
  pet.position = sampleWalk(pet.routine.route, Math.max(0, now - pet.routine.startedAt) * PET_SPEED[id] / GAME_MINUTES_PER_REAL_SECOND).from;
  delete pet.routine;
}

/** Called on the clock's isolated state. Routes are cosmetic, supplies are authoritative. */
export function runPetRoutines(state: GameState, minutes: number, now: number,
  occupied: ReadonlySet<PetId>, random = Math.random): void {
  for (const id of PET_IDS) {
    const pet = state.pets[id];
    const drain = (value: number, rate: number) => Math.round(clamp(value - minutes * rate / 60) * 100) / 100;
    pet.satiety = drain(pet.satiety, 4);
    pet.energy = drain(pet.energy, 5);
    pet.bladder = drain(pet.bladder, 7);
    const previous = pet.routine;
    if (previous) pet.position = sampleWalk(previous.route, (now - previous.startedAt) * PET_SPEED[id] / GAME_MINUTES_PER_REAL_SECOND).from;
    if ((id === 'verdell' && state.world.dogWalker) || occupied.has(id)) {
      delete pet.routine;
      continue;
    }
    // A pre-update saved 'eat' route cannot mime eating from a newly empty bowl.
    if (previous && previous.until > now && !(previous.kind === 'eat' && state.petBowls[id] === 0)) continue;
    if (previous?.kind === 'eat' && state.petBowls[id] > 0) {
      // The bowl — not a packet in household storage — pays for each meal.
      state.petBowls[id]--;
      pet.satiety = clamp(pet.satiety + PET_EAT_SATIETY_GAIN);
      pet.happiness = clamp(pet.happiness + 3);
    } else if (previous?.kind === 'toilet') {
      pet.bladder = 100;
    } else if (previous?.kind === 'sleep') {
      pet.energy = clamp(pet.energy + 33);
    }
    let kind: PetRoutine['kind'] = 'wander';
    if (pet.satiety < PET_AUTO_EAT_BELOW && state.petBowls[id] > 0) kind = 'eat';
    else if (pet.bladder <= 63) kind = 'toilet';
    else if (pet.energy <= 63) kind = 'sleep';
    let target = Math.floor(random() * PET_ROAM.length);
    if (previous?.kind === 'wander' && previous.target === target) target = (target + 1) % PET_ROAM.length;
    const duration = kind === 'sleep' ? 16 : kind === 'wander' ? 8 + Math.floor(random() * 5) : 10;
    const route = planWalk(pet.position, petDestination(id, { kind, target }), homeObstacles, HOME_FLOOR);
    pet.routine = route ? { kind, target, startedAt: now, until: now + duration, route } : undefined;
  }
}
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
      if (next.petFood[id] > PET_FOOD_MAX_REFILLS - spec.foodAmount)
        return { ok: false, reason: 'Корма уже достаточно, сначала используйте запасы' };
      next.money -= spec.foodPrice;
      next.petFood[id] += spec.foodAmount;
      addLedger(next,role,'expense','pets',spec.foodPrice,spec.foodName);
      message = names[role] + ': куплена пачка ' + spec.foodName + ' (+' + spec.foodAmount + ' насыпаний по 3 порции)';
      break;
    case 'feed':
      if (next.petBowls[id] > 0)
        return { ok: false, reason: 'В миске ' + spec.name + ' ещё есть корм. Дождись, пока питомец его съест' };
      if (next.petFood[id] <= 0)
        return { ok: false, reason: 'Корм для ' + spec.name + ' закончился — купи ещё одну пачку' };
      next.petFood[id]--;
      next.petBowls[id] += PET_BOWL_CAPACITY;
      message = names[role] + ': насыпано ' + PET_BOWL_CAPACITY + ' порции в миску ' + spec.name +
        ' · осталось насыпаний в запасе: ' + next.petFood[id];
      break;
    case 'play':
      if (actor.energy < 5) return { ok: false, reason: 'Для игры с питомцем нужно немного отдохнуть' };
      if (data.satiety < 8) return { ok: false, reason: spec.name + ' проголодался — сначала покорми' };
      data.satiety = clamp(data.satiety - 7);
      data.happiness = clamp(data.happiness + 18);
      data.bond = clamp(data.bond + 9);
      actor.energy = clamp(actor.energy - 5);
      actor.mood = clamp(actor.mood + 5);
      actor.fun = clamp(actor.fun + 12);
      actor.social = clamp(actor.social + 8);
      message = names[role] + ' играет с ' + spec.name;
      break;
    case 'pet':
      data.happiness = clamp(data.happiness + 9);
      data.bond = clamp(data.bond + 6);
      actor.mood = clamp(actor.mood + 3);
      actor.social = clamp(actor.social + 7);
      message = names[role] + ' гладит ' + spec.name;
      break;
    case 'brush':
      data.happiness = clamp(data.happiness + 7);
      data.bond = clamp(data.bond + 11);
      actor.mood = clamp(actor.mood + 2);
      actor.social = clamp(actor.social + 4);
      message = names[role] + ' ухаживает за шерстью ' + spec.name;
      break;
  }
  // The pet stays at its shared position while the household cares for it.
  if (kind !== 'buyFood') {
    const point = petCarePoint(next, id, kind);
    if (point) Object.assign(actor, point, { pose: 'idle' });
  }
  next.revision++;
  return { ok: true, state: next, message };
}
