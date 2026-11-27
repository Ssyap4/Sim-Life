import {isAbsolute} from 'node:path';
import {recoverHouseholdBackup} from '../server/storage';

// Operator only. Never run this while a server owns the directory.
const [dataDir,confirmation,...extra]=process.argv.slice(2);
if(!dataDir||!isAbsolute(dataDir)||confirmation!=='--confirm-server-stopped'||extra.length){
  console.error('Usage: node --import tsx scripts/recover-household.ts <absolute-data-dir> --confirm-server-stopped');
  process.exitCode=1;
}else{
  try{
    const result=recoverHouseholdBackup(dataDir);
    console.log('Restored revision '+result.revision+'; damaged file preserved at '+result.quarantine);
  }catch(error){
    console.error('Recovery refused:',error instanceof Error?error.message:error);
    process.exitCode=1;
  }
}
