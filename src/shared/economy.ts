import type { CharacterId, GameState } from './protocol';
export interface LedgerEntry {
  id: number;
  day: number;
  minute: number;
  actor: CharacterId;
  kind: 'expense' | 'income';
  category: 'groceries' | 'takeout' | 'pets' | 'work';
  amount: number;
  label: string;
}
export const LEDGER_LIMIT = 40;
export function addLedger(state: GameState, actor: CharacterId, kind: LedgerEntry['kind'],
  category: LedgerEntry['category'], amount: number, label: string): void {
  const previous = state.ledger.at(-1)?.id ?? 0;
  state.ledger.push({ id: previous + 1, day: state.clock.day, minute: state.clock.minute,
    actor, kind, category, amount, label: label.slice(0, 140) });
  if (state.ledger.length > LEDGER_LIMIT) state.ledger.splice(0, state.ledger.length - LEDGER_LIMIT);
}
export const formatRub = (n: number): string => new Intl.NumberFormat('ru-RU').format(n) + ' ₽';
