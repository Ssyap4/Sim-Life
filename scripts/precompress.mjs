import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
// Only generated JS/CSS and binary 3D models; never compress or copy private media.
for(const name of readdirSync('dist/assets')){
  if(!/\.(js|css|glb)$/.test(name))continue;
  const file=join('dist/assets',name),raw=readFileSync(file),gzip=gzipSync(raw,{level:6});
  if(gzip.length<raw.length){writeFileSync(file+'.gz',gzip);console.log(name+': '+raw.length+' -> '+gzip.length+' bytes');}
}
