import { gameMinutes, type GameClock } from './life';
import { BILLING_PERIOD } from './services';
import type { LedgerEntry } from './economy';

export const SAVINGS_GOALS = {
  reserve: { icon:'🛟', label:'Подушка безопасности', target:20000 },
  home: { icon:'🏡', label:'Улучшения дома', target:30000 },
  alinaStudio: { icon:'💇', label:'Будущая студия Алины', target:150000 },
  vladStudio: { icon:'💻', label:'Будущая студия Влада', target:150000 },
  holiday: { icon:'🌴', label:'Совместный отдых', target:50000 },
} as const;
export type SavingsGoal = keyof typeof SAVINGS_GOALS;

export const SPENDING_CATEGORIES = {
  groceries: {icon:'🥕', label:'Продукты', limit:6500},
  takeout: {icon:'🍕',label:'Готовая еда и доставка',limit:3500},
  pets: {icon:'🐾',label:'Питомцы',limit:2200},
} as const;
export type SpendingCategory = keyof typeof SPENDING_CATEGORIES;
export const SPENDING_KEYS=Object.keys(SPENDING_CATEGORIES) as SpendingCategory[];

export type SavingsMovement={
  id:number; day:number; minute:number; actor:'vlad'|'alina';
  kind:'deposit'|'withdraw';amount:number;goal:SavingsGoal;
};
export interface FamilyBudget {
  balance:number;
  goal:SavingsGoal;
  target:number;
  period:number;
  limits:Record<SpendingCategory,number>;
  spent:Record<SpendingCategory,number>;
  history:SavingsMovement[];
}
export const BUDGET_HISTORY_LIMIT=24;
export const MAX_SAVINGS=1000000000;
export const MAX_TRANSFER=500000;
export const MAX_TARGET=2000000;
export const MAX_LIMIT=1000000;

export function budgetPeriod(clock:GameClock):number{
  return Math.floor(gameMinutes(clock)/BILLING_PERIOD);
}
export function initialFamilyBudget(clock:GameClock):FamilyBudget {
  return {
    balance:0,goal:'reserve',target:SAVINGS_GOALS.reserve.target,
    period:budgetPeriod(clock),
    limits: Object.fromEntries(SPENDING_KEYS.map(id=>[id,SPENDING_CATEGORIES[id].limit]))
      as Record<SpendingCategory,number>,
    spent:{groceries:0,takeout:0,pets:0},history:[],
  };
}
export function isSavingsGoal(value:unknown):value is SavingsGoal{
  return typeof value==='string'&&Object.hasOwn(SAVINGS_GOALS,value);
}
export function isSpendingCategory(value:unknown):value is SpendingCategory{
  return typeof value==='string'&&Object.hasOwn(SPENDING_CATEGORIES,value);
}
const whole=(value:unknown,max:number):value is number=>
  Number.isSafeInteger(value)&&Number(value)>=0&&Number(value)<=max;
export function validFamilyBudget(value:unknown):value is FamilyBudget{
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const raw=value as Partial<FamilyBudget>;
  if(!whole(raw.balance,MAX_SAVINGS)||!isSavingsGoal(raw.goal)||
      !whole(raw.target,MAX_TARGET)||raw.target!<1000||
      !whole(raw.period,100000000))return false;
  if(!raw.limits||!raw.spent||typeof raw.limits!=='object'||typeof raw.spent!=='object')return false;
  for(const id of SPENDING_KEYS){
    if(!whole(raw.limits[id],MAX_LIMIT)||!whole(raw.spent[id],1000000000))return false;
  }
  if(!Array.isArray(raw.history)||raw.history.length>BUDGET_HISTORY_LIMIT)return false;
  let last=0;
  for(const row of raw.history){
    if(!row||!whole(row.id,Number.MAX_SAFE_INTEGER)||row.id<=last||
      !whole(row.day,100000000)||row.day<1||!whole(row.minute,1439)||
      (row.actor!=='vlad'&&row.actor!=='alina')||
      (row.kind!=='deposit'&&row.kind!=='withdraw')||
      !whole(row.amount,MAX_TRANSFER)||row.amount<1||!isSavingsGoal(row.goal))return false;
    last=row.id;
  }
  return true;
}
export function syncBudgetPeriod(budget:FamilyBudget,clock:GameClock):void{
  const period=budgetPeriod(clock);
  if(budget.period===period)return;
  budget.period=period;
  budget.spent={groceries:0,takeout:0,pets:0};
}
/** Existing household saves had a 40-entry ledger but no savings.
 * Migrate using only the entries we still know about; never invent spending.
 */
export function restoreFamilyBudget(old:FamilyBudget|undefined,clock:GameClock,ledger:LedgerEntry[]):FamilyBudget{
  const plan=old??initialFamilyBudget(clock);
  if(old){syncBudgetPeriod(plan,clock);return plan;}
  const start=budgetPeriod(clock)*BILLING_PERIOD;
  const now=gameMinutes(clock);
  for(const row of ledger){
    const at=(row.day-1)*1440+row.minute;
    if(row.kind==='expense'&&isSpendingCategory(row.category)&&at>=start&&at<=now)
      plan.spent[row.category]+=row.amount;
  }
  return plan;
}

export type BudgetCommand=
  | {type:'budget_deposit'|'budget_withdraw';amount:number}
  | {type:'budget_goal';goal:SavingsGoal;target:number}
  | {type:'budget_limit';category:SpendingCategory;amount:number};

export function spendingStatus(budget:FamilyBudget,id:SpendingCategory):{
  spent:number;limit:number;left:number;percent:number;
}{
  const spent=budget.spent[id]??0,limit=budget.limits[id];
  return {spent,limit,left:Math.max(0,limit-spent),percent:limit>0?spent/limit*100:0};
}
