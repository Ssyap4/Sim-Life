import {RECIPES,TAKEOUT,isHomeDrink,HOME_DESSERTS,isShopSnack,type RecipeId} from './shared/food';
import {favoriteFood,type TasteKind} from './shared/foodTastes';
import type {CharacterId,GameState} from './shared/protocol';
export type TasteSubmit=(kind:TasteKind,item:string,enabled:boolean)=>boolean;
export function tasteButton(s:GameState,role:CharacterId,kind:TasteKind,id:string,submit:TasteSubmit,changed?:(enabled:boolean)=>void){
 const b=document.createElement('button');b.type='button';b.className='food-action taste-favorite';
 let selected=favoriteFood(s,role,kind,id);
 const render=()=>{b.textContent=selected?'♥ В избранном':'♡ В избранное';b.setAttribute('aria-pressed',String(selected));};
 b.onclick=()=>{const next=!selected;if(submit(kind,id,next)){selected=next;render();changed?.(next);}};
 render();return b;
}
export function tasteLabel(s:GameState,role:CharacterId,kind:TasteKind,id:string){
 const other=role==='vlad'?'alina':'vlad';
 return (favoriteFood(s,role,kind,id)?' · ♥ Моё любимое':'')+(favoriteFood(s,other,kind,id)?' · ♡ Любит '+(other==='alina'?'Алина':'Влад'):'');
}

type TasteView={query:string;category:string;only:boolean;limit:number};
const views:Record<CharacterId,TasteView>={vlad:{query:'',category:'all',only:true,limit:12},alina:{query:'',category:'all',only:true,limit:12}};
const listItems=[...Object.entries(RECIPES).map(([id,f])=>({id,kind:'meal' as const,name:f.name,emoji:f.emoji,category:isHomeDrink(id as RecipeId)?'drink':HOME_DESSERTS.includes(id as RecipeId)||['pannaCotta','cremeBrulee','chocolateFondant','birthdayCake','fruitSalad','christmasApples'].includes(id)?'sweet':'meal'})),...Object.entries(TAKEOUT).map(([id,f])=>({id,kind:'takeout' as const,name:f.name,emoji:f.emoji,category:isShopSnack(id)?'sweet':'takeout'}))];
export function renderFoodTastes(root:HTMLElement,s:GameState,owner:CharacterId,viewer:CharacterId,submit?:TasteSubmit){
 const editable=owner===viewer&&!!submit,v=views[owner],selected=new Set(s.foodTastes?.[owner]?.favorites??[]);
 const h=document.createElement('h3');h.textContent='♥ Любимые блюда и напитки';
 const note=document.createElement('p');note.textContent=editable?'Выбирай свои вкусы сам. Хорошая любимая порция даёт до +6 настроения раз в 3 игровых часа. Плохое качество не скрывается.':'Здесь любимые блюда партнёра. Можно выбрать их для завтрака, угощения или совместного ужина.';
 const search=document.createElement('input');search.type='search';search.placeholder='Найти блюдо или напиток';search.setAttribute('aria-label','Поиск вкусов');search.value=v.query;
 const category=document.createElement('select');category.setAttribute('aria-label','Категория вкусов');
 for(const [id,title] of [['all','Все категории'],['meal','Домашние блюда'],['drink','Напитки'],['sweet','Десерты и перекусы'],['takeout','Готовая еда']]){const opt=document.createElement('option');opt.value=id;opt.textContent=title;category.append(opt);}category.value=v.category;
 const toggle=document.createElement('button');toggle.type='button';toggle.className='collection-more';
 const count=document.createElement('small');const list=document.createElement('div');list.className='collection-list';
 const more=document.createElement('button');more.type='button';more.className='collection-more';
 function render(){
  const q=v.query.trim().toLocaleLowerCase('ru').replaceAll('ё','е');
  const rows=listItems.filter(x=>(!editable||v.only?selected.has(x.kind+':'+x.id):true)&&(v.category==='all'||x.category===v.category)&&(!q||x.name.toLocaleLowerCase('ru').replaceAll('ё','е').includes(q))).sort((a,b)=>Number(selected.has(b.kind+':'+b.id))-Number(selected.has(a.kind+':'+a.id))||a.name.localeCompare(b.name,'ru'));
  count.textContent='В избранном: '+selected.size+' · найдено: '+rows.length;
  toggle.textContent=v.only?'Показать весь ассортимент':'Показать только любимое';
  list.replaceChildren();for(const x of rows.slice(0,v.limit)){
   const row=document.createElement('div');row.className='collection-entry';const title=document.createElement('strong');title.textContent=x.emoji+' '+x.name;row.append(title);
   if(editable){const view={...s,foodTastes:{...s.foodTastes,[owner]:{favorites:[...selected]}}};row.append(tasteButton(view,owner,x.kind,x.id,submit!,on=>{if(on)selected.add(x.kind+':'+x.id);else selected.delete(x.kind+':'+x.id);render();}));}
   else{const small=document.createElement('small');small.textContent='♥ Любимое';row.append(small);}list.append(row);
  }
  if(!rows.length){const empty=document.createElement('p');empty.textContent=editable&&v.only?'Пока нет подходящих любимых блюд. Открой весь ассортимент.':'Пока ничего не найдено.';list.append(empty);}
  more.hidden=rows.length<=v.limit;more.textContent='Показать ещё · '+Math.max(0,rows.length-v.limit);
 }
 search.oninput=()=>{v.query=search.value;v.limit=12;render();};category.onchange=()=>{v.category=category.value;v.limit=12;render();};toggle.onclick=()=>{v.only=!v.only;v.limit=12;render();};more.onclick=()=>{v.limit+=12;render();};
 const controls=document.createElement('div');controls.className='taste-controls';controls.append(search,category);if(editable)controls.append(toggle);root.append(h,note,controls,count,list,more);render();
}
