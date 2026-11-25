/**
 * Mobile scene gesture arbitration. All distances are CSS pixels, not device
 * pixels, so high-DPR Android/iOS screens use the same forgiving tap target.
 *
 * No delayed taps: the first touch is instant. A subsequent rapid touch at
 * the SAME point is ignored to avoid duplicate actions / accidental walks.
 * Controls keep owning deliberate pans and two-finger gestures.
 */
export type PointerContact = {
  id: number;
  x: number;
  y: number;
  type: 'touch' | 'pen' | 'mouse';
  primary: boolean;
  button: number;
  time: number;
};

export const MOBILE_TAP_SLOP = 14;
export const MOUSE_TAP_SLOP = 8;
export const REPEAT_TAP_MS = 290;
export const REPEAT_TAP_RADIUS = 30;
export const TOUCH_TAP_MAX_MS = 550;

export class CanvasGestureGate {
  private readonly touches = new Map<number, { x: number; y: number }>();
  private tap: PointerContact | null = null;
  private inMultiTouch = false;
  private lastTouchTap: { x: number; y: number; time: number } | null = null;

  private slop(type: PointerContact['type']): number {
    return type === 'touch' ? MOBILE_TAP_SLOP : MOUSE_TAP_SLOP;
  }

  get touchCount(): number { return this.touches.size; }

  down(pointer: PointerContact): void {
    if (pointer.type === 'touch') {
      this.touches.set(pointer.id, { x: pointer.x, y: pointer.y });
      if (this.touches.size > 1) {
        this.inMultiTouch = true;
        this.tap = null;
      }
    }
    if (!this.inMultiTouch && pointer.primary && pointer.button === 0 &&
        (pointer.type !== 'touch' || this.touches.size === 1)) {
      this.tap = pointer;
    } else if (pointer.type === 'touch') {
      this.tap = null;
    }
  }

  move(pointer: PointerContact): { holdTap: boolean; twistRadians: number } {
    const current = this.touches.get(pointer.id);
    let twistRadians = 0;
    if (current && this.touches.size === 2) {
      const other = [...this.touches.entries()].find(([id]) => id !== pointer.id)?.[1];
      if (other) {
        const ax = current.x - other.x, ay = current.y - other.y;
        const bx = pointer.x - other.x, by = pointer.y - other.y;
        const minSpan2 = 16 * 16;
        if (ax * ax + ay * ay >= minSpan2 && bx * bx + by * by >= minSpan2)
          twistRadians = Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
      }
      this.inMultiTouch = true;
      this.tap = null;
    }
    if (current) {
      current.x = pointer.x;
      current.y = pointer.y;
    }
    if (!this.tap || this.tap.id !== pointer.id) return { holdTap: false, twistRadians };
    const distance = Math.hypot(pointer.x - this.tap.x, pointer.y - this.tap.y);
    if (distance >= this.slop(pointer.type)) {
      this.tap = null;
      return { holdTap: false, twistRadians };
    }
    return { holdTap: pointer.type === 'touch', twistRadians };
  }

  up(pointer: PointerContact): boolean {
    const candidate = this.tap;
    const duration = candidate ? pointer.time - candidate.time : Infinity;
    const isTap = !this.inMultiTouch && candidate?.id === pointer.id &&
      (pointer.type !== 'touch' || (duration >= 0 && duration <= TOUCH_TAP_MAX_MS)) &&
      Math.hypot(pointer.x - candidate.x, pointer.y - candidate.y) < this.slop(pointer.type);
    this.clear(pointer.id);
    if (!isTap) return false;
    if (pointer.type === 'touch') {
      const previous = this.lastTouchTap;
      this.lastTouchTap = { x: pointer.x, y: pointer.y, time: pointer.time };
      if (previous && pointer.time >= previous.time &&
          pointer.time - previous.time <= REPEAT_TAP_MS &&
          Math.hypot(pointer.x - previous.x, pointer.y - previous.y) <= REPEAT_TAP_RADIUS) {
        return false;
      }
    }
    return true;
  }

  /** Browser interruption may swallow pointerup entirely. */
  reset(): void {
    this.touches.clear();
    this.tap = null;
    this.inMultiTouch = false;
    this.lastTouchTap = null;
  }

  cancel(pointerId: number): void {
    this.clear(pointerId);
  }

  private clear(pointerId: number): void {
    this.touches.delete(pointerId);
    if (this.tap?.id === pointerId) this.tap = null;
    if (this.touches.size === 0) this.inMultiTouch = false;
  }
}
