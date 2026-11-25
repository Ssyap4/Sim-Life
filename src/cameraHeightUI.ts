/** One pointer owns the hold; releasing or losing visibility stops immediately. */
export function bindCameraHeightButtons(adjust:(direction:1|-1,seconds:number)=>void):void {
  let active:{button:HTMLButtonElement;pointer:number;direction:1|-1}|null=null;
  let frame=0,last=0;
  const stop=()=>{
    if(!active)return;
    const {button,pointer}=active;active=null;
    cancelAnimationFrame(frame);frame=0;
    button.classList.remove('height-held');
    if(button.hasPointerCapture(pointer))button.releasePointerCapture(pointer);
  };
  const tick=(now:number)=>{
    if(!active)return;
    if(document.hidden||getComputedStyle(active.button).visibility==='hidden'||!active.button.getClientRects().length){stop();return;}
    adjust(active.direction,(now-last)/1000);last=now;
    frame=requestAnimationFrame(tick);
  };
  for(const direction of [1,-1] as const){
    const button=document.querySelector<HTMLButtonElement>(direction===1?'#camera-height-up':'#camera-height-down')!;
    button.addEventListener('pointerdown',event=>{
      if(event.button!==0||active)return;
      event.preventDefault();event.stopPropagation();
      active={button,pointer:event.pointerId,direction};
      button.setPointerCapture(event.pointerId);button.classList.add('height-held');
      adjust(direction,.085);last=performance.now();frame=requestAnimationFrame(tick);
    });
    for(const type of ['pointerup','pointercancel','lostpointercapture'] as const)
      button.addEventListener(type,event=>{if(active?.pointer===event.pointerId){event.stopPropagation();stop();}});
    button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();if(event.detail===0)adjust(direction,.12);});
    button.addEventListener('contextmenu',event=>event.preventDefault());
  }
  window.addEventListener('blur',stop);
  window.addEventListener('pagehide',stop);
  document.addEventListener('visibilitychange',stop);
}
