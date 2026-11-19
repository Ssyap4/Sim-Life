import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { initialState, type CharacterId, type GameState } from '../src/shared/protocol';
import { EMPTY_MEALS, EMPTY_PANTRY } from '../src/shared/food';
import { INITIAL_PETS, INITIAL_PET_FOOD, PET_IDS, type PetState } from '../src/shared/pets';
import { INITIAL_CLOCK, INITIAL_DAILY_NEEDS } from '../src/shared/life';

export interface ServerFiles {
  dataDir: string;
  access: Record<CharacterId, string>;
  load(): GameState;
  save(state: GameState): void;
}

const isValidState = (value: unknown): value is GameState => {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<GameState>;
  if (state.version !== 2 || !Number.isSafeInteger(state.revision) ||
      !Number.isSafeInteger(state.money) || state.money! < 0 ||
      !state.pantry || !state.characters) return false;
  // A clock was added to existing version-2 households; never reset old saves.
  if (state.clock !== undefined && (!Number.isSafeInteger(state.clock.day) || state.clock.day < 1 ||
      !Number.isSafeInteger(state.clock.minute) || state.clock.minute < 0 ||
      state.clock.minute >= 1440)) return false;
  const pantry = state.pantry as Record<string, unknown>;
  const meals = state.meals as Record<string, unknown> | undefined;
  if (!Number.isSafeInteger(pantry.eggs) || Number(pantry.eggs) < 0 ||
      !Number.isSafeInteger(pantry.bread) || Number(pantry.bread) < 0) return false;
  // Older version-2 saves only had eggs and bread; missing catalogue keys are
  // handled by load() without ever discarding their money, skills or progress.
  if (!Object.keys(EMPTY_PANTRY).every((key) => pantry[key] === undefined ||
    Number.isSafeInteger(pantry[key]) && Number(pantry[key]) >= 0 && Number(pantry[key]) <= 99)) return false;
  if (meals !== undefined && (!meals || !Object.keys(EMPTY_MEALS).every((key) =>
    meals[key] === undefined || Number.isSafeInteger(meals[key]) &&
      Number(meals[key]) >= 0 && Number(meals[key]) <= 30))) return false;
  // Pet fields were introduced after version 2 shipped; old saves may omit them.
  const petData = state.pets as Record<string, PetState> | undefined;
  const petFood = state.petFood as Record<string, number> | undefined;
  if (petData !== undefined && (!petData || !PET_IDS.every((id) => {
    const pet = petData[id];
    return pet && (['satiety', 'happiness', 'bond'] as const).every((field) =>
      Number.isSafeInteger(pet[field]) && pet[field] >= 0 && pet[field] <= 100);
  }))) return false;
  if (petFood !== undefined && (!petFood || !PET_IDS.every((id) =>
    Number.isSafeInteger(petFood[id]) && petFood[id] >= 0 && petFood[id] <= 24))) return false;
  return (['vlad', 'alina'] as const).every((role) => {
    const p = state.characters?.[role];
    if (!p) return false;
    return (['hunger', 'energy', 'mood', 'skill'] as const).every((key) =>
      typeof p[key] === 'number' && Number.isFinite(p[key]) && p[key] >= 0 && p[key] <= 100,
    ) && (['hygiene', 'social', 'fun', 'comfort'] as const).every((key) =>
      p[key] === undefined || typeof p[key] === 'number' && Number.isFinite(p[key]) &&
        p[key] >= 0 && p[key] <= 100,
    ) && Number.isFinite(p.x) && Number.isFinite(p.z) &&
      Math.abs(p.x) <= 6 && Math.abs(p.z) <= 5 &&
      ['idle', 'sit', 'sleep', 'work'].includes(p.pose);
  });
};

export function openServerFiles(dataDir: string): ServerFiles {
  mkdirSync(dataDir, { recursive: true });
  const accessPath = join(dataDir, 'access.json');
  let access: Record<CharacterId, string>;
  if (existsSync(accessPath)) {
    const saved: unknown = JSON.parse(readFileSync(accessPath, 'utf8'));
    if (!saved || typeof saved !== 'object') throw new Error('Invalid access.json');
    const record = saved as Record<string, unknown>;
    if (typeof record.vlad !== 'string' || record.vlad.length < 12 ||
        typeof record.alina !== 'string' || record.alina.length < 12) {
      throw new Error('Invalid access.json credentials');
    }
    access = { vlad: record.vlad, alina: record.alina };
  } else {
    access = {
      vlad: randomBytes(10).toString('hex').toUpperCase(),
      alina: randomBytes(10).toString('hex').toUpperCase(),
    };
    writeFileSync(accessPath, JSON.stringify(access, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  }
  const statePath = join(dataDir, 'household.json');

  return {
    dataDir, access,
    load(): GameState {
      if (!existsSync(statePath)) return initialState();
      const data: unknown = JSON.parse(readFileSync(statePath, 'utf8'));
      if (!isValidState(data)) throw new Error('Saved household is invalid. Refusing to discard player progress.');
      return {
        ...data,
        clock: { ...INITIAL_CLOCK, ...data.clock },
        characters: {
          vlad: { ...INITIAL_DAILY_NEEDS, ...data.characters.vlad },
          alina: { ...INITIAL_DAILY_NEEDS, ...data.characters.alina },
        },
        pantry: { ...EMPTY_PANTRY, ...data.pantry },
        meals: { ...EMPTY_MEALS, ...data.meals },
        pets: { ...structuredClone(INITIAL_PETS), ...data.pets },
        petFood: { ...INITIAL_PET_FOOD, ...data.petFood },
      };
    },
    save(state: GameState): void {
      if (!isValidState(state)) throw new Error('Refusing to save invalid household');
      const temporary = join(dataDir, 'household.tmp');
      writeFileSync(temporary, JSON.stringify(state, null, 2) + '\n');
      if (existsSync(statePath)) copyFileSync(statePath, join(dataDir, 'household.backup.json'));
      renameSync(temporary, statePath);
    },
  };
}
