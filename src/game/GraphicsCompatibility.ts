/** Android Chrome keeps a compatible context without forcing a low-resolution
 * framebuffer. Explicit safe mode is reserved for actual GPU failures. */
export function graphicsProfile(userAgent: string, query: string) {
  const mode = new URLSearchParams(query).get('gfx');
  const android = /Android/i.test(userAgent);
  const firefox = android && /(?:Firefox|Fenix)\//i.test(userAgent);
  const chromium = android && !firefox;
  const webview = chromium && (!/Chrome\//i.test(userAgent)||/; wv\b|Version\/4\.0/i.test(userAgent));
  const safe = mode === 'safe' || (webview && mode !== 'full');
  const full = mode === 'full';
  return {
    android, firefox, safe, full,
    antialias: !safe,
    powerPreference: (safe ? 'default' : 'low-power') as 'default' | 'low-power',
    maxPixelRatio: safe ? 1 : android ? (full ? 3 : 2.5) : 1.5,
  };
}

export type GraphicsQuality = 'standard' | 'high' | 'low';

export function chooseGraphicsQuality(frameMs: number, profile: {safe: boolean; full: boolean}): GraphicsQuality {
  if (profile.safe) return 'low';
  if (profile.full) return 'high';
  return frameMs > 24 ? 'low' : frameMs < 17.8 ? 'high' : 'standard';
}

export function worldPixelRatio(
  compact: boolean, devicePixelRatio: number, initialRatio: number,
  home: boolean, quality: GraphicsQuality, profile: {full: boolean; maxPixelRatio: number; android?:boolean; safe?:boolean},
): number {
  const deviceRatio = devicePixelRatio || 1;
  if (profile.full && !profile.safe) return Math.min(deviceRatio, profile.maxPixelRatio);
  if(profile.android && !profile.safe){
    const requested=quality==='low'?1.5:quality==='standard'?2:2.5;
    return Math.min(deviceRatio,requested,profile.maxPixelRatio);
  }
  const requested = compact
    ? Math.min(deviceRatio, quality === 'low' ? (home ? .88 : 1)
      : home ? (quality === 'high' ? 1.26 : 1.11)
        : quality === 'high' ? 1.45 : initialRatio)
    : initialRatio;
  return Math.min(requested, profile.maxPixelRatio);
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
  const diagnose = document.createElement('a');
  diagnose.href = '/gpu-check.html';
  diagnose.textContent = 'Проверить WebGL 1 / 2';
  diagnose.style.cssText = 'display:inline-block;margin:10px 0 0;color:#305b40;' +
    'font:700 13px system-ui;text-decoration:underline;touch-action:manipulation';
  panel.append(title, detail, retry, diagnose);
  parent.append(panel);
}

export function clearGraphicsProblem(canvas: HTMLCanvasElement): void {
  canvas.parentElement?.querySelector('#graphics-recovery')?.remove();
}

/** A single small readback, only after rendering, detects a silent white frame.
 * Never poll readPixels every animation frame on a budget Android GPU. */
export function isBlankGraphicsFrame(gl: WebGLRenderingContext, width: number, height: number): boolean {
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
