import { formatRub } from './shared/economy';
import { clockAt, clockLabel } from './shared/life';
import { clockMinutes } from './shared/locations';
import type { GameState } from './shared/protocol';
import { BILLING_PERIOD, SERVICES, SERVICE_IDS, serviceAvailable, upcomingPayments,
  type Bill, type ServiceCommand, type ServiceId } from './shared/services';

export type BillingApp = 'finance' | 'subscriptions' | 'utilities' | 'internet' | 'mobile';
const subscriptions = SERVICE_IDS.filter(id => SERVICES[id].category === 'subscription');
const dateLabel = (minute: number) => clockLabel(clockAt(minute));
const rubRange = (min: number, max: number) => min === max ? formatRub(min) : formatRub(min) + ' – ' + formatRub(max);
function tariff(id: ServiceId) {
  const service = SERVICES[id];
  return service.price === null ? rubRange(...service.range) : formatRub(service.price);
}

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

export function createBillingUI(root: HTMLElement, send: (command: ServiceCommand) => boolean) {
  let previous = '';
  let visibleHistory = 12;
  let currentMessages: string[] = [];
  function button(label: string, command: ServiceCommand) {
    const control = node('button', 'billing-button', label);
    control.type = 'button';
    control.dataset.billingAction = JSON.stringify(command);
    control.addEventListener('click', () => { if (send(command)) control.disabled = true; });
    return control;
  }

  function expenseRow(label: string, detail: string, amount?: string, kind = '') {
    const row = node('div', 'billing-row');
    const summary = node('div');
    summary.append(node('strong', '', label), node('small', '', detail));
    row.append(summary);
    if (amount) row.append(node('b', kind, amount));
    return row;
  }

  function overview(state: GameState, now: number) {
    let minimum = 0;
    let maximum = 0;
    for (const id of SERVICE_IDS) {
      const status = state.billing.services[id];
      if (!status.enabled || !status.autoRenew || status.nextDue === null ||
          status.nextDue > now + BILLING_PERIOD) continue;
      const service = SERVICES[id];
      const cycles = 1 + Math.floor((now + BILLING_PERIOD - status.nextDue) / service.period);
      const quote = id === 'utilities' ? state.billing.utilityQuote : undefined;
      const amount = quote?.due === status.nextDue ? quote.amount : undefined;
      const remaining = cycles - (amount === undefined ? 0 : 1);
      minimum += (amount ?? 0) + (service.price ?? service.range[0]) * remaining;
      maximum += (amount ?? 0) + (service.price ?? service.range[1]) * remaining;
    }
    const debt = state.billing.bills.reduce((total, bill) => total + (bill.paidAt === null ? bill.amount : 0), 0);
    const active = subscriptions.filter(id => serviceAvailable(state.billing, id, now)).length;
    const hero = node('div', 'billing-hero');
    hero.append(node('small', '', 'Общие деньги'), node('strong', '', formatRub(state.money)));
    const metrics = node('div', 'billing-metrics');
    for (const [label, value] of [['Ближайшие 10 дней', rubRange(minimum, maximum)],
      ['Задолженность', formatRub(debt)], ['Активные подписки', String(active)]]) {
      const item = node('div');
      item.append(node('small', '', label), node('strong', '', value));
      metrics.append(item);
    }
    hero.append(metrics);
    const journal = node('section', 'billing-journal');
    journal.append(node('h3', '', 'История операций'));
    if (!state.ledger.length) journal.append(node('p', '', 'Операций пока нет.'));
    for (const entry of [...state.ledger].reverse()) {
      const actor = {vlad: 'Влад', alina: 'Алина', family: 'Семья'}[entry.actor];
      journal.append(expenseRow(entry.label, actor + ' · ' + clockLabel(entry),
        (entry.kind === 'income' ? '+' : '−') + formatRub(entry.amount),
        entry.kind === 'income' ? 'market-positive' : 'billing-amount'));
    }
    const upcoming = upcomingPayments(state.billing, now);
    if (!upcoming.length) return [hero, journal];
    const reminders = node('section', 'billing-journal billing-upcoming');
    reminders.append(node('h3', '', 'Платежи в ближайший игровой день'));
    for (const { id, due, amount } of upcoming) {
      const { icon, name } = SERVICES[id];
      reminders.append(expenseRow(icon + ' ' + name, dateLabel(due), amount === null ? tariff(id) : formatRub(amount)));
    }
    return [hero, reminders, journal];
  }

  function service(state: GameState, id: ServiceId, now: number) {
    const definition = SERVICES[id];
    const status = state.billing.services[id];
    const invoices = state.billing.bills.filter(bill => bill.service === id);
    const unpaid = invoices.filter(bill => bill.paidAt === null).sort((a,b) => a.issuedAt - b.issuedAt);
    const active = serviceAvailable(state.billing, id, now);
    const card = node('section', 'billing-service');
    const head = node('div', 'billing-service-head');
    head.append(node('h3', '', definition.icon + ' ' + definition.name),
      node('span', active ? 'billing-status active' : 'billing-status',
        unpaid.length ? 'Ожидает оплаты' : active ? 'Активна' : status.enabled ? 'Истекла' : 'Не подключена'));
    card.append(head, node('strong', 'billing-tariff', tariff(id) + ' / ' + definition.period / 1440 + ' игровых дней'));
    if (id === 'utilities') card.append(node('p', '', 'Точная сумма начисления появляется за игровой день до оплаты.'));
    if (id === 'mobile') card.append(node('p', '', 'Семейный тариф для доставки, звонков и переписки.'));
    if (id === 'internet') card.append(node('p', '', 'Подключение для домашнего компьютера и платного ТВ.'));
    if (status.paidUntil !== null && active) {
      const hours = Math.ceil((status.paidUntil - now) / 60);
      card.append(node('p', '', 'Оплачено до ' + dateLabel(status.paidUntil) +
        ' · осталось ' + Math.floor(hours / 24) + ' д. ' + hours % 24 + ' ч.'));
    }
    if (status.autoRenew && status.nextDue !== null) {
      const quote = id === 'utilities' ? state.billing.utilityQuote : undefined;
      card.append(node('p', '', 'Следующий платёж · ' + dateLabel(status.nextDue) +
        (quote?.due === status.nextDue ? ' · ' + formatRub(quote.amount) : '')));
    }
    if (unpaid.length) {
      const total = unpaid.reduce((sum,bill) => sum + bill.amount, 0);
      card.append(node('p', 'billing-debt', 'Задолженность ' + formatRub(total)));
      for (const bill of unpaid.slice(0, visibleHistory))
        card.append(expenseRow('Не оплачен', 'Выставлен и подлежит оплате · ' + dateLabel(bill.issuedAt), formatRub(bill.amount)));
      card.append(button('Оплатить ранний счёт · ' + formatRub(unpaid[0].amount), {type:'service_pay',billId:unpaid[0].id}));
    }
    if (definition.category === 'subscription') {
      if (!active && !unpaid.length)
        card.append(button('Подключить · ' + tariff(id), {type:'service_connect',service:id}));
      if (active || unpaid.length)
        card.append(button(status.autoRenew ? 'Выключить автопродление' : 'Включить автопродление',
          {type:'service_renewal',service:id,enabled:!status.autoRenew}));
    }
    const journal = node('div', 'billing-journal billing-invoices');
    journal.append(node('h4', '', 'Оплаченные счета'));
    const paid = invoices.filter((bill): bill is Bill & {paidAt:number} => bill.paidAt !== null)
      .sort((a,b) => b.paidAt - a.paidAt || b.issuedAt - a.issuedAt);
    if (!paid.length) journal.append(node('p', '', 'Платежей пока нет.'));
    for (const bill of paid.slice(0, visibleHistory)) {
      journal.append(expenseRow(formatRub(bill.amount), 'Начислен ' + dateLabel(bill.issuedAt) +
        ' · оплачен ' + dateLabel(bill.paidAt)));
    }
    card.append(journal);
    if (Math.max(paid.length,unpaid.length) > visibleHistory) {
      const more = node('button','billing-button','Показать ещё');
      more.type = 'button';
      more.addEventListener('click', () => { visibleHistory += 12; renderPage(state, definition.category === 'subscription' ? 'subscriptions' : id as BillingApp); });
      card.append(more);
    }
    return card;
  }

  function renderPage(state: GameState, page: BillingApp) {
    const now = clockMinutes(state.clock);
    const signature = JSON.stringify([page, Math.floor(now / 60), state.money, state.billing.services, state.billing.utilityQuote, state.billing.bills.length, state.ledger.at(-1)?.id,
      visibleHistory, currentMessages]);
    if (signature === previous) return;
    previous = signature;
    const scroll = root.scrollTop;
    const focus = (document.activeElement as HTMLElement | null)?.dataset.billingAction;
    const content = page === 'finance' ? overview(state, now) :
      (page === 'subscriptions' ? subscriptions : [page]).map(id => service(state, id, now));
    if (currentMessages.length) {
      const messages = node('div','billing-messages');
      messages.setAttribute('role','status');
      for (const message of currentMessages) messages.append(node('p','',message));
      content.unshift(messages);
    }
    root.replaceChildren(...content);
    root.scrollTop = scroll;
    if (focus) [...root.querySelectorAll<HTMLElement>('[data-billing-action]')]
      .find(element => element.dataset.billingAction === focus)?.focus({preventScroll: true});
  }

  return { renderPage, reset() { previous = ''; visibleHistory = 12; },
    setMessages(messages: string[]) { currentMessages = messages; previous = ''; } };
}
