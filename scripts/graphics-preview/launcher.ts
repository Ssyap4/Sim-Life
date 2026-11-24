import { networkInterfaces } from 'node:os';
import { resolve } from 'node:path';
import { startServer } from '../../server/server';

const port=3178;
startServer({
  port, host:'0.0.0.0', testNoCodes:true, previewStartMoney:100_000, starterPetFurniture:true,
  distDir:resolve('dist'),dataDir:resolve('graphics-test-data'),
}).then(()=>{
  console.log('Sim-Life — графический эксперимент 0.37');
  console.log('На этом компьютере: http://127.0.0.1:'+port+'/');
  console.log('Для телефона в той же домашней сети:');
  for(const group of Object.values(networkInterfaces())){
    for(const address of group??[])if(address.family==='IPv4'&&!address.internal)
      console.log('  http://'+address.address+':'+port+'/');
  }
  console.log('Погода: добавьте к адресу ?weather=rain, snow, fog, overcast или storm.');
  console.log('Оставьте окно открытым во время игры. Для остановки нажмите Ctrl+C.');
}).catch(error=>{console.error(error.message);process.exitCode=1;});
