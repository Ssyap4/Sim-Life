import { MINUTES_PER_DAY } from './life';

/** Shared catalogue for family services. Times are absolute game minutes. */
export const BILLING_PERIOD = 10 * MINUTES_PER_DAY;
export const UTILITY_RANGE = [2450, 3750] as const;

export const SERVICES = {
  utilities: { name: 'Коммунальные услуги', icon: '🏠', category: 'mandatory', price: null, range: UTILITY_RANGE, period: BILLING_PERIOD },
  internet: { name: 'Домашний интернет', icon: '🌐', category: 'mandatory', price: 1200, period: BILLING_PERIOD },
  mobile: { name: 'Мобильная связь', icon: '📱', category: 'mandatory', price: 1000, period: BILLING_PERIOD },
  netflix: { name: 'Netflix', icon: '🎬', category: 'subscription', price: 1500, period: BILLING_PERIOD },
  youtube: { name: 'YouTube Premium', icon: '▶️', category: 'subscription', price: 1300, period: BILLING_PERIOD },
} as const;

export type ServiceId = keyof typeof SERVICES;
export type ServiceState = {
  enabled: boolean;
  autoRenew: boolean;
  paidUntil: number | null;
  nextDue: number | null;
  remindedFor?: number;
};
export type Bill = {
  id: string;
  service: ServiceId;
  issuedAt: number;
  amount: number;
  paidAt: number | null;
};
export type FamilyServices = {
  services: Record<ServiceId, ServiceState>;
  bills: Bill[];
  utilityQuote?: { due: number; amount: number };
};

export function initialServices(now: number): FamilyServices {
  return {
    services: Object.fromEntries(Object.entries(SERVICES).map(([id, spec]) => {
      const enabled = spec.category === 'mandatory';
      return [id, { enabled, autoRenew: enabled,
        paidUntil: enabled ? now + spec.period : null,
        nextDue: enabled ? now + spec.period : null }];
    })) as Record<ServiceId, ServiceState>,
    bills: [],
  };
}

export const SERVICE_IDS = Object.keys(SERVICES) as ServiceId[];
export const PAYMENT_REMINDER_PREFIX = 'Скоро платёж';

export function upcomingPayments(billing: FamilyServices, now: number) {
  return SERVICE_IDS.flatMap(id => {
    const status = billing.services[id];
    const due = status.nextDue;
    if (!status.enabled || !status.autoRenew || due === null || due <= now || due - now > MINUTES_PER_DAY) return [];
    const quote = billing.utilityQuote;
    const amount = id === 'utilities' && quote?.due === due ? quote.amount : SERVICES[id].price;
    return [{ id, due, amount }];
  }).sort((a, b) => a.due - b.due);
}

export type ServiceCommand =
  | { type: 'service_connect'; service: ServiceId }
  | { type: 'service_renewal'; service: ServiceId; enabled: boolean }
  | { type: 'service_pay'; billId: string };

export const isServiceId = (value: unknown): value is ServiceId =>
  typeof value === 'string' && Object.hasOwn(SERVICES, value);

export function serviceAvailable(billing: FamilyServices, id: ServiceId, now: number): boolean {
  const service = billing.services[id];
  return service.enabled && service.paidUntil !== null && service.paidUntil > now &&
    !billing.bills.some(bill => bill.service === id && bill.paidAt === null);
}

export const SERVICE_MESSAGES = {
  internet: 'Нет подключения к интернету. Оплатите домашний интернет',
  computer: 'Интернет отключён. Оплатите домашний интернет — 1 200 ₽',
  mobile: 'Мобильная связь отключена. Оплатите мобильный тариф — 1 000 ₽',
  netflix: 'Для просмотра фильмов нужна подписка Netflix — 1 500 ₽ / 10 дней',
  youtube: 'Подключите YouTube Premium — 1 300 ₽ / 10 дней',
};

export function mediaAccessError(billing: FamilyServices, id: 'netflix' | 'youtube', now: number): string | undefined {
  if (!serviceAvailable(billing, id, now)) return SERVICE_MESSAGES[id];
  if (!serviceAvailable(billing, 'internet', now)) return SERVICE_MESSAGES.internet;
}
