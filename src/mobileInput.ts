/** Native-app-like touch behavior without blocking real form editing. */
export function keyboardCoversViewport(mobile:boolean,editing:boolean,
  visualHeight:number,layoutHeight:number):boolean {
  return mobile&&editing&&layoutHeight>0&&visualHeight<layoutHeight*.82;
}
const editable = (target: EventTarget | null): boolean =>
  target instanceof Element &&
  Boolean(target.closest('input,textarea,select,[contenteditable="true"],[data-allow-selection]'));

export function installMobileInput(root: HTMLElement): void {
  // iOS/Safari can still dispatch selection and contextmenu during gestures
  // even when the scene canvas itself uses touch-action:none.
  root.addEventListener('selectstart', event => {
    if (!editable(event.target)) event.preventDefault();
  });
  root.addEventListener('dragstart', event => {
    if (!editable(event.target)) event.preventDefault();
  });
  root.addEventListener('dblclick', event => {
    if (!editable(event.target)) event.preventDefault();
  });
  root.addEventListener('contextmenu', event => {
    if (window.matchMedia('(any-pointer: coarse)').matches &&
        !editable(event.target)) event.preventDefault();
  });

// Keep the focused search field and its results visible above the on-screen
// keyboard on iPhone 11 / Android; no screen-notch-specific UI is required.
const visualViewport=window.visualViewport;
let keyboardScrollFrame=0;
function syncKeyboard():void {
  const focused=document.activeElement;
  const editing=focused instanceof HTMLInputElement ||
    focused instanceof HTMLTextAreaElement || focused instanceof HTMLSelectElement;
  const mobile=window.matchMedia('(any-pointer: coarse)').matches;
  const height=visualViewport?.height ?? window.innerHeight;
  const top=visualViewport?.offsetTop ?? 0;
  const reduced=keyboardCoversViewport(mobile,editing,height,window.innerHeight);
  root.classList.toggle('mobile-keyboard-open',reduced);
  root.style.setProperty('--mobile-keyboard-height',Math.round(height)+'px');
  root.style.setProperty('--mobile-keyboard-top',Math.round(top)+'px');
  window.cancelAnimationFrame(keyboardScrollFrame);
  if(reduced && focused instanceof HTMLElement)
    keyboardScrollFrame=window.requestAnimationFrame(()=>
      focused.scrollIntoView({block:'nearest',inline:'nearest'}));
}
root.addEventListener('focusin',syncKeyboard);
root.addEventListener('focusout',()=>requestAnimationFrame(syncKeyboard));
visualViewport?.addEventListener('resize',syncKeyboard);
visualViewport?.addEventListener('scroll',syncKeyboard);

}
