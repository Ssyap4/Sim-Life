import {leisureAction} from '../src/shared/leisure';
import {PURCHASABLE_FURNITURE,FURNITURE_BY_ID,type FurnitureProduct,type FurnitureShape,type PlacedFurniture} from '../src/shared/furniture';
import {initialState} from '../src/shared/protocol';
import {checkFurniturePlacement} from '../src/shared/furnishingPlacement';
import {furnitureActionList,furnitureUseLocation,furnitureSource,type FurnitureUseAction} from '../src/shared/furnitureUse';
import {isSleepBed,selectSleepBed} from '../src/shared/bedSleep';
import {applyFurnishing} from '../server/furnishing';
import {planTask,evaluateTask} from '../server/tasks';
import {BOOKS,GENRES} from '../src/shared/homeLife';
import {performance} from 'node:perf_hooks';
const spots=[[12.9,-5.5],[13.7,-5.5],[13.5,2.8],[11.9,-5.4],[12.4,-1.8],
 [13.5,-1.85],[11.7,2.85],[11.3,-5.5],[13.4,.6],[7.8,-7.0],
 [-2.36,2.02],[2.39,-2.22],[13.5,-6.2],[11,-6],[-2.8,-5.6],[11,-5.4],
 [12.8,-6.4],[10.9,-5.3]];
const sold=['table','sofa','bed','desk','officeChair','nightstandLeft','nightstandRight'] as const;
const seats=new Set<FurnitureShape>(['armchair','ottoman','bench','chair','stool']);
const storage=new Set<FurnitureShape>(['wardrobe','dresser','nightstand','sideboard']);
const deskActs=['deskJournal','deskGames','vladOrder','vladStudy','alinaStudy','alinaConsult'];
const sofaActs=['sofaRest','sofaMusic','sofaCall','free_tv','youtube','movie','read_book'];
function expected(info:FurnitureProduct):string[]{
 if(info.shape==='leisure')return [leisureAction(info.id)!];
 if(info.shape==='bed'||info.shape==='daybed')return [];
 if(info.shape==='sofa'||info.shape==='corner')return sofaActs;
 if(seats.has(info.shape))return ['officeChairSit','read_book'];
 if(storage.has(info.shape))return ['tidy'];
 if(info.shape==='shelves')return ['read_book','tidy'];
 if(info.shape==='table')return info.height>=.63?['tableRest','tableTalk','tablePlan']:[];
 if(info.shape==='desk')return deskActs;
 return [];
}
const failures:any[]=[];const rows:any[]=[];
let validated=0,actionsVerified=0;
const start=performance.now();
const book=Object.keys(BOOKS)[0];
const genre=Object.keys(GENRES)[0];
const scope=process.argv.includes("--leisure-only")?PURCHASABLE_FURNITURE.filter(i=>i.category==="leisure"):PURCHASABLE_FURNITURE;
for(const info of scope){
 let state=initialState();
 state.money=500000;
 state.furnishing.soldFixtures=[...sold];
 for(const id of ['youtube','netflix']as const){
   const service=state.billing.services[id];
   service.enabled=true;service.paidUntil=999999;service.nextDue=999999;
 }
 try {
   const order=applyFurnishing(state,'vlad',{type:'furniture_order',sku:info.id,
     finish:'sage',shipping:'express',quantity:1},100);
   if(!order.ok)throw Error('ORDER '+order.reason);
   const amount=state.money-info.price-990;
   if(order.state.money!==amount)throw Error('CHECKOUT MONEY');
   state=order.state;
   const unbox=applyFurnishing(state,'alina',{type:'furniture_unbox',id:1},115);
   if(!unbox.ok)throw Error('UNBOX '+unbox.reason);
   state=unbox.state;
   let placed=false;
   for(const [x,z] of (info.category==='leisure'?[...spots,[10,8.6],[16.5,8.6],[13,8.6]]:spots)){
     if(placed)break;
     for(const rotation of [0,1,2,3]as const){
       const sample={id:1,sku:info.id,finish:'sage' as const,x,z,rotation};
       if(!checkFurniturePlacement(state,sample,[]).valid)continue;
       const place=applyFurnishing(state,'vlad',{type:'furniture_place',id:1,x,z,rotation},120);
       if(place.ok){state=place.state;placed=true;break;}
     }
   }
   if(!placed)throw Error('CANNOT PLACE');
   validated++;
   const item=state.furnishing.placed[0];
   const actual=furnitureActionList(item).slice().sort();
   const wanted=expected(info).slice().sort();
   if(JSON.stringify(actual)!==JSON.stringify(wanted))
     throw Error('ACTION MAP: want '+wanted+' got '+actual);
   for(const role of ['vlad','alina']as const){
      if(isSleepBed(item)){
        const found=selectSleepBed(state,role,1);
        if(!found.ok)throw Error('SLEEP ROUTE '+role+' '+found.reason);
      }
      for(const action of actual){
        const location=furnitureUseLocation(state,role,1,action);
        if(!location)throw Error('NO ROUTE '+role+' '+action);
        const cmd={type:'furniture_use',furnitureId:1,action,
          ...(action==='read_book'?{book}:{}),
          ...(action==='movie'?{genre}:{})};
        const plan=planTask(cmd);
        if(!plan)throw Error('NO PLAN '+role+' '+action);
        const deniedRole=role==='vlad'&&['alinaStudy','alinaConsult'].includes(action)||
           role==='alina'&&['vladOrder','vladStudy'].includes(action);
        const applied=evaluateTask(state,role,plan.command);
        if(!applied.ok && !deniedRole)throw Error('DENIED '+role+' '+action+': '+applied.reason);
        if(applied.ok && deniedRole)throw Error('BAD ROLE GRANTED '+role+' '+action);
        if(applied.ok && applied.state.revision<=state.revision)throw Error('NO SAVE REVISION '+action);
        actionsVerified++;
      }
   }
   const before=item;
   let moved=false;
   for(const [dx,dz,rot] of [[.06,.04,before.rotation],[0,.08,before.rotation],
     [.08,0,before.rotation],[0,0,((before.rotation+1)%4)]]as const){
     if(dx===0&&dz===0&&rot===before.rotation)continue;
     const result=applyFurnishing(state,'alina',{type:'furniture_move',id:1,
       x:before.x+dx,z:before.z+dz,rotation:rot},124);
     if(result.ok){state=result.state;moved=true;break;}
   }
   if(!moved)throw Error('CANNOT MOVE');
   // Re-evaluate all available interactions AFTER moving or rotating.
   for(const role of ['vlad','alina']as const){
     const movedItem=state.furnishing.placed[0];
     if(isSleepBed(movedItem)&&!selectSleepBed(state,role,1).ok)
       throw Error('NO SLEEP AFTER MOVE '+role);
     for(const action of actual){
       if(!furnitureUseLocation(state,role,1,action))
         throw Error('NO ROUTE AFTER MOVE '+role+' '+action);
     }
   }
   const store=applyFurnishing(state,'vlad',{type:'furniture_store',id:1},125);
   if(!store.ok)throw Error('STORE '+store.reason);
   state=store.state;
   if(state.furnishing.placed.length||state.furnishing.stored.length!==1)
     throw Error('STORE DID NOT MOVE ITEM');
   for(const action of actual as FurnitureUseAction[]){
     if(furnitureSource(state,1,action).ok)throw Error('STORED ITEM STILL USEABLE');
   }
   const soldResult=applyFurnishing(state,'alina',{type:'furniture_sell',id:1},126);
   if(!soldResult.ok)throw Error('SELL '+soldResult.reason);
   if(soldResult.state.money!==state.money+Math.floor(info.price*.55))
     throw Error('WRONG SELL PROCEEDS');
   state=soldResult.state;
   if(state.furnishing.stored.length||state.furnishing.placed.length)throw Error('ITEM REMAINS AFTER SELL');
   if(applyFurnishing(state,'vlad',{type:'furniture_sell',id:1},127).ok)
     throw Error('DUPLICATE SELL');
   rows.push({sku:info.id,shape:info.shape,actions:actual.length,result:'ok'});
 }catch(e){failures.push({sku:info.id,shape:info.shape,message:String(e)});rows.push({sku:info.id,result:'fail'});}
}
const passed=rows.filter(x=>x.result==='ok').length;
if(failures.length||passed!==scope.length){
 console.error('FURNITURE_AUDIT_FAILURE: '+failures.length+' of '+scope.length);
 process.exitCode=1;
}
console.log(JSON.stringify({total:scope.length,passed,
 placementValidated:validated,actionsVerified,durationMs:Math.round(performance.now()-start),failures,
 breakdown:Object.fromEntries([...new Set(rows.map(r=>r.shape))].map(shape=>[shape,rows.filter(r=>r.shape===shape).length]))},null,2));
