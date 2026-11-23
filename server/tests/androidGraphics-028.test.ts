import test from 'node:test';
import assert from 'node:assert/strict';
import { graphicsProfile, isBlankGraphicsFrame } from '../../src/game/GraphicsCompatibility';

test('Android Chrome and in-app WebViews select low-memory WebGL by default',()=>{
  for(const ua of [
    'Mozilla/5.0 (Linux; Android 13; Redmi Note 11) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 Mobile Safari/537.36',
  ]){
    const p=graphicsProfile(ua,'');
    assert.equal(p.android,true);
    assert.equal(p.safe,true);
    assert.equal(p.antialias,false);
    assert.equal(p.powerPreference,'default');
    assert.equal(p.maxPixelRatio,1);
    assert.equal(graphicsProfile(ua,'?gfx=full').safe,false);
  }
});
test('iPhone rendering is not silently degraded and safe mode remains opt-in',()=>{
  const ua='Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17 Safari/604.1';
  assert.equal(graphicsProfile(ua,'').safe,false);
  assert.equal(graphicsProfile(ua,'').antialias,true);
  assert.equal(graphicsProfile(ua,'?gfx=safe').safe,true);
});
test('Android Firefox uses exactly the same WebGL graphics profile as iPhone',()=>{
  const iphone='Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17 Safari/604.1';
  const firefox='Mozilla/5.0 (Android 10; Mobile; rv:158.0) Gecko/158.0 Firefox/158.0';
  const original=graphicsProfile(iphone,'');
  for(const query of ['', '?gfx=full']){
    const current=graphicsProfile(firefox,query);
    assert.equal(current.android,true);
    assert.equal(current.firefox,true);
    assert.equal(current.safe,false);
    for(const key of ['safe','antialias','powerPreference','maxPixelRatio'] as const)
      assert.equal(current[key],original[key],key+' should match iPhone');
  }
  assert.equal(graphicsProfile(firefox,'?gfx=safe').safe,true,
    'user-requested emergency safe mode must remain available');
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
