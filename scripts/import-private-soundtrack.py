"""Import the household's own audio files for local use only.
Run: python scripts/import-private-soundtrack.py SOURCE_DIR PRIVATE_CACHE
The cache and MP3 output are not tracked by Git.
Requires imageio-ffmpeg (or ffmpeg available on PATH)."""
import sys, pathlib, hashlib, json, shutil, subprocess, re, os
deps=pathlib.Path(r'D:\Sim-Life-AudioSources\pydeps')
if deps.exists():sys.path.insert(0,str(deps))
try:
 import imageio_ffmpeg
 ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
except ImportError:
 ffmpeg=shutil.which('ffmpeg')
if not ffmpeg:raise RuntimeError('ffmpeg is required')
src=pathlib.Path(sys.argv[1]);cache=pathlib.Path(sys.argv[2])
cache.mkdir(parents=True,exist_ok=True)
root=pathlib.Path(__file__).resolve().parents[1]
out=root/'public/audio/soundtrack'
out.mkdir(parents=True,exist_ok=True)
tracks=[
('edge-of-town','Edge of Town','Ian Stocker','e92f2bef8ca6eb4b1d35489cc73d6b1dd0cba69343302891fe294d21d6cfed17'),
('the-simple-life','The Simple Life','Jerry Martin','b115575747bde5ee3317767884ad67be1fe2e30b11477d9d7f98a951bb2633ef'),
('smooth','Smooth','Jerry Martin','be9368796ce36195a13ce7db1f12edb6e20e56ba84e5ed39b504574db9263f39'),
('track-four','Композиция 4','','dfe0532c15e54b14714e2c12db27455dc24525a07258a07c50ac3a5b195c21cf'),
('the-club','The Club','Jerry Martin','a395ccd9063341175618ef0291f126501ebe92e62a58b6ac41c3e6d9d992a626'),
('martinis-for-two','Martinis For Two','Jerry Martin','8624f18bcebf4c491860817d316fe5a4da73ec3d3d4b379548dc5c0d50f33ed1'),
('cocktails-anyone','Cocktails Anyone?','Jerry Martin','c13ea404837a355af0731e3cb53015a5e3020da6f2ef5b5b809fb4bcdd7a8032'),
('lounge-lizard','Lounge Lizard','Kirk Casey','f4b2c78ae1f34c10e3a99a9832e773cd6088c8ff8cc7061d4447ff4119fb8b2d')]
for i,(_,_,_,expected) in enumerate(tracks,1):
 p=src/f'{i}.mp3'
 with p.open('rb') as f:actual=hashlib.file_digest(f,'sha256').hexdigest()
 if actual!=expected:raise ValueError(f'Source {i} does not match uploaded file')
def inspect(file,levels=False):
 cmd=[ffmpeg,'-hide_banner','-nostdin','-nostats','-loglevel','info','-i',str(file),'-map','0:a:0','-vn','-sn','-dn']
 if levels:cmd+=['-af','volumedetect']
 cmd+=['-progress','pipe:1','-f','null','-']
 run=subprocess.run(cmd,capture_output=True,text=True,encoding='utf-8',errors='replace',check=True)
 times=re.findall(r'out_time_us=(\d+)',run.stdout)
 if not times:raise ValueError('No decoded audio '+str(file))
 duration=int(times[-1])/1e6
 if levels:
  mean=float(re.findall(r'mean_volume: (-?[0-9.]+) dB',run.stderr)[-1])
  peak=float(re.findall(r'max_volume: (-?[0-9.]+) dB',run.stderr)[-1])
  return duration,mean,peak
 return duration
catalog=[]
for i,(slug,title,artist,_) in enumerate(tracks,1):
 source=src/f'{i}.mp3';filename=slug+'.mp3';target=cache/filename
 duration,mean,peak=inspect(source,True)
 if not 240<duration<420:raise ValueError(f'Unexpected decoded source duration for {i}: {duration}')
 gain=min(-19-mean,-1.7-peak,6)
 tmp=target.with_suffix('.tmp.mp3')
 bitrate='96k' if i in (4,6,7,8) else '128k'
 filters=f'volume={gain:.2f}dB,afade=t=in:st=0:d=0.8,afade=t=out:st={duration-1.8:.3f}:d=1.8'
 subprocess.run([ffmpeg,'-hide_banner','-nostdin','-loglevel','error','-y','-i',str(source),'-map','0:a:0','-vn','-sn','-dn','-map_metadata','-1','-af',filters,'-c:a','libmp3lame','-b:a',bitrate,'-write_xing','1',str(tmp)],check=True)
 output_duration=inspect(tmp)
 if abs(output_duration-duration)>0.25:raise ValueError(f'Decoded duration changed for {i}: {duration} vs {output_duration}')
 tmp.replace(target);shutil.copy2(target,out/filename)
 catalog.append({'id':slug,'title':title,'artist':artist,'file':filename,'seconds':round(output_duration,2)})
 print(f'{i}: {slug}, {output_duration:.2f}s, {bitrate}, gain {gain:.1f}dB, {target.stat().st_size} bytes',flush=True)
wanted={t['file'] for t in catalog}
for p in out.glob('*.mp3'):
 if p.name not in wanted:p.unlink()
(out/'manifest.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(root/'src/game/Soundtrack.ts').write_text('// Private household soundtrack; audio files installed locally, not committed.\nexport const SOUNDTRACK = '+json.dumps(catalog,ensure_ascii=False,indent=2)+' as const;\n',encoding='utf-8')
(cache/'manifest.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('TOTAL',round(sum(t['seconds'] for t in catalog),2),'seconds',sum((cache/t['file']).stat().st_size for t in catalog),'bytes',flush=True)
