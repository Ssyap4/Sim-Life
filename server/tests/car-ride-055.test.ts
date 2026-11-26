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
