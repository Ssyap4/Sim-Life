import {formatRub} from './shared/economy';
import { clockLabel } from './shared/life';
import {BILLING_PERIOD,SERVICES} from './shared/services';
import {SAVINGS_GOALS,SPENDING_CATEGORIES,SPENDING_KEYS,spendingStatus,
  type BudgetCommand,type SavingsGoal,type SpendingCategory} from './shared/familyBudget';
import type {GameState} from './shared/protocol';

const el=<K extends keyof HTMLElementTagNameMap>(
  tag:K,cls='',text=''):HTMLElementTagNameMap[K]=>{
  const node=document.createElement(tag);node.className=cls;node.textContent=text;return node;
};
const moneyInput=(value:number,min:number,max:number)=>{
  const input=el('input','billing-budget-input');
  input.type='number';input.inputMode='numeric';
  input.min=String(min);input.max=String(max);input.step='100';
  input.value=String(value);
  return input;
};
function doButton(label:string,fn:()=>boolean,disabled=false){
  const button=el('button','billing-button',label);
  button.type='button';button.disabled=disabled;
  button.addEventListener('click',()=>{
    if(fn())button.disabled=true;
  });
  return button;
}

/** One shared controller for phone and laptop. No local-only balances: all
 * changes go through authenticated server transactions and are refreshed by
 * the authoritative household snapshot. */
export function renderFamilyBudget(state:GameState,send:(command:BudgetCommand)=>boolean):HTMLElement {
  const budget=state.savings;
  const panel=el('section','billing-service billing-family-budget');
  panel.dataset.familyBudget='true';
  const title=el('h3','','🏦 Семейная копилка и план');
  const hint=el('p','billing-budget-hint',
    'Общие деньги и накопления — разные кошельки. Оплата покупок и счетов идёт только с семейного счёта. Вернуть накопленное можно в любой момент.');
  panel.append(title,hint);
  const summary=el('div','billing-budget-summary');
  for(const [label,value] of [
    ['Доступно на расходы',state.money],
    ['Отложено',budget.balance],
    ['Всего у семьи',state.money+budget.balance],
  ] as [string,number][]){
    const item=el('div');
    item.append(el('small','',label),el('strong','',formatRub(value)));
    summary.append(item);
  }
  panel.append(summary);

  const goal=el('div','billing-budget-goal');
  goal.append(el('strong','','🎯 Цель накопления'));
  const select=el('select','billing-budget-select');
  select.dataset.budgetGoal='true';
  for(const [id,spec] of Object.entries(SAVINGS_GOALS) as [SavingsGoal,typeof SAVINGS_GOALS[SavingsGoal]][]){
    const option=document.createElement('option');
    option.value=id;option.textContent=spec.icon+' '+spec.label;
    select.append(option);
  }
  select.value=budget.goal;
  select.addEventListener('change',()=>{
    const id=select.value as SavingsGoal;
    const def=SAVINGS_GOALS[id];
    if(def&&send({type:'budget_goal',goal:id,target:def.target}))select.disabled=true;
  });
  const targetRow=el('div','billing-budget-edit');
  const amount=moneyInput(budget.target,1000,2000000);
  amount.dataset.budgetTarget='true';
  amount.setAttribute('aria-label','Сумма цели накопления');
  const saveTarget=doButton('Изменить цель',()=>{
    const target=Number(amount.value);
    if(!Number.isSafeInteger(target)||target<1000||target>2000000)return false;
    return send({type:'budget_goal',goal:budget.goal,target});
  });
  targetRow.append(amount,saveTarget);
  const progress=el('div','billing-budget-track');
  progress.setAttribute('role','progressbar');
  progress.setAttribute('aria-label','Прогресс накопления');
  progress.setAttribute('aria-valuemin','0');
  progress.setAttribute('aria-valuemax',String(budget.target));
  progress.setAttribute('aria-valuenow',String(Math.min(budget.target,budget.balance)));
  const fill=el('div','billing-budget-fill');
  fill.style.width=(Math.min(100,budget.balance/budget.target*100)).toFixed(1)+'%';
  progress.append(fill);
  goal.append(select,targetRow,progress,el('small','',
    formatRub(budget.balance)+' / '+formatRub(budget.target)+
    ' · '+Math.min(100,Math.floor(budget.balance/budget.target*100))+'%'));
  panel.append(goal);

  const transfers=el('div','billing-budget-transfers');
  transfers.append(el('strong','','Переложить деньги'));
  const customRow=el('div','billing-budget-edit');
  const amountInput=moneyInput(1000,1,500000);
  amountInput.dataset.budgetAmount='true';
  amountInput.setAttribute('aria-label','Сумма перевода в рублях');
  const deposit=doButton('В копилку',()=>{
    const n=Number(amountInput.value);
    return Number.isSafeInteger(n)&&n>0&&n<=500000&&n<=state.money &&
      send({type:'budget_deposit',amount:n});
  },!state.money);
  deposit.dataset.budgetDeposit='true';
  const withdraw=doButton('Вернуть',()=>{
    const n=Number(amountInput.value);
    return Number.isSafeInteger(n)&&n>0&&n<=500000&&n<=budget.balance &&
      send({type:'budget_withdraw',amount:n});
  },!budget.balance);
  withdraw.dataset.budgetWithdraw='true';
  customRow.append(amountInput,deposit,withdraw);
  transfers.append(customRow);
  const quick=el('div','billing-budget-quick');
  for(const n of [500,1000,3000]){
    const b=doButton('+'+formatRub(n),()=>send({type:'budget_deposit',amount:n}),n>state.money);
    b.dataset.budgetQuick=String(n);
    quick.append(b);
  }
  transfers.append(quick);
  panel.append(transfers);

  const late=state.billing.bills.filter(b=>b.paidAt===null);
  const owed=late.reduce((n,b)=>n+b.amount,0);
  const mandatory=Object.entries(SERVICES)
    .filter(([,v])=>v.category==='mandatory')
    .reduce((n,[id,service])=>{
      const status=state.billing.services[id as keyof typeof SERVICES];
      const due=status.nextDue;
      return n+(status.enabled&&status.autoRenew&&due!==null&&
        due>=budget.period*BILLING_PERIOD&&due<(budget.period+1)*BILLING_PERIOD
        ? (service.price??service.range?.[1]??0):0);
    },0);
  if(owed>0 || mandatory>state.money){
    const warning=el('p','billing-budget-warning',
      owed?'⚠️ Есть неоплаченные счета на '+formatRub(owed)+
        '. Накопления не оплачивают счета автоматически.':
        '⚠️ Обязательные платежи на этом отрезке могут превысить доступные деньги. Проверяй даты счетов перед переводом в копилку.');
    panel.append(warning);
  }

  const plan=el('section','billing-budget-plan');
  plan.append(el('h3','','📊 План расходов · 10 игровых дней'));
  plan.append(el('p','billing-budget-hint',
    'Лимиты — подсказки, а не запреты. Реальные покупки учитываются автоматически, даже когда старые строки истории уже скрыты.'));
  const periodNow=Math.floor((state.clock.day-1)*1440+state.clock.minute)/BILLING_PERIOD;
  const current=budget.period===Math.floor(periodNow);
  if(!current)plan.append(el('p','billing-budget-hint','Начался новый период: суммы обновятся при следующей финансовой операции.'));
  for(const id of SPENDING_KEYS){
    const def=SPENDING_CATEGORIES[id];
    const spent=current?spendingStatus(budget,id).spent:0;
    const limit=budget.limits[id];
    const row=el('div','billing-budget-category');
    row.append(el('strong','',def.icon+' '+def.label));
    row.append(el('small','',formatRub(spent)+' из '+formatRub(limit)+
      (spent>limit?' · превышение '+formatRub(spent-limit):' · остаток '+formatRub(limit-spent))));
    const track=el('div','billing-budget-track');
    const bar=el('div','billing-budget-fill'+(spent>limit?' over':''));
    bar.style.width=(Math.min(100,spent/limit*100)).toFixed(1)+'%';
    track.append(bar);row.append(track);
    const adjust=el('div','billing-budget-edit');
    const input=moneyInput(limit,1,1000000);input.dataset.budgetLimit=id;
    input.setAttribute('aria-label','Лимит: '+def.label);
    adjust.append(input,doButton('Сохранить лимит',()=>{
      const n=Number(input.value);
      return Number.isSafeInteger(n)&&n>=1&&n<=1000000&&
        send({type:'budget_limit',category:id as SpendingCategory,amount:n});
    }));
    row.append(adjust);
    plan.append(row);
  }
  panel.append(plan);

  const history=el('div','billing-budget-history');
  history.append(el('h3','','Последние переводы'));
  if(!budget.history.length)history.append(el('p','billing-budget-hint','Копилка пока пустует. Начни с небольшой суммы.'));
  for(const row of [...budget.history].reverse().slice(0,6)){
    const who=row.actor==='vlad'?'Влад':'Алина';
    const line=el('div','billing-row');
    line.append(el('span','',who+' · '+clockLabel(row)));
    line.append(el('b','', (row.kind==='deposit'?'+':'−')+formatRub(row.amount)));
    history.append(line);
  }
  panel.append(history);
  return panel;
}
