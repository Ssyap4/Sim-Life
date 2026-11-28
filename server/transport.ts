import WebSocket from 'ws';
import type {ServerPacket} from '../src/shared/protocol';

/** Never accumulate unlimited snapshots for a slow or disconnected phone.
 * Disconnect the lagging client rather than dropping ordered game events.
 * A reconnect receives an authoritative fresh household snapshot. */
export const MAX_PENDING_SERVER_BYTES=2*1024*1024;
type Peer=Pick<WebSocket,'readyState'|'bufferedAmount'|'send'|'terminate'>;
export function sendSerialized(peer:Peer,payload:string):boolean{
 if(peer.readyState!==WebSocket.OPEN)return false;
 if(peer.bufferedAmount>MAX_PENDING_SERVER_BYTES){peer.terminate();return false;}
 try{peer.send(payload);return true;}
 catch{peer.terminate();return false;}
}
export function broadcastPacket(peers:Iterable<Peer>,packet:ServerPacket):void{
 let payload:string|undefined;
 for(const peer of peers){
  if(peer.readyState!==WebSocket.OPEN)continue;
  payload??=JSON.stringify(packet);
  sendSerialized(peer,payload);
 }
}
