/** Do not replace active mobile DOM targets during a press or inertial scroll.
 * Explicit app navigation bypasses this gate; server state is never delayed. */
export const PHONE_SCROLL_QUIET_MS=160;
export class PhoneRefreshGate {
 private pointers=new Set<number>();
 private lastScroll=-Infinity;
 down(id:number){this.pointers.add(id);}
 up(id:number){this.pointers.delete(id);}
 scroll(now:number){this.lastScroll=now;}
 wait(now:number):number{
  if(this.pointers.size)return Infinity;
  return Math.max(0,PHONE_SCROLL_QUIET_MS-(now-this.lastScroll));
 }
 reset(){this.pointers.clear();this.lastScroll=-Infinity;}
}
