/** Fictional in-game catalogue; descriptions are intentionally compact for mobile. */
export const GAME_GENRES = {
  sim: { title:'Симуляторы', icon:'🌿', description:'Создавай, выращивай, обустраивай' },
  strategy: { title:'Стратегии', icon:'♟️', description:'Планируй и побеждай' },
  racing: { title:'Гонки', icon:'🏎️', description:'Скорость и адреналин' },
  horror: { title:'Приключения и хорроры', icon:'🌙', description:'Тайны, открытия, мурашки' },
} as const;
export type GameGenre = keyof typeof GAME_GENRES;
export interface ComputerGame {
  id: string;
  title: string;
  genre: GameGenre;
  icon: string;
  subtitle: string;
  scene: number;
  color: string;
  duration: number; // real-world seconds
  fun: number;
  mood: number;
  comfort: number;
  energy: number; // negative fatigue
  skill: number;
}
export const COMPUTER_GAMES: readonly ComputerGame[] = [
  {id:'green-valley',title:'Зелёная долина',genre:'sim',icon:'🌻',subtitle:'Ферма, огород и соседи',scene:0,color:'#93cba2',duration:40,fun:28,mood:4,comfort:5,energy:-3,skill:0},
  {id:'little-metropolis',title:'Мой мегаполис',genre:'sim',icon:'🏙️',subtitle:'Построй город своей мечты',scene:1,color:'#9cb9db',duration:52,fun:30,mood:4,comfort:4,energy:-5,skill:0},
  {id:'paw-house',title:'Лапки и дом',genre:'sim',icon:'🐾',subtitle:'Забота о питомцах',scene:2,color:'#e6b59a',duration:35,fun:26,mood:5,comfort:6,energy:-3,skill:0},
  {id:'dawn-empire',title:'Империя Рассвета',genre:'strategy',icon:'🏰',subtitle:'Развивай своё королевство',scene:0,color:'#e3bc80',duration:55,fun:29,mood:3,comfort:1,energy:-6,skill:1},
  {id:'orbital-frontier',title:'Орбитальный рубеж',genre:'strategy',icon:'🪐',subtitle:'Экспедиции и космофлот',scene:1,color:'#9eb8ef',duration:62,fun:33,mood:4,comfort:0,energy:-8,skill:1},
  {id:'iron-tactics',title:'Железная тактика',genre:'strategy',icon:'🛡️',subtitle:'Сражения на карте',scene:2,color:'#9dbaaa',duration:46,fun:27,mood:2,comfort:1,energy:-6,skill:1},
  {id:'night-curve',title:'Ночной вираж',genre:'racing',icon:'🏁',subtitle:'Городские заезды после заката',scene:0,color:'#e39aaf',duration:32,fun:26,mood:5,comfort:0,energy:-4,skill:0},
  {id:'neon-drift',title:'Неоновый дрифт',genre:'racing',icon:'⚡',subtitle:'Виражи под неоновым светом',scene:1,color:'#94d9e5',duration:43,fun:32,mood:5,comfort:0,energy:-5,skill:0},
  {id:'snow-rally',title:'Снежное ралли',genre:'racing',icon:'❄️',subtitle:'Скользкие повороты и снег',scene:2,color:'#b8d7e6',duration:49,fun:31,mood:3,comfort:1,energy:-5,skill:0},
  {id:'motel-13',title:'Мотель №13',genre:'horror',icon:'🔦',subtitle:'Исследуй пустые комнаты',scene:0,color:'#b5a5c7',duration:40,fun:26,mood:3,comfort:-3,energy:-4,skill:0},
  {id:'forest-signal',title:'Лесной сигнал',genre:'horror',icon:'🌲',subtitle:'Найди источник странного сигнала',scene:1,color:'#8bbca7',duration:56,fun:34,mood:3,comfort:-2,energy:-6,skill:0},
  {id:'dark-station',title:'Тёмная станция',genre:'horror',icon:'📻',subtitle:'Секрет заброшенного комплекса',scene:2,color:'#baa5e6',duration:60,fun:36,mood:4,comfort:-4,energy:-7,skill:0},
] as const;
export type ComputerGameId = typeof COMPUTER_GAMES[number]['id'];
export const GAME_BY_ID: ReadonlyMap<string, ComputerGame> = new Map(COMPUTER_GAMES.map(game=>[game.id,game]));
export const isComputerGameId = (v: unknown): v is ComputerGameId =>
  typeof v === 'string' && GAME_BY_ID.has(v);
export const VIDEO_CLIPS = {
  pets: {title:'Уютный день с питомцами',icon:'🐾',duration:35,fun:16,mood:4},
  travel: {title:'Путешествие к морю',icon:'🌊',duration:42,fun:18,mood:5},
  tech: {title:'Гаджеты и технологии',icon:'💻',duration:38,fun:17,mood:4},
} as const;
export type VideoClipId = keyof typeof VIDEO_CLIPS;
export const isVideoClipId = (id: unknown): id is VideoClipId =>
  typeof id === 'string' && Object.hasOwn(VIDEO_CLIPS,id);
export interface ComputerLibrary {
  favorites: ComputerGameId[];
  recent: ComputerGameId[];
  last: ComputerGameId | null;
  sessions: number;
}
export const initialComputerLibrary = (): Record<'vlad'|'alina', ComputerLibrary> => ({
  vlad:{favorites:[],recent:[],last:null,sessions:0},
  alina:{favorites:[],recent:[],last:null,sessions:0},
});
export function validComputerLibrary(value: unknown): value is Record<'vlad'|'alina',ComputerLibrary> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record=value as Record<string,ComputerLibrary>;
  return ['vlad','alina'].every(role=>{
    const v=record[role];
    return v && Array.isArray(v.favorites) && v.favorites.length <= COMPUTER_GAMES.length &&
      v.favorites.every(isComputerGameId) && new Set(v.favorites).size===v.favorites.length &&
      Array.isArray(v.recent) && v.recent.length<=5 && v.recent.every(isComputerGameId) &&
      new Set(v.recent).size===v.recent.length && (v.last===null || isComputerGameId(v.last)) &&
      Number.isSafeInteger(v.sessions) && v.sessions>=0 && v.sessions<=1000000;
  });
}
export const gamePreference = (role:'vlad'|'alina',genre:GameGenre): number =>
  role==='vlad' && genre==='strategy' || role==='alina' && (genre==='sim'||genre==='horror') ? 3 : 0;
