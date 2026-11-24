import test from 'node:test';
import assert from 'node:assert/strict';
import { graphicsProfile, isBlankGraphicsFrame, chooseGraphicsQuality, worldPixelRatio } from '../../src/game/GraphicsCompatibility';

test('Android Chrome defaults to sharper rendering while WebViews keep the emergency mode',()=>{
 const chrome='Mozilla/5.0 (Linux; Android 13; Redmi Note 11) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36';
 const p=graphicsProfile(chrome,'');
 assert.equal(p.safe,false);
 assert.equal(p.antialias,false);
 assert.equal(p.powerPreference,'default');
 assert.equal(p.maxPixelRatio,2.5);
 assert.equal(worldPixelRatio(true,3,1.25,true,'standard',p),2);
 assert.equal(worldPixelRatio(true,3,1.25,true,'low',p),1.5);
 assert.equal(worldPixelRatio(true,3,1.25,true,'high',p),2.5);
 const full=graphicsProfile(chrome,'?gfx=full');
 assert.equal(worldPixelRatio(true,3,1.25,true,'high',full),3);
 assert.equal(chooseGraphicsQuality(90,full),'high');
 const webview=graphicsProfile('Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 Mobile Safari/537.36','');
 assert.equal(webview.safe,true);
 assert.equal(webview.maxPixelRatio,1);
 assert.equal(graphicsProfile(chrome,'?gfx=safe').safe,true);
});
test('iPhone rendering is not silently degraded and safe mode remains opt-in',()=>{
  const ua='Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17 Safari/604.1';
  assert.equal(graphicsProfile(ua,'').safe,false);
  assert.equal(graphicsProfile(ua,'').antialias,true);
  assert.equal(graphicsProfile(ua,'?gfx=safe').safe,true);
});
test('Android Firefox preserves the iPhone context settings but renders at higher resolution',()=>{
  const iphone='Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17 Safari/604.1';
  const firefox='Mozilla/5.0 (Android 10; Mobile; rv:158.0) Gecko/158.0 Firefox/158.0';
  const original=graphicsProfile(iphone,'');
  for(const query of ['', '?gfx=full']){
    const current=graphicsProfile(firefox,query);
    assert.equal(current.android,true);
    assert.equal(current.firefox,true);
    assert.equal(current.safe,false);
    for(const key of ['safe','antialias','powerPreference'] as const)
      assert.equal(current[key],original[key],key+' should match iPhone');
  }
  assert.equal(graphicsProfile(firefox,'?gfx=safe').safe,true,
    'user-requested emergency safe mode must remain available');
});
test('gfx=full stays crisp even when mobile FPS governor sees slow frames',()=>{
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1';
  const firefox = 'Mozilla/5.0 (Android 10; Mobile; rv:158.0) Gecko/158.0 Firefox/158.0';
  for (const ua of [iphone, firefox]) {
    const full = graphicsProfile(ua, '?gfx=full');
    assert.equal(full.full, true);
    assert.equal(full.safe, false);
    assert.equal(full.antialias, true);
    for (const frameMs of [16, 25, 55, 120])
      assert.equal(chooseGraphicsQuality(frameMs, full), 'high');
    assert.equal(worldPixelRatio(true, 2.5, 1.25, true, 'high', full), full.android?2.5:1.5);
    assert.equal(worldPixelRatio(true, 1.3, 1.25, true, 'high', full), 1.3);
  }
  const normal = graphicsProfile(firefox, '');
  assert.equal(normal.full, false);
  assert.equal(chooseGraphicsQuality(30, normal), 'low');
  assert.equal(worldPixelRatio(true, 3, 1.25, true, 'low', normal), 1.5);
  assert.equal(worldPixelRatio(true, 3, 1.25, true, 'standard', normal), 2);
  const safe = graphicsProfile(firefox, '?gfx=safe');
  assert.equal(chooseGraphicsQuality(12, safe), 'low');
  assert.equal(worldPixelRatio(true, 3, 1.25, true, 'low', safe), .88);
});

test('detects silent white GPU frame without flagging a valid sky background',()=>{
  const rgba=[255,255,255,255];
  const gl={
    RGBA:6408,UNSIGNED_BYTE:5121,isContextLost:()=>false,
    readPixels:(_x:number,_y:number,_w:number,_h:number,_format:number,_type:number,pixel:Uint8Array)=>{
      pixel.set(rgba);
    },
  } as unknown as WebGLRenderingContext;
  assert.equal(isBlankGraphicsFrame(gl,400,840),true);
  rgba.splice(0,4,192,199,173,255);
  assert.equal(isBlankGraphicsFrame(gl,400,840),false);
  assert.equal(isBlankGraphicsFrame({...gl,isContextLost:()=>true} as WebGLRenderingContext,400,840),true);
});
