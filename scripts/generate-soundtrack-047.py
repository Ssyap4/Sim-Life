"""Original mellow life-simulator soundtrack, rendered offline; no external samples.
Requires numpy and soundfile (libsndfile with MPEG support)."""
import math, pathlib, sys, json
deps=pathlib.Path(r'D:\Sim-Life-AudioSources\pydeps')
if deps.exists():sys.path.insert(0,str(deps))
import numpy as np
import soundfile as sf
RATE=24000
OUT=pathlib.Path(__file__).resolve().parents[1]/'public/audio/soundtrack'
OUT.mkdir(parents=True,exist_ok=True)
# Each arrangement has a separate harmonic progression, tempo, motif and timbre.
tracks=[
 ('quiet-morning','Тихое утро',72,0,'piano',[(0,4,7,11),(9,12,16,19),(5,9,12,16),(7,11,14,21),(4,7,11,14),(9,12,16,19),(2,5,9,12),(7,11,14,17)],[7,4,2,4,9,7,4,2]),
 ('window-light','Свет из окна',66,5,'felt',[(0,4,7,11),(4,7,11,14),(9,12,16,19),(5,9,12,16),(2,5,9,12),(7,11,14,17),(0,4,7,14),(5,9,12,16)],[4,7,9,7,2,4,0,2]),
 ('slow-sunday','Неспешное воскресенье',70,2,'rhodes',[(0,4,7,14),(5,9,12,16),(9,12,16,19),(7,11,14,17),(4,7,11,14),(5,9,12,16),(2,5,9,12),(7,11,14,21)],[9,7,4,2,4,7,2,0]),
 ('garden-path','Садовая тропинка',76,7,'nylon',[(0,4,7,11),(2,5,9,12),(4,7,11,14),(5,9,12,16),(9,12,16,19),(5,9,12,16),(2,5,9,12),(7,11,14,21)],[4,2,7,9,7,4,2,4]),
 ('warm-tea','Тёплый чай',64,-3,'felt',[(0,4,7,11),(5,9,12,16),(4,7,11,14),(9,12,16,19),(2,5,9,12),(5,9,12,16),(7,11,14,17),(0,4,7,14)],[7,9,4,2,0,4,2,0]),
 ('ordinary-miracle','Маленькие радости',74,0,'rhodes',[(0,4,7,14),(4,7,11,14),(5,9,12,16),(7,11,14,17),(9,12,16,19),(2,5,9,12),(5,9,12,16),(7,11,14,21)],[2,4,7,4,9,7,2,4]),
 ('blue-hour','Синий час',62,2,'piano',[(9,12,16,19),(5,9,12,16),(0,4,7,11),(7,11,14,17),(4,7,11,14),(5,9,12,16),(2,5,9,12),(7,11,14,21)],[4,7,9,7,4,2,0,2]),
 ('home-again','Снова дома',68,5,'nylon',[(0,4,7,11),(9,12,16,19),(5,9,12,16),(2,5,9,12),(4,7,11,14),(5,9,12,16),(7,11,14,21),(0,4,7,14)],[7,4,2,0,2,4,7,4]),
]
catalog=[]
for idx,(slug,title,bpm,key,timbre,chords,motif) in enumerate(tracks):
 rng=np.random.default_rng(4700+idx)
 beat=60/bpm
 bars=64 # eight eight-bar phrases, 202–248 seconds each
 total=bars*4*beat+7
 n=int(total*RATE)
 mix=np.zeros((n,2),dtype=np.float32)
 cache={}
 def voice(midi,duration,kind):
  # Cache pitches/durations; smooth, softly detuned partials with natural decays.
  k=(midi,round(duration,2),kind)
  if k in cache:return cache[k]
  t=np.arange(int(duration*RATE),dtype=np.float32)/RATE
  f=440*2**((midi-69)/12)
  if kind=='pad':
   env=np.minimum(t/.75,1)*np.minimum(np.maximum(0,duration-t)/1.2,1)
   y=(np.sin(2*np.pi*f*t)+.32*np.sin(2*np.pi*f*1.003*t+.6)+.14*np.sin(2*np.pi*f*2*t))*env*.62
   y*=.91+.09*np.sin(t*.8)
  elif kind=='bass':
   env=np.minimum(t/.055,1)*np.exp(-t*.63)*np.minimum(np.maximum(0,duration-t)/.3,1)
   y=(np.sin(2*np.pi*f*t)+.15*np.sin(2*np.pi*f*2*t))*env
  else:
   weights={'piano':[1,.46,.24,.13,.055,.026],'felt':[1,.31,.11,.041,.016],'rhodes':[1,.26,.085,.025],'nylon':[1,.52,.18,.085,.035]}[kind]
   y=np.zeros_like(t)
   for h,w in enumerate(weights,1):
    freq=f*h*math.sqrt(1+.00022*h*h)
    decay=(.72 if kind=='felt' else .58 if kind=='rhodes' else .94 if kind=='nylon' else .65)+.31*(h-1)
    y+=w*np.sin(2*np.pi*freq*t+(.12*h))*np.exp(-t*decay)
    if kind in ('piano','felt'):y+=.17*w*np.sin(2*np.pi*freq*1.0018*t+.44)*np.exp(-t*decay)
   attack=.029 if kind=='felt' else .016 if kind=='rhodes' else .012
   env=np.minimum(t/attack,1)**1.25*np.minimum(np.maximum(0,duration-t)/.18,1)
   y*=env*.65
  cache[k]=y.astype(np.float32)
  return cache[k]
 def put(midi,start,duration,amp,kind,pan=0):
  a=max(0,int(start*RATE));y=voice(midi,duration,kind)[:n-a]
  if not len(y):return
  mix[a:a+len(y),0]+=y*amp*math.sqrt((1-pan)/2)
  mix[a:a+len(y),1]+=y*amp*math.sqrt((1+pan)/2)
 for bar in range(bars):
  phrase=bar//8; pos=bar%8; chord=chords[pos]; start=bar*4*beat+.7
  # The eight phrases alternate fuller / sparse / melody-free sections.
  density=[.66,.86,.92,.50,.82,.96,.68,.44][phrase]
  root=48+key+chord[0]
  put(root-12,start,4*beat+.9,.075*density,'bass',-.12)
  if phrase not in (0,7):
   for j,interval in enumerate(chord[1:]):
    put(48+key+interval,start+.08,4*beat+.5,.020*density,'pad',[-.42,0,.42][j])
  voicing=[48+key+chord[0],48+key+chord[2],48+key+chord[1],48+key+chord[3]]
  pattern=([0,2,1,3],[0,1.5,2.5],[0,2],[0,1,2.5,3.5])[(phrase+idx)%4]
  for j,at in enumerate(pattern):
   midi=voicing[(j+bar%2)%len(voicing)]
   put(midi,start+at*beat+float(rng.uniform(-.015,.022)),3.1,.063*density*float(rng.uniform(.8,1.10)),timbre,-.20+.13*j)
  # A deliberately sparse motif, varied by phrase, with rests and chord-tone endings.
  if phrase not in (3,7) or pos%2==0:
   notes=[motif[(pos+phrase//2)%8],motif[(pos+1+phrase//2)%8]]
   if pos in (3,7):notes[-1]=chord[2]%12
   for j,m in enumerate(notes):
    if (pos+phrase+j)%5==0:continue
    midi=60+key+m
    if midi>79:midi-=12
    put(midi,start+(.65 if j==0 else 2.45)*beat,3.6,.095*density*float(rng.uniform(.83,1.08)),timbre,.20 if j==0 else .30)
  if phrase in (2,5) and pos in (1,5):
   put(60+key+chord[1]%12,start+3.45*beat,2.3,.037,timbre,.35)
 # Short cross-channel reflections, no hard percussion, no sharp transient peaks.
 dry=mix.copy()
 for seconds,level in [(0.071,.095),(.139,.063),(.227,.045),(.36,.028)]:
  delay=int(seconds*RATE);mix[delay:]+=dry[:-delay,::-1]*level
 del dry
 fade_in=int(3.2*RATE);fade_out=int(6*RATE)
 mix[:fade_in]*=np.linspace(0,1,fade_in,dtype=np.float32)[:,None]
 mix[-fade_out:]*=np.linspace(1,0,fade_out,dtype=np.float32)[:,None]
 rms=float(np.sqrt(np.mean(mix*mix)));peak=float(np.max(np.abs(mix)))
 mix*=min(.078/max(rms,.001),.68/max(peak,.001))
 filename=slug+'.mp3'
 sf.write(OUT/filename,mix,RATE,format='MP3',subtype='MPEG_LAYER_III',compression_level=.55)
 info=sf.info(OUT/filename)
 catalog.append({'id':slug,'title':title,'file':filename,'seconds':round(info.duration,2)})
 print(slug,round(info.duration,1), (OUT/filename).stat().st_size,flush=True)
 del mix,cache
(OUT/'manifest.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2),encoding='utf-8')
ts=OUT.parents[2]/'src/game/Soundtrack.ts'
ts.write_text('// Original compositions; generated by scripts/generate-soundtrack-047.py.\nexport const SOUNDTRACK = '+json.dumps(catalog,ensure_ascii=False,indent=2)+' as const;\n',encoding='utf-8')
print('TOTAL',round(sum(t['seconds'] for t in catalog)/60,2),'minutes',flush=True)
