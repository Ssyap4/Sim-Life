import {test} from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import {broadcastPacket,sendSerialized,MAX_PENDING_SERVER_BYTES} from '../transport';
import {initialState} from '../../src/shared/protocol';

function peer(bufferedAmount=0,readyState:WebSocket["readyState"]=WebSocket.OPEN,fail=false){
 const messages:string[]=[];let terminated=0;
 const socket={readyState,bufferedAmount,send(data:unknown){if(fail)throw Error('closed');messages.push(String(data));},terminate(){terminated++;}};
 return {socket,messages,get terminated(){return terminated;}};
}
test('broadcast serializes once and keeps healthy partner synchronized when other peer is slow',()=>{
 const slow=peer(MAX_PENDING_SERVER_BYTES+1),healthy=peer(),second=peer(),closed=peer(0,WebSocket.CLOSED);
 let serializations=0;
 const state=initialState();state.money=100000;
 Object.defineProperty(state,'toJSON',{value:()=>{serializations++;return {money:state.money};}});
 broadcastPacket([slow.socket,healthy.socket,second.socket,closed.socket],{type:'snapshot',state});
 assert.equal(serializations,1);assert.equal(slow.terminated,1);assert.equal(slow.messages.length,0);
 assert.deepEqual(healthy.messages,second.messages);
 assert.equal(JSON.parse(healthy.messages[0]).state.money,100000);
 assert.equal(closed.terminated,0);assert.equal(closed.messages.length,0);
});
test('failed peer write is isolated and does not throw into gameplay transaction',()=>{
 const failing=peer(0,WebSocket.OPEN,true),healthy=peer();
 assert.equal(sendSerialized(failing.socket,'{}'),false);
 assert.equal(failing.terminated,1);
 broadcastPacket([failing.socket,healthy.socket],{type:'online',online:['vlad']});
 assert.deepEqual(JSON.parse(healthy.messages[0]),{type:'online',online:['vlad']});
});
