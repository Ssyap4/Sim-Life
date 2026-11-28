import {leisureAction} from '../../src/shared/leisure';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {FURNITURE_CATALOG, type FurnitureProduct, type FurnitureShape} from '../../src/shared/furniture';
import {furnitureActionList,availableFurnitureActions,FURNITURE_ACTIONS} from '../../src/shared/furnitureUse';
import {isSleepBed,bedCapacity} from '../../src/shared/bedSleep';
const seats=new Set<FurnitureShape>(['armchair','ottoman','bench','chair','stool']);
const containers=new Set<FurnitureShape>(['wardrobe','dresser','nightstand','sideboard']);
function expected(item:FurnitureProduct){
 const shape=item.shape;
 if(item.id==='oasis-pool')return ['poolFloat','poolSwim'];
 if(item.id==='hobby-workbench')return ['buildCottage','buildCar'];
 if(shape==='leisure')return [leisureAction(item.id)!];
 if(shape==='bed'||shape==='daybed')return [] as string[];
 if(shape==='sofa'||shape==='corner')return ['sofaRest','sofaMusic','sofaCall','sofaScroll','free_tv','youtube','movie','read_book'];
 if(seats.has(shape))return ['officeChairSit','read_book'];
 if(containers.has(shape))return ['tidy'];
 if(shape==='shelves')return ['read_book','tidy'];
 if(shape==='table')return item.height>=.63?['tableRest','tableTalk','tablePlan']:[];
 if(shape==='desk')return ['deskJournal','deskGames','vladOrder','vladStudy','alinaStudy','alinaConsult'];
 return [] as string[];
}
test('every catalogue SKU has exactly the actions its physical shape supports',()=>{
 for(const item of FURNITURE_CATALOG){
   const owned={id:1,sku:item.id,finish:'sage' as const,rotation:0 as const,x:12,z:-5};
   const actual=furnitureActionList(owned).slice().sort();
   const wanted=expected(item).slice().sort();
   assert.deepEqual(actual,wanted,item.id);
   assert.equal(isSleepBed(owned),item.shape==='bed'||item.shape==='daybed',item.id+' sleep eligibility');
   if(isSleepBed(owned)){
     assert.equal(bedCapacity(owned),item.shape==='bed'&&item.width>=1.55?2:1,item.id);
   }
   assert.ok(actual.every(action=>Object.hasOwn(FURNITURE_ACTIONS,action)),item.id);
 }
});
test('installed furniture only shows resident-appropriate, truly available actions',()=>{
 const state=initialState();
 const desk={id:1,sku:'desk-hutch',finish:'sage' as const,rotation:0 as const,x:11,z:-5};
 const sofa={id:2,sku:'sofa-futon',finish:'sage' as const,rotation:0 as const,x:13,z:-5};
 const shelf={id:3,sku:'shelf-asym',finish:'sage' as const,rotation:0 as const,x:13,z:-2};
 state.furnishing.soldFixtures=['bookcase'];
 state.furnishing.placed=[desk,sofa];
 const vlad=availableFurnitureActions(state,'vlad',desk);
 const alina=availableFurnitureActions(state,'alina',desk);
 assert.ok(vlad.includes('vladStudy')&&vlad.includes('vladOrder'));
 assert.ok(!vlad.includes('alinaStudy')&&!vlad.includes('alinaConsult'));
 assert.ok(alina.includes('alinaStudy')&&alina.includes('alinaConsult'));
 assert.ok(!alina.includes('vladStudy')&&!alina.includes('vladOrder'));
 assert.ok(!availableFurnitureActions(state,'vlad',sofa).includes('read_book'),
   'do not offer an impossible book read when all bookcases are sold');
 state.furnishing.placed.push(shelf);
 assert.ok(availableFurnitureActions(state,'alina',sofa).includes('read_book'),
   'reading returns when a purchased bookshelf is installed');
 assert.ok(availableFurnitureActions(state,'alina',shelf).includes('read_book'));
 state.furnishing.placed.pop();
 assert.ok(!availableFurnitureActions(state,'alina',sofa).includes('read_book'));
});
