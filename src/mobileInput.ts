/** Native-app-like touch behavior without blocking real form editing. */
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
}
