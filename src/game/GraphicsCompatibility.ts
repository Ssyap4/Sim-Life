/** Per-browser graphics budget. Android Chrome can lose its context even at
 * reduced resolution; Firefox/Gecko is a separate GPU implementation and must
 * NOT be punished with the old blurry 0.88x/antialias-off fallback by default.
 *
 * gfx=safe: minimal fallback for devices with a weak renderer
 * gfx=balanced: crisp Firefox-like profile, with adaptive quality
 * gfx=quality: higher starting resolution, still throttles if FPS is poor
 * gfx=full: original iPhone-like renderer for comparison; not automatically used
 */
export function graphicsProfile(userAgent: string, query: string) {
  const mode = new URLSearchParams(query).get('gfx');
  const android = /Android/i.test(userAgent);
  const firefox = android && /(?:Firefox|Fenix)\//i.test(userAgent);
  const safeFallback = mode === 'safe' || (android && !firefox &&
    mode !== 'full' && mode !== 'balanced' && mode !== 'quality');
  const balanced = mode === 'balanced' || (firefox && mode !== 'safe' && mode !== 'full' && mode !== 'quality');
  const quality = mode === 'quality';
  const safe = safeFallback || balanced || quality;
  const enhancedAndroid = android && (balanced || quality);
  return {
    android,
    firefox,
    safe,
    enhancedAndroid,
    antialias: !safeFallback,
    powerPreference: (safe ? 'default' : 'low-power') as 'default' | 'low-power',
    maxPixelRatio: safeFallback ? 1 : quality ? 1.5 : balanced ? 1.4 : 1.5,
    initialQuality: (safeFallback ? 'low' : quality ? 'high' : 'standard') as 'low' | 'standard' | 'high',
  };
}

/** Match the effective 3D resolution to the actual mobile browser while the
 * existing FPS feedback loop can still step down on slow hardware. */
export function enhancedAndroidPixelRatio(quality: 'low' | 'standard' | 'high',
  devicePixelRatio: number, maxPixelRatio: number): number {
  const budget = quality === 'low' ? 1.0 : quality === 'standard' ? 1.25 : 1.5;
  return Math.min(devicePixelRatio || 1, budget, maxPixelRatio);
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
