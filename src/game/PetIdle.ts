import type { PetId } from '../shared/pets';

export type PetIdleGesture = 'greet' | 'sniff' | 'groom' | 'stretch' | 'observe' | 'hungryLook' | 'playBow' | 'pawWave' | 'slowBlink' | 'pounce' | 'beg' | 'happyHop' | 'nuzzle' | 'shake' | 'yawn' | 'sitLook' | 'backStretch' | 'earScratch' | 'pawLick' | 'faceWash' | 'downRest' | 'sniffSweep' | 'arch' | 'knead' | 'stalk' | 'lookBack' | 'sideStretch';
export interface PetIdleContext {
  satiety: number;
  energy: number;
  happiness: number;
  bond: number;
  bowl: number;
  personNearby: boolean;
}

export const PET_IDLE_SECONDS = 3.4;

/** One welcoming animation on a real arrival, never during distress. */
export function petCanWelcome(s:PetIdleContext):boolean {
  return s.personNearby && s.satiety>=30 && s.energy>=38 &&
    s.happiness>=62 && s.bond>=52;
}

/** Only picks a client-side animation. Never drives navigation, needs, or food. */
export function choosePetIdle(id: PetId, state: PetIdleContext, turn: number): PetIdleGesture {
  const slot=Number.isFinite(turn)?Math.abs(Math.trunc(turn)):0;
  if (state.satiety < 25 && state.bowl === 0)
    return slot % 3 === 2 ? (id === 'simba' ? 'groom' : 'sniff') : 'hungryLook';
  if (state.energy < 27) return (['stretch','yawn',id==='simba'?'slowBlink':'downRest'] as const)[slot%3];
  if (id === 'verdell') {
    // He sometimes asks for attention, but mostly sniffs and explores.
    if (petCanWelcome(state) && slot%11===4) return 'happyHop';
    if (state.personNearby && state.bond>=38 && state.energy>=32 &&
      state.satiety>=25 && slot%9===2) return 'beg';
    if (state.personNearby && state.happiness>=43 && slot%7===0) return 'greet';
    const quiet:readonly PetIdleGesture[]=[
      'sniff','observe','pawWave','stretch','playBow','shake','sitLook','sniffSweep','earScratch','yawn','pawLick','backStretch','downRest','lookBack',
    ];
    const gesture=quiet[slot%quiet.length];
    return (gesture==='playBow' && (state.energy<48||state.happiness<47)||gesture==='pawWave'&&!state.personNearby&&state.energy<45)
      ? 'observe':gesture;
  }
  // An independent cat does not nuzzle on every second idle loop.
  if (state.personNearby && state.bond>=48 && state.happiness>=54 &&
    state.energy>=25 && state.satiety>=25 && slot%8===1)return 'nuzzle';
  const quiet:readonly PetIdleGesture[]=[
    'groom','slowBlink','observe','stretch','pounce','faceWash','arch','knead','stalk','yawn','earScratch','lookBack','sideStretch','pawLick',
  ];
  const gesture=quiet[slot%quiet.length];
  return (gesture==='pounce'||gesture==='stalk') && (state.energy<52||state.happiness<55||state.satiety<30)
    ? 'observe':gesture;
}

/** Smoothly enters and exits a gesture without a sudden body pop. */
export function petIdleWeight(time: number): number {
  if (!Number.isFinite(time) || time <= 0 || time >= PET_IDLE_SECONDS) return 0;
  const fade = Math.max(0, Math.min(1, time / .48, (PET_IDLE_SECONDS - time) / .65));
  return fade * fade * (3 - 2 * fade);
}
