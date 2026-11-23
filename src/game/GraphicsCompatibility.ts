/** Keep rendering on mobile GPUs whose memory budget is tighter than iPhone.
 * gfx=full permits comparing the original path; gfx=safe forces fallback.
 * No game state, network protocol or household data changes. */
export function graphicsProfile(userAgent: string, query: string) {
  const mode = new URLSearchParams(query).get('gfx');
  const android = /Android/i.test(userAgent);
  const safe = mode === 'safe' || (android && mode !== 'full');
  return {
    android,
    safe,
    antialias: !safe,
    powerPreference: (safe ? 'default' : 'low-power') as 'default' | 'low-power',
    maxPixelRatio: safe ? 1 : 1.5,
  };
}

/** Never leave a dead WebGL canvas looking like an empty playable world. */
export function showGraphicsProblem(canvas: HTMLCanvasElement, reason: string): void {
  const parent = canvas.parentElement;
  if (!parent || parent.querySelector('#graphics-recovery')) return;
  const panel = document.createElement('section');
  panel.id = 'graphics-recovery';
  panel.setAttribute('role', 'alert');
  panel.style.cssText =
    'position:absolute;top:34%;left:50%;transform:translateX(-50%);z-index:150;' +
    'max-width:340px;width:calc(100% - 40px);background:#fffdf1;' +
    'color:#304335;border:1px solid #bbc8ad;border-radius:15px;' +
    'box-shadow:0 10px 32px #1d392c40;padding:16px;pointer-events:auto;' +
    'font:700 13px/1.45 system-ui,sans-serif;text-align:center';
  const title = document.createElement('strong');
  title.textContent = 'Не удалось показать 3D-мир';
  title.style.cssText = 'display:block;font-size:16px;margin-bottom:8px';
  const detail = document.createElement('p');
  detail.textContent = reason + ' Сохранения в безопасности. Попробуй открыть игру в обычном Google Chrome.';
  detail.style.cssText = 'margin:0 0 12px';
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.textContent = 'Перезапустить 3D';
  retry.style.cssText = 'padding:10px 15px;border-radius:11px;border:0;' +
    'background:#5c8267;color:white;font:700 13px system-ui;touch-action:manipulation';
  retry.addEventListener('click', () => {
    const url = new URL(window.location.href);
    url.searchParams.set('gfx', 'safe');
    url.searchParams.set('retry', Date.now().toString(36));
    window.location.assign(url.toString());
  });
  panel.append(title, detail, retry);
  parent.append(panel);
}

export function clearGraphicsProblem(canvas: HTMLCanvasElement): void {
  canvas.parentElement?.querySelector('#graphics-recovery')?.remove();
}

/** A single small readback, only after rendering, detects a silent white frame.
 * Never poll readPixels every animation frame on a budget Android GPU. */
export function isBlankGraphicsFrame(gl: WebGL2RenderingContext, width: number, height: number): boolean {
  if (gl.isContextLost() || width < 32 || height < 32) return true;
  const pixel = new Uint8Array(4);
  const positions: readonly [number, number][] = [[.24,.28],[.50,.46],[.76,.68]];
  let blank = 0;
  for (const [x,y] of positions) {
    gl.readPixels(Math.floor(width*x), Math.floor(height*y), 1, 1,
      gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    if (pixel[3] === 0 || (pixel[0] > 243 && pixel[1] > 243 && pixel[2] > 243))
      blank++;
  }
  return blank === positions.length;
}
