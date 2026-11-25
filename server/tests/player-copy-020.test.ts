import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const content=(path:string)=>readFileSync(resolve(root,path),'utf8');
test('user-facing home copy never mentions old development releases or private filesystem',()=>{
  const text=content('src/main.ts');
  assert.doesNotMatch(text,/0\.16|ВИЗУАЛЬНЫЙ ПРЕДПРОСМОТР|Тестовая версия:|Код из server-data|Коды созданы на компьютере/);
  assert.match(text,/СИМУЛЯТОР ЖИЗНИ/);
  assert.match(text,/<h1>SIM LIFE<\/h1>/);
  assert.match(text,/Выбери героя, чтобы вернуться домой/);
});
test('phone and thought lessons explain current autonomy rather than old version numbers',()=>{
  for(const filename of ['src/phoneUI.ts','src/shared/thoughtHelp.ts'])
    assert.doesNotMatch(content(filename),/(?:как в|поведение) 0\.\d+/);
});
test('package and lockfile versions mark the current 0.47 release',()=>{
  assert.equal(JSON.parse(content('package.json')).version,'0.47.0');
  assert.equal(JSON.parse(content('package-lock.json')).version,'0.47.0');
});
