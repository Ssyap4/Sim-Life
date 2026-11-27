import {mkdirSync,writeFileSync,readFileSync,unlinkSync,existsSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {albumFor,ALBUM_LIMIT,PHOTO_MAX_BYTES,photoCaption,photoId,type FamilyPhoto} from '../src/shared/familyAlbum';
import {gameMinutes} from '../src/shared/life';
import type {CharacterId,GameState} from '../src/shared/protocol';

// Read JPEG dimensions without decoding arbitrary uploaded images on the game server.
export function jpegDimensions(b:Buffer){
 if(b.length<12||b[0]!==255||b[1]!==216||b[b.length-2]!==255||b[b.length-1]!==217)return null;
 let offset=2;
 while(offset+4<=b.length){
  if(b[offset++]!==255)return null;while(b[offset]===255)offset++;
  const marker=b[offset++];if(marker===218||marker===217)return null;
  if(offset+2>b.length)return null;const length=b.readUInt16BE(offset);
  if(length<2||offset+length>b.length)return null;
  if([192,193,194].includes(marker)){if(length<8||b[offset+2]!==8)return null;const height=b.readUInt16BE(offset+3),width=b.readUInt16BE(offset+5);return width>0&&height>0&&Math.max(width,height)<=640?{width,height}:null;}
  offset+=length;
 }
 return null;
}
export function decodePhoto(value:unknown){
 if(typeof value!=='string'||value.length>Math.ceil(PHOTO_MAX_BYTES/3)*4||!/^[A-Za-z0-9+/]+={0,2}$/.test(value))return null;
 const bytes=Buffer.from(value,'base64');if(bytes.length>PHOTO_MAX_BYTES||bytes.toString('base64')!==value)return null;
 const size=jpegDimensions(bytes);return size?{bytes,...size}:null;
}
export function openAlbum(dataDir:string){
 const dir=join(dataDir,'family-photos');
 const file=(id:string)=>join(dir,id+'.jpg');
 return {
  add(source:GameState,role:CharacterId,jpeg:unknown,caption:unknown){
   const text=photoCaption(caption),decoded=decodePhoto(jpeg);
   if(text===null||!decoded)return {ok:false as const,reason:'Некорректный снимок или подпись'};
   if(albumFor(source).length>=ALBUM_LIMIT)return {ok:false as const,reason:'Альбом заполнен. Удали свой ненужный снимок.'};
   const id=randomBytes(16).toString('hex'),photo:FamilyPhoto={id,by:role,at:gameMinutes(source.clock),place:source.world.places[role],caption:text,width:decoded.width,height:decoded.height};
   mkdirSync(dir,{recursive:true});writeFileSync(file(id),decoded.bytes,{flag:'wx'});
   const state=structuredClone(source);(state.familyAlbum??=[]).push(photo);state.revision++;
   return {ok:true as const,state,photo,rollback(){try{unlinkSync(file(id));}catch{}}};
  },
  get(state:GameState,id:unknown){if(!photoId(id)||!albumFor(state).some(p=>p.id===id)||!existsSync(file(id))||statSync(file(id)).size>PHOTO_MAX_BYTES)return null;const bytes=readFileSync(file(id));return bytes.length<=PHOTO_MAX_BYTES?bytes.toString('base64'):null;},
  remove(source:GameState,role:CharacterId,id:unknown){if(!photoId(id)||!albumFor(source).some(p=>p.id===id&&p.by===role))return {ok:false as const,reason:'Удалить можно только свой снимок'};
   const state=structuredClone(source);state.familyAlbum=albumFor(state).filter(p=>p.id!==id);state.revision++;
   return {ok:true as const,state,cleanup(){try{unlinkSync(file(id));}catch{}}};
  }
 };
}
