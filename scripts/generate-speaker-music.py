"""Original procedural instrumental arrangements. No samples or external music."""
import math, random, wave, array
from pathlib import Path
RATE=16000
SECONDS=32
OUT=Path(__file__).resolve().parents[1]/'public'/'audio'/'speakers'
OUT.mkdir(parents=True,exist_ok=True)
GENRES={
 'lofi':(76,'keys',[0,5,2,7],.72),
 'pop':(108,'pluck',[0,7,9,5],1),
 'house':(124,'synth',[0,8,3,10],1),
 'hiphop':(88,'keys',[0,3,8,7],1),
 'rock':(116,'guitar',[0,5,7,3],1),
 'chill':(82,'pad',[0,7,5,9],.45),
 'romantic':(70,'keys',[0,9,5,7],.22),
 'piano':(66,'piano',[0,5,9,7],0),
}
def generate(genre,idx):
 bpm,style,roots,drums=GENRES[genre]
 rng=random.Random(531+list(GENRES).index(genre)*37+idx*131)
 beat=60/(bpm+idx*4)
 n=RATE*SECONDS; data=[0.0]*n; cache={}
 root=48+idx*2
 minor=genre in ('house','hiphop','rock')
 scale=[0,2,3 if minor else 4,5,7,8 if minor else 9,10 if minor else 11]
 def note(at,midi,length,amp,kind):
  start=int(at*RATE); count=min(n-start,int(length*RATE))
  if count<=0:return
  key=(midi,round(length,3),kind)
  buf=cache.get(key)
  if buf is None:
   f=440*2**((midi-69)/12); w=2*math.pi*f/RATE
   harmonics={'bass':(1,.18,.06),'piano':(1,.38,.12,.06),'keys':(1,.18,.15),'pluck':(1,.23,.14),'synth':(1,.31,.2,.1),'guitar':(1,.55,.25,.18),'pad':(1,.15,.07)}[kind]
   attack=.12 if kind=='pad' else .008
   decay=2.7 if kind in ('piano','keys','pluck','guitar') else .65
   buf=[]
   for i in range(int(length*RATE)):
    t=i/RATE; env=min(1,t/attack,max(0,(length-t)/.10))*math.exp(-decay*t/max(.25,length))
    phase=w*i
    v=sum(h*math.sin(phase*(k+1)) for k,h in enumerate(harmonics))
    if kind=='guitar':v=math.tanh(v*1.6)
    if kind=='pad':v=.65*v+.35*math.sin(phase*1.003)
    buf.append(v*env)
   cache[key]=buf
  for i in range(min(count,len(buf))):data[start+i]+=buf[i]*amp
 def percussion(at,kind,amp):
  start=int(at*RATE); duration={'kick':.24,'snare':.17,'hat':.07}[kind]; count=min(n-start,int(duration*RATE))
  for i in range(max(0,count)):
   t=i/RATE; white=rng.uniform(-1,1)
   if kind=='kick':v=math.sin(2*math.pi*(48*t+5*(1-math.exp(-t*30))))*math.exp(-t*16)
   elif kind=='snare':v=(.7*white+.3*math.sin(2*math.pi*185*t))*math.exp(-t*24)
   else:v=white*math.exp(-t*55)
   data[start+i]+=v*amp
 pattern=[rng.randrange(len(scale)) for _ in range(16)]
 for bar in range(math.ceil(SECONDS/(beat*4))):
  at=bar*4*beat; r=root+roots[(bar+idx)%4]
  third=3 if minor or (roots[(bar+idx)%4] in (2,9)) else 4
  chord=[r,r+third,r+7,r+12]
  for j,m in enumerate(chord):
   if genre in ('piano','romantic','lofi'):
    note(at+j*beat*.5,m+12,beat*2.3,.075,style)
    note(at+(j+4)*beat*.5,m+12,beat*1.7,.05,style)
   else:note(at,m+12,beat*3.8,.04,'pad' if genre=='chill' else style)
  for k in range(4):
   t=at+k*beat
   if genre!='piano':note(t,r-12+(7 if k==3 else 0),beat*.84,.115 if drums else .045,'bass')
   if drums:
    if genre=='house' or k in (0,2):percussion(t,'kick',.24*drums)
    if k in (1,3):percussion(t,'snare',.12*drums)
    for off in (0,.5):percussion(t+off*beat,'hat',.045*drums)
   if (k+bar+idx)%5!=4:
    pitch=root+24+scale[pattern[(bar*4+k)%16]]
    note(t+(beat*.25 if genre in ('lofi','hiphop') and k%2 else 0),pitch,beat*(1.4 if genre in ('piano','romantic','chill') else .70),.13,style)
   if genre in ('rock','pop','house') and k%2==1:
    note(t+beat*.5,r+19,beat*.45,.045,style)
 peak=max(.1,max(abs(v) for v in data));gain=min(1,.82/peak)
 pcm=array.array('h',(int(max(-1,min(1,v*gain))*32767*min(1,i/(RATE*.2),(n-i)/(RATE*.35))) for i,v in enumerate(data)))
 path=OUT/f'speaker-track-{genre}-{idx}.wav'
 with wave.open(str(path),'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(RATE);f.writeframes(pcm.tobytes())
 print(path.name,flush=True)
if __name__=='__main__':
 for genre in GENRES:
  for idx in range(2):generate(genre,idx)
