import { clockMinutes } from './locations';
import { ACTIONS, type ActionId, type GameState, type TimedCommand } from './protocol';
import { MATERIAL_BY_ID } from './educationCatalog';
import { furnitureSource } from './furnitureUse';
import { FURNITURE_BY_ID } from './furniture';
import { mediaAccessError, serviceAvailable, SERVICE_MESSAGES } from './services';

const onlineComputer = new Set<ActionId>(['vladOrder', 'vladStudy', 'alinaStudy', 'alinaConsult', 'deskGames']);
const mobileCommunication = new Set<ActionId>(['sofaCall', 'tableTalk']);

export function taskAccessError(state: GameState, command: TimedCommand): string | undefined {
  const now = clockMinutes(state.clock);
  if(command.type==='furniture_use'){
    const selected=furnitureSource(state,command.furnitureId,command.action);
    if(!selected.ok)return selected.reason;
  }
  if(command.type==='act'){
    const item=ACTIONS[command.actionId]?.item;
    if(item && state.furnishing.soldFixtures?.includes(item as import('./furniture').StaticFurnitureId)
      && !(item==='desk'&&command.computer==='laptop')&&
      !(item==='desk'&&state.furnishing.placed.some(p=>
        FURNITURE_BY_ID.get(p.sku)?.shape==='desk')))
      return 'Предмет был продан — выбери доступную мебель';
  }
  const sold=state.furnishing.soldFixtures??[];
  const hasShape=(...shapes:import('./furniture').FurnitureShape[])=>
    state.furnishing.placed.some(p=>shapes.includes(FURNITURE_BY_ID.get(p.sku)!.shape));
  if((command.type==='movie'||command.type==='youtube'||command.type==='free_tv')&&
    sold.includes('sofa')&&!hasShape('sofa','corner'))
    return 'Поставь диван, чтобы смотреть телевизор';
  if(command.type==='read_book'&&((sold.includes('bookcase')&&!hasShape('shelves'))||
      (command.seat==='officeChair'&&sold.includes('officeChair')&&!hasShape('armchair','chair'))))
    return 'Для чтения нужен книжный стеллаж и место для сидения';
  if(command.type==='study'){
    const channel=MATERIAL_BY_ID.get(command.material)?.channel;
    if(channel==='book'&&sold.includes('bookcase')&&!hasShape('shelves'))
      return 'Поставь книжный стеллаж для занятий с книгами';
    if(channel==='tv'&&sold.includes('sofa')&&!hasShape('sofa','corner'))
      return 'Поставь диван для просмотра учебных видео';
    if(channel==='academy'&&sold.includes('desk')&&command.computer!=='laptop'&&
      !state.furnishing.placed.some(p=>FURNITURE_BY_ID.get(p.sku)?.shape==='desk'))
      return 'Для компьютерного обучения установи письменный стол или используй ноутбук';
  }
  if((command.type==='play_game'||command.type==='computer_video')&&
    sold.includes('desk')&&command.device==='desktop'&&!hasShape('desk'))
    return 'Поставь новый компьютерный стол или используй ноутбук';
  if (command.type === 'movie' || (command.type === 'act' && command.actionId === 'sofaMovie'))
    return mediaAccessError(state.billing, 'netflix', now);
  if (command.type === 'youtube') return mediaAccessError(state.billing, 'youtube', now);
  if (command.type !== 'act') return;
  if (onlineComputer.has(command.actionId) && !serviceAvailable(state.billing, 'internet', now))
    return SERVICE_MESSAGES.computer;
  if (mobileCommunication.has(command.actionId) && !serviceAvailable(state.billing, 'mobile', now))
    return SERVICE_MESSAGES.mobile;
}
