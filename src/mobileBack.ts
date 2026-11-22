/** A single ephemeral browser-history entry while game overlays are visible.
 * Android hardware Back and iOS browser Back dismiss game UI first.
 * When no UI is open the normal browser navigation remains untouched.
 */
export interface MobileBackOptions {
  root: HTMLElement;
  isOpen(): boolean;
  closeTop(): void;
}
export function installMobileBack(options: MobileBackOptions): () => void {
  const {root,isOpen,closeTop}=options;
  const flag='simLifeOverlayBackV1';
  let armed=false;
  let draining=false;
  let disposed=false;
  let scheduled=false;
  let syncing=false;
  const inGame=()=>document.querySelector<HTMLElement>('#auth')?.hidden===true;
  const sync=()=>{
    scheduled=false;
    if(disposed||syncing||draining)return;
    syncing=true;
    try {
      if(inGame()&&isOpen()&&!armed) {
        history.pushState({[flag]:true},'',location.href);
        armed=true;
      } else if ((!isOpen()||!inGame())&&armed) {
        // Remove our own history entry after dismissing a menu manually.
        draining=true;
        history.back();
      }
    } finally {syncing=false;}
  };
  const schedule=()=>{
    if(scheduled)return;
    scheduled=true;queueMicrotask(sync);
  };
  const onPop=()=>{
    if(disposed)return;
    if(draining){
      draining=false;armed=false;schedule();return;
    }
    if(!armed)return;
    armed=false;
    if(inGame()&&isOpen())closeTop();
    schedule();
  };
  const observer=new MutationObserver(entries=>{
    if(entries.some(entry=>entry.attributeName==='hidden'||
      entry.attributeName==='aria-expanded'))schedule();
  });
  observer.observe(root,{subtree:true,attributes:true,attributeFilter:['hidden','aria-expanded']});
  window.addEventListener('popstate',onPop);
  schedule();
  return ()=>{
    disposed=true;observer.disconnect();
    window.removeEventListener('popstate',onPop);
  };
}
