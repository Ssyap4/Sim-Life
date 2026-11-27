import type {CharacterId,GameState} from './protocol';
import {PLACES,type PlaceId} from './locations';
export const ALBUM_LIMIT=40,PHOTO_MAX_BYTES=90000,PHOTO_CAPTION_LIMIT=100;
export type FamilyPhoto={id:string;by:CharacterId;at:number;place:PlaceId;caption:string;width:number;height:number};
export type AlbumCommand={type:'album_add';jpeg:string;caption:string}|{type:'album_get';id:string}|{type:'album_delete';id:string};
export const photoId=(id:unknown):id is string=>typeof id==='string'&&/^[a-f0-9]{32}$/.test(id);
export function photoCaption(v:unknown){return typeof v==='string'&&v.trim().length<=PHOTO_CAPTION_LIMIT&&!/[\u0000-\u001f\u007f]/.test(v)?v.trim():null;}
export function albumFor(s:Pick<GameState,'familyAlbum'>){return s.familyAlbum??[];}
export function validAlbum(value:unknown):value is FamilyPhoto[]{
 if(!Array.isArray(value)||value.length>ALBUM_LIMIT)return false;
 const seen=new Set<string>();
 return value.every(p=>{if(!p||!photoId(p.id)||seen.has(p.id)||!['vlad','alina'].includes(p.by)||!Number.isSafeInteger(p.at)||p.at<0||!Object.hasOwn(PLACES,p.place)||photoCaption(p.caption)!==p.caption||!Number.isInteger(p.width)||!Number.isInteger(p.height)||p.width<1||p.height<1||Math.max(p.width,p.height)>640)return false;seen.add(p.id);return true;});
}
