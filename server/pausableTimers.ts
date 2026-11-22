/** Pauses elapsed wall-time and active gameplay timers without touching the event loop. */
export class PausableTimers {
  private pausedAt: number | null = null;
  private pausedTotal = 0;
  private slots = new Map<ReturnType<typeof setTimeout>, {
    original: ReturnType<typeof setTimeout>;
    current: ReturnType<typeof setTimeout> | null;
    deadline: number;
    remaining: number;
    run: () => void;
  }>();

  now(): number {
    const real = this.pausedAt ?? Date.now();
    return real - this.pausedTotal;
  }
  get paused(): boolean { return this.pausedAt !== null; }

  schedule(run: () => void, duration: number): ReturnType<typeof setTimeout> {
    const delay = Math.max(0, duration);
    const slot = {
      original: undefined as unknown as ReturnType<typeof setTimeout>,
      current: null as ReturnType<typeof setTimeout> | null,
      deadline: Date.now() + delay,
      remaining: delay,
      run,
    };
    const finish = () => { this.slots.delete(slot.original); slot.current = null; run(); };
    const handle = setTimeout(finish, delay);
    slot.original = handle;
    slot.current = handle;
    this.slots.set(handle, slot);
    if (this.paused) { clearTimeout(handle); slot.current = null; }
    return handle;
  }
  clear(handle: ReturnType<typeof setTimeout>): void {
    const slot = this.slots.get(handle);
    if (!slot) { clearTimeout(handle); return; }
    if (slot.current) clearTimeout(slot.current);
    this.slots.delete(handle);
  }
  pause(): void {
    if (this.paused) return;
    const now = Date.now();
    this.pausedAt = now;
    for (const slot of this.slots.values()) {
      slot.remaining = Math.max(0, slot.deadline - now);
      if (slot.current) clearTimeout(slot.current);
      slot.current = null;
    }
  }
  resume(): void {
    if (this.pausedAt === null) return;
    this.pausedTotal += Date.now() - this.pausedAt;
    this.pausedAt = null;
    for (const slot of this.slots.values()) {
      slot.deadline = Date.now() + slot.remaining;
      slot.current = setTimeout(() => {
        this.slots.delete(slot.original);
        slot.current = null;
        slot.run();
      }, slot.remaining);
    }
  }
  dispose(): void {
    for (const slot of this.slots.values()) if (slot.current) clearTimeout(slot.current);
    this.slots.clear();
  }
}
