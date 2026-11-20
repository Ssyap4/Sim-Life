import { NEED_INFO } from './shared/life';
import type { NeedEffects, NeedKey } from './shared/homeLife';
import { names, type CharacterId } from './shared/protocol';

export function needChips(effects: NeedEffects, confirmed: boolean): HTMLElement {
  const row=document.createElement('div');
  row.className='need-chips';
  for(const [key,amount] of Object.entries(effects)) {
    if (!(amount > 0)) continue;
    const info=key==='mood'?{emoji:'🙂',label:'Настроение'}:NEED_INFO[key as Exclude<NeedKey,'mood'>];
    const chip=document.createElement('span');
    chip.textContent=info.emoji+' '+info.label+' +'+amount.toLocaleString('ru-RU');
    row.append(chip);
  }
  if(!row.childElementCount) row.hidden=true;
  if(!confirmed) row.setAttribute('aria-label','Ожидаемые прибавки');
  return row;
}

export function needFeedback(root: HTMLElement) {
  const expiry = new Map<CharacterId, number>();
  return {
    show(role: CharacterId,label: string,effects?: NeedEffects) {
      if(!effects) return;
      const chips=needChips(effects,true);
      if(chips.hidden) return;
      const card=document.createElement('article');
      card.className='confirmed-need';
      card.dataset.gainRole=role;
      const title=document.createElement('strong');
      title.textContent=names[role]+' · '+label;
      card.append(title,chips);
      root.querySelector('[data-gain-role="'+role+'"]')?.remove();
      root.append(card);
      window.clearTimeout(expiry.get(role));
      expiry.set(role,window.setTimeout(() => {card.remove();expiry.delete(role);},3500));
    },
    clear() {
      for(const timer of expiry.values()) window.clearTimeout(timer);
      expiry.clear();
      root.replaceChildren();
    },
  };
}
