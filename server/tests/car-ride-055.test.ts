import test from 'node:test';
import assert from 'node:assert/strict';
import {activeCarRide,isCarReturn,recordCarRide,rideDuration,rideProgress} from '../../src/shared/carRide';
import {initialState} from '../../src/shared/protocol';

test('shared real-time travel window, expiry and independent passengers',()=>{
 const old=initialState(),after=structuredClone(old);
 after.world.places={vlad:'lake',alina:'lake'};
 recordCarRide(old,after,['vlad','alina'],1000);
 const v=activeCarRide(after,'vlad',1000)!;
 assert.deepEqual(v,activeCarRide(after,'alina',1000));
 assert.equal(rideProgress(v,6000),.5);assert.equal(activeCarRide(after,'vlad',11000),undefined);
 assert.equal(rideDuration('home','market'),6000);assert.equal(rideDuration('spa','home'),8000);
 const back=structuredClone(after);back.world.places.vlad='home';after.world.carDriver='vlad';
 assert.ok(isCarReturn(after,back,'vlad'));recordCarRide(after,back,['vlad'],12000);
 assert.equal(activeCarRide(back,'vlad',12000)?.to,'home');assert.equal(activeCarRide(back,'alina',12000),undefined);
});
test('walking home does not trigger a ride',()=>{
 const old=initialState();old.world.places.vlad='district';const after=structuredClone(old);after.world.places.vlad='home';
 assert.equal(isCarReturn(old,after,'vlad'),false);
});

test('resort and grooming keep symmetric trip duration and independent checkout',()=>{
 const old=initialState(),after=structuredClone(old);
 after.world.places={vlad:'resort',alina:'resort'};after.world.carDriver='vlad';
 recordCarRide(old,after,['vlad','alina'],1000);
 assert.equal(rideDuration('home','resort'),10000);assert.equal(rideDuration('resort','home'),10000);
 assert.deepEqual(activeCarRide(after,'vlad',1500),activeCarRide(after,'alina',1500));
 const back=structuredClone(after);back.world.places.alina='home';
 assert.ok(isCarReturn(after,back,'alina'));recordCarRide(after,back,['alina'],12000);
 assert.equal(activeCarRide(back,'alina',12001)?.to,'home');assert.equal(activeCarRide(back,'vlad',12001),undefined);
 const groom=structuredClone(old);groom.world.places.vlad='grooming';groom.world.carDriver='vlad';
 recordCarRide(old,groom,['vlad'],1000);assert.equal(rideDuration('home','grooming'),8000);assert.equal(rideDuration('grooming','home'),8000);
 assert.equal(activeCarRide(groom,'vlad',1001)?.to,'grooming');assert.equal(activeCarRide(groom,'alina',1001),undefined);
 assert.ok(isCarReturn(groom,old,'vlad'));
});
