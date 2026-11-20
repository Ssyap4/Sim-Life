import { GROCERIES, TAKEOUT, GROCERY_CATEGORIES, type IngredientId, type TakeoutId } from './food';
import { PETS, type PetId } from './pets';

export type MarketCategory = 'dairy' | 'bakery' | 'meat' | 'vegetables' | 'pantry' | 'fruit' | 'takeout' | 'pets';
export interface MarketProduct {
  id: string;
  stockKey: string;
  kind: 'grocery' | 'takeout' | 'pet';
  category: MarketCategory;
  name: string;
  emoji: string;
  price: number;
  quantity: number;
  unit: string;
}
export const MARKET_CATEGORIES: Record<MarketCategory, string> = {
  ...GROCERY_CATEGORIES, takeout:'Готовая еда · дорого', pets:'Для питомцев',
};
export const MARKET_PRODUCTS: MarketProduct[] = [
  ...Object.entries(GROCERIES).filter(([id]) => id !== 'coffee').map(([id, p]) => ({
    id:'grocery:'+id, stockKey:id, kind:'grocery' as const,
    category:p.category, name:p.name, emoji:p.emoji, price:p.price,quantity:p.quantity,unit:p.unit,
  })),
  ...Object.entries(TAKEOUT).map(([id,p])=>({
    id:'takeout:'+id, stockKey:id, kind:'takeout' as const,
    category:'takeout' as const, name:p.name, emoji:p.emoji,price:p.price,quantity:p.quantity,unit:'порц.',
  })),
  ...Object.entries(PETS).map(([id,p])=>({
    id:'pet:'+id, stockKey:id, kind:'pet' as const,
    category:'pets' as const,name:p.foodName,emoji:p.emoji,price:p.foodPrice,quantity:p.foodAmount,unit:'насып.',
  })),
];
export const MARKET_BY_ID = new Map(MARKET_PRODUCTS.map(p=>[p.id,p]));
export interface BasketLine { id: string; quantity: number }
export function marketProduct(id: string): MarketProduct | undefined { return MARKET_BY_ID.get(id); }
export function basketPrice(lines: BasketLine[]): number {
  return lines.reduce((n,line)=> n + (marketProduct(line.id)?.price ?? 0)*line.quantity,0);
}
export function recipeMissingIngredient(id: string): id is IngredientId { return Object.prototype.hasOwnProperty.call(GROCERIES,id); }
export function isTakeoutId(id: string): id is TakeoutId { return Object.prototype.hasOwnProperty.call(TAKEOUT,id); }
export function isPetId(id: string): id is PetId { return Object.prototype.hasOwnProperty.call(PETS,id); }
