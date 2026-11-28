import {clockAt,gameDate,gameMinutes,GAME_DAYS_PER_MONTH,type GameClock} from './life';
export type WeatherKind='clear'|'overcast'|'fog'|'rain'|'snow'|'storm';
export const WEATHER_INFO:Record<WeatherKind,{name:string;icon:string}>={
 clear:{name:'Ясно',icon:'☀️'},overcast:{name:'Облачно',icon:'☁️'},fog:{name:'Туман',icon:'🌫️'},
 rain:{name:'Дождь',icon:'🌧️'},snow:{name:'Снег',icon:'🌨️'},storm:{name:'Гроза',icon:'⛈️'},
};
const BASE=[-7,-6,0,8,15,19,22,20,13,6,-1,-5];
const hash=(n:number)=>{let x=Math.imul(n|0,0x45d9f3b);x=Math.imul(x^(x>>>16),0x45d9f3b);return ((x^(x>>>16))>>>0)/4294967296;};
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const smooth=(v:number)=>v*v*(3-2*v);
function temperatureAt(clock:GameClock){
 const date=gameDate(clock.day),i=date.month-1;
 const monthly=lerp(BASE[i],BASE[(i+1)%12],(date.day-1+clock.minute/1440)/GAME_DAYS_PER_MONTH);
 const m=gameMinutes(clock),day=Math.floor(m/1440),t=(m%1440)/1440;
 const anomaly=lerp((hash(day+527)-.5)*10,(hash(day+528)-.5)*10,smooth(t));
 return monthly+anomaly+5*Math.cos((clock.minute-900)*Math.PI/720);
}
const FRONT_MINUTES=360;
function frontAt(clock:GameClock):WeatherKind{
 const index=Math.floor(gameMinutes(clock)/FRONT_MINUTES),frontClock=clockAt(index*FRONT_MINUTES+180);
 const t=temperatureAt(frontClock),r=hash(index+827),cloud=(hash(Math.floor(index/3)+611)+r)/2;
 if(cloud>.66)return t<=1?'snow':t>=15&&r>.87?'storm':'rain';
 if(cloud>.51)return 'overcast';
 if(r<.12&&cloud>.24&&(frontClock.minute<540||frontClock.minute>=1080))return 'fog';
 return 'clear';
}
export function weatherAt(clock:GameClock){
 const minute=Math.max(0,gameMinutes(clock)),day=gameDate(clock.day),kind=frontAt(clock);
 const temp=Math.round(temperatureAt(clock)),season=day.month>=3&&day.month<=5?'spring':day.month>=6&&day.month<=8?'summer':day.month>=9&&day.month<=11?'autumn':'winter';
 // Cover survives a clear period; thaw is driven by the recent temperature,
 // not by whether a snow particle is currently visible.
 let snow=season==='winter'?1:0;
 for(let i=12;season!=='winter'&&i>=0;i--){
  const c=clockAt(Math.max(0,minute-i*360)),t=temperatureAt(c);
  snow=Math.max(0,Math.min(1,snow+(frontAt(c)==='snow'?.26:0)-(t>1?Math.min(.34,t*.035):0)));
 }

 const wind=kind==='storm'?12:kind==='rain'?5:kind==='snow'?4:kind==='fog'?1:2+Math.floor(hash(Math.floor(minute/360)+41)*4);
 return {kind,temp,season,snow:Math.round(snow*10)/10,wind,nextChangeAt:(Math.floor(minute/FRONT_MINUTES)+1)*FRONT_MINUTES};
}
export function weatherTemperature(t:number){return (t>0?'+':'')+t+'°';}