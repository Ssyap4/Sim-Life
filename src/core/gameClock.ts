import { CLOCK_SYNC_MS, GAME_MINUTES_PER_REAL_SECOND, type ClockSample } from '../shared/life';

/** Estimate only the displayed clock between server samples. Transactions use the saved clock. */
export class GameClockDisplay {
  private minutes = 0;
  private receipt = 0;
  private speed = 0;
  private correction = 0;
  private sampled = false;

  reset(minutes: number, now: number): void {
    this.minutes = minutes;
    this.receipt = now;
    this.speed = this.correction = 0;
    this.sampled = false;
  }

  sync(sample: ClockSample, now: number): void {
    const displayed = this.read(now);
    const difference = sample.minutes - displayed;
    const continuous = sample.multiplier>0 && this.speed>0 && this.sampled && now - this.receipt <= 3 * CLOCK_SYNC_MS && Math.abs(difference) < 2;
    this.minutes = continuous ? displayed : sample.minutes;
    this.receipt = now;
    this.speed = sample.multiplier * GAME_MINUTES_PER_REAL_SECOND / 1000;
    this.correction = continuous ? difference : 0;
    this.sampled = true;
  }

  read(now: number): number {
    const elapsed = Math.min(3 * CLOCK_SYNC_MS, Math.max(0, now - this.receipt));
    const time = Math.max(CLOCK_SYNC_MS, Math.abs(this.correction) / (this.speed || 1));
    return this.minutes + elapsed * this.speed + this.correction * Math.min(elapsed / time, 1);
  }

  pause(now: number): void { this.reset(this.read(now), now); }
}
