import {collectionFor,collectionSummary} from './shared/personalCollections';
import {RECIPES,type RecipeId} from './shared/food';
import {COOKING_ORDER,COOKING_RECIPES} from './shared/cookingProgression';
import {LAKE_FISH,type LakeFish} from './shared/lake';
import {qualityLabel} from './shared/foodQuality';
import {SKILLS,skillRank,type SkillId} from './shared/education';
import {MATERIAL_BY_ID} from './shared/educationCatalog';
import {clockAt} from './shared/life';
import type {CharacterId,GameState} from './shared/protocol';

const element=<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string,cls?:string)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
const weight=(g:number)=>g? (g/1000).toLocaleString('ru-RU',{maximumFractionDigits:3})+' кг':'—';
const day=(at:number)=>'День '+clockAt(at).day;
type Filter='all'|'done'|'missing'|'perfect';
const views:Record<CharacterId,{filter:Filter;limit:number}>={vlad:{filter:'all',limit:8},alina:{filter:'all',limit:8}};
function stats(values:[string,string][]){const wrap=element('div',undefined,'collection-summary');for(const [value,label] of values){const b=element('div');b.append(element('strong',value),element('small',label));wrap.append(b);}return wrap;}
function entry(title:string,detail:string,discovered=true){const el=element('div',undefined,'collection-entry');el.dataset.discovered=String(discovered);el.append(element('strong',title),element('small',detail));return el;}
function fishBook(s:GameState,role:CharacterId){
 const section=element('section'),c=collectionFor(s,role),summary=collectionSummary(s,role);
 section.dataset.collection='fish';section.append(element('h3','🎣 Рыболовный журнал','collection-heading'),stats([[summary.fish+'/'+summary.fishTotal,'Виды рыб'],[String(summary.catches),'Уловов'],[weight(summary.bestGrams),'Личный рекорд']]));
 const list=element('div',undefined,'collection-list');
 for(const [id,d] of Object.entries(LAKE_FISH)){const row=c.fish[id as LakeFish];list.append(entry((row?'✓ ':'○ ')+d.name,row?'Поймано: '+row.count+' · рекорд '+weight(row.bestGrams)+' · '+day(row.at):'Ещё не поймана',!!row));}
 section.append(list);return section;
}
function recipeBook(s:GameState,role:CharacterId){
 const section=element('section'),c=collectionFor(s,role),summary=collectionSummary(s,role),v=views[role];
 section.dataset.collection='recipes';section.append(element('h3','🍳 Кулинарная книга','collection-heading'),stats([[summary.recipes+'/'+summary.recipeTotal,'Приготовленные рецепты'],[String(summary.batches),'Приготовлений'],[String(summary.perfect),'Идеальные блюда']]));
 const tabs=element('div',undefined,'collection-filters'),list=element('div',undefined,'collection-list'),more=element('button','Показать ещё','collection-more');
 const options:[Filter,string][]=[['all','Все'],['done','Готовили'],['missing','Новые'],['perfect','Идеальные']];
 function render(){tabs.replaceChildren();for(const [id,label] of options){const b=element('button',label);b.type='button';b.dataset.recipeFilter=id;b.setAttribute('aria-pressed',String(v.filter===id));b.onclick=()=>{v.filter=id;v.limit=8;render();};tabs.append(b);}
  const rows=COOKING_ORDER.filter(id=>{const r=c.recipes[id];return v.filter==='all'||(v.filter==='done'&&!!r)||(v.filter==='missing'&&!r)||(v.filter==='perfect'&&r?.best==='perfect');});
  list.replaceChildren();for(const id of rows.slice(0,v.limit)){const r=c.recipes[id as RecipeId],d=COOKING_RECIPES[id];list.append(entry((r?'✓ ':'○ ')+RECIPES[id].name,r?'Готовили: '+r.count+' · лучшее: '+qualityLabel(r.best)+' · последнее: '+qualityLabel(r.last)+' · идеальных: '+r.perfect+' · '+day(r.at):'Ещё не приготовлено · кулинария '+d.minLevel+' ур.',!!r));}
  if(!rows.length)list.append(element('p','Пока нет записей в этой категории.'));
  more.hidden=rows.length<=v.limit;more.textContent='Показать ещё · '+Math.max(0,rows.length-v.limit);
 }
 more.type='button';more.onclick=()=>{v.limit+=8;render();};section.append(tabs,list,more);render();return section;
}
function studyBook(s:GameState,role:CharacterId){
 const section=element('section'),p=s.education.characters[role],ids:SkillId[]=role==='vlad'?['technology','logic']:['cooking','practical','communication'];
 section.dataset.collection='study';section.append(element('h3',role==='vlad'?'💻 Технологии и обучение':'📚 Саморазвитие','collection-heading'));
 for(const id of ids){const rank=skillRank(p.xp[id]),row=element('div',undefined,'collection-skill'),bar=element('progress');bar.max=20;bar.value=rank.level;bar.setAttribute('aria-label',SKILLS[id][1]);row.append(element('strong',SKILLS[id][0]+' '+SKILLS[id][1]+' · '+rank.level+'/20'),bar);section.append(row);}
 const materials=Object.entries(p.studied).flatMap(([id,r])=>{const d=MATERIAL_BY_ID.get(id);return d&&ids.includes(d.skill)&&r.completions>0?[{d,r}]:[];}).sort((a,b)=>a.d.title.localeCompare(b.d.title,'ru'));
 section.append(element('p','Пройденные материалы: '+materials.length));
 const list=element('div',undefined,'collection-list');for(const {d,r} of materials.slice(0,8))list.append(entry(d.title,'Завершено: '+r.completions+' · '+r.minutes+' игр. мин.'));
 if(!materials.length)list.append(element('p','Пока нет завершённых материалов по этим навыкам.'));
 if(materials.length>8){const more=element('button','Показать все · '+materials.length,'collection-more');more.type='button';more.onclick=()=>{for(const {d,r} of materials.slice(8))list.append(entry(d.title,'Завершено: '+r.completions+' · '+r.minutes+' игр. мин.'));more.remove();};section.append(list,more);}else section.append(list);return section;
}
export function renderPersonalCollection(root:HTMLElement,s:GameState,role:CharacterId){
 root.append(element('p','Коллекции пополняются только после завершённых занятий. Старые уловы и блюда без личной записи не восстанавливаются.'));
 if(role==='vlad')root.append(fishBook(s,role),studyBook(s,role),recipeBook(s,role));
 else root.append(recipeBook(s,role),studyBook(s,role),fishBook(s,role));
}
