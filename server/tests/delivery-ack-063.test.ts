import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {applyWorld} from '../locations';
import {deliveryWasAccepted} from '../../src/core/deliveryAck';
test('reconnect confirms exact delivery, not unrelated sequence advancement',()=>{
 const s=initialState();
 const r=applyWorld(s,'vlad',{type:'delivery_order',sequence:0,lines:[{id:'grocery:bread',quantity:1}]});
 assert.ok(r.ok);
 assert.equal(deliveryWasAccepted(r.state,'vlad',0),true);
 assert.equal(deliveryWasAccepted(r.state,'alina',0),false);
 assert.equal(deliveryWasAccepted(r.state,'vlad',1),false);
 r.state.world.deliveries=[];
 assert.equal(deliveryWasAccepted(r.state,'vlad',0),true,'claimed delivery retains receipt');
 r.state.ledger=[];
 assert.equal(deliveryWasAccepted(r.state,'vlad',0),false,'sequence alone is not confirmation');
});
