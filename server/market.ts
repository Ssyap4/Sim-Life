import {isGift,giftCount,GIFT_LIMIT} from '../src/shared/gifts';
import { type CharacterId, type GameState, names } from '../src/shared/protocol';
import { type BasketLine, marketProduct } from '../src/shared/market';
import { addLedger, formatRub } from '../src/shared/economy';
import { storageCanFit } from '../src/shared/storageSpace';
import { PET_FOOD_MAX_REFILLS } from '../src/shared/pets';
import { addReadyFood, expireReadyFood, reconcileReadyFood, type ReadyFoodStorage } from '../src/shared/readyFood';
import { gameMinutes } from '../src/shared/life';

export type CheckoutResult =
  | { ok: true; state: GameState; message: string }
  | { ok: false; reason: string };

type QuoteResult = { ok: true; lines: BasketLine[]; cost: number; units: number } | { ok: false; reason: string };

/** Prices and counts come from the authoritative catalog. */
export function quoteCart(unknownLines: unknown): QuoteResult {
  if (!Array.isArray(unknownLines) || unknownLines.length < 1 || unknownLines.length > 35)
    return { ok:false,reason:'Корзина пуста или слишком велика' };
  const seen = new Set<string>();
  const lines: BasketLine[] = [];
  let cost = 0, units = 0;
  for (const raw of unknownLines) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok:false,reason:'Некорректная строка заказа' };
    const {id,quantity} = raw as Record<string,unknown>;
    if (typeof id !== 'string' || !Number.isSafeInteger(quantity) ||
        (quantity as number) < 1 || (quantity as number) > 10 || seen.has(id))
      return { ok:false,reason:'Проверь количество и товары в корзине' };
    const product=marketProduct(id);
    if (!product) return {ok:false,reason:'Неизвестный товар в корзине'};
    seen.add(id);
    lines.push({id,quantity:quantity as number});
    units+=quantity as number;
    cost+=product.price*(quantity as number);
  }
  if (units>60 || !Number.isSafeInteger(cost) || cost>500_000)
    return {ok:false,reason:'Слишком большой заказ'};
  return { ok: true, lines, cost, units };
}

export function grantCart(source: GameState, lines: BasketLine[], readyStorage: ReadyFoodStorage = 'fridge',
  readyAt = gameMinutes(source.clock)): CheckoutResult {
  const next=structuredClone(source);
  reconcileReadyFood(next);
  expireReadyFood(next);
  // Validate and update a clone. No partial cart spending, even across categories.
  for (const line of lines) {
    const product=marketProduct(line.id)!;
    const delta=product.quantity*line.quantity;
    if (product.kind==='grocery') {
      const key=product.stockKey as keyof GameState['pantry'];
      if (next.pantry[key]+delta>99) return {ok:false,reason:'Не хватает места для '+product.name+' (максимум 99)'};
      next.pantry[key]+=delta;
    } else if (product.kind==='takeout') {
      const key=product.stockKey as keyof GameState['takeout'];
      if (next.takeout[key]+delta>40) return {ok:false,reason:'Слишком много готовой еды: '+product.name};
      next.takeout[key]+=delta;
      addReadyFood(next,'takeout',key,delta,readyStorage,readyAt);
    } else if(product.kind==='gift'){
      const key=product.stockKey;if(!isGift(key)||giftCount(next,key)+delta>GIFT_LIMIT)return {ok:false,reason:'Слишком много подарков'};
      (next.gifts??={})[key]=giftCount(next,key)+delta;
    } else {
      const key=product.stockKey as keyof GameState['petFood'];
      if (next.petFood[key]+delta>PET_FOOD_MAX_REFILLS) return {ok:false,reason:'Запас корма заполнен: '+product.name};
      next.petFood[key]+=delta;
    }
  }
  const storage=storageCanFit(source,next);
  if(!storage.ok)return {ok:false,reason:storage.reason};
  return { ok: true, state: next, message: 'Товары поступили в запасы' };
}

/** Record the actual categories of a validated basket without charging it again.
 * Allocate a single delivery fee proportionally, rounding cumulative shares to conserve RUB. */
export function recordCartExpense(state: GameState, actor: CharacterId, lines: BasketLine[],
  delivery?: {id:string; fee:number}): void {
  const categories=['groceries','takeout','pets','gifts'] as const;
  const groups=categories.map(category=>({category,lines:lines.filter(line=>{
    const kind=marketProduct(line.id)!.kind;
    return category===(kind==='grocery'?'groceries':kind==='pet'?'pets':kind==='gift'?'gifts':'takeout');
  })})).filter(group=>group.lines.length).map(group=>({...group,
    subtotal:group.lines.reduce((sum,line)=>sum+marketProduct(line.id)!.price*line.quantity,0)}));
  const total=groups.reduce((sum,group)=>sum+group.subtotal,0);
  let cumulative=0,allocated=0;
  for(const group of groups){
    cumulative+=group.subtotal;
    const cumulativeFee=delivery&&total>0?Math.round(delivery.fee*cumulative/total):0;
    const fee=cumulativeFee-allocated;allocated=cumulativeFee;
    const label=delivery
      ? '\u0414\u043e\u0441\u0442\u0430\u0432\u043a\u0430 '+delivery.id+' \u00b7 '+group.lines.reduce((n,line)=>n+line.quantity,0)+' \u0443\u043f. \u00b7 \u0442\u043e\u0432\u0430\u0440\u044b '+group.subtotal+' \u20bd + \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0430 '+fee+' \u20bd'
      : group.lines.map(line=>marketProduct(line.id)!.name+' \u00d7'+line.quantity).join(', ');
    addLedger(state,actor,'expense',group.category,group.subtotal+fee,label);
  }
}

export function checkout(source: GameState, actor: CharacterId, unknownLines: unknown): CheckoutResult {
  const quote = quoteCart(unknownLines);
  if (!quote.ok) return quote;
  const { lines, cost, units } = quote;
  if(lines.some(line=>marketProduct(line.id)?.kind==='gift'))return {ok:false,reason:'Подарки доступны только через доставку'};
  if (source.money < cost) return { ok: false, reason: 'Недостаточно денег: нужно ' + formatRub(cost) };
  const grant = grantCart(source, lines);
  if (!grant.ok) return grant;
  const next = grant.state;
  next.money -= cost;
  next.revision++;
  recordCartExpense(next, actor, lines);
  return { ok: true, state: next, message: names[actor] + ': покупка (' + units + ' уп.) · −' + formatRub(cost) };
}
