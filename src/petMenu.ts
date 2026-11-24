import {FURNITURE_REACTIONS} from './shared/petPreferences';
import {FURNITURE_BY_ID} from './shared/furniture';
import {feedingStation,feederReserve,dryRefills} from './shared/petFeeders';
import {DOG_COMMANDS,DOG_COMMAND_NAMES,commandSkill,trainingLevel,type DogTrainingAction} from './shared/dogTraining';
import {toysFor,toyOwned,TOY_REACTIONS} from './shared/petToys';
import { nextPetFood,petFoodProduct,FOOD_REACTIONS } from './shared/petShop';
import {
  PETS, PET_IDS, PET_ACTION_NAMES, PET_BOWL_CAPACITY, petHungerLevel,treatsRemaining, type PetId, type PetAction,
} from './shared/pets';
import type { GameState } from './shared/protocol';
import { catPerchCandidates } from './shared/CatPerches';
import {petBeds,petScratchers} from './shared/petFurniture';
import { petWish } from './shared/petWishes';

/** Small touch-friendly family panel driven by persistent server state. */
export function renderPetChoices(
  container: HTMLElement,
  state: GameState,
  selected: PetId | null,
  choose: (id: PetId) => void,
  send: (id: PetId, action: PetAction) => boolean,
): void {
  const tabs = document.createElement('div');
  tabs.className = 'pet-tabs';
  for (const id of PET_IDS) {
    const pet = PETS[id];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pet-tab' + (selected === id ? ' selected' : '');
    const hunger = petHungerLevel(state.pets[id].satiety);
    button.textContent = pet.emoji + ' ' + pet.name + (hunger === 'critical' ? ' ❗' : hunger === 'warning' ? ' ⚠️' : '');
    button.title = 'Сытость: ' + Math.round(state.pets[id].satiety) + '%';
    button.addEventListener('click', () => choose(id));
    tabs.appendChild(button);
  }
  container.appendChild(tabs);
  if (!selected) {
    // First tap on the Pets panel shows both personalities immediately;
    // opening individual stats/actions remains optional.
    for (const id of PET_IDS) {
      const wish = petWish(state, id);
      const overview = document.createElement('button');
      overview.type = 'button';
      overview.className = 'pet-wish pet-wish-preview' + (wish.urgent ? ' pet-wish-urgent' : '');
      const title = document.createElement('strong');
      title.textContent = PETS[id].emoji + ' ' + PETS[id].name + ' · ' + wish.title;
      const phrase = document.createElement('span');
      phrase.textContent = wish.message;
      const tip = document.createElement('small');
      tip.textContent = 'Подробнее о питомце и его потребностях';
      overview.append(title, phrase, tip);
      overview.addEventListener('click', () => choose(id));
      container.appendChild(overview);
    }
    return;
  }
  const pet = PETS[selected];
  const stats = state.pets[selected];
  const description = document.createElement('p');
  description.className = 'pet-note';
  description.textContent = pet.species + ' · запас: ' + state.petFood[selected] + ' насыпаний' +
    ' · миска: ' + state.petBowls[selected] + '/' + PET_BOWL_CAPACITY + ' порций';
  container.appendChild(description);
  const station=feedingStation(state.furnishing,selected),reserve=feederReserve(stats).length,capacity=station.model?.capacity??0;
  if(station.model||reserve){const note=document.createElement('p');note.className='pet-note';note.textContent=(station.model?.name??'Обычная миска')+(capacity?' · бункер '+reserve+'/'+capacity+' · автоподача':reserve?' · в запасе бункера '+reserve:'');container.appendChild(note);}
  const food=nextPetFood(stats),bowl=petFoodProduct(stats.bowlFood);
  if(food||bowl||stats.foodPreferences){const note=document.createElement('p');note.className='pet-note';note.textContent=[bowl?'В миске: '+bowl.name:'',food?'Следующее насыпание: '+food.name:'',...Object.entries(stats.foodPreferences??{}).map(([id,value])=>petFoodProduct(id)?.name+': '+FOOD_REACTIONS[value])].filter(Boolean).join(' · ');container.appendChild(note);}
  if(state.petFood[selected]+reserve===0){
    const note=document.createElement('p');note.className='pet-note';
    note.textContent='Корм закончился. Купи его в зоомагазине, супермаркете или закажи доставку продуктов.';
    container.appendChild(note);
  }
  const beds=petBeds(state.furnishing,selected);
  const petFurniture=document.createElement('p');
  petFurniture.className='pet-note';
  const favorite=beds.some(item=>item.id===stats.favoriteBedId);
  petFurniture.textContent='🏡 Лежанки: '+beds.length+(favorite?' · есть любимая':'')+
    (selected==='simba'?' · когтеточки: '+petScratchers(state.furnishing).length:'');
  container.appendChild(petFurniture);
  const installed=new Set(state.furnishing.placed.map(i=>i.sku));const known=Object.entries(stats.furniturePreferences??{}).filter(([key])=>installed.has(key.split(':')[0]));
  if(known.length){const details=document.createElement('details');details.className='pet-wish';const title=document.createElement('summary');title.textContent='🏡 Предпочтения мебели · '+known.length;details.append(title);for(const [key,value] of known){const [sku,entry]=key.split(':'),p=document.createElement('p');p.className='pet-note';p.textContent=(FURNITURE_BY_ID.get(sku)?.name??sku)+(entry==='inside'?' · внутри':entry==='jump'?' · крыша':'')+' — '+FURNITURE_REACTIONS[value];details.append(p);}container.append(details);}
  const toys=toysFor(selected).filter(p=>toyOwned(stats,p.id));
  if(toys.length){const note=document.createElement('p');note.className='pet-note';note.textContent='🧸 Игрушки: '+toys.map(p=>p.name+' · '+(stats.toyPreferences?.[p.id]===undefined?'ещё не играл':TOY_REACTIONS[stats.toyPreferences[p.id]])).join('; ');container.appendChild(note);}
  const wish = petWish(state, selected);
  const thoughts = document.createElement('section');
  thoughts.className = 'pet-wish' + (wish.urgent ? ' pet-wish-urgent' : '');
  const title = document.createElement('strong');
  title.textContent = '💭 Что хочет ' + pet.name + '? · ' + wish.title;
  const phrase = document.createElement('p');
  phrase.textContent = wish.message;
  const tip = document.createElement('small');
  tip.textContent = 'Подсказка: ' + wish.advice;
  thoughts.append(title, phrase, tip);
  container.appendChild(thoughts);
  const hungerLevel = petHungerLevel(stats.satiety);
  if (hungerLevel !== 'normal') {
    const hungry = document.createElement('p');
    hungry.className = 'pet-note';
    hungry.setAttribute('role','status');
    hungry.textContent = (hungerLevel === 'critical' ? '❗ Критический голод' : '⚠️ Проголодался') +
      ' · сытость ' + Math.round(stats.satiety) + '%.' +
      (state.petBowls[selected] === 0
        ? ' Миска пуста: насыпь корм или заполни кормушку, чтобы ' + pet.name + ' смог поесть.'
        : ' В миске есть корм: ' + pet.name + ' сможет самостоятельно поесть.');
    container.appendChild(hungry);
  }

  const status = document.createElement('div');
  status.className = 'pet-status';
  const meters: Array<[string, number, string]> = [
    ['Сытость', stats.satiety, 'food'],
    ['Энергия', stats.energy, 'happy'],
    ['Туалет', stats.bladder, 'bond'],
    ['Радость', stats.happiness, 'happy'],
    ['Привязанность', stats.bond, 'bond'],
    ...(selected==='verdell'?[['Чистота',stats.cleanliness??100,'food'] as [string,number,string]]:[]),
  ];
  for (const [label, value, className] of meters) {
    const line = document.createElement('div');
    line.className = 'pet-meter';
    const legend = document.createElement('span');
    legend.textContent = label + ' · ' + Math.round(value) + '%';
    const track = document.createElement('div');
    track.className = 'pet-meter-track';
    const fill = document.createElement('i');
    fill.className = className;
    fill.style.width = value + '%';
    track.append(fill);
    line.append(legend, track);
    status.appendChild(line);
  }
  container.appendChild(status);

  if(selected==='verdell'){
    const box=document.createElement('details');box.className='pet-wish';const heading=document.createElement('summary');heading.textContent='🎓 Дрессировка · '+DOG_COMMANDS.filter(c=>commandSkill(stats,c).xp===100).length+'/7 освоено';box.appendChild(heading);
    if(stats.lastTraining){const last=document.createElement('p');last.className='pet-note';last.textContent='Последняя команда: '+DOG_COMMAND_NAMES[stats.lastTraining.command]+' — '+(stats.lastTraining.success?'получилось!':'ещё учится');box.appendChild(last);}
    for(const c of DOG_COMMANDS){const skill=commandSkill(stats,c),b=document.createElement('button');b.type='button';b.className='food-action pet-action';b.disabled=!!stats.routine?.training||stats.energy<40||stats.satiety<45||stats.bladder<45;const name=document.createElement('strong');name.textContent=DOG_COMMAND_NAMES[c]+' · '+skill.xp+'%';const hint=document.createElement('small');hint.textContent=trainingLevel(skill.xp)+' · '+skill.successes+'/'+skill.attempts+' успешно';b.append(name,hint);b.addEventListener('click',()=>send(selected,('train-'+c) as DogTrainingAction));box.appendChild(b);}
    container.appendChild(box);
  }
  const actions: Array<{ action: PetAction; icon: string; hint: string; disabled: boolean }> = [
    {
      action: 'feed', icon: '🥣',
      hint: '−1 насыпание из пачки · +3 порции в миску · питомец ест сам при сытости 40% и ниже',
      disabled: state.petFood[selected]+reserve < 1 || state.petBowls[selected] > 0,
    },
    {
      action: 'play', icon: '🎾',
      hint: 'Радость и дружба · немного энергии игрока',
      disabled: stats.satiety < 8,
    },
    { action: 'pet', icon: '❤️', hint: 'Ласка, настроение и доверие', disabled: false },
    { action: 'brush', icon: '🪮', hint: 'Уход за шерстью и привязанность', disabled: false },

  ];
  if(selected==='verdell')actions.unshift({action:stats.routine?.kind==='bedTogether'?'leaveBed':'bedTogether',icon:'🛏️',hint:'Мягкая лесенка у кровати · Верделл отдыхает рядом с вами',disabled:stats.routine?.kind!=='bedTogether'&&!state.furnishing.placed.some(i=>i.sku==='pet-bed-stairs')});
  if(capacity)actions.unshift({action:'loadFeeder',icon:'🥣',hint:'Загрузить сухой корм в бункер · '+reserve+'/'+capacity,disabled:reserve>=capacity||dryRefills(state,selected)<=0});
  // These are new server-owned routes, not copies of the existing pet/play actions.
  actions.unshift({
    action:'mat',icon:'🧺',hint:'Сам идёт на реально купленную и установленную лежанку',
    disabled:!beds.length||stats.satiety<40||stats.bladder<35||stats.energy<20,
  });
  if(selected==='simba')actions.unshift({
    action:'scratch',icon:'🐾',hint:'Симба идёт к установленной когтеточке и точит когти',
    disabled:!petScratchers(state.furnishing).length||stats.satiety<40||stats.bladder<35||stats.energy<20,
  });
  actions.unshift({
    action:'call',icon:'📣',hint:'Питомец сам подходит к хозяину, обходя мебель',
    disabled:stats.satiety<40||stats.bladder<35||stats.energy<20,
  });
  if(selected==='simba')actions.splice(1,0,{
    action:'perch',icon:'🛋️',hint:'Запрыгнуть на доступную кровать, диван или кресло',
    disabled:stats.satiety<40||stats.bladder<35||stats.energy<20||
      catPerchCandidates(state.furnishing).length===0,
  });
  else actions.splice(1,0,{
    action:'fetch',icon:'🎾',hint:'Пробежать к мячику и принести его обратно',
    disabled:stats.satiety<40||stats.bladder<35||stats.energy<42,
  });
  if(selected==='verdell')actions.unshift({action:'bathe',icon:'🛁',hint:'Купание в ванной · чистота 100% · привязанность +7',disabled:stats.routine?.kind==='bath'||stats.satiety<20||stats.energy<15||stats.bladder<18});
  actions.unshift({action:'toy',icon:'🧸',hint:'Питомец идёт к купленной игрушке. Повтори, чтобы сменить её.',disabled:!toys.length||stats.satiety<40||stats.bladder<35||stats.energy<45});
  actions.unshift({action:'treat',icon:'🦴',hint:'+30 сытости · +12 настроение · +8 привязанность · осталось '+treatsRemaining(stats,state.clock.day)+'/3',disabled:treatsRemaining(stats,state.clock.day)<=0});
  for (const row of actions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'food-action pet-action';
    button.disabled = row.disabled;
    const title = document.createElement('strong');
    title.textContent = row.icon + ' ' + PET_ACTION_NAMES[row.action];
    const hint = document.createElement('small');
    hint.textContent = row.hint;
    button.append(title, hint);
    button.addEventListener('click', () => send(selected, row.action));
    container.appendChild(button);
  }
}
