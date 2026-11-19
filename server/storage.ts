import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { initialState, type CharacterId, type GameState } from '../src/shared/protocol';

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
  if (!Number.isSafeInteger(state.pantry.eggs) || state.pantry.eggs < 0 ||
      !Number.isSafeInteger(state.pantry.bread) || state.pantry.bread < 0) return false;
  return (['vlad', 'alina'] as const).every((role) => {
    const p = state.characters?.[role];
    if (!p) return false;
    return (['hunger', 'energy', 'mood', 'skill'] as const).every((key) =>
      typeof p[key] === 'number' && Number.isFinite(p[key]) && p[key] >= 0 && p[key] <= 100,
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
      return data;
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
