import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BILLING_PERIOD, initialServices } from '../../src/shared/services';
import { serviceAvailable, settleBills } from '../services';

test('Bills are created once per period and prioritized without overdrawing the budget', () => {
  const billing = initialServices(300);
  const account = { money: 1200, billing };
  const paid: string[] = [];
  const settle = () => settleBills(account, 300 + BILLING_PERIOD, p => paid.push(p.bill.id));
  settle();
  assert.equal(billing.bills.length, 3);
  assert.equal(account.money, 0);
  assert.deepEqual(paid, ['internet:' + (300 + BILLING_PERIOD)]);
  assert.equal(serviceAvailable(billing, 'internet', 300 + BILLING_PERIOD), true);
  assert.equal(serviceAvailable(billing, 'mobile', 300 + BILLING_PERIOD), false);
  settle();
  assert.equal(billing.bills.length, 3);
  assert.equal(paid.length, 1);
  account.money = 5000;
  settle();
  assert.equal(billing.bills.filter(bill => bill.paidAt === null).length, 0);
  assert.ok(account.money >= 250);
});

test('Multiple elapsed periods preserve every mandatory obligation', () => {
  const billing = initialServices(0);
  const account = { money: 0, billing };
  settleBills(account, BILLING_PERIOD * 3, () => assert.fail('no money'));
  assert.equal(billing.bills.length, 9);
  assert.equal(new Set(billing.bills.map(bill => bill.id)).size, 9);
  assert.ok(billing.bills.filter(bill => bill.service === 'utilities')
    .every(bill => bill.amount >= 2450 && bill.amount <= 3750));
});

test('The oldest utility bill is paid first even when a more recent bill costs less', () => {
  const billing = initialServices(0);
  const account = {money:0,billing};
  settleBills(account, BILLING_PERIOD * 2, () => {});
  const utilities = billing.bills.filter(bill => bill.service === 'utilities');
  utilities[0].amount = 3750;
  utilities[1].amount = 2450;
  account.money = 2450;
  settleBills(account, BILLING_PERIOD * 2, () => {});
  assert.ok(utilities.every(bill => bill.paidAt === null));
  assert.equal(account.money, 50);
});
