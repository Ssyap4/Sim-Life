import { copyFileSync,existsSync,mkdirSync,readFileSync,writeFileSync,renameSync } from 'node:fs';
import { resolve,join } from 'node:path';
import {initialState} from '../src/shared/protocol';
import {isValidFurnishing} from '../src/shared/furniture';
import {grantStarterPetFurniture} from './starterPets';
// Explicit one-time deployment operation; never on ordinary restarts.
const [mode,path]=process.argv.slice(2);
if(!path||!['preview','production'].includes(mode))throw Error('Usage: reset-release.ts preview|production DATA_DIR');
const dir=resolve(path),file=join(dir,'household.json');
if(mode==='preview'&&/[/\\]Sim-Life[/\\]server-data$/i.test(dir))throw Error('Refusing preview reset on production');
mkdirSync(dir,{recursive:true});
const fresh=initialState();
if(existsSync(file)){
 const prior=JSON.parse(readFileSync(file,'utf8'));
 if(mode==='preview'){
  fresh.money=100000;
  if(isValidFurnishing(prior.furnishing)){
   const f=prior.furnishing;
   fresh.furnishing={nextId:f.nextId,placed:structuredClone(f.placed),orders:[],stored:[],soldFixtures:[...(f.soldFixtures??[])],...(f.starterPetsGranted?{starterPetsGranted:true as const}:{})};
  }
 }
 const backups=join(dir,'release-backups');mkdirSync(backups,{recursive:true});
 copyFileSync(file,join(backups,'household-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json'));
}
if(mode==='preview')fresh.money=100000;
grantStarterPetFurniture(fresh);
writeFileSync(file+'.reset.tmp',JSON.stringify(fresh,null,2)+'\n');
renameSync(file+'.reset.tmp',file);
console.log('Reset '+mode+' household; balance='+fresh.money+'; placed='+fresh.furnishing.placed.length);
