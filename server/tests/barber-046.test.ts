import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {applyWorld,localActivity,validWorld} from '../locations';
import {approachFor,stationById} from '../../src/shared/locations';
import {barberSlots,barberDenial,validBarberBooking} from '../../src/shared/barber';
import {careScore,careEffects,validVanity} from '../../src/shared/vanity';
import {gameMinutes} from '../../src/shared/life';
import {planTask,evaluateTask} from '../tasks';
test('BRO booking, car travel, professional care, return and cost are authoritative',()=>{
 let s=initialState();const at=barberSlots(gameMinutes(s.clock))[0],book={type:'barber_book',at,service:'barberFull'};
 assert.equal(applyWorld(s,'alina',book).ok,false);assert.equal(applyWorld(s,'vlad',{...book,at:-1}).ok,false);
 const booked=applyWorld(s,'vlad',book);assert.ok(booked.ok);s=booked.state;assert.ok(validBarberBooking(s.barberBooking));assert.equal(s.money,10000);
 assert.equal(applyWorld(s,'vlad',{type:'travel',place:'barber'}).ok,false);
 Object.assign(s.characters.vlad,approachFor(stationById('home','family-car')!,'vlad'));
 const trip=applyWorld(s,'vlad',{type:'car_travel',place:'barber'});assert.ok(trip.ok);s=trip.state;assert.ok(validWorld(s.world));
 assert.equal(localActivity(s,'vlad','barberFull','barber-chair').ok,false);
 const route=applyWorld(s,'vlad',{type:'approach',place:'barber',station:'barber-chair'});assert.ok(route.ok);s=route.state;
 assert.equal(planTask({type:'local_activity',station:'barber-chair',action:'barberFull'})?.durationMs,90000);
 const done=localActivity(s,'vlad','barberFull','barber-chair');assert.ok(done.ok);s=done.state;assert.equal(s.money,7100);assert.equal(careScore(s,'vlad'),100);assert.equal(careScore(s),40);assert.ok(validVanity(s.vladCare,'vlad'));assert.equal(s.barberBooking,undefined);assert.ok(careEffects(s,'vlad').every(e=>e.until===gameMinutes(s.clock)+4320));assert.ok(barberDenial(s,'vlad','barberFull'));
 const exit=applyWorld(s,'vlad',{type:'approach',place:'barber',station:'barber-exit'});assert.ok(exit.ok);const home=applyWorld(exit.state,'vlad',{type:'travel',place:'district',via:'barber-exit'});assert.ok(home.ok);assert.equal(home.state.world.places.vlad,'home');assert.equal(home.state.world.carDriver,undefined);
 assert.equal(planTask({type:'vanity_care',care:'vladProFade'}),null);assert.equal(evaluateTask(home.state,'vlad',{type:'vanity_care',care:'vladProFade'}).ok,false);
});
test('individual barber services have exact approved cost and no cross-character effects',()=>{
 for(const [action,price,points,hours] of [['barberFade',1200,30,72],['barberShave',900,25,48],['barberStyle',700,25,48],['barberFace',800,20,48]] as const){
  const s=initialState();s.world.places.vlad='barber';Object.assign(s.characters.vlad,approachFor(stationById('barber','barber-chair')!,'vlad'));const done=localActivity(s,'vlad',action,'barber-chair');assert.ok(done.ok);assert.equal(done.state.money,s.money-price);assert.equal(careScore(done.state,'vlad'),40+points);assert.equal(careEffects(done.state,'vlad')[0].until,gameMinutes(s.clock)+hours*60);assert.equal(careScore(done.state),40);assert.ok(barberDenial(done.state,'vlad',action));
 }
});
