/** Browser-frame cadence diagnostic. This is not a GPU time or device FPS API. */
export interface FrameSample {
  fps: number;
  p95Ms: number;
  frames: number;
  drawCalls: number;
  triangles: number;
}

export class FrameMeter {
  private previous: number | null = null;
  private started: number | null = null;
  private intervals: number[] = [];

  reset(): void {
    this.previous = null;
    this.started = null;
    this.intervals.length = 0;
  }

  record(nowMs: number, drawCalls: number, triangles: number): FrameSample | null {
    if (!Number.isFinite(nowMs)) return null;
    if (this.previous === null) {
      this.previous = nowMs;
      this.started = nowMs;
      return null;
    }
    const interval = nowMs - this.previous;
    this.previous = nowMs;
    // A suspended browser tab should not count as a multi-second dropped frame.
    if (!(interval > 0) || interval > 1000) {
      this.reset();
      this.previous = nowMs;
      this.started = nowMs;
      return null;
    }
    this.intervals.push(interval);
    const elapsed = nowMs - (this.started ?? nowMs);
    if (elapsed < 1800) return null;
    const sorted = [...this.intervals].sort((a, b) => a - b);
    const p95 = sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
    const result = {
      fps: Math.round(this.intervals.length * 10000 / elapsed) / 10,
      p95Ms: Math.round(p95 * 10) / 10,
      frames: this.intervals.length,
      drawCalls,
      triangles,
    };
    this.intervals.length = 0;
    this.started = nowMs;
    return result;
  }
}

export function createPerformanceProbe(host: HTMLElement) {
  const meter = new FrameMeter();
  const panel = document.createElement('aside');
  panel.className = 'performance-probe';
  panel.setAttribute('aria-label', 'Диагностика кадров Sim-Life');
  const heading = document.createElement('strong');
  heading.textContent = 'Sim-Life · Тест FPS';
  const frame = document.createElement('div');
  frame.textContent = 'Сбор кадров…';
  const gpu = document.createElement('div');
  const ready = document.createElement('div');
  ready.textContent = 'Загрузка моделей…';
  const caveat = document.createElement('small');
  caveat.textContent = 'DPR экрана '+window.devicePixelRatio+' · кадры браузера';
  panel.append(heading, frame, gpu, ready, caveat);
  host.append(panel);

  return {
    onFrame(now: number, calls: number, triangles: number): void {
      if (document.hidden) { meter.reset(); return; }
      const sample = meter.record(now, calls, triangles);
      if (!sample) return;
      frame.textContent = `FPS ${sample.fps.toFixed(1)} · p95 ${sample.p95Ms.toFixed(1)} мс`;
      gpu.textContent = `${sample.drawCalls} draw · ${sample.triangles.toLocaleString('ru-RU')} трис · ${host.querySelector('canvas')?.width ?? '—'}×${host.querySelector('canvas')?.height ?? '—'}`;
    },
    ready(readyMs: number, assetsMs: number, mode: string): void {
      ready.textContent = `Сцена ${(readyMs / 1000).toFixed(2)} с · модели ${Math.round(assetsMs)} мс · ${mode}`;
    },
  };
}
