import { MARKET_PRODUCTS, MARKET_CATEGORIES, type MarketProduct } from './shared/market';
import { GROCERY_DETAILS, TAKEOUT_DESCRIPTIONS } from './shared/storageSpace';

/** Human-friendly search: case-insensitive, ё/е equivalent, no network or timers. */
export function normalizeMarketSearch(text: string): string {
  return text.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

const searchable = (product: MarketProduct): string => {
  const details = product.kind === 'grocery'
    ? GROCERY_DETAILS[product.stockKey as keyof typeof GROCERY_DETAILS]?.description ?? ''
    : product.kind === 'takeout'
      ? TAKEOUT_DESCRIPTIONS[product.stockKey as keyof typeof TAKEOUT_DESCRIPTIONS] ?? ''
      : 'корм для питомцев собака кот кошка';
  return normalizeMarketSearch([product.name, product.unit, MARKET_CATEGORIES[product.category], details].join(' '));
};

const entries = MARKET_PRODUCTS.map((product, index) => ({
  product, index, name: normalizeMarketSearch(product.name), text: searchable(product),
}));

/** Search every category, ranked by prefix, word-start and name matches first. */
export function findMarketProducts(query: string): MarketProduct[] {
  const words = normalizeMarketSearch(query).split(' ').filter(Boolean);
  if (!words.length) return MARKET_PRODUCTS;
  return entries.flatMap(({product,index,name,text}) => {
    if (!words.every(word => text.includes(word))) return [];
    const fullQuery = words.join(' ');
    const rank = name.startsWith(fullQuery) ? 0
      : name.split(/[^\p{L}\p{N}]+/u).some(part => part.startsWith(fullQuery)) ? 1
      : name.includes(fullQuery) ? 2 : 3;
    return [{product,index,rank}];
  }).sort((a,b) => a.rank-b.rank || a.index-b.index).map(row=>row.product);
}
