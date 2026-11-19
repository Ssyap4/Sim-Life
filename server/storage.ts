import { validWorld } from './locations';
import { initialWorld } from '../src/shared/locations';
import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { initialState, type CharacterId, type GameState } from '../src/shared/protocol';
import { EMPTY_MEALS, EMPTY_PANTRY, EMPTY_TAKEOUT } from '../src/shared/food';
import { LEDGER_LIMIT } from '../src/shared/economy';
import { JOBS, isJobId } from '../src/shared/jobs';
import { INITIAL_PETS, INITIAL_PET_FOOD, PET_IDS, PET_ROAM, PET_ROUTINES, type PetState } from '../src/shared/pets';
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
  if (state.world !== undefined && !validWorld(state.world)) return false;
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
  const takeout = state.takeout as Record<string, unknown> | undefined;
  if (takeout !== undefined && (!takeout || !Object.keys(EMPTY_TAKEOUT).every(key =>
    takeout[key] === undefined || Number.isSafeInteger(takeout[key]) &&
      Number(takeout[key]) >= 0 && Number(takeout[key]) <= 40))) return false;
  const shifts = state.shiftDays as Record<string, number> | undefined;
  if (shifts !== undefined && (!shifts ||
      !(['vlad','alina'] as const).every(role =>
        Number.isSafeInteger(shifts[role]) && shifts[role] >= 0))) return false;
  if (state.ledger !== undefined && (!Array.isArray(state.ledger) ||
      state.ledger.length > LEDGER_LIMIT ||
      !state.ledger.every(row => row && Number.isSafeInteger(row.id) && row.id > 0 &&
        Number.isSafeInteger(row.day) && row.day >= 1 &&
        Number.isSafeInteger(row.minute) && row.minute >= 0 && row.minute < 1440 &&
        Number.isSafeInteger(row.amount) && row.amount >= 0 &&
        (row.actor === 'vlad' || row.actor === 'alina') &&
        (row.kind === 'income' || row.kind === 'expense') &&
        ['groceries','takeout','pets','work'].includes(row.category) &&
        typeof row.label === 'string' && row.label.length <= 140))) return false;
  const activeShifts=state.activeShifts as Record<string, unknown> | undefined;
  if (activeShifts !== undefined && (!activeShifts || Array.isArray(activeShifts) ||
    Object.keys(activeShifts).some(role => role !== 'vlad' && role !== 'alina') ||
    !Object.values(activeShifts).every(raw => {
      if (!raw || typeof raw !== 'object') return false;
      const shift=raw as Record<string, unknown>;
      if (!isJobId(shift.job)) return false;
      const hours=shift.hours;
      return Number.isSafeInteger(hours) &&
        Number(hours) >= JOBS[shift.job].hoursMin &&
        Number(hours) <= JOBS[shift.job].hoursMax &&
        Number.isSafeInteger(shift.startedAt) && Number(shift.startedAt) >= 0 &&
        Number.isSafeInteger(shift.endsAt) &&
        Number(shift.endsAt) === Number(shift.startedAt) + Number(hours) * 60 &&
        (shift.targetPay === undefined ||
          Number.isSafeInteger(shift.targetPay) &&
          Number(shift.targetPay) >= JOBS[shift.job].payMin &&
          Number(shift.targetPay) <= JOBS[shift.job].payMax);
    }))) return false;
  // Pet fields were introduced after version 2 shipped; old saves may omit them.
  const petData = state.pets as Record<string, PetState> | undefined;
  const petFood = state.petFood as Record<string, number> | undefined;
  const point = (p: { x: number; z: number } | undefined) => p && Number.isFinite(p.x) && Number.isFinite(p.z) &&
    Math.abs(p.x) <= 6 && Math.abs(p.z) <= 5;
  if (petData !== undefined && (!petData || !PET_IDS.every((id) => {
    const pet = petData[id];
    const validMeter = (n: number) => Number.isFinite(n) && n >= 0 && n <= 100;
    const routine = pet?.routine;
    return pet && [pet.satiety, pet.happiness, pet.bond].every(validMeter) &&
      (pet.energy === undefined || validMeter(pet.energy)) && (pet.bladder === undefined || validMeter(pet.bladder)) &&
      (pet.position === undefined || point(pet.position)) && (pet.parkPosition === undefined || point(pet.parkPosition)) &&
      (routine === undefined || routine && PET_ROUTINES.includes(routine.kind) &&
        Number.isSafeInteger(routine.startedAt) && routine.startedAt >= 0 && Number.isSafeInteger(routine.until) &&
        routine.until > routine.startedAt && Number.isSafeInteger(routine.target) && routine.target >= 0 && routine.target < PET_ROAM.length &&
        routine.route && point(routine.route.from) && Array.isArray(routine.route.path) && routine.route.path.length <= 60 &&
        routine.route.path.every(point));
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
        world: data.world ?? initialWorld(),
        clock: { ...INITIAL_CLOCK, ...data.clock },
        characters: {
          vlad: { ...INITIAL_DAILY_NEEDS, ...data.characters.vlad },
          alina: { ...INITIAL_DAILY_NEEDS, ...data.characters.alina },
        },
        pantry: { ...EMPTY_PANTRY, ...data.pantry },
        meals: { ...EMPTY_MEALS, ...data.meals },
        takeout: { ...EMPTY_TAKEOUT, ...data.takeout },
        ledger: [...(data.ledger ?? [])],
        shiftDays: Object.assign({ vlad: 0, alina: 0 }, data.shiftDays),
        activeShifts: { ...data.activeShifts },
        pets: {
          verdell: { ...INITIAL_PETS.verdell, ...data.pets?.verdell },
          simba: { ...INITIAL_PETS.simba, ...data.pets?.simba },
        },
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
