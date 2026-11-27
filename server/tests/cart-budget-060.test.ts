import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {DELIVERY_FEE} from '../../src/shared/locations';
import {basketPrice} from '../../src/shared/market';
import {applyWorld} from '../locations';

test('Takeaway delivery uses the takeaway budget, including the fee',()=>{
  const s=initialState(),lines=[{id:'takeout:pizzaCheese',quantity:1}];
  const r=applyWorld(s,'vlad',{type:'delivery_order',sequence:0,lines});
  assert.ok(r.ok);if(!r.ok)return;
  assert.equal(r.state.money,s.money-basketPrice(lines)-DELIVERY_FEE);
  assert.deepEqual(r.state.savings.spent,{groceries:0,takeout:850+DELIVERY_FEE,pets:0});
  assert.equal(r.state.ledger.length,1);
  assert.equal(r.state.ledger[0].category,'takeout');
  assert.equal(r.state.world.deliveries.length,1);
  assert.equal(applyWorld(r.state,'vlad',{type:'delivery_order',sequence:0,lines}).ok,false);
  assert.equal(s.ledger.length,0);
});

test('Mixed delivery allocates categories and a single proportional fee without changing the charge',()=>{
  const s=initialState(),lines=[{id:'grocery:milk',quantity:1},{id:'takeout:pizzaCheese',quantity:1},
    {id:'pet:verdell',quantity:1},{id:'gift:giftFlowers',quantity:1}];
  const total=basketPrice(lines)+DELIVERY_FEE;
  const r=applyWorld(s,'alina',{type:'delivery_order',sequence:0,lines});
  assert.ok(r.ok);if(!r.ok)return;
  assert.equal(r.state.money,s.money-total);
  assert.equal(r.state.ledger.reduce((sum,e)=>sum+e.amount,0),total);
  assert.deepEqual(r.state.ledger.map(e=>e.category),['groceries','takeout','pets','gifts']);
  for(const e of r.state.ledger)if(e.category==='groceries'||e.category==='takeout'||e.category==='pets')
    assert.equal(r.state.savings.spent[e.category],e.amount);
  assert.equal(r.state.world.deliveries[0].cost,total);
  assert.ok(r.state.ledger.every(e=>e.actor==='alina'));
  assert.deepEqual(s.savings.spent,{groceries:0,takeout:0,pets:0});
});
