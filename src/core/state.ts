export type CharacterId = 'vlad' | 'alina';

export interface Needs {
  hunger: number;
  energy: number;
  mood: number;
  skill: number;
}

export interface GameState {
  version: 1;
  money: number;
  pantry: { eggs: number; bread: number };
  characters: Record<CharacterId, Needs>;
}

const STORAGE_KEY = 'sim-life-prototype-v1';

export const names: Record<CharacterId, string> = {
  vlad: 'Влад',
  alina: 'Алина',
};

const defaults = (): GameState => ({
  version: 1,
  money: 2500,
  pantry: { eggs: 4, bread: 3 },
  characters: {
    vlad: { hunger: 78, energy: 82, mood: 74, skill: 0 },
    alina: { hunger: 82, energy: 86, mood: 81, skill: 0 },
  },
});

export function loadState(): GameState {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (!text) return defaults();
    const raw: unknown = JSON.parse(text);
    if (!raw || typeof raw !== 'object' || !('version' in raw) || raw.version !== 1) return defaults();
    const input = raw as Partial<GameState>;
    if (typeof input.money !== 'number' || !Number.isFinite(input.money)) return defaults();
    if (!input.pantry || !input.characters?.vlad || !input.characters?.alina) return defaults();

    const safe = defaults();
    safe.money = Math.max(0, Math.round(input.money));
    safe.pantry.eggs = Math.max(0, Math.floor(Number(input.pantry.eggs) || 0));
    safe.pantry.bread = Math.max(0, Math.floor(Number(input.pantry.bread) || 0));
    for (const id of ['vlad', 'alina'] as const) {
      const inputNeeds = input.characters[id];
      for (const stat of ['hunger', 'energy', 'mood', 'skill'] as const) {
        const value = Number(inputNeeds[stat]);
        safe.characters[id][stat] = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : safe.characters[id][stat];
      }
    }
    return safe;
  } catch {
    return defaults();
  }
}

export function saveState(state: GameState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private browsing / restricted storage: playable without persistence.
  }
}

export function changeStat(state: GameState, id: CharacterId, stat: keyof Needs, amount: number): void {
  state.characters[id][stat] = Math.max(0, Math.min(100, state.characters[id][stat] + amount));
}
