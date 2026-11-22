import assert from 'node:assert/strict';
import test from 'node:test';
import { keyboardCoversViewport } from '../../src/mobileInput';
test('mobile search fields recognize a real virtual keyboard reduction',()=>{
  assert.equal(keyboardCoversViewport(true,true,410,844),true);
  assert.equal(keyboardCoversViewport(true,true,805,844),false);
  assert.equal(keyboardCoversViewport(false,true,410,844),false);
  assert.equal(keyboardCoversViewport(true,false,410,844),false);
});
test('viewport helper cannot activate on an invalid or zero layout',()=>{
  assert.equal(keyboardCoversViewport(true,true,0,0),false);
  assert.equal(keyboardCoversViewport(true,true,568,568),false);
});
