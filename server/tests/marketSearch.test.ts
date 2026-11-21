import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MARKET_PRODUCTS } from '../../src/shared/market';
import { findMarketProducts, normalizeMarketSearch } from '../../src/marketSearch';

test('Market search starts responding from the very first character', () => {
  const hits = findMarketProducts('м');
  assert.ok(hits.length > 0 && hits.length < MARKET_PRODUCTS.length);
  assert.ok(hits[0].name.startsWith('М'));
  assert.ok(hits.some(item => item.name.toLowerCase().includes('молоко')));
});

test('Market search is insensitive to Cyrillic case, ё/е and surrounding whitespace', () => {
  assert.deepEqual(findMarketProducts('МОЛ'),findMarketProducts('мол'));
  assert.deepEqual(findMarketProducts('  мол  '),findMarketProducts('мол'));
  assert.deepEqual(findMarketProducts('ё'),findMarketProducts('е'));
  assert.equal(normalizeMarketSearch('  ЁЖ  '),'еж');
});

test('Market search includes partial words and prioritizes matching product names', () => {
  const bread=findMarketProducts('хле');
  assert.equal(bread[0]?.name.startsWith('Хлеб'),true);
  const pizza=findMarketProducts('пиц');
  assert.ok(pizza.length>=2);
  assert.ok(pizza[0].name.startsWith('Пицца'));
  assert.ok(pizza[1].name.startsWith('Пицца'));
  assert.ok(findMarketProducts('перони').some(product=>product.name.includes('Пепперони')));
});

test('Market search handles multiple tokens and product types', () => {
  const items=findMarketProducts('пиц пеп');
  assert.ok(items.some(item=>item.name.includes('Пепперони')));
  assert.ok(items.every(item=>item.name.toLowerCase().includes('пиц')));
  const pets=findMarketProducts('корм');
  assert.ok(pets.some(item=>item.name.includes('шпица')));
  assert.ok(pets.some(item=>item.name.includes('кота')));
});

test('Market search matches description and category text', () => {
  const results=findMarketProducts('молочные');
  assert.ok(results.length>0);
  assert.ok(results.every(item=>item.category==='dairy'||item.name.toLowerCase().includes('молочные')));
});

test('Market search gives all items for an empty term and none for missing products', () => {
  assert.deepEqual(findMarketProducts(''),MARKET_PRODUCTS);
  assert.deepEqual(findMarketProducts('   '),MARKET_PRODUCTS);
  assert.deepEqual(findMarketProducts('хххневозможнонайти'),[]);
});

test('Search does not mutate catalogue order, objects or prices', () => {
  const ids=MARKET_PRODUCTS.map(p=>p.id);
  const prices=MARKET_PRODUCTS.map(p=>p.price);
  findMarketProducts('м');
  findMarketProducts('ё');
  findMarketProducts('пиц');
  assert.deepEqual(MARKET_PRODUCTS.map(p=>p.id),ids);
  assert.deepEqual(MARKET_PRODUCTS.map(p=>p.price),prices);
});
