import type {CharacterId,GameState} from '../shared/protocol';
/** A later sequence may represent a cafe or supermarket transaction instead.
 * Clear a delivery basket only when the exact delivery or its receipt exists. */
export function deliveryWasAccepted(state:GameState,role:CharacterId,sequence:number):boolean{
 const id='D-'+role+'-'+sequence;
 return state.world.deliveries.some(order=>order.id===id&&order.role===role)
  ||state.ledger.some(entry=>entry.actor===role&&entry.kind==='expense'&&entry.label.startsWith('Доставка '+id+' ·'));
}
