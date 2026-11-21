import type { SocialCommand, SocialOffer } from '../shared/socialLife';
import type { ServiceCommand } from '../shared/services';
import type { EducationCommand } from '../shared/education';
import type { PlaceId, Point, WorldCommand } from '../shared/locations';
import { storeTrust } from './trusted';
import type { ActionId, CharacterId, ClientPacket, GameState, ServerPacket, SocialKind, TimedCommand } from '../shared/protocol';
import type { IngredientId, RecipeId, TakeoutId } from '../shared/food';
import type { InstantCoffeeId } from '../shared/coffee';
import type { BasketLine } from '../shared/market';
import type { JobId } from '../shared/jobs';
import type { SleepMode, TimeStatus } from '../shared/timeControl';
import type { PetId, PetAction } from '../shared/pets';
import type { Entertainment, Genre, HomePresentation, NeedEffects } from '../shared/homeLife';
import type { HomeLeisure } from '../shared/home';
import type { WalkRoute } from '../game/navigation';
import type { ClockSample } from '../shared/life';

export interface ConnectionCallbacks {
  onReady(role: CharacterId, state: GameState, online: CharacterId[]): void;
  onSnapshot(state: GameState): void;
  onOnline(online: CharacterId[]): void;
  onTimeStatus(status: TimeStatus): void;
  onClock(sample: ClockSample): void;
  onStudyProgress(role: CharacterId, taskId: number, elapsed: number, total: number): void;
  onEducationFeedback(taskId: number, correct: boolean, message: string, question?: string): void;
  onEducationNotice(message: string): void;
  onDisconnect(): void;
  onAction(role: CharacterId, actionId: ActionId, message: string): void;
  onFoodEvent(role: CharacterId, action: 'buy' | 'cook' | 'eat', message: string): void;
  onStoreEvent(role: CharacterId, message: string): void;
  onJobEvent(role: CharacterId, outcome:'started'|'finished'|'left_early', message:string):void;
  onPetEvent(role: CharacterId, pet: PetId, action: PetAction, message: string): void;
  onTaskStarted(role: CharacterId, taskId: number, label: string, durationMs: number, command: TimedCommand, automatic?: boolean, home?: HomePresentation, effects?: NeedEffects): void;
  onTaskActive(role: CharacterId, taskId: number, elapsedMs: number): void;
  onNeedGain(role: CharacterId, label: string, effects: NeedEffects): void;
  onMovieOffer(inviteId: number, from: CharacterId, genre: Genre): void;
  onMovieOfferClosed(inviteId: number, message: string): void;
  onHomeLeisure(roles: CharacterId[], activity: HomeLeisure | null, routes: Partial<Record<CharacterId, WalkRoute>>): void;
  onStorageEvent(role: CharacterId, station?: string): void;
  onTaskEnded(role: CharacterId, taskId: number, outcome: 'completed' | 'cancelled' | 'failed', message: string, effects?: NeedEffects): void;
  onSocialStart(kind: SocialKind, message: string): void;
  onSocialOffer(offer:SocialOffer):void;
  onSocialClosed(id:number,message:string,reply?:string):void;
  onError(message: string): void;
  onStatus(status: string): void;
  onWorldPath(role: CharacterId, place: PlaceId, path: Point[], station?: string): void;
  onWorldEvent(role: CharacterId, message: string): void;
  onDeliveryArrived(): void;
  onReadyFoodSpoiled(message: string): void;
  onBillingEvent(messages: string[]): void;
}

export class LiveConnection {
  private socket: WebSocket | null = null;
  private role: CharacterId | null = null;
  private credential: { code: string; remember: boolean } | { token: string } | null = null;
  private retryCount = 0;
  private retryTimer: number | undefined;
  private stopped = false;
  private authorized = false;

  constructor(private readonly callbacks: ConnectionCallbacks) {}

  login(role: CharacterId, code: string, remember = false): void {
    if (!code.trim()) return;
    this.connect(role, { code: code.trim(), remember });
  }

  resume(role: CharacterId, token: string): void { this.connect(role, { token }); }

  private connect(role: CharacterId, credential: NonNullable<LiveConnection['credential']>): void {
    this.stop();
    this.stopped = false;
    this.role = role;
    this.credential = credential;
    this.retryCount = 0;
    this.open();
  }

  perform(actionId: ActionId, computer?: import('../shared/computer').ComputerDevice): boolean {
    if (!this.authorized || this.socket?.readyState !== WebSocket.OPEN) {
      this.callbacks.onError('Нет соединения с сервером');
      return false;
    }
    this.send({ type: 'act', actionId, ...(computer ? { computer } : {}) });
    return true;
  }

  food(type: 'buy' | 'cook' | 'eat', id: IngredientId | RecipeId): boolean {
    if (type === 'buy') return this.sendAuthenticated({ type, item: id as IngredientId });
    return this.sendAuthenticated({ type, recipe: id as RecipeId });
  }

  brewCoffee(blend: InstantCoffeeId): boolean {return this.sendAuthenticated({type:'brew_coffee',blend});}

  startJob(job:JobId):boolean {return this.sendAuthenticated({type:'job_start',job});}
  leaveJobEarly():boolean {return this.sendAuthenticated({type:'job_leave_early'});}
  setShiftSpeed(enabled: boolean): boolean {return this.sendAuthenticated({type:'shift_speed',enabled});}
  startSleep(mode: SleepMode): boolean {return this.sendAuthenticated({type:'sleep_start',mode});}
  stopSleep(): boolean {return this.sendAuthenticated({type:'sleep_stop'});}

  checkout(lines: BasketLine[]): boolean {
    return this.sendAuthenticated({type:'checkout',lines});
  }

  eatTakeout(item: TakeoutId): boolean {
    return this.sendAuthenticated({type:'eat_takeout',item});
  }

  service(command: ServiceCommand): boolean {return this.sendAuthenticated(command);}
  education(command: EducationCommand): boolean {return this.sendAuthenticated(command);}
  entertainment(command: Entertainment): boolean {return this.sendAuthenticated(command);}
  inviteMovie(genre: Genre): boolean {return this.sendAuthenticated({type:'movie_invite',genre});}
  answerMovie(inviteId: number, accept: boolean): boolean {return this.sendAuthenticated({type:'movie_reply',inviteId,accept});}
  withdrawMovie(inviteId: number): boolean {return this.sendAuthenticated({type:'movie_withdraw',inviteId});}

  cancelTask(taskId: number): boolean {
    return this.sendAuthenticated({ type: 'cancel_task', taskId });
  }

  petAction(pet: PetId, action: PetAction): boolean {
    return this.sendAuthenticated({ type: 'pet_action', pet, action });
  }

  world(command: WorldCommand): boolean { return this.sendAuthenticated(command); }
  career(command: import('../shared/careers').CareerCommand): boolean { return this.sendAuthenticated(command); }
  playGame(game: import('../shared/computerGames').ComputerGameId,device:import('../shared/computer').ComputerDevice):boolean {
    return this.sendAuthenticated({type:'play_game',game,device});
  }
  favoriteGame(game: import('../shared/computerGames').ComputerGameId,enabled:boolean):boolean {
    return this.sendAuthenticated({type:'computer_favorite',game,enabled});
  }
  playComputerVideo(clip:import('../shared/computerGames').VideoClipId,device:import('../shared/computer').ComputerDevice):boolean {
    return this.sendAuthenticated({type:'computer_video',clip,device});
  }

  forgetDevice(): void {
    storeTrust(null);
    if (this.authorized) this.send({ type: 'forget_device' });
    this.stop();
  }

  social(command:SocialCommand):boolean {return this.sendAuthenticated(command);}
  offerSocial(kind: SocialKind): boolean { return this.sendAuthenticated({ type: 'social_offer', kind }); }
  isReady(): boolean { return this.authorized; }

  private sendAuthenticated(message: ClientPacket): boolean {
    if (!this.authorized || this.socket?.readyState !== WebSocket.OPEN) {
      this.callbacks.onError('Нет соединения с сервером');
      return false;
    }
    this.send(message);
    return true;
  }

  stop(): void {
    this.stopped = true;
    this.credential = null;
    this.role = null;
    window.clearTimeout(this.retryTimer);
    this.authorized = false;
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.onmessage = null;
      this.socket.onopen = null;
      this.socket.close();
    }
    this.socket = null;
  }

  private send(value: ClientPacket): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(value));
  }

  private open(): void {
    if (!this.role || this.stopped) return;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = protocol + '//' + location.host + '/sync';
    this.callbacks.onStatus('Подключаемся к общему дому…');
    let socket: WebSocket;
    try { socket = new WebSocket(url); }
    catch { this.scheduleRetry(); return; }
    this.socket = socket;
    socket.onopen = () => {
      if (!this.role || !this.credential || this.socket !== socket) return;
      if ('token' in this.credential) this.send({ type: 'resume', role: this.role, token: this.credential.token });
      else this.send({ type: 'auth', role: this.role, ...this.credential });

    };
    socket.onmessage = (event: MessageEvent<string>) => {
      let packet: ServerPacket;
      try { packet = JSON.parse(event.data) as ServerPacket; }
      catch { return; }
      if (packet.type === 'ready') {
        this.authorized = true;
        this.retryCount = 0;
        this.callbacks.onReady(packet.role, packet.state, packet.online);
        this.callbacks.onStatus('Синхронизация активна');
      } else if (packet.type === 'device_token' && this.authorized && packet.role === this.role) {
        this.credential = { token: packet.token };
        storeTrust({ role: packet.role, token: packet.token });
      } else if (packet.type === 'world_path' && this.authorized) {
        this.callbacks.onWorldPath(packet.role, packet.place, packet.path, packet.station);
      } else if (packet.type === 'world_event' && this.authorized) {
        this.callbacks.onWorldEvent(packet.role, packet.message);
      } else if (packet.type === 'delivery_arrived' && this.authorized) {
        this.callbacks.onDeliveryArrived();
      } else if (packet.type === 'ready_food_spoiled' && this.authorized) {
        this.callbacks.onReadyFoodSpoiled(packet.message);
      } else if (packet.type === 'snapshot' && this.authorized) {
        this.callbacks.onSnapshot(packet.state);
      } else if (packet.type === 'online' && this.authorized) {
        this.callbacks.onOnline(packet.online);
      } else if (packet.type === 'time_status' && this.authorized) {
        this.callbacks.onTimeStatus(packet.status);
      } else if (packet.type === 'study_progress' && this.authorized) {
        this.callbacks.onStudyProgress(packet.role, packet.taskId, packet.elapsed, packet.total);
      } else if (packet.type === 'education_feedback' && this.authorized) {
        this.callbacks.onEducationFeedback(packet.taskId, packet.correct, packet.message, packet.question);
      } else if (packet.type === 'education_notice' && this.authorized) {
        this.callbacks.onEducationNotice(packet.message);
      } else if (packet.type === 'clock_sync' && this.authorized) {
        this.callbacks.onClock(packet.sample);
      } else if (packet.type === 'action' && this.authorized) {
        this.callbacks.onAction(packet.role, packet.actionId, packet.message);
      } else if (packet.type === 'food_event' && this.authorized) {
        this.callbacks.onFoodEvent(packet.role, packet.action, packet.message);
      } else if (packet.type === 'billing_event' && this.authorized) {
        this.callbacks.onBillingEvent(packet.messages);
      } else if (packet.type === 'store_event' && this.authorized) {
        this.callbacks.onStoreEvent(packet.role, packet.message);
      } else if (packet.type === 'job_event' && this.authorized) {
        this.callbacks.onJobEvent(packet.role,packet.outcome,packet.message);
      } else if (packet.type === 'pet_event' && this.authorized) {
        this.callbacks.onPetEvent(packet.role, packet.pet, packet.action, packet.message);
      } else if (packet.type === 'task_started' && this.authorized) {
        this.callbacks.onTaskStarted(packet.role, packet.taskId, packet.label, packet.durationMs, packet.command, packet.automatic, packet.home, packet.effects);
      } else if (packet.type === 'task_active' && this.authorized) {
        this.callbacks.onTaskActive(packet.role,packet.taskId,packet.elapsedMs);
      } else if (packet.type === 'need_gain' && this.authorized) {
        this.callbacks.onNeedGain(packet.role,packet.label,packet.effects);
      } else if (packet.type === 'movie_offer' && this.authorized) {
        this.callbacks.onMovieOffer(packet.inviteId,packet.from,packet.genre);
      } else if (packet.type === 'movie_offer_closed' && this.authorized) {
        this.callbacks.onMovieOfferClosed(packet.inviteId,packet.message);
      } else if (packet.type === 'home_leisure' && this.authorized) {
        this.callbacks.onHomeLeisure(packet.roles, packet.activity, packet.routes);
      } else if (packet.type === 'storage_event' && this.authorized) {
        this.callbacks.onStorageEvent(packet.role, packet.station);
      } else if (packet.type === 'task_ended' && this.authorized) {
        this.callbacks.onTaskEnded(packet.role, packet.taskId, packet.outcome, packet.message, packet.effects);
      } else if(packet.type==='social_pending'&&this.authorized) {
        this.callbacks.onSocialOffer(packet.offer);
      } else if(packet.type==='social_closed'&&this.authorized) {
        this.callbacks.onSocialClosed(packet.inviteId,packet.message,packet.reply);
      } else if (packet.type === 'social_start' && this.authorized) {
        this.callbacks.onSocialStart(packet.kind, packet.message);
      } else if (packet.type === 'error') {
        this.callbacks.onError(packet.reason);
        if (!this.authorized && (packet.reason.includes('код') || packet.reason.includes('занят'))) {
          if (packet.reason.includes('Доверие устройства истекло')) storeTrust(null);
          this.callbacks.onStatus('Не удалось войти: ' + packet.reason);
          this.stop();
        }
      }
    };
    socket.onclose = () => {
      if (this.authorized) this.callbacks.onDisconnect();
      this.authorized = false;
      if (!this.stopped) {
        this.callbacks.onStatus('Связь потеряна. Повторное подключение…');
        this.scheduleRetry();
      }
    };
    socket.onerror = () => { /* onclose will handle connection failures */ };
  }

  private scheduleRetry(): void {
    if (this.stopped) return;
    const delay = Math.min(1500 * 2 ** Math.min(this.retryCount++, 4), 15000);
    window.clearTimeout(this.retryTimer);
    this.retryTimer = window.setTimeout(() => this.open(), delay);
  }
}
