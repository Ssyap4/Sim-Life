// Read-only catalog audit. All counts below are illustrative ten-day plans, not simulated telemetry.
import {JOBS,JOB_IDS,type JobId} from '../src/shared/jobs';
import {CAREERS} from '../src/shared/careers';
import {GROCERIES,TAKEOUT,recipePortionCost,type RecipeId} from '../src/shared/food';
import {CAFE_MENU,DELIVERY_FEE} from '../src/shared/locations';
import {PURCHASABLE_FURNITURE,FURNITURE_DELIVERY} from '../src/shared/furniture';
import {ELECTRONICS} from '../src/shared/electronics';
import {PET_SHOP_FOOD} from '../src/shared/petShop';
import {FITNESS_PASSES} from '../src/shared/fitness';
import {CLINIC_SERVICES,VET_SERVICES,MEDICINE_PRICE} from '../src/shared/health';
import {BARBER_SERVICES} from '../src/shared/barber';
import {LAKE_PASSES,LAKE_TENTS,LAKE_MEALS} from '../src/shared/lake';
import {SPA_PASSES} from '../src/shared/spa';
import {VENUE_GAMES} from '../src/shared/venue';
import {SERVICES,UTILITY_RANGE} from '../src/shared/services';
import {GAME_MINUTES_PER_REAL_SECOND} from '../src/shared/life';
import {SAVINGS_GOALS,SPENDING_CATEGORIES} from '../src/shared/familyBudget';
const average=(a:number,b:number)=>(a+b)/2;
const realHoursPerGameHour=60/GAME_MINUTES_PER_REAL_SECOND/3600;
const pay=(id:JobId)=>average(JOBS[id].payMin,JOBS[id].payMax);
const recipe=(id:RecipeId,n:number)=>recipePortionCost(id)*n;
const pet=(tier:number,packs:number)=>PET_SHOP_FOOD.filter(p=>p.id.endsWith('-dry-'+tier)).reduce((sum,p)=>sum+p.price*packs,0);
const mandatory=average(...UTILITY_RANGE)+SERVICES.internet.price+SERVICES.mobile.price;
const subscriptions=SERVICES.netflix.price+SERVICES.youtube.price;
const salary=CAREERS.it.roles[0][1]+CAREERS.marketing.roles[0][1];
function scenario(income:number,expenses:Record<string,number>){
  const total=Object.values(expenses).reduce((a,b)=>a+b,0);
  return {income,expenses,total,balance:income-total};
}
const scenarios={
  economical:scenario(5*pay('courier')+5*pay('driver'),{
    mandatory,homeMeals:recipe('chickenSoup',20)+recipe('porridge',20),pets:pet(0,2)}),
  comfortable:scenario(7*salary,{
    mandatory,subscriptions,homeMeals:recipe('omelette',10)+recipe('chickenRice',10)+recipe('pastaBolognese',10),
    takeaway:2*TAKEOUT.pizzaCheese.price+2*DELIVERY_FEE,cafe:6*CAFE_MENU.caesar.price,
    pets:pet(1,2),spa:SPA_PASSES.pair.price,venue:VENUE_GAMES.venueHockey.price}),
  active:scenario(7*salary+8*pay('vibeSite'),{
    mandatory,subscriptions,homeMeals:recipe('chickenRice',10)+recipe('pastaBolognese',10),
    takeaway:TAKEOUT.rollsPremium.price+2*TAKEOUT.pizzaBig.price+3*DELIVERY_FEE,cafe:8*CAFE_MENU.tomYum.price,
    pets:pet(2,2),spa:SPA_PASSES.package.price,venue:VENUE_GAMES.venueBowling.price+VENUE_GAMES.venueUfc.price,
    lake:LAKE_PASSES.night.pair+LAKE_TENTS.nord.price,fitness:2*FITNESS_PASSES.single.price,
    barber:BARBER_SERVICES.barberFull.price,computer:ELECTRONICS.pcOffice.price})
};
const range=(values:number[])=>[Math.min(...values),Math.max(...values)];
const prices=(catalog:Record<string,{price:number}>)=>Object.fromEntries(Object.entries(catalog).map(([id,v])=>[id,v.price]));
const jobs=Object.fromEntries([...JOB_IDS,'vibeSite' as const].map(id=>{
  const j=JOBS[id],hours=average(j.hoursMin,j.hoursMax),perGameHour=pay(id)/hours;
  return [id,{pay:pay(id),hours,perGameHour:Math.round(perGameHour),realMinutes:hours*realHoursPerGameHour*60,
    perRealHour:Math.round(perGameHour/realHoursPerGameHour),perRealHourAt1_5:Math.round(perGameHour/realHoursPerGameHour*1.5)}];
}));
console.log(JSON.stringify({assumptions:'Ten game days, 40 food portions per household, two bags per pet, seven entry-level career shifts per resident in comfortable/active plan; average wages/utilities; no bonuses, illness, spoilage, fuel or initial stock. Counts are choices, not predicted need.',jobs,
  careers:Object.fromEntries(Object.entries(CAREERS).map(([id,c])=>[id,{hours:c.hours,pay:c.roles.map(r=>r[1]),perRealHour:c.roles.map(r=>Math.round(r[1]/c.hours/realHoursPerGameHour))}])),
  groceries:prices(GROCERIES),takeawayPerPortion:Object.fromEntries(Object.entries(TAKEOUT).map(([id,p])=>[id,p.price/p.quantity])),
  homeMeals:Object.fromEntries((['omelette','toast','chickenRice','chickenSoup','pastaBolognese','porridge'] as const).map(id=>[id,recipePortionCost(id)])),
  cafe:prices(CAFE_MENU),furnitureRange:range(PURCHASABLE_FURNITURE.map(p=>p.price)),furnitureDelivery:FURNITURE_DELIVERY,
  electronics:prices(ELECTRONICS),petFood:PET_SHOP_FOOD.map(p=>({id:p.id,price:p.price,refills:p.refills,satiety:p.satiety})),
  clinic:prices(CLINIC_SERVICES),vet:prices(VET_SERVICES),medicine:MEDICINE_PRICE,fitness:prices(FITNESS_PASSES),spa:prices(SPA_PASSES),
  barber:prices(BARBER_SERVICES),venue:prices(VENUE_GAMES),lake:LAKE_PASSES,tents:prices(LAKE_TENTS),lakeMeals:prices(LAKE_MEALS),
  bills:{mandatory,subscriptions,utilityRange:UTILITY_RANGE},savingsGoals:SAVINGS_GOALS,budgetCaps:SPENDING_CATEGORIES,scenarios},null,2));
