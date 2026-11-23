import { formatRub } from '../src/shared/economy';
import { names, type CharacterId, type GameState } from '../src/shared/protocol';
import { isSavingsGoal,isSpendingCategory,MAX_LIMIT,MAX_SAVINGS,
  MAX_TARGET,MAX_TRANSFER,SAVINGS_GOALS,syncBudgetPeriod,
  type BudgetCommand,type SavingsMovement } from '../src/shared/familyBudget';

const validAmount=(n:unknown,upper:number):n is number=>
  Number.isSafeInteger(n)&&Number(n)>=1&&Number(n)<=upper;

/** One atomic household wallet transaction: either everyone sees the update
 * or nobody does. Banked money is deliberately NOT a ledger expense/income.
 */
export function applyBudgetCommand(source:GameState,role:CharacterId,command:BudgetCommand):
  |{ok:true;state:GameState;message:string}
  |{ok:false;reason:string}{
  if(!source.savings)return {ok:false,reason:'Копилка пока не готова'};
  const state=structuredClone(source);
  const budget=state.savings;
  syncBudgetPeriod(budget,state.clock);
  let message='';
  if(command.type==='budget_deposit'||command.type==='budget_withdraw'){
    if(!validAmount(command.amount,MAX_TRANSFER))
      return {ok:false,reason:'Укажи целую сумму от 1 до 500 000 ₽'};
    const amount=command.amount;
    if(command.type==='budget_deposit'){
      if(state.money<amount)return {ok:false,reason:'На семейном счёте недостаточно денег'};
      if(budget.balance>MAX_SAVINGS-amount)
        return {ok:false,reason:'Копилка достигла максимального размера'};
      state.money-=amount;budget.balance+=amount;
      message=names[role]+': в копилку отложено '+formatRub(amount);
    }else{
      if(budget.balance<amount)return {ok:false,reason:'В копилке недостаточно денег'};
      state.money+=amount;budget.balance-=amount;
      message=names[role]+': из копилки возвращено '+formatRub(amount)+' на семейный счёт';
    }
    const row:SavingsMovement={
      id:(budget.history.at(-1)?.id??0)+1,
      day:state.clock.day,minute:state.clock.minute,actor:role,
      kind:command.type==='budget_deposit'?'deposit':'withdraw',
      amount,goal:budget.goal,
    };
    budget.history.push(row);
    if(budget.history.length>24)budget.history.splice(0,budget.history.length-24);
  }else if(command.type==='budget_goal'){
    if(!isSavingsGoal(command.goal)||!validAmount(command.target,MAX_TARGET)||
        command.target<1000)
      return {ok:false,reason:'Укажи существующую цель и сумму от 1 000 до 2 000 000 ₽'};
    budget.goal=command.goal;
    budget.target=command.target;
    message=names[role]+': новая семейная цель — '+SAVINGS_GOALS[command.goal].label+
      ', '+formatRub(command.target);
  }else if(command.type==='budget_limit'){
    if(!isSpendingCategory(command.category)||!validAmount(command.amount,MAX_LIMIT))
      return {ok:false,reason:'Лимит должен быть целым числом от 1 до 1 000 000 ₽'};
    budget.limits[command.category]=command.amount;
    message=names[role]+': обновлён лимит на '+command.category+' — '+
      formatRub(command.amount)+' за 10 игровых дней';
  }else return {ok:false,reason:'Неизвестная финансовая операция'};
  state.revision++;
  return {ok:true,state,message};
}
