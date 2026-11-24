
import * as THREE from 'three';
import {cube,softCube,drum,plane,finish,batchRigidParts,type XYZ} from './ArtKit';
import {ELECTRONICS,type ElectronicsId,type ElectronicsKind} from '../shared/electronics';

const dark=0x232c35,black=0x101820,silver=0xbfc7ce;
function part(g:THREE.Group,size:XYZ,pos:XYZ,color:number,rounded=false,screen=false){
 const m=new THREE.Mesh(rounded?softCube:cube,finish(color,screen?'screen':'metal'));m.scale.set(...size);m.position.set(...pos);m.receiveShadow=true;g.add(m);return m;
}
function round(g:THREE.Group,size:XYZ,pos:XYZ,color:number){
 const m=new THREE.Mesh(drum,finish(color,'metal'));m.scale.set(...size);m.position.set(...pos);g.add(m);return m;
}
function display(g:THREE.Group,w:number,h:number,x:number,y:number,z:number,angle=0,tint=0x577f9c){
 const anchor=new THREE.Group();anchor.name='Electronics display';anchor.position.set(x,y,z);anchor.rotation.x=angle;anchor.scale.set(w,h,1);
 const still=new THREE.Mesh(plane,finish(tint,'screen'));still.name='Display glass';anchor.add(still);
 // Small static wallpaper, shared with showroom when powered off/idle.
 const line=new THREE.Mesh(plane,finish(0x98c5d8,'screen'));line.position.set(-.17,.17,.001);line.scale.set(.48,.018,1);anchor.add(line);
 g.add(anchor);return anchor;
}
export function buildElectronicsModel(id:ElectronicsId):THREE.Group{
 const model=ELECTRONICS[id],g=new THREE.Group();g.name='Device '+id;g.userData.electronicsId=id;
 if(model.kind==='coffee'){
   const basic=id==='coffeeBasic',mid=id==='coffeeCapsule',premium=id==='coffeePremium',starter=id==='coffeeStart';
   const w=premium?.39:mid?.34:.30,h=premium?.40:mid?.36:basic?.34:.31;
   const shell=premium?0x292d32:mid?0x78988c:basic?0xb9bfc2:0x40494e;
   part(g,[w,.035,.33],[0,.0175,0],dark,true);
   part(g,[w,h-.035,.16],[0,(h+.035)/2,-.085],shell,true);
   part(g,[w,.105,.22],[0,h-.0525,.022],shell,true);
   part(g,[w-.018,.025,.15],[0,.046,.085],silver,true);
   for(let i=0;i<5;i++)part(g,[w*.72,.003,.007],[0,.060,.034+i*.022],dark);
   part(g,[.085,.035,.071],[0,h-.113,.080],black,true);
   for(const x of [-.026,.026])round(g,[.012,.035,.012],[x,h-.135,.096],silver);
   if(basic){part(g,[.105,.025,.035],[.075,h-.118,.128],dark,true);const wand=part(g,[.015,.13,.015],[-.118,.147,.09],silver,true);wand.rotation.z=-.19;}
   if(mid){part(g,[.075,.04,.035],[0,h-.005,-.01],dark,true);part(g,[.06,.015,.12],[0,h-.018,.055],silver,true);}
   if(premium){part(g,[.095,.20,.13],[.137,.146,.055],0xe6e1d3,true);part(g,[.10,.028,.14],[.137,.26,.055],dark,true);part(g,[.16,.056,.13],[0,h+.025,-.07],0x514238,true);}
   display(g,premium?.16:.095,.043,0,h-.044,.134,0,0x345d55);
   for(const x of [-.10,.10]){const button=round(g,[.023,.012,.023],[x,h-.047,.136],0xc7d5cf);button.rotation.x=Math.PI/2;}
   if(starter){part(g,[.10,.083,.084],[0,.104,.092],0xf2e9d6,true);part(g,[.025,.04,.04],[.06,.104,.092],0xf2e9d6,true);}
 }else if(model.kind==='desktop'){
   const pro=id==='pcPro',creator=id==='pcCreator',office=id==='pcOffice';
   const color=pro?silver:creator?0x414951:dark;
   const w=pro?1.00:creator?.99:office?.91:1.09,h=pro?.62:creator?.61:office?.58:.74;
   const z=-.26,y=.467,thick=pro?.045:creator?.055:.085;
   part(g,[w,h,thick],[0,y,z],color,true);
   display(g,w-.065,h-.065,0,y,z+thick/2+.001,0,pro?0x7486ad:creator?0x627a98:0x4a777f);
   part(g,[.075,.29,.085],[0,.15,z],color,true);
   part(g,[pro?.34:.36,.034,.24],[0,.02,z],color,true);
   // All layouts keep the keyboard in the existing animation's reach.
   part(g,[.67,.032,.18],[0,.027,.34],pro?silver:dark,true);
   for(let row=0;row<3;row++)for(let col=0;col<10;col++)
     part(g,[.052,.008,.033],[(col-4.5)*.061,.047,.294+row*.047],pro?0xe5e6e6:office?0x60785f:0x657480);
   part(g,[.095,.034,.15],[.47,.03,.34],pro?silver:dark,true);
   if(pro){
     part(g,[.28,.14,.25],[.61,.075,-.10],silver,true);
     part(g,[.024,.008,.02],[.51,.148,-.10],0x575f64);
     for(let i=0;i<5;i++)part(g,[.030,.016,.008],[.50+i*.048,.06,.029],dark,true);
   }else if(creator||office){
     const x=.60,body=creator?.36:.30;
     part(g,[.24,body,.32],[x,body/2,-.11],color,true);
     part(g,[.195,body-.05,.016],[x,body/2,.057],black,true);
     if(creator)for(let i=0;i<3;i++){
       const fan=round(g,[.070,.012,.070],[x,.075+i*.100,.071],0x73899a);fan.rotation.x=Math.PI/2;
       const hub=round(g,[.024,.015,.024],[x,.075+i*.100,.084],dark);hub.rotation.x=Math.PI/2;
     }else{
       part(g,[.016,.23,.007],[x-.073,.15,.069],0x64bf55);
       for(let i=0;i<5;i++)part(g,[.10,.009,.009],[x+.017,.075+i*.028,.069],0x55656a);
     }
     part(g,[.041,.012,.025],[x,body-.023,.061],0x85c7a8);
   }
 }else if(model.kind==='laptop'){
   const pro=id==='laptopPro',air=id==='laptopPlus',neo=id==='laptopAir';
   const color=pro?0x48505a:air?0xc7cdd5:neo?0xa9c4c9:0x424c55;
   const w=pro?.60:air?.56:neo?.54:.55,h=pro?.38:air?.35:neo?.33:.35;
   const depth=.37,thick=pro?.036:air?.022:.03;
   part(g,[w,thick,depth],[0,thick/2,.13],color,true);
   part(g,[w-.085,.006,.150],[0,thick+.005,.065],dark,true);
   for(let r=0;r<4;r++)for(let c=0;c<9;c++)
     part(g,[.041,.007,.027],[(c-4)*.047,thick+.011,.008+r*.035],pro?0x858d95:0xb7c1c5);
   part(g,[.17,.004,.076],[0,thick+.003,.235],pro?0x646e79:0x929fa6,true);
   const lid=part(g,[w,h,pro?.032:.024],[0,.165,-.055],color,true);lid.rotation.x=-.20;
   display(g,w-.045,h-.047,0,.165,-.035,-.20,pro?0x7187b5:air?0x96b0cf:neo?0x6d9e9f:0x63858c);
   const cam=part(g,[.035,.011,.008],[0,.165+(h-.047)/2-.005,-.015],black,true);cam.rotation.x=-.20;
   part(g,[.016,.007,.04],[w/2-.01,.014,.17],black);
 }else if(model.kind==='tv'){
   const hd=id==='tvHD',oled=id==='tvOLED',four=id==='tv4k';
   const w=hd?1.33:four?1.67:oled?1.87:1.82,h=w*9/16,thick=oled?.037:four?.055:.074;
   const y=.18+h/2,z=-.045;
   part(g,[w,h,thick],[0,y,z],oled?0x161e26:dark,true);
   display(g,w-(oled?.040:.075),h-(oled?.040:.075),0,y,z+thick/2+.001,0,oled?0x324961:0x587a8e);
   if(oled){
     part(g,[.72,.033,.30],[0,.02,z+.05],0x535c64,true);
     part(g,[.22,.16,.10],[0,.10,z],0x535c64,true);
   }else for(const side of [-1,1]){
     const foot=part(g,[.065,.16,.24],[side*w*.35,.085,z+.035],dark,true);foot.rotation.z=side*.17;
   }
   part(g,[.025,.012,.01],[w*.43,.184,z+thick/2+.007],0x78b9a2);
 }else{
   const pro=id==='phonePro',plus=id==='phonePlus',lite=id==='phoneLite';
   const w=pro?.079:plus?.076:.073,h=pro?.151:plus?.147:.142;
   part(g,[w,.016,h],[0,.009,0],pro?0x536173:plus?0x9bb3b6:lite?0x3c566b:dark,true);
   part(g,[w-.009,.002,h-.010],[0,.018,0],0x21364e,true,true);
   for(let i=0;i<4;i++)part(g,[w-.025,.0015,.019],[0,.020,-.042+i*.026],i%2?0xe0d3b5:0x7197c1,true,true);
   for(let i=0;i<(pro?3:plus?2:1);i++)part(g,[.013,.005,.013],[-w*.25+(i%2)*.019,.001,-h*.30+Math.floor(i/2)*.018],black,true);
 }
 batchRigidParts(g,true);
 return g;
}
export function electronicsDisplay(g:THREE.Group):THREE.Group|undefined{return g.getObjectByName('Electronics display') as THREE.Group|undefined;}
export const electronicsIds=(kind:ElectronicsKind)=>(Object.keys(ELECTRONICS) as ElectronicsId[]).filter(id=>ELECTRONICS[id].kind===kind);
export function electronicsVariants(kind:ElectronicsKind){
 const group=new THREE.Group(),models=new Map<ElectronicsId,THREE.Group>();
 for(const id of electronicsIds(kind)){const model=buildElectronicsModel(id);model.visible=false;group.add(model);models.set(id,model);}
 return {group,models,select(id:ElectronicsId){for(const [key,m] of models)m.visible=key===id;return models.get(id)!;}};
}
