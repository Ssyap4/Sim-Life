import { clockMinutes } from './locations';
import { ACTIONS, type ActionId, type GameState, type TimedCommand } from './protocol';
import { MATERIAL_BY_ID } from './educationCatalog';
import { mediaAccessError, serviceAvailable, SERVICE_MESSAGES } from './services';

const onlineComputer = new Set<ActionId>(['vladOrder', 'vladStudy', 'alinaStudy', 'alinaConsult', 'deskGames']);
const mobileCommunication = new Set<ActionId>(['sofaCall', 'tableTalk']);

export function taskAccessError(state: GameState, command: TimedCommand): string | undefined {
  const now = clockMinutes(state.clock);
  if(command.type==='act'){
    const item=ACTIONS[command.actionId]?.item;
    if(item && state.furnishing.soldFixtures?.includes(item as import('./furniture').StaticFurnitureId)
      && !(item==='desk'&&command.computer==='laptop'))
      return 'Предмет был продан — выбери доступную мебель';
  }
  const sold=state.furnishing.soldFixtures??[];
  if((command.type==='movie'||command.type==='youtube'||command.type==='free_tv')&&sold.includes('sofa'))
    return 'Диван продан — просмотр с дивана недоступен';
  if(command.type==='read_book'&&(sold.includes('bookcase')||
      (command.seat==='officeChair'&&sold.includes('officeChair'))))
    return 'Для чтения нужна библиотека и доступное место для сидения';
  if(command.type==='study'){
    const channel=MATERIAL_BY_ID.get(command.material)?.channel;
    if(channel==='book'&&sold.includes('bookcase'))
      return 'Книжный стеллаж продан — печатные книги недоступны';
    if(channel==='tv'&&sold.includes('sofa'))
      return 'Диван продан — просмотр учебного видео недоступен';
    if(channel==='academy'&&sold.includes('desk')&&command.computer!=='laptop')
      return 'Компьютер со столом продан — используй ноутбук';
  }
  if((command.type==='play_game'||command.type==='computer_video')&&sold.includes('desk')&&command.device==='desktop')
    return 'Компьютер со столом продан — используй ноутбук';
  if (command.type === 'movie' || (command.type === 'act' && command.actionId === 'sofaMovie'))
    return mediaAccessError(state.billing, 'netflix', now);
  if (command.type === 'youtube') return mediaAccessError(state.billing, 'youtube', now);
  if (command.type !== 'act') return;
  if (onlineComputer.has(command.actionId) && !serviceAvailable(state.billing, 'internet', now))
    return SERVICE_MESSAGES.computer;
  if (mobileCommunication.has(command.actionId) && !serviceAvailable(state.billing, 'mobile', now))
    return SERVICE_MESSAGES.mobile;
}
