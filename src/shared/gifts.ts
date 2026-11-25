import type {GameState} from './protocol';
export const FAMILY_GIFTS={giftFlowers:{price:850,label:'Букет цветов',emoji:'💐'},giftSweets:{price:450,label:'Коробка сладостей',emoji:'🎁'}} as const;
export type GiftId=keyof typeof FAMILY_GIFTS;
export type GiftStock=Partial<Record<GiftId,number>>;
export const GIFT_LIMIT=10;
export const isGift=(id:unknown):id is GiftId=>typeof id==='string'&&Object.hasOwn(FAMILY_GIFTS,id);
export const familyGift=(id:string)=>isGift(id)?FAMILY_GIFTS[id]:undefined;
export const giftCount=(s:GameState,id:GiftId)=>s.gifts?.[id]??0;
export function validGifts(v:unknown):v is GiftStock{return !!v&&typeof v==='object'&&!Array.isArray(v)&&Object.entries(v).every(([id,n])=>isGift(id)&&Number.isSafeInteger(n)&&n>=0&&n<=GIFT_LIMIT);}
export const pendingGifts=(s:GameState,id:GiftId)=>s.world.deliveries.reduce((n,d)=>n+d.lines.filter(l=>l.id==='gift:'+id).reduce((sum,l)=>sum+l.quantity,0),0);
