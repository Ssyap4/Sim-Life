import {albumFor,ALBUM_LIMIT,PHOTO_CAPTION_LIMIT,type AlbumCommand} from './shared/familyAlbum';
import {names,type CharacterId,type GameState} from './shared/protocol';
import {PLACES} from './shared/locations';
import {clockAt,clockLabel} from './shared/life';

export function createFamilyAlbumUI(root:HTMLElement,send:(c:AlbumCommand)=>boolean,capture:()=>void){
 let state:GameState|undefined,role:CharacterId='vlad',selected:string|undefined,draft:string|undefined,caption='',key='',pending=false,baseline=new Set<string>(),limit=12;
 let message='';const cache=new Map<string,string>(),requested=new Set<string>();
 const panel=document.createElement('section');panel.className='family-album';
 function button(label:string,action:()=>void,disabled=false){const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=disabled;b.onclick=action;return b;}
 function image(jpeg:string){const img=document.createElement('img');img.src='data:image/jpeg;base64,'+jpeg;img.alt='Снимок игрового мира';return img;}
 function draw(){
  if(!state)return;const photos=albumFor(state),scroll=root.scrollTop;
  panel.replaceChildren();
  const header=document.createElement('strong');header.textContent='Наши фотографии · '+photos.length+'/'+ALBUM_LIMIT;panel.append(header);
  if(message){const p=document.createElement('p');p.className='album-feedback';p.textContent=message;panel.append(p);}
  if(draft){
   panel.append(image(draft));const input=document.createElement('input');input.placeholder='Подпись к фото (необязательно)';input.setAttribute('aria-label','Подпись к фото');input.maxLength=PHOTO_CAPTION_LIMIT;input.value=caption;input.disabled=pending;input.oninput=()=>caption=input.value;
   panel.append(input,button(pending?'Сохраняется…':'Сохранить в альбом',()=>{if(!draft||!state)return;baseline=new Set(albumFor(state).map(p=>p.id));if(send({type:'album_add',jpeg:draft,caption})){pending=true;draw();}},pending||photos.length>=ALBUM_LIMIT),button('Отменить снимок',()=>{draft=undefined;caption='';draw();},pending));
  }else if(selected){
   const p=photos.find(x=>x.id===selected);if(!p){selected=undefined;draw();return;}
   panel.append(button('‹ Все фотографии',()=>{selected=undefined;draw();}));
   const jpeg=cache.get(p.id);
   if(jpeg)panel.append(image(jpeg));else{const loading=document.createElement('p');loading.textContent='Загрузка снимка…';panel.append(loading);if(!requested.has(p.id)&&send({type:'album_get',id:p.id}))requested.add(p.id);}
   const info=document.createElement('p');info.textContent=(p.caption?p.caption+' · ':'')+names[p.by]+' · '+PLACES[p.place].name+' · '+clockLabel(clockAt(p.at));panel.append(info);
   if(p.by===role){const confirm=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Удалить мой снимок';confirm.append(summary,button('Подтвердить удаление',()=>{if(send({type:'album_delete',id:p.id})){selected=undefined;draw();}}));panel.append(confirm);}
  }else{
   panel.append(button('📷 Сделать фото',capture,photos.length>=ALBUM_LIMIT));
   if(!photos.length){const p=document.createElement('p');p.textContent='Сохраняйте моменты вашей жизни. Снимки видны обоим игрокам.';panel.append(p);}
   const grid=document.createElement('div');grid.className='album-grid';
   for(const p of [...photos].reverse().slice(0,limit)){
    const card=button('',()=>{selected=p.id;draw();});card.className='album-tile';
    const jpeg=cache.get(p.id);if(jpeg)card.append(image(jpeg));else{const placeholder=document.createElement('div');placeholder.className='album-placeholder';placeholder.textContent='📷';card.append(placeholder);if(!requested.has(p.id)&&send({type:'album_get',id:p.id}))requested.add(p.id);}
    const label=document.createElement('span');label.textContent=p.caption||PLACES[p.place].name;const small=document.createElement('small');small.textContent=names[p.by]+' · '+clockLabel(clockAt(p.at));card.append(label,small);grid.append(card);
   }
   panel.append(grid);if(photos.length>limit)panel.append(button('Показать ещё',()=>{limit+=12;draw();}));
  }
  if(panel.parentElement!==root)root.replaceChildren(panel);root.scrollTop=scroll;
 }
 return {
  reset(){key='';requested.clear();limit=12;selected=undefined;message='';},
  render(s:GameState,r:CharacterId){if(role!==r){role=r;draft=undefined;caption='';pending=false;cache.clear();requested.clear();selected=undefined;}
   state=s;const photos=albumFor(s);
   if(pending&&photos.some(p=>p.by===r&&!baseline.has(p.id))){draft=undefined;caption='';pending=false;message='Снимок сохранён';}
   for(const id of cache.keys())if(!photos.some(p=>p.id===id))cache.delete(id);
   const next=JSON.stringify([r,photos]);if(next!==key||panel.parentElement!==root){key=next;draw();}
  },
  draft(jpeg:string,r:CharacterId){role=r;draft=jpeg;caption='';message='';pending=false;key='';},
  receive(id:string,jpeg:string){requested.delete(id);if(!state||!albumFor(state).some(p=>p.id===id))return;cache.set(id,jpeg);if(panel.parentElement===root&&!root.hidden&&!draft)draw();},
  reject(reason:string){pending=false;message=reason;if(panel.parentElement===root&&!root.hidden)draw();},
 };
}
