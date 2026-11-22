import { COOKING_ORDER, COOKING_RECIPES } from './shared/cookingProgression';
import { RECIPES } from './shared/food';
import { rankTitle, SKILLS, SKILL_IDS, skillRank, type SkillId } from './shared/education';
import { names, type CharacterId, type GameState } from './shared/protocol';

type View = {state: GameState; role: CharacterId};

export function createSkillsPanel(root: HTMLElement, read: () => View | null) {
  root.innerHTML = '<section class="skills-sheet" role="dialog" aria-modal="true" aria-label="Навыки персонажа">' +
    '<header class="skills-head"><div><strong>📊 Навыки и развитие</strong><small data-skills-owner></small></div>' +
    '<button type="button" data-skills-close aria-label="Закрыть навыки">×</button></header>' +
    '<div class="skills-list" aria-label="Девять навыков"></div>' +
    '<article class="skills-detail" aria-live="polite"></article></section>';
  const owner = root.querySelector<HTMLElement>('[data-skills-owner]')!;
  const list = root.querySelector<HTMLElement>('.skills-list')!;
  const detail = root.querySelector<HTMLElement>('.skills-detail')!;
  let selected: SkillId = 'cooking';
  let signature = '';

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, value: string, className = '') => {
    const node = document.createElement(tag);
    node.textContent = value;
    if (className) node.className = className;
    return node;
  };
  function render() {
    const view = read();
    if (root.hidden || !view) return;
    const profile = view.state.education.characters[view.role];
    const nextSignature = JSON.stringify([view.role, selected, profile.xp]);
    if (nextSignature === signature) return;
    signature = nextSignature;
    owner.textContent = names[view.role] + ' · личный прогресс';
    list.replaceChildren();
    for (const id of SKILL_IDS) {
      const rank = skillRank(profile.xp[id]);
      const button = el('button', '', 'skills-item');
      button.type = 'button';
      button.dataset.skill = id;
      button.setAttribute('aria-pressed', String(id === selected));
      const compactName: Partial<Record<SkillId,string>> = {
        organization:'Организация', attention:'Внимание', fitness:'Физподготовка', practical:'Практика',
      };
      button.append(el('span', SKILLS[id][0], 'skills-emoji'),
        el('span', compactName[id] ?? SKILLS[id][1], 'skills-name'),
        el('strong', rank.level + '/20', 'skills-level'));
      const progress = document.createElement('progress');
      progress.max = rank.next || 1;
      progress.value = rank.next ? rank.current : 1;
      progress.setAttribute('aria-label', 'Прогресс: ' + SKILLS[id][1]);
      button.append(progress);
      button.addEventListener('click', () => {selected = id; signature = ''; render();});
      list.append(button);
    }
    const rank = skillRank(profile.xp[selected]);
    detail.replaceChildren(
      el('h3', SKILLS[selected][0] + ' ' + SKILLS[selected][1] + ' · ' + rankTitle(rank.level)),
      el('p', SKILLS[selected][2]),
      el('p', rank.next ? 'До уровня ' + (rank.level + 1) + ': ' + (rank.next - rank.current) +
        ' XP · всего ' + profile.xp[selected] + ' XP' : 'Достигнут максимальный уровень 20', 'skills-xp'));
    if (selected === 'cooking') {
      const next = COOKING_ORDER.find(id => COOKING_RECIPES[id].minLevel > rank.level);
      detail.append(el('p', next
        ? '🔓 Следующий рецепт: ' + RECIPES[next].name + ' · уровень ' + COOKING_RECIPES[next].minLevel
        : 'Все рецепты доступны по уровню. Осталось собрать ингредиенты.', 'skills-unlock'));
      detail.append(el('p',
        'Готовь разные блюда: новый рецепт приносит больше опыта, привычный со временем меньше. Учёба тоже развивает кулинарию.'));
      const catalogue = el('div', '', 'skills-recipe-list');
      for (const id of COOKING_ORDER) {
        const recipe = COOKING_RECIPES[id];
        const available = rank.level >= recipe.minLevel;
        const line = el('div', '', available ? 'skills-recipe-unlocked' : 'skills-recipe-locked');
        line.append(el('span', (available ? '✓ ' : '🔒 ') + RECIPES[id].emoji + ' ' + RECIPES[id].name),
          el('small', recipe.tier + ' · ур. ' + recipe.minLevel));
        catalogue.append(line);
      }
      detail.append(catalogue);
    }
  }
  function close() {root.hidden = true; signature = '';}
  root.querySelector('[data-skills-close]')!.addEventListener('click', close);
  root.addEventListener('click', e => {if (e.target === root) close();});
  const escape = (e: KeyboardEvent) => {if (e.key === 'Escape' && !root.hidden) close();};
  window.addEventListener('keydown', escape);
  return {open(){selected = 'cooking'; root.hidden = false; signature = ''; render();
      root.querySelector<HTMLButtonElement>('[data-skills-close]')?.focus();},
    close, refresh:render};
}
