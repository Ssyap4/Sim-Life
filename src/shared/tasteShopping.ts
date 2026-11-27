import {favoriteFood,type TasteKind} from './foodTastes';
import {RECIPES,ingredientList,type RecipeId} from './food';
import {INSTANT_COFFEE} from './coffee';
import type {MarketProduct} from './market';
import type {CharacterId,GameState} from './protocol';
export function productTaste(p:MarketProduct):{kind:TasteKind;item:string}|undefined{
 if(p.kind==='takeout')return {kind:'takeout',item:p.stockKey};
 if(p.kind==='grocery'&&(INSTANT_COFFEE as readonly string[]).includes(p.stockKey))return {kind:'coffee',item:p.stockKey};
}
export function favoriteProduct(s:GameState,role:CharacterId,p:MarketProduct){
 const t=productTaste(p);return !!t&&favoriteFood(s,role,t.kind,t.item);
}
export function favoriteRecipeIngredients(s:GameState,role:CharacterId){
 const result=new Set<string>();
 for(const id of Object.keys(RECIPES) as RecipeId[])if(favoriteFood(s,role,'meal',id))for(const [ing,n] of ingredientList(id))if(s.pantry[ing]<n)result.add(ing);
 return result;
}
