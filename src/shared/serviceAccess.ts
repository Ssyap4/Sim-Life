import { clockMinutes } from './locations';
import type { ActionId, GameState, TimedCommand } from './protocol';
import { mediaAccessError, serviceAvailable, SERVICE_MESSAGES } from './services';

const onlineComputer = new Set<ActionId>(['vladOrder', 'vladStudy', 'alinaStudy', 'alinaConsult', 'deskGames']);
const mobileCommunication = new Set<ActionId>(['sofaCall', 'tableTalk']);

export function taskAccessError(state: GameState, command: TimedCommand): string | undefined {
  const now = clockMinutes(state.clock);
  if (command.type === 'movie' || (command.type === 'act' && command.actionId === 'sofaMovie'))
    return mediaAccessError(state.billing, 'netflix', now);
  if (command.type === 'youtube') return mediaAccessError(state.billing, 'youtube', now);
  if (command.type !== 'act') return;
  if (onlineComputer.has(command.actionId) && !serviceAvailable(state.billing, 'internet', now))
    return SERVICE_MESSAGES.computer;
  if (mobileCommunication.has(command.actionId) && !serviceAvailable(state.billing, 'mobile', now))
    return SERVICE_MESSAGES.mobile;
}
