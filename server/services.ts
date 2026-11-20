import { randomInt } from 'node:crypto';
import { addLedger, formatRub } from '../src/shared/economy';
import { clockMinutes } from '../src/shared/locations';
import type { CharacterId, GameState } from '../src/shared/protocol';
import { MINUTES_PER_DAY, clockAt, clockLabel } from '../src/shared/life';
import { SERVICES, SERVICE_IDS, PAYMENT_REMINDER_PREFIX, UTILITY_RANGE, isServiceId, serviceAvailable, upcomingPayments,
  type Bill, type FamilyServices, type ServiceId } from '../src/shared/services';

type Account = { money: number; billing: FamilyServices };
type Payment = { bill: Bill; automatic: boolean };
export { serviceAvailable };

function issue(billing: FamilyServices, service: ServiceId, due: number): Bill {
  const definition = SERVICES[service];
  const quote = service === 'utilities' && billing.utilityQuote?.due === due ? billing.utilityQuote : undefined;
  const bill: Bill = { id: service + ':' + due, service, issuedAt: due,
    amount: definition.price ?? quote?.amount ?? randomInt(UTILITY_RANGE[0], UTILITY_RANGE[1] + 1), paidAt: null };
  if (quote) delete billing.utilityQuote;
  billing.bills.push(bill);
  return bill;
}

function pay(account: Account, bill: Bill, now: number, periodStart: number) {
  account.money -= bill.amount;
  bill.paidAt = now;
  const status = account.billing.services[bill.service];
  if (SERVICES[bill.service].category === 'subscription') {
    status.paidUntil = periodStart + SERVICES[bill.service].period;
    status.nextDue = status.paidUntil;
  } else if (!account.billing.bills.some(other => other.service === bill.service && other.paidAt === null)) {
    status.paidUntil = status.nextDue;
  }
}

const debt = (billing: FamilyServices, id: ServiceId) => billing.bills
  .filter(bill => bill.service === id && bill.paidAt === null)
  .sort((a, b) => a.issuedAt - b.issuedAt);

const unpaidNotice = (id: ServiceId) =>
  '⚠️ ' + SERVICES[id].name + ' · недостаточно средств для оплаты';

/** Bills and the budget change in the same isolated state transaction. */
export function settleBills(account: Account, now: number, notify: (payment: Payment) => void,
  notice: (message: string) => void = () => {}): void {
  for (const id of SERVICE_IDS) {
    const spec = SERVICES[id];
    const status = account.billing.services[id];
    if (!status.enabled) continue;
    if (spec.category === 'mandatory') {
      const newBills: Bill[] = [];
      while (status.nextDue !== null && status.nextDue <= now) {
        newBills.push(issue(account.billing, id, status.nextDue));
        status.nextDue += spec.period;
      }
      for (const bill of debt(account.billing, id)) {
        if (account.money < bill.amount) break;
        pay(account, bill, now, bill.issuedAt);
        notify({ bill, automatic: true });
      }
      if (newBills.some(bill => bill.paidAt === null)) notice(unpaidNotice(id));
    } else {
      const [outstanding] = debt(account.billing, id);
      if (outstanding && status.autoRenew && account.money >= outstanding.amount) {
        pay(account, outstanding, now, now);
        notify({ bill: outstanding, automatic: true });
      }
      // An unpaid optional renewal stops billing until the subscription resumes.
      while (status.nextDue !== null && status.nextDue <= now) {
        const due = status.nextDue;
        status.nextDue = null;
        if (!status.autoRenew) {
          notice(spec.icon + ' ' + spec.name + ' · оплаченный период закончился');
          break;
        }
        const bill = issue(account.billing, id, due);
        if (account.money < bill.amount) {
          notice(unpaidNotice(id) + ' · подписка приостановлена');
          break;
        }
        pay(account, bill, now, due);
        notify({ bill, automatic: true });
      }
    }
  }
}

function recordPayment(state: GameState, bill: Bill, actor: CharacterId | 'family') {
  addLedger(state, actor, 'expense', 'services', bill.amount,
    SERVICES[bill.service].name + (actor === 'family' ? ' · автоплатёж' : ' · оплата'));
}

export function settleFamilyServices(state: GameState, retry: boolean, remind = true): string[] {
  const now = clockMinutes(state.clock);
  const messages: string[] = [];
  if (retry || SERVICE_IDS.some(id => {
    const due = state.billing.services[id].nextDue;
    return due !== null && due <= now;
  })) {
    const payments = new Map<ServiceId, number>();
    settleBills(state, now, ({bill}) => {
      recordPayment(state, bill, 'family');
      payments.set(bill.service, (payments.get(bill.service) ?? 0) + bill.amount);
    }, message => messages.push(message));
    for (const [id, total] of payments)
      messages.push(SERVICES[id].icon + ' ' + SERVICES[id].name + ' · оплачено −' + formatRub(total));
  }
  if (!remind) return messages;
  const utility = state.billing.services.utilities;
  const due = utility.nextDue;
  if (utility.enabled && due !== null && due > now && due - now <= MINUTES_PER_DAY &&
      state.billing.utilityQuote?.due !== due) {
    state.billing.utilityQuote = { due, amount: randomInt(UTILITY_RANGE[0], UTILITY_RANGE[1] + 1) };
  }
  for (const { id, due, amount } of upcomingPayments(state.billing, now)) {
    const status = state.billing.services[id];
    if (status.remindedFor === due || amount === null) continue;
    status.remindedFor = due;
    messages.push(SERVICES[id].icon + ' ' + PAYMENT_REMINDER_PREFIX + ' · ' + SERVICES[id].name +
      ' · ' + formatRub(amount) + ' · ' + clockLabel(clockAt(due)));
  }
  return messages;
}

type Result = {ok: true; state: GameState; message: string} | {ok: false; reason: string};
const fail = (reason: string): Result => ({ok: false, reason});

export function applyServiceCommand(source: GameState, actor: CharacterId, command: Record<string, unknown>): Result {
  const state = structuredClone(source);
  const now = clockMinutes(state.clock);
  if (command.type === 'service_pay') {
    if (typeof command.billId !== 'string') return fail('Неверный номер счёта');
    const bill = state.billing.bills.find(row => row.id === command.billId && row.paidAt === null);
    if (!bill) return fail('Счёт уже оплачен или не найден');
    if (debt(state.billing, bill.service)[0] !== bill) return fail('Сначала оплатите самый ранний счёт услуги');
    if (state.money < bill.amount) return fail('Для оплаты нужно ' + formatRub(bill.amount));
    pay(state, bill, now, now);
    recordPayment(state, bill, actor);
    state.revision++;
    return {ok: true, state, message: SERVICES[bill.service].icon + ' ' + SERVICES[bill.service].name +
      ' · оплачено −' + formatRub(bill.amount)};
  }

  const id = command.service;
  if (!isServiceId(id) || SERVICES[id].category !== 'subscription') return fail('Выберите подписку');
  const spec = SERVICES[id];
  const status = state.billing.services[id];
  if (command.type === 'service_renewal') {
    if (typeof command.enabled !== 'boolean' || !status.enabled) return fail('Подписка не подключена');
    if (!serviceAvailable(state.billing, id, now) && !debt(state.billing, id).length)
      return fail('Подключите подписку снова');
    status.autoRenew = command.enabled;
    state.revision++;
    return {ok: true, state, message: spec.name + ' · автопродление ' + (status.autoRenew ? 'включено' : 'выключено')};
  }
  if (command.type !== 'service_connect') return fail('Неизвестная операция');
  if (serviceAvailable(state.billing, id, now)) return fail('Подписка уже активна');
  if (debt(state.billing, id).length) return fail('Сначала оплатите выставленный счёт');
  if (state.money < spec.price) return fail('Для подключения нужно ' + formatRub(spec.price));
  status.enabled = status.autoRenew = true;
  const bill = issue(state.billing, id, now);
  pay(state, bill, now, now);
  recordPayment(state, bill, actor);
  state.revision++;
  return {ok: true, state, message: '✅ ' + spec.name + ' · подключено на ' + spec.period / 1440 + ' игровых дней'};
}

export function validBilling(value: unknown): value is FamilyServices {
  if (!value || typeof value !== 'object') return false;
  const { services, bills, utilityQuote } = value as Partial<FamilyServices>;
  const minute = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
  if (!services || !SERVICE_IDS.every(id => {
    const status = services[id];
    return status && typeof status.enabled === 'boolean' && typeof status.autoRenew === 'boolean' &&
      (status.paidUntil === null || minute(status.paidUntil)) && (status.nextDue === null || minute(status.nextDue)) &&
      (status.remindedFor === undefined || minute(status.remindedFor));
  })) return false;
  if (utilityQuote !== undefined && (!utilityQuote || !minute(utilityQuote.due) ||
      utilityQuote.due !== services.utilities.nextDue || !minute(utilityQuote.amount) ||
      utilityQuote.amount < UTILITY_RANGE[0] || utilityQuote.amount > UTILITY_RANGE[1])) return false;
  if (!Array.isArray(bills)) return false;
  const ids = new Set<string>();
  return bills.every(bill => {
    if (!bill || !isServiceId(bill.service) || !minute(bill.issuedAt) ||
        bill.id !== bill.service + ':' + bill.issuedAt || ids.has(bill.id) ||
        !minute(bill.amount) || (bill.paidAt !== null && (!minute(bill.paidAt) || bill.paidAt < bill.issuedAt))) return false;
    ids.add(bill.id);
    const definition = SERVICES[bill.service];
    return definition.price === null
      ? bill.amount >= definition.range[0] && bill.amount <= definition.range[1]
      : bill.amount === definition.price;
  });
}
