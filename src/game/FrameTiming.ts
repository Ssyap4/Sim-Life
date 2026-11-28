/** Render time is cosmetic: server clocks remain authoritative. */
export function frameTiming(elapsedMs: number, paused: boolean, hidden: boolean) {
  const interrupted = hidden || !Number.isFinite(elapsedMs) || elapsedMs < 0 || elapsedMs > 1000;
  const frameMs = Math.max(1, elapsedMs);
  return {
    dt: interrupted || paused ? 0 : Math.min(frameMs / 1000, .20),
    qualitySample: interrupted || paused ? null : Math.min(frameMs, 150),
  };
}

/** Authoritative task choreography must advance independently of capped render dt. */
export type ActiveVisualClock={elapsed:number;last:number};
export function advanceActiveVisualClock(clock:ActiveVisualClock, now:number, paused:boolean):number {
  if(!Number.isFinite(now)||now<clock.last)return clock.elapsed;
  if(!paused)clock.elapsed+=(now-clock.last)/1000;
  clock.last=now;
  return clock.elapsed;
}
