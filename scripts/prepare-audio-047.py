import sys, pathlib, json
sys.path.insert(0,r'D:\Sim-Life-AudioSources\pydeps')
import numpy as np
import soundfile as sf
root=pathlib.Path(r'D:\Sim-Life-AudioSources')
dest=pathlib.Path(r'D:\Sim-Life-047-Audio\public\audio\v2')
dest.mkdir(parents=True,exist_ok=True)
bank={}
RATE=24000
def load(path):
 x,sr=sf.read(path,dtype='float32',always_2d=True)
 x=x.mean(axis=1)
 if sr!=RATE:
  x=np.interp(np.arange(round(len(x)*RATE/sr))*sr/RATE,np.arange(len(x)),x).astype(np.float32)
 return x
def finish(x,loop=False,target=.105):
 x=np.array(x,dtype=np.float32);x-=np.mean(x)
 if loop:
  n=min(int(.20*RATE),len(x)//4)
  if n>1:
   u=np.linspace(0,1,n);x[:n]=x[-n:]*(1-u)+x[:n]*u;x=x[:-n]
 else:
  n=min(int(.035*RATE),len(x)//3)
  if n>1:x[:n]*=np.linspace(0,1,n);x[-n:]*=np.linspace(1,0,n)
 rms=np.sqrt(np.mean(x*x));x*=min(target/max(rms,.001),.86/max(np.max(np.abs(x)),.001),9)
 return x
def save(name,x,loop=False,target=.105):
 i=len(bank.get(name,[]));filename=f'{name}-{i}.wav'
 sf.write(dest/filename,finish(x,loop,target),RATE,subtype='PCM_16')
 bank.setdefault(name,[]).append(filename)
def clip(path,name,sec,start=0,loop=False,target=.105):
 try:
  x=load(path)
  if len(x)<1000:return
  a=min(int(start*RATE),max(0,len(x)-int(sec*RATE)))
  save(name,x[a:a+int(sec*RATE)],loop,target)
 except Exception as e:print(name,str(e))
pack=root/'100-CC0-SFX_0';v2=root/'sfx_100_v2'
for name,files,secs in [('door',['door_open','door_close_01','door_close_02'],1.2),('dish',['dishes_01','dishes_02','dishes_03','pot_01'],1.2),('paper',['paper_01','paper_02','paper_03'],.85),('flush',['toilet_01','toilet_02'],5),('hit',['hit_01','hit_02'],.5),('spring',['spring_01','spring_03'],.7),('ring',['bell_01','bell_02'],1.1)]:
 for f in files:clip(pack/(f+'.ogg'),name,secs)
for name,files,secs,loop in [('water',['loop_water_01','loop_water_02'],7,True),('street',['loop_highway'],12,True),('room',['loop_ambient_01'],10,True),('wind',['air_01','air_02'],3,True),('thunder',['thunder_01'],5,False),('vacuum',['loop_machine_01'],7,True)]:
 for f in files:clip(v2/('sfx100v2_'+f+'.ogg'),name,secs,0,loop,.065 if name in ['room','wind','street'] else .10)
for p in sorted((root/'MoreSounds').rglob('Cloth_*.wav'))[:4]:clip(p,'cloth',1)
for p in sorted((root/'MoreSounds').rglob('Drink_*.wav'))[:3]:clip(p,'drink',1.8)
for name,seconds,start,loop in [('cook',7,2,True),('shower',7,5,True),('keyboard',1.3,1,False),('purr',7,4,True),('bird',14,3,True),('cricket',12,3,True),('rain',12,3,True),('fire',7,3,True)]:
 clip(root/(name+'.mp3'),name,seconds,start,loop,.075 if name in ['bird','cricket','rain','purr','fire'] else .11)
for name,seconds,start,loop in [('clipper',2.4,.15,True),('eat',.5,0,False),('toothbrush',2.0,2,True),('cafe',14,3,True),('vacuum',6,5,True),('crowd',10,1,True),('engine',4,.3,False)]:
 clip(root/(name+'.mp3'),name,seconds,start,loop,.095)
clip(root/'meowAlt.mp3','meow',1.25,0,False,.12)
for name in ['voiceVlad','voiceAlina','laughVlad','laughAlina']:
 try:
  x=load(root/(name+'.mp3')); window=int((1.6 if name.startswith('voice') else 1.15)*RATE)
  # Pick separated audible excerpts, skip leading/trailing silence.
  candidates=[]
  for a in range(0,max(1,len(x)-window+1),int(.24*RATE)):
   seg=x[a:a+window];r=float(np.sqrt(np.mean(seg*seg)))
   candidates.append((r,a))
  chosen=[]
  for r,a in sorted(candidates,reverse=True):
   if r<.006 or any(abs(a-b)<window*.92 for b in chosen):continue
   chosen.append(a);save(name,x[a:a+window],False,.105)
   if len(chosen)>=5:break
  if not chosen and len(x)>1000:save(name,x[:window],False,.105)
 except Exception as e:print(name,e)
for name in ['meow','bark']:
 path=dest.parent/(name+'.mp3')
 try:
  x=load(path);sec=1.45 if name=='meow' else .65
  save(name,x[:int(RATE*sec)],False,.12)
 except Exception as e:print(name,e)
# Original, gently voiced UI chimes and short cues. Never copy commercial audio.
def chime(name,notes,duration):
 t=np.arange(int(RATE*duration))/RATE; x=np.zeros_like(t)
 for n,(f,start) in enumerate(notes):
  a=t-start;env=np.where(a>=0,np.minimum(np.maximum(a,0)/.012,1)*np.exp(-np.maximum(a,0)*7),0)
  x+=env*(np.sin(2*np.pi*f*a)+.24*np.sin(2*np.pi*f*2.002*a)+.08*np.sin(2*np.pi*f*3.01*a))*.15
 save(name,x,False,.055)
chime('click',[(740,0)],.085);chime('confirm',[(523.25,0),(659.25,.075),(783.99,.15)],.52);chime('error',[(392,0),(329.63,.085)],.32)
# Original music: longer legato chords, soft piano-like decays and quiet bass.
def music(name,roots,melody,beat=.75):
 duration=beat*32; t=np.arange(int(RATE*duration))/RATE;x=np.zeros_like(t)
 def note(m,start,length,amp,decay):
  nonlocal x
  a=t-start;g=(a>=0)&(a<length);v=a[g];f=440*2**((m-69)/12)
  e=np.minimum(v/.018,1)*np.minimum((length-v)/.13,1)*np.exp(-v*decay)
  x[g]+=amp*e*(np.sin(2*np.pi*f*v)+.26*np.sin(2*np.pi*f*2.002*v)+.09*np.sin(2*np.pi*f*3.008*v))
 for bar,r in enumerate(roots):
  st=bar*4*beat
  note(r-12,st,4*beat,.11,.45)
  for j,m in enumerate([r+12,r+19,r+24]):note(m,st+j*.055,4*beat-j*.055,.045,.5)
 for j,m in enumerate(melody):
  if m:note(m,j*beat,min(beat*1.5,duration-j*beat),.105,.95)
 save(name,x,True,.085)
music('scoreMorning',[48,55,45,53,48,55,53,55],[72,76,79,0,74,77,79,74,69,72,76,0,69,72,77,72,72,76,79,84,83,79,77,0,77,76,72,69,74,77,79,0])
music('scoreEvening',[45,53,48,55,45,53,48,52],[69,0,76,72,69,72,77,0,67,72,76,74,67,71,74,0,69,72,76,81,77,0,72,69,67,72,76,72,68,71,76,0],.9)
music('scorePark',[55,50,52,48,55,50,48,50],[74,79,83,0,74,78,81,78,76,79,83,0,72,76,79,76,74,79,81,83,81,78,76,0,72,76,79,84,79,74,78,0],.68)
music('scoreDance',[48,45,53,55,48,45,53,55],[72,76,79,76,69,72,76,72,77,81,84,81,74,79,83,79,72,79,76,79,69,76,72,76,77,84,81,84,74,83,79,83],.5)
# Separate short programme loops assembled from the real voice samples, original score and Foley.
rng=np.random.default_rng(47)
def media(name,score,pace,impact=False):
 n=RATE*12;x=np.zeros(n,dtype=np.float32);bed=load(dest/(bank[score][0]));x+=np.resize(bed,n)*.30
 for k,start in enumerate(np.arange(.3,11.0,pace)):
  voice=['voiceVlad','voiceAlina'][k%2]
  if voice not in bank:continue
  y=load(dest/bank[voice][k%len(bank[voice])]);a=int(start*RATE);y=y[:n-a];x[a:a+len(y)]+=y*.55
  if name=='mediaFight' and 'crowd' in bank:
   y=load(dest/bank['crowd'][0]);a=int(start*RATE);y=y[:min(n-a,int(2.4*RATE))];x[a:a+len(y)]+=y*.19
  if name=='mediaRace' and 'engine' in bank:
   y=load(dest/bank['engine'][0]);a=int(start*RATE);y=y[:n-a];x[a:a+len(y)]+=y*.48
  if impact and k%3==0:
   y=load(dest/bank['hit'][k%len(bank['hit'])]);a=int((start+.32)*RATE);y=y[:n-a];x[a:a+len(y)]+=y*.32
 save(name,x,True,.085)
for name,score,pace,impact in [('mediaTalk','scoreMorning',2.4,False),('mediaCozy','scoreMorning',3.3,False),('mediaDrama','scoreEvening',3.0,False),('mediaSuspense','scoreEvening',4.2,True),('mediaAction','scoreDance',2.8,True),('mediaComedy','scorePark',2.0,False),('mediaTech','scoreMorning',3.0,False),('mediaFight','scoreDance',2.7,True),('mediaRace','scoreDance',4.0,True)]:media(name,score,pace,impact)
ts=dest.parents[2]/'src'/'game'/'AudioBank.ts'
ts.write_text('// Local, curated mono PCM; generated by scripts/prepare-audio-047.py.\nexport const AUDIO_BANK = '+json.dumps(bank,indent=2)+' as const;\n',encoding='utf-8')
print(json.dumps({k:len(v) for k,v in bank.items()}));print('files',sum(map(len,bank.values())),'bytes',sum(p.stat().st_size for p in dest.glob('*.wav')))
