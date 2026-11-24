import type { CharacterId, GameState } from './protocol';
import { syncBudgetPeriod,isSpendingCategory } from './familyBudget';
export interface LedgerEntry {
  id: number;
  day: number;
  minute: number;
  actor: CharacterId | 'family';
  kind: 'expense' | 'income';
  category: 'groceries' | 'takeout' | 'pets' | 'work' | 'services' | 'education' | 'furniture' | 'clothing';
  amount: number;
  label: string;
}
export const LEDGER_LIMIT = 40;
export function addLedger(state: GameState, actor: LedgerEntry['actor'], kind: LedgerEntry['kind'],
  category: LedgerEntry['category'], amount: number, label: string): void {
  const previous = state.ledger.at(-1)?.id ?? 0;
  state.ledger.push({ id: previous + 1, day: state.clock.day, minute: state.clock.minute,
    actor, kind, category, amount, label: label.slice(0, 140) });
  if (state.ledger.length > LEDGER_LIMIT) state.ledger.splice(0, state.ledger.length - LEDGER_LIMIT);
  // This tally is NOT derived from the 40-line visible journal: recording
  // every real grocery/pet/takeaway purchase prevents the plan losing spends.
  if(state.savings){
    syncBudgetPeriod(state.savings,state.clock);
    if(kind==='expense'&&isSpendingCategory(category)){
      state.savings.spent[category]+=amount;
    }
  }
}
export const formatRub = (n: number): string => new Intl.NumberFormat('ru-RU').format(n) + ' ₽';
