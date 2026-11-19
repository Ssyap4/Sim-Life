import type { ActionId, CharacterId, ClientPacket, GameState, ServerPacket, SocialKind, TimedCommand } from '../shared/protocol';
import type { IngredientId, RecipeId, TakeoutId } from '../shared/food';
import type { BasketLine } from '../shared/market';
import type { JobId } from '../shared/jobs';
import type { PetId, PetAction } from '../shared/pets';

export interface ConnectionCallbacks {
  onReady(role: CharacterId, state: GameState, online: CharacterId[]): void;
  onSnapshot(state: GameState): void;
  onOnline(online: CharacterId[]): void;
  onAction(role: CharacterId, actionId: ActionId, message: string): void;
  onFoodEvent(role: CharacterId, action: 'buy' | 'cook' | 'eat', message: string): void;
  onStoreEvent(role: CharacterId, message: string): void;
  onJobEvent(role: CharacterId, outcome:'started'|'finished'|'cancelled', message:string):void;
  onPetEvent(role: CharacterId, pet: PetId, action: PetAction, message: string): void;
  onTaskStarted(role: CharacterId, taskId: number, label: string, durationMs: number, command: TimedCommand): void;
  onTaskEnded(role: CharacterId, taskId: number, outcome: 'completed' | 'cancelled' | 'failed', message: string): void;
  onSocialStart(kind: SocialKind, message: string): void;
  onError(message: string): void;
  onStatus(status: string): void;
}

export class LiveConnection {
  private socket: WebSocket | null = null;
  private role: CharacterId | null = null;
  private code = '';
  private retryCount = 0;
  private retryTimer: number | undefined;
  private stopped = false;
  private authorized = false;

  constructor(private readonly callbacks: ConnectionCallbacks) {}

  login(role: CharacterId, code: string): void {
    if (!code) return;
    this.stop();
    this.stopped = false;
    this.role = role;
    this.code = code.trim();
    this.retryCount = 0;
    this.open();
  }

  perform(actionId: ActionId): boolean {
    if (!this.authorized || this.socket?.readyState !== WebSocket.OPEN) {
      this.callbacks.onError('Нет соединения с сервером');
      return false;
    }
    this.send({ type: 'act', actionId });
    return true;
  }

  food(type: 'buy' | 'cook' | 'eat', id: IngredientId | RecipeId): boolean {
    if (type === 'buy') return this.sendAuthenticated({ type, item: id as IngredientId });
    return this.sendAuthenticated({ type, recipe: id as RecipeId });
  }

  startJob(job:JobId):boolean {return this.sendAuthenticated({type:'job_start',job});}
  cancelJob():boolean {return this.sendAuthenticated({type:'job_cancel'});}

  checkout(lines: BasketLine[]): boolean {
    return this.sendAuthenticated({type:'checkout',lines});
  }

  eatTakeout(item: TakeoutId): boolean {
    return this.sendAuthenticated({type:'eat_takeout',item});
  }

  cancelTask(taskId: number): boolean {
    return this.sendAuthenticated({ type: 'cancel_task', taskId });
  }

  petAction(pet: PetId, action: PetAction): boolean {
    return this.sendAuthenticated({ type: 'pet_action', pet, action });
  }

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
    window.clearTimeout(this.retryTimer);
    this.authorized = false;
    if (this.socket) {
      this.socket.onclose = null;
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
      if (this.role) this.send({ type: 'auth', role: this.role, code: this.code });
    };
    socket.onmessage = (event: MessageEvent<string>) => {
      let packet: ServerPacket;
      try { packet = JSON.parse(event.data) as ServerPacket; }
      catch { return; }
      if (packet.type === 'ready') {
        this.authorized = true;
        this.retryCount = 0;
        this.callbacks.onReady(packet.role, packet.state, packet.online);
        this.callbacks.onStatus('Мы дома — синхронизация активна');
      } else if (packet.type === 'snapshot' && this.authorized) {
        this.callbacks.onSnapshot(packet.state);
      } else if (packet.type === 'online' && this.authorized) {
        this.callbacks.onOnline(packet.online);
      } else if (packet.type === 'action' && this.authorized) {
        this.callbacks.onAction(packet.role, packet.actionId, packet.message);
      } else if (packet.type === 'food_event' && this.authorized) {
        this.callbacks.onFoodEvent(packet.role, packet.action, packet.message);
      } else if (packet.type === 'store_event' && this.authorized) {
        this.callbacks.onStoreEvent(packet.role, packet.message);
      } else if (packet.type === 'job_event' && this.authorized) {
        this.callbacks.onJobEvent(packet.role,packet.outcome,packet.message);
      } else if (packet.type === 'pet_event' && this.authorized) {
        this.callbacks.onPetEvent(packet.role, packet.pet, packet.action, packet.message);
      } else if (packet.type === 'task_started' && this.authorized) {
        this.callbacks.onTaskStarted(packet.role, packet.taskId, packet.label, packet.durationMs, packet.command);
      } else if (packet.type === 'task_ended' && this.authorized) {
        this.callbacks.onTaskEnded(packet.role, packet.taskId, packet.outcome, packet.message);
      } else if (packet.type === 'social_start' && this.authorized) {
        this.callbacks.onSocialStart(packet.kind, packet.message);
      } else if (packet.type === 'error') {
        this.callbacks.onError(packet.reason);
        if (!this.authorized && (packet.reason.includes('код') || packet.reason.includes('занят'))) {
          this.callbacks.onStatus('Не удалось войти: ' + packet.reason);
          this.stop();
        }
      }
    };
    socket.onclose = () => {
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
