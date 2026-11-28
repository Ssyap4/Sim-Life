import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';

const manifest=JSON.parse(readFileSync('dist/.vite/manifest.json','utf8'));
function measure(roots){
 const seen=new Set(),files=new Set();
 function visit(key){
  if(seen.has(key))return;
  seen.add(key);
  const entry=manifest[key];assert.ok(entry,'Missing manifest entry '+key);
  files.add(entry.file);
  for(const dep of entry.imports??[])visit(dep);
 }
 roots.forEach(visit);
 let raw=0,gzip=0;
 for(const f of files){const data=readFileSync('dist/'+f);raw+=data.length;gzip+=gzipSync(data,{level:9}).length;}
 return {files:[...files],raw,gzip};
}
const ui=measure(['src/main.ts']),full=measure(['src/main.ts','src/game/World.ts','src/game/BlenderCharacter.ts','src/game/SimbaRig.ts']);
console.log('STARTUP_BUNDLE '+JSON.stringify({ui,full}));
assert.ok(ui.gzip<=400000,'Initial interface dependency graph exceeded 400 kB gzip');
assert.ok(full.gzip<=850000,'Full game startup JS exceeded 850 kB gzip');
assert.ok(!ui.files.some(f=>/\/(?:ArtKit|BufferGeometryUtils|Wardrobe|GLTFLoader|FurnitureModels|World)-/.test(f)),'3D dependency leaked into initial interface');
