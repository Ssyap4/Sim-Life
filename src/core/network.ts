import type { SocialCommand, SocialOffer } from '../shared/socialLife';
import type { ServiceCommand } from '../shared/services';
import type { BudgetCommand } from '../shared/familyBudget';
import type { EducationCommand } from '../shared/education';
import type { PlaceId, Point, WorldCommand } from '../shared/locations';
import { storeTrust } from './trusted';
import type { ActionId, CharacterId, ClientPacket, GameState, ServerPacket, QueuedTask, SocialKind, TimedCommand } from '../shared/protocol';
import type { AutonomyMode } from '../shared/autonomy';
import type { IngredientId, RecipeId, TakeoutId } from '../shared/food';
import type { CoffeeBlend, CoffeeDrink } from '../shared/coffee';
import type { BasketLine } from '../shared/market';
import type { FurnishingCommand } from '../shared/furniture';
import type { JobId } from '../shared/jobs';
import type { SleepMode, TimeStatus } from '../shared/timeControl';
import type { PetId, PetAction } from '../shared/pets';
import type { Entertainment, MediaGenre, HomePresentation, NeedEffects } from '../shared/homeLife';
import type { HomeLeisure } from '../shared/home';
import type { WalkRoute } from '../game/navigation';
import type { ClockSample } from '../shared/life';

export interface ConnectionCallbacks {
  onReady(role: CharacterId, state: GameState, online: CharacterId[]): void;
  onSnapshot(state: GameState): void;
  onAlbumImage?(id:string,jpeg:string):void;
  onAlbumError?(reason:string,id?:string):void;
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
  onTaskQueue(role: CharacterId, tasks: QueuedTask[]): void;
  onNeedGain(role: CharacterId, label: string, effects: NeedEffects): void; onTvFoodDone(role:CharacterId,taskId:number):void;
  onAgilityFeedback?(taskId:number,role:CharacterId,quality?:number):void;
  onTableState?(match:import('../shared/manualTableGames').TableMatch):void;
  onPoolState?(match:import('../shared/manualPool').PoolMatch):void;
  onHockeyState?(match:import('../shared/manualHockey').HockeyMatch):void;
  onBowlingState?(match:import('../shared/manualBowling').BowlingMatch):void;
  onMovieOffer(inviteId: number, from: CharacterId, genre: MediaGenre,food?:import('../shared/food').MediaFood,selection?:import('../shared/mediaCatalog').MediaSelection): void;
  onMovieOfferClosed(inviteId: number, message: string): void;
  onHomeLeisure(roles: CharacterId[], activity: HomeLeisure | null, routes: Partial<Record<CharacterId, WalkRoute>>): void;
  onStorageEvent(role: CharacterId, station?: string): void;
  onTaskEnded(role: CharacterId, taskId: number, outcome: 'completed' | 'cancelled' | 'failed', message: string, effects?: NeedEffects): void;
  onSocialStart(kind: SocialKind, message: string): void;
  onSocialOffer(offer:SocialOffer):void;
  onConversation?(from:CharacterId,remainingMs:number,title:string):void;
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
  private suspended = false;
  private hasBeenReady = false;
  private connectTimer: number | undefined;
  private silenceTimer: number | undefined;
  private lastPacketAt=0;
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
    this.suspended = false;
    this.hasBeenReady = false;
    this.role = role;
    this.credential = credential;
    this.retryCount = 0;
    this.open();
  }

  perform(actionId: ActionId, computer?: import('../shared/computer').ComputerDevice): boolean {
    return this.sendAuthenticated({type:'act',actionId,...(computer?{computer}:{})});
  }

  cleanRoom(room:import('../shared/homeDust').DustRoomId):boolean {return this.sendAuthenticated({type:'clean_room',room});}
  furnitureUse(command:import('../shared/furnitureUse').FurnitureUseCommand):boolean {
    return this.sendAuthenticated(command);
  }

  food(type: 'buy' | 'cook' | 'eat', id: IngredientId | RecipeId,furnitureId?:number,drinkSeat?:import('../shared/food').DrinkSeat): boolean {
    if (type === 'buy') return this.sendAuthenticated({ type, item: id as IngredientId });
    return this.sendAuthenticated({ type, recipe: id as RecipeId,
      ...(type==='eat'&&furnitureId!==undefined?{furnitureId}:{}),...(type==='eat'&&drinkSeat?{drinkSeat}:{}) });
  }

  serveWorkDrink(command:import('../shared/workCoffee').WorkDrinkCommand):boolean{return this.sendAuthenticated(command);}
  brewCoffee(blend: CoffeeBlend,drink?:CoffeeDrink): boolean {return this.sendAuthenticated({type:'brew_coffee',blend,drink});}

  startJob(job:JobId,device?:import('../shared/computer').ComputerDevice):boolean {return this.sendAuthenticated({type:'job_start',job,device});}
  answerHomeJob(nonce:string,choice:number):boolean {return this.sendAuthenticated({type:'home_job_answer',nonce,choice});}
  leaveJobEarly():boolean {return this.sendAuthenticated({type:'job_leave_early'});}
  setShiftSpeed(enabled: boolean): boolean {return this.sendAuthenticated({type:'shift_speed',enabled});}
  togglePause(): boolean { return this.sendAuthenticated({type:'pause_toggle'}); }
  replyPause(accept: boolean): boolean { return this.sendAuthenticated({type:'pause_reply',accept}); }
  setAutonomyMode(mode:AutonomyMode):boolean{return this.sendAuthenticated({type:'autonomy_mode',mode});}
  startSleep(mode: SleepMode,furnitureId?:number): boolean {return this.sendAuthenticated({type:'sleep_start',mode,...(furnitureId===undefined?{}:{furnitureId})});}
  happiness(type:'happiness_buy'|'happiness_activate',reward:import('../shared/happiness').RewardId):boolean{return this.sendAuthenticated({type,reward});}
  stopSleep(): boolean {return this.sendAuthenticated({type:'sleep_stop'});}

  checkout(lines: BasketLine[]): boolean {
    return this.sendAuthenticated({type:'checkout',lines});
  }

  eatTakeout(item: TakeoutId,furnitureId?:number): boolean {
    return this.sendAuthenticated({type:'eat_takeout',item,...(furnitureId===undefined?{}:{furnitureId})});
  }

  service(command: ServiceCommand): boolean {return this.sendAuthenticated(command);}
  weekend(command:import('../shared/weekends').WeekendCommand):boolean{return this.sendAuthenticated(command);}
  familyLife(command:import('../shared/familyLife').FamilyLifeCommand):boolean{return this.sendAuthenticated(command);}
  budget(command: BudgetCommand): boolean {return this.sendAuthenticated(command);}
  education(command: EducationCommand): boolean {return this.sendAuthenticated(command);}
  entertainment(command: Entertainment): boolean {return this.sendAuthenticated(command);}
  inviteMovie(genre: MediaGenre,food?:import('../shared/food').MediaFood,selection?:import('../shared/mediaCatalog').MediaSelection): boolean {return this.sendAuthenticated({type:'movie_invite',genre,food,selection});}
  tableAction(command:import('../shared/manualTableGames').TableCommand):boolean{return this.sendAuthenticated(command);}
  poolShot(command:import('../shared/manualPool').PoolCommand):boolean{return this.sendAuthenticated(command);}
  hockeyMove(command:import('../shared/manualHockey').HockeyCommand):boolean{return this.sendAuthenticated(command);}
  bowlingRoll(command:import('../shared/manualBowling').BowlingCommand):boolean{return this.sendAuthenticated(command);}
  mediaMark(command:import('../shared/mediaLibrary').MediaCommand):boolean{return this.sendAuthenticated(command);}
  answerMovie(inviteId: number, accept: boolean): boolean {return this.sendAuthenticated({type:'movie_reply',inviteId,accept});}
  withdrawMovie(inviteId: number): boolean {return this.sendAuthenticated({type:'movie_withdraw',inviteId});}

  cancelQueuedTask(queueId:number):boolean{return this.sendAuthenticated({type:'cancel_queued_task',queueId});}
  clearTaskQueue():boolean{return this.sendAuthenticated({type:'clear_task_queue'});}

  cancelTask(taskId: number): boolean {
    return this.sendAuthenticated({ type: 'cancel_task', taskId });
  }

  yieldSimba(key:string):boolean {return this.sendAuthenticated({type:'simba_yield',key});}

  agilityCue(taskId:number):boolean{return this.sendAuthenticated({type:'agility_cue',taskId});}
  catPlay(command:import('../shared/petToys').CatPlayCommand):boolean{return this.sendAuthenticated(command);}
  petAction(pet: PetId, action: PetAction): boolean {
    return this.sendAuthenticated({ type: 'pet_action', pet, action });
  }

  world(command: WorldCommand): boolean { return this.sendAuthenticated(command); }
  furnishing(command:FurnishingCommand):boolean{return this.sendAuthenticated(command);}
  career(command: import('../shared/careers').CareerCommand): boolean { return this.sendAuthenticated(command); }
  playGame(game: import('../shared/computerGames').ComputerGameId,device:import('../shared/computer').ComputerDevice,furnitureId?:number):boolean {
    return this.sendAuthenticated({type:'play_game',game,device,...(furnitureId===undefined?{}:{furnitureId})});
  }
  album(command:import('../shared/familyAlbum').AlbumCommand):boolean{return this.sendAuthenticated(command);}
  familyMessage(command:import('../shared/familyMessages').MessageCommand):boolean{return this.sendAuthenticated(command);}
  favoriteFood(kind:import('../shared/foodTastes').TasteKind,item:string,enabled:boolean):boolean {return this.sendAuthenticated({type:'food_favorite',kind,item,enabled});}
  favoriteGame(game: import('../shared/computerGames').ComputerGameId,enabled:boolean):boolean {
    return this.sendAuthenticated({type:'computer_favorite',game,enabled});
  }
  playComputerVideo(clip:import('../shared/computerGames').VideoClipId,device:import('../shared/computer').ComputerDevice,furnitureId?:number):boolean {
    return this.sendAuthenticated({type:'computer_video',clip,device,...(furnitureId===undefined?{}:{furnitureId})});
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
    return this.send(message);
  }

  stop(): void {
    this.stopped = true;
    this.suspended = false;
    this.credential = null;
    this.role = null;
    this.closeSocket();
  }

  // BFCache retains the JS heap, so preserve credentials in memory only.
  suspend(): void {
    if(this.stopped || !this.role) return;
    this.suspended = true;
    const wasReady=this.authorized;
    this.closeSocket();
    if(wasReady){this.callbacks.onDisconnect();this.callbacks.onStatus('Связь потеряна. Повторяем подключение…');}
  }

  wake(): void {
    if(this.stopped || !this.role || !this.credential) return;
    this.suspended=false;
    if(this.authorized && performance.now()-this.lastPacketAt>=20000){this.recoverSilentSocket();return;}
    if(this.socket && (this.socket.readyState===WebSocket.OPEN || this.socket.readyState===WebSocket.CONNECTING)) return;
    this.closeSocket();
    this.retryCount=0;
    this.open();
  }

  private closeSocket(): void {
    window.clearTimeout(this.retryTimer);
    window.clearTimeout(this.connectTimer);
    window.clearTimeout(this.silenceTimer);
    this.authorized = false;
    const socket=this.socket;
    this.socket=null;
    if(socket){
      socket.onclose=null;socket.onmessage=null;socket.onopen=null;socket.onerror=null;
      socket.close();
    }
  }

  // Server clock packets arrive every two seconds, even during a game pause.
  // Detect a half-open connection that the browser still reports as OPEN.
  private armSilenceWatchdog():void {
    this.lastPacketAt=performance.now();
    window.clearTimeout(this.silenceTimer);
    const socket=this.socket;
    this.silenceTimer=window.setTimeout(()=>{
      if(this.socket===socket&&this.authorized)this.recoverSilentSocket();
    },20000);
  }
  private recoverSilentSocket():void {
    if(!this.authorized||this.stopped||this.suspended)return;
    this.closeSocket();
    this.callbacks.onDisconnect();
    this.callbacks.onStatus('Связь потеряна. Повторяем подключение…');
    this.retryCount=0;this.scheduleRetry();
  }

  private send(value: ClientPacket): boolean {
    const socket=this.socket;
    if(!socket||socket.readyState!==WebSocket.OPEN)return false;
    try{
      if(socket.bufferedAmount>512*1024)throw new Error('Pending send buffer');
      socket.send(JSON.stringify(value));return true;
    }catch{
      // Do not replay a possibly accepted purchase or action after reconnect.
      const wasReady=this.authorized;
      this.closeSocket();
      if(wasReady)this.callbacks.onDisconnect();
      this.callbacks.onError('Команда не отправлена. Восстанавливаем соединение.');
      this.scheduleRetry();
      return false;
    }
  }

  private open(): void {
    if (!this.role || !this.credential || this.stopped || this.suspended || this.socket) return;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = protocol + '//' + location.host + '/sync';
    this.callbacks.onStatus('Подключаемся к общему дому…');
    let socket: WebSocket;
    try { socket = new WebSocket(url); }
    catch { this.scheduleRetry(); return; }
    this.socket = socket;
    this.connectTimer=window.setTimeout(()=>{
      if(this.socket!==socket || this.authorized)return;
      this.closeSocket();
      this.callbacks.onStatus('Связь потеряна. Повторяем подключение…');
      this.scheduleRetry();
    },12000);
    socket.onopen = () => {
      if (!this.role || !this.credential || this.socket !== socket) return;
      if ('token' in this.credential) this.send({ type: 'resume', role: this.role, token: this.credential.token });
      else this.send({ type: 'auth', role: this.role, ...this.credential });

    };
    socket.onmessage = (event: MessageEvent<string>) => {
      if(this.socket!==socket || this.stopped || this.suspended)return;
      let packet: ServerPacket;
      try { packet = JSON.parse(event.data) as ServerPacket; }
      catch { return; }
      if(!packet||typeof packet!=='object'||typeof packet.type!=='string')return;
      if(this.authorized)this.armSilenceWatchdog();
      if (packet.type === 'ready') {
        if(this.authorized||packet.role!==this.role)return;
        window.clearTimeout(this.connectTimer);
        this.authorized = true;
        this.armSilenceWatchdog();
        this.hasBeenReady = true;
        this.retryCount = 0;
        this.callbacks.onReady(packet.role, packet.state, packet.online);
        this.callbacks.onStatus('Синхронизация активна');
      } else if (packet.type === 'device_token' && this.authorized && packet.role === this.role) {
        this.credential = { token: packet.token };
        storeTrust({ role: packet.role, token: packet.token });
      } else if (packet.type === 'world_path' && this.authorized) {
        this.callbacks.onWorldPath(packet.role, packet.place, packet.path, packet.station);
      } else if(packet.type==='agility_feedback'&&this.authorized){this.callbacks.onAgilityFeedback?.(packet.taskId,packet.role,packet.quality);
      } else if (packet.type === 'world_event' && this.authorized) {
        this.callbacks.onWorldEvent(packet.role, packet.message);
      } else if (packet.type === 'delivery_arrived' && this.authorized) {
        this.callbacks.onDeliveryArrived();
      } else if (packet.type === 'ready_food_spoiled' && this.authorized) {
        this.callbacks.onReadyFoodSpoiled(packet.message);
      } else if(packet.type==='album_image'&&this.authorized){this.callbacks.onAlbumImage?.(packet.id,packet.jpeg);
      } else if(packet.type==='album_error'&&this.authorized){this.callbacks.onAlbumError?.(packet.reason,packet.id);
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
      } else if (packet.type === 'task_queue' && this.authorized) {
        this.callbacks.onTaskQueue(packet.role,packet.tasks);
      } else if (packet.type === 'task_active' && this.authorized) {
        this.callbacks.onTaskActive(packet.role,packet.taskId,packet.elapsedMs);
      } else if (packet.type === 'tv_food_done' && this.authorized) {
        this.callbacks.onTvFoodDone(packet.role,packet.taskId);
      } else if (packet.type === 'need_gain' && this.authorized) {
        this.callbacks.onNeedGain(packet.role,packet.label,packet.effects);
      } else if(packet.type==='table_state'&&this.authorized){this.callbacks.onTableState?.(packet.match);
      } else if(packet.type==='pool_state'&&this.authorized){this.callbacks.onPoolState?.(packet.match);
      } else if(packet.type==='hockey_state'&&this.authorized){this.callbacks.onHockeyState?.(packet.match);
      } else if(packet.type==='bowling_state'&&this.authorized){this.callbacks.onBowlingState?.(packet.match);
      } else if (packet.type === 'movie_offer' && this.authorized) {
        this.callbacks.onMovieOffer(packet.inviteId,packet.from,packet.genre,packet.food,packet.selection);
      } else if (packet.type === 'movie_offer_closed' && this.authorized) {
        this.callbacks.onMovieOfferClosed(packet.inviteId,packet.message);
      } else if (packet.type === 'home_leisure' && this.authorized) {
        this.callbacks.onHomeLeisure(packet.roles, packet.activity, packet.routes);
      } else if (packet.type === 'storage_event' && this.authorized) {
        this.callbacks.onStorageEvent(packet.role, packet.station);
      } else if (packet.type === 'task_ended' && this.authorized) {
        this.callbacks.onTaskEnded(packet.role, packet.taskId, packet.outcome, packet.message, packet.effects);
      } else if(packet.type==='conversation'&&this.authorized) {
        this.callbacks.onConversation?.(packet.from,packet.remainingMs,packet.title);
      } else if(packet.type==='social_pending'&&this.authorized) {
        this.callbacks.onSocialOffer(packet.offer);
      } else if(packet.type==='social_closed'&&this.authorized) {
        this.callbacks.onSocialClosed(packet.inviteId,packet.message,packet.reply);
      } else if (packet.type === 'social_start' && this.authorized) {
        this.callbacks.onSocialStart(packet.kind, packet.message);
      } else if (packet.type === 'error') {
        if(!this.authorized && this.hasBeenReady && packet.reason.includes('занят') && this.retryCount<5){
          this.closeSocket();this.scheduleRetry();return;
        }
        this.callbacks.onError(packet.reason);
        if (!this.authorized && (packet.reason.includes('код') || packet.reason.includes('занят'))) {
          if (packet.reason.includes('Доверие устройства истекло')) storeTrust(null);
          this.callbacks.onStatus('Не удалось войти: ' + packet.reason);
          this.stop();
        }
      }
    };
    socket.onclose = () => {
      if(this.socket!==socket)return;
      window.clearTimeout(this.connectTimer);
      window.clearTimeout(this.silenceTimer);
      this.socket=null;
      const wasReady=this.authorized;
      this.authorized = false;
      if(wasReady)this.callbacks.onDisconnect();
      if (!this.stopped && !this.suspended) {
        this.callbacks.onStatus('Связь потеряна. Повторное подключение…');
        this.scheduleRetry();
      }
    };
    socket.onerror = () => { /* onclose will handle connection failures */ };
  }

  private scheduleRetry(): void {
    if (this.stopped || this.suspended) return;
    const delay = Math.min(1500 * 2 ** Math.min(this.retryCount++, 4), 15000);
    window.clearTimeout(this.retryTimer);
    this.retryTimer = window.setTimeout(() => this.open(), delay);
  }
}
