import * as THREE from 'three';
import { FURNITURE_BY_ID,FURNITURE_FINISHES,type FurnitureFinish } from '../shared/furniture';
import { cube,softCube,orb,drum,finish,batchRigidParts } from './ArtKit';

// Deliberately authored visual identities, shared by product photos and world.
// Components are simple reusable low-poly geometry, not textures or extra draw loops.
type Surface='wood'|'fabric'|'ceramic'|'metal';
export function distinctiveFurniture(sku:string,finishId:FurnitureFinish):THREE.Group|null {
  const item=FURNITURE_BY_ID.get(sku);
  if(!item)return null;
  const finishColor=FURNITURE_FINISHES[finishId];
  const {main:M,light:L,dark:D,fabric:F}=finishColor;
  const w=item.width,d=item.depth,h=item.height;
  const root=new THREE.Group();
  const box=(width:number,height:number,depth:number,x:number,y:number,z:number,
    color=M,surface:Surface='wood',soft=false)=>{
    const mesh=new THREE.Mesh(soft?softCube:cube,finish(color,surface));
    mesh.scale.set(Math.max(width,.004),Math.max(height,.004),Math.max(depth,.004));
    mesh.position.set(x,y,z);mesh.receiveShadow=true;root.add(mesh);
    return mesh;
  };
  const ball=(rx:number,ry:number,rz:number,x:number,y:number,z:number,
    color=F,surface:Surface='fabric')=>{
    const mesh=new THREE.Mesh(orb,finish(color,surface));
    mesh.scale.set(rx,ry,rz);mesh.position.set(x,y,z);
    mesh.receiveShadow=true;root.add(mesh);return mesh;
  };
  const cyl=(rx:number,height:number,rz:number,x:number,y:number,z:number,
    color=M,surface:Surface='wood')=>{
    const mesh=new THREE.Mesh(drum,finish(color,surface));
    mesh.scale.set(rx,height,rz);mesh.position.set(x,y,z);root.add(mesh);return mesh;
  };
  const rod=(a:[number,number,number],b:[number,number,number],
    radius=.025,color=D,surface:Surface='metal')=>{
    const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b);
    const mid=p.clone().add(q).multiplyScalar(.5);
    const delta=q.clone().sub(p);
    const mesh=new THREE.Mesh(drum,finish(color,surface));
    mesh.scale.set(radius,delta.length(),radius);
    mesh.position.copy(mid);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
    root.add(mesh);return mesh;
  };
  const line=(x1:number,y1:number,z1:number,x2:number,y2:number,z2:number,
    radius=.025,color=D,surface:Surface='metal')=>rod([x1,y1,z1],[x2,y2,z2],radius,color,surface);
  const feet=(height:number,edge=.11,r=.06,color=D)=>{
    for(const x of [-w/2+edge,w/2-edge])
      for(const z of [-d/2+edge,d/2-edge])
        box(r,height,r,x,height/2,z,color);
  };
  const rail=(y:number,atZ=-d*.42,width=w*.88,color=D)=>{
    box(width,.025,.03,0,y,atZ,color);
  };
  const dot=(x:number,y:number,z:number,r=.014,color=D)=>
    ball(r,r,r,x,y,z,color,'metal');
  const s=sku;

  if(s==='leisure-chess'||s==='leisure-board'){
    const chess=s==='leisure-chess';
    box(.98,.095,.81,0,.945,0,M,'wood',true);
    box(.12,.83,.12,0,.44,0,D,'metal');
    box(.62,.075,.48,0,.05,0,D,'wood',true);
    for(const z of [-.65,.65]){
      box(.51,.09,.37,0,.485,z,F,'fabric',true);
      for(const x of [-.19,.19])for(const dz of [-.12,.12])box(.045,.45,.045,x,.225,z+dz,D,'metal');
      box(.48,.31,.07,0,.72,z+Math.sign(z)*.15,M,'wood',true);
    }
    if(chess){
      for(let i=0;i<8;i++)for(let j=0;j<8;j++){
        const x=(i-3.5)*.077,z=(j-3.5)*.077;
        box(.077,.008,.077,x,.995,z,(i+j)%2?0x79563b:0xead0ab);
        if(j<2||j>5){
          const color=j<2?0x322e2a:0xe9e5da;
          const hh=j===1||j===6?.045:.07;
          cyl(.023,hh,.023,x,1+hh*.5,z,color,'ceramic');
          ball(.020,.020,.020,x,1+hh,z,color,'ceramic');
        }
      }
    }else{
      box(.64,.018,.48,0,1.001,0,0x668d70,'fabric');
      for(let i=0;i<6;i++)for(let j=0;j<4;j++)box(.075,.009,.071,(i-2.5)*.098,1.013,(j-1.5)*.10,(i+j)%3===0?0xf4c975:0xe3dec6);
      for(let i=0;i<4;i++)cyl(.022,.038,.022,-.19+i*.115,1.035,.11,[0xb14b49,0x426a9f,0xddbd53,0x526f44][i],'ceramic');
      box(.055,.055,.055,.10,1.043,-.11,0xf4eee1,'ceramic',true);
      box(.055,.055,.055,.17,1.043,-.16,0xf4eee1,'ceramic',true);
    }
    return root;
  }
  if(s==='leisure-darts'){
    box(w*.85,.10,d*.85,0,.05,0,D,'metal',true);
    line(0,.12,0,0,h*.88,0,.055,D);
    const board=cyl(.345,.07,.345,0,h-.35,.07,0x413530,'wood');board.rotation.x=Math.PI/2;
    for(let i=0;i<20;i++){
      const a=i*Math.PI/10;
      const wedge=new THREE.Shape();wedge.moveTo(0,0);wedge.absarc(0,0,.304,a,a+Math.PI/10,false);wedge.lineTo(0,0);
      const g=new THREE.ShapeGeometry(wedge,3),mesh=new THREE.Mesh(g,finish(i%2?0x252b2a:0xe7dcc0,'fabric'));
      mesh.position.set(0,h-.35,.11);root.add(mesh);
    }
    for(const [r,c] of [[.024,0xb72d34],[.049,0x63865e],[.147,0xb72d34],[.283,0x63865e]] as const){
      const ring=new THREE.Mesh(new THREE.RingGeometry(r-.011,r,32),finish(c,'fabric'));ring.position.set(0,h-.35,.116);root.add(ring);
    }
    box(.58,.055,.17,0,h-.79,.13,M);
    for(const x of [-.17,0,.17]){line(x,h-.77,.14,x,h-.61,.14,.012,0xb8bec1);box(.052,.055,.025,x,h-.61,.14,0xb74b42);}
    return root;
  }
  if(s==='leisure-tennis'){
    box(w*.98,.075,d*.98,0,.76,0,0x245a88,'wood',true);
    feet(.71,.17,.075,D);
    for(const side of [-1,1]){
      box(.025,.012,d*.96,side*w*.46,.803,0,0xf1eee1);
      box(w*.94,.012,.025,0,.803,side*d*.46,0xf1eee1);
      line(side*w*.49,.78,0,side*w*.49,.94,0,.019,D);
    }
    box(.018,.010,d*.95,0,.803,0,0xf1eee1);
    for(let i=0;i<17;i++)box(.016,.135,.012,(i-8)*w/17,.865,0,0xe4e4db,'fabric');
    for(const y of [.807,.858,.928])box(w*.94,.012,.014,0,y,0,0xe4e4db,'fabric');
    for(const side of [-1,1]){
      ball(.084,.018,.102,side*.39,.831,side*.84,side<0?0xb63836:0x313333,'ceramic');
      box(.045,.035,.14,side*.39,.825,side*.98,M,'wood',true);
    }
    ball(.020,.020,.020,.16,.83,.25,0xf0eee4,'ceramic');
    return root;
  }
  if(s==='leisure-billiards'){
    box(w*.98,.19,d*.98,0,.70,0,D,'wood',true);
    feet(.61,.22,.16,D);
    box(w*.82,.045,d*.86,0,.815,0,0x326849,'fabric',true);
    for(const side of [-1,1]){
      box(.085,.10,d*.91,side*w*.46,.86,0,M,'wood',true);
      box(w*.89,.10,.10,0,.86,side*d*.46,M,'wood',true);
      for(const z of [-d*.43,0,d*.43])cyl(.063,.012,.063,side*w*.414,.887,z,0x161c1b,'fabric');
    }
    const colors=[0xe6bd3c,0x194d9b,0xb93632,0x76378b,0xe68a25,0x386e43,0x8f352f,0x242622];
    for(let row=0;row<4;row++)for(let i=0;i<=row;i++)ball(.030,.030,.030,(i-row/2)*.061,.87,-.45-row*.053,colors[(row+i)%colors.length],'ceramic');
    ball(.030,.030,.030,0,.87,.50,0xf8f4e5,'ceramic');
    line(-w*.34,.892,-.90,-w*.34,.892,.91,.012,0xd0a471,'wood');
    line(-w*.28,.892,-.92,-w*.28,.892,.85,.012,0xa4754d,'wood');
    return root;
  }
  if(s==='leisure-swing'){
    for(const x of [-w*.44,w*.44]){
      for(const z of [-d*.43,d*.43])line(x,.03,z,x,h-.14,0,.047,D,'metal');
      line(x,.13,-d*.43,x,.13,d*.43,.035,D);
    }
    line(-w*.45,h-.13,0,w*.45,h-.13,0,.046,D);
    box(w*.96,.045,d*.77,0,h-.045,0,F,'fabric',true);
    const pivot=new THREE.Group();pivot.name='Leisure swing pivot';pivot.position.y=h-.13;root.add(pivot);
    const add=(m:THREE.Mesh)=>{root.remove(m);m.position.y-=pivot.position.y;pivot.add(m);};
    for(const x of [-.83,.83]){
      add(line(x,h-.13,0,x,.49,-.16,.018,D));
      add(line(x,h-.13,0,x,.49,.16,.018,D));
    }
    add(box(1.87,.13,.59,0,.49,0,M,'wood',true));
    add(box(1.80,.085,.50,0,.565,0,F,'fabric',true));
    add(box(1.86,.49,.09,0,.82,-.25,M,'wood',true));
    add(box(1.78,.38,.085,0,.83,-.18,F,'fabric',true));
    batchRigidParts(pivot,true);
    return root;
  }
  if(s==='leisure-hammock'){
    for(const side of [-1,1]){
      line(side*w*.46,.08,-d*.40,side*w*.46,.08,d*.40,.048,D,'metal');
      line(side*w*.36,.10,0,side*w*.46,h-.09,0,.055,D,'metal');
      line(side*w*.46,h-.09,0,side*w*.31,.78,0,.019,L,'fabric');
    }
    line(-w*.42,.075,0,w*.42,.075,0,.045,D,'metal');
    const pos:number[]=[],idx:number[]=[];
    for(let i=0;i<=20;i++){
      const t=i/20,x=(t-.5)*w*.70;
      for(let j=0;j<=10;j++){
        const q=j/10-.5,z=q*d*.76*(.80+.20*Math.sin(t*Math.PI));
        pos.push(x,.47+.37*(2*t-1)**2+.13*(2*q)**2,z);
      }
    }
    for(let i=0;i<20;i++)for(let j=0;j<10;j++){const k=i*11+j;idx.push(k,k+11,k+1,k+1,k+11,k+12);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
    const cloth=finish(F,'fabric').clone();cloth.side=THREE.DoubleSide;
    root.add(new THREE.Mesh(g,cloth));
    for(const side of [-1,1])line(side*w*.35,.86,-d*.31,side*w*.35,.86,d*.31,.031,M,'wood');
    return root;
  }

  // Pet accessories have the EXACT same lightweight model in catalogue cards,
  // placement preview and the installed house. They are not reskinned rugs.
  if(s==='pet-bed-verdell'||s==='pet-bed-simba'){
    const cat=s==='pet-bed-simba';
    box(w*.96,.032,d*.95,0,.023,0,D,'fabric',true);
    ball(w*.42,.063,d*.38,0,.075,0,F);
    for(const side of [-1,1]){
      ball(w*.11,.075,d*.35,side*w*.39,.079,0,cat?M:L);
      ball(w*.35,.071,d*.12,0,.079,side*d*.37,cat?M:L);
    }
    for(const x of [-.07,.07])for(const z of [-.045,.045])
      ball(.020,.004,.018,x,.137,z,D);
    ball(.035,.005,.028,0,.138,.075,D);
    return root;
  }
  if(s==='pet-house-starter'){
    box(w*.96,.06,d*.95,0,.035,0,0x92785e,'wood',true);
    box(w*.82,.08,d*.78,0,.11,-.015,0xc4a889,'fabric',true);
    for(const side of [-1,1]){
      box(.10,h-.17,d*.92,side*(w*.43),.08+(h-.17)/2,-.02,0x7d9582,'fabric',true);
      box(.025,.025,d*.80,side*w*.45,.19,-.02,0xe3d4ba,'fabric');
    }
    box(w*.86,h-.17,.10,0,.08+(h-.17)/2,-d*.43,0x7d9582,'fabric',true);
    box(w*.94,.08,d*.96,0,h-.105,0,0x69816e,'fabric',true);
    box(w*.82,.052,d*.79,0,h-.039,0,0xd7c4a5,'fabric',true);
    box(.28,.065,.012,0,h-.108,d*.49,0xd7c4a5,'fabric');
    for(const x of [-.045,0,.045])ball(.017,.016,.009,x,h-.105,d*.50,0x866747);
    return root;
  }
  if(s==='pet-scratcher-starter'){
    cyl(w*.46,.072,d*.46,0,.041,0,0x87684b,'wood');
    cyl(.092,h-.16,.092,0,(h-.16)/2+.075,0,0xc6aa7b,'fabric');
    for(let i=0;i<12;i++)cyl(.098,.013,.098,0,.12+i*.048,0,i%2?0xd1b78a:0xae9167,'fabric');
    cyl(.106,.045,.106,0,h-.037,0,0x977451,'wood');
    return root;
  }
  if(s.startsWith('pet-house-')){
    const tower=s==='pet-house-tower',soft=s==='pet-house-soft';
    const cw=tower?1.08:w*.95, cx=tower?-.37:0;
    const roof=tower?.79:h-(soft?.14:.065);
    const wall=soft?.12:.075;
    box(w*.98,.07,d*.97,0,.036,0,D,'wood',true);
    box(cw-wall*2,.08,d*.78,cx,.11,-.015,F,'fabric',true);
    for(const side of [-1,1]){
      box(wall,roof-.09,d*.87,cx+side*(cw/2-wall/2),(roof+.09)/2,-.03,soft?M:L,soft?'fabric':'wood',soft);
    }
    box(cw,roof-.09,wall,cx,(roof+.09)/2,-d*.44,soft?M:L,soft?'fabric':'wood',soft);
    box(cw,.075,d*.93,cx,roof-.0375,-.015,soft?M:D,soft?'fabric':'wood',soft);
    if(!tower){
      box(cw*.86,.052,d*.81,cx,roof+.026,-.02,F,'fabric',true);
      if(soft){
        for(const side of [-1,1])box(.08,.09,d*.82,side*cw*.43,roof+.045,-.015,M,'fabric',true);
        box(cw*.85,.09,.08,cx,roof+.045,-d*.41,M,'fabric',true);
      }else{
        for(const side of [-1,1])box(.035,.09,d*.85,side*cw*.44,roof-.1,-.02,D);
        box(cw*.65,.055,.035,cx,.22,-d*.435,D);
      }
    }else{
      const px=.48;
      cyl(.115,1.10,.115,px,.62,.06,0xb59a70,'fabric');
      for(let i=0;i<12;i++){
        const y=.13+i*.076,a=i*1.2;
        line(px+Math.cos(a)*.12,y,.06+Math.sin(a)*.12,
          px+Math.cos(a+1.2)*.12,y+.04,.06+Math.sin(a+1.2)*.12,.012,0xe1caa4,'fabric');
      }
      box(1.06,.08,.97,cx,1.255,-.035,M,'wood',true);
      box(.95,.05,.85,cx,1.315,-.035,F,'fabric',true);
      for(const x of [cx-.44,cx+.44])box(.055,.47,.055,x,1.015,-.43,D);
      line(.62,1.12,.10,.71,.92,.19,.009,D);ball(.045,.045,.045,.71,.88,.19,0xd58f78);
    }
    return root;
  }
  if(s==='pet-scratcher-simba'){
    box(w*.94,.075,d*.94,0,.041,0,D,'wood',true);
    cyl(.105,h*.73,.105,0,h*.43,0,0xb59a70,'fabric');
    for(let i=0;i<9;i++){
      const yy=h*(.13+i*.073),a=i*1.1;
      line(Math.cos(a)*.113,yy,Math.sin(a)*.113,
        Math.cos(a+1.1)*.113,yy+h*.045,Math.sin(a+1.1)*.113,
        .014,0xdfc8a0,'fabric');
    }
    box(w*.68,.058,d*.69,0,h*.84,0,M,'fabric',true);
    ball(w*.27,.027,d*.27,0,h*.90,0,F);
    line(w*.22,h*.85,d*.22,w*.28,h*.62,d*.26,.009,D);
    ball(.047,.051,.047,w*.28,h*.57,d*.26,0xd58f78);
    return root;
  }
  // ----------------------------- UPHOLSTERY -----------------------------
  if(item.shape==='sofa'||item.shape==='corner'||item.shape==='armchair'){
    const chair=item.shape==='armchair',chaise=item.shape==='corner';
    const futon=s==='sofa-futon',mod=s==='sofa-modular',chester=s==='sofa-chester';
    const nest=s==='chair-nest',cloud=s==='chair-cloud',wicker=s==='chair-wicker',wing=s==='chair-wing';
    const compact=s==='sofa-micro';
    if(wicker){
      // Ring-shaped open rattan chair, slatted back, thin airy frame.
      cyl(w*.38,.065,d*.35,0,h*.45,0,F,'fabric');
      for(const x of [-w*.31,w*.31])
        for(const z of [-d*.27,d*.27])line(x,0,z,x,h*.47,z,.025,M,'wood');
      const top=ball(w*.38,h*.31,d*.10,0,h*.71,-d*.31,M,'wood');
      top.rotation.x=.10;
      for(let i=-4;i<=4;i++){
        line(i*w*.073,h*.51,-d*.36,i*w*.073,h*.94,-d*.34,.012,D,'wood');
      }
      for(const side of [-1,1])
        line(side*w*.34,h*.51,-d*.30,side*w*.40,h*.56,d*.18,.025,M,'wood');
      ball(w*.31,h*.085,d*.27,0,h*.54,d*.04,F);
    }else if(wing){
      box(w*.79,h*.15,d*.80,0,h*.39,0,D,'wood',true);
      ball(w*.37,h*.14,d*.31,0,h*.53,d*.09,F);
      box(w*.73,h*.69,d*.14,0,h*.72,-d*.37,F,'fabric',true);
      for(const side of [-1,1]){
        const wings=box(w*.18,h*.49,d*.20,side*w*.36,h*.77,-d*.30,M,'fabric',true);
        wings.rotation.y=side*.36;
        box(w*.15,h*.28,d*.65,side*w*.42,h*.58,d*.09,F,'fabric',true);
      }
      feet(h*.22,.18,.07);
      for(const yy of [.64,.78,.89])for(const xx of [-.18,0,.18])
        dot(xx*w,yy*h,-d*.291,.014,D);
    }else if(nest){
      ball(w*.43,h*.29,d*.41,0,h*.58,0,M);
      ball(w*.33,h*.20,d*.32,0,h*.60,d*.09,L);
      ball(w*.39,h*.38,d*.12,0,h*.75,-d*.27,M);
      for(const side of [-1,1])ball(w*.13,h*.28,d*.28,side*w*.36,h*.63,d*.02,M);
      // Upholstered support bridges the round shell to all four legs.
      box(w*.77,h*.16,d*.70,0,h*.36,0,M,'fabric',true);
      feet(h*.28,.18,.052);
    }else if(cloud){
      ball(w*.47,h*.21,d*.40,0,h*.42,0,F);
      ball(w*.40,h*.15,d*.33,0,h*.59,d*.09,L);
      ball(w*.41,h*.33,d*.16,0,h*.73,-d*.27,F);
      for(const x of [-w*.38,w*.38])ball(w*.13,h*.23,d*.35,x,h*.60,0,L);
      box(w*.67,h*.09,d*.65,0,h*.16,0,D,'wood',true);
    }else if(futon){
      // Visible wooden structure and a tilted back: not another box sofa.
      box(w*.96,h*.08,d*.92,0,h*.26,0,M);
      for(let i=0;i<9;i++)box(w*.88,h*.025,d*.055,0,h*.32,-d*.41+i*d*.10,L);
      box(w*.91,h*.11,d*.73,0,h*.43,d*.045,F,'fabric',true);
      const back=box(w*.94,h*.34,d*.10,0,h*.66,-d*.35,F,'fabric',true);back.rotation.x=-.26;
      feet(h*.24,.09,.055);
      for(const x of [-w*.46,w*.46])
        line(x,h*.23,-d*.40,x,h*.72,-d*.41,.043,D,'wood');
    }else{
      const baseY=mod?h*.21:h*.30;
      box(w*.94,h*(mod?.31:.27),d*.90,0,baseY,0,M,'fabric',true);
      if(!mod)feet(h*.14,.15,.055);
      const arms=compact?w*.15:chester?w*.13:mod?w*.08:w*.11;
      const seatCount=chair?1:compact?1:w>2.4?3:2;
      const seatW=(w-arms*2)*.91/seatCount;
      const seatZ=chaise?-.045:d*.065;
      for(let i=0;i<seatCount;i++){
        const x=(i-(seatCount-1)/2)*seatW;
        box(seatW*.96,h*.16,d*(mod?.73:.64),x,h*.51,seatZ,F,'fabric',true);
        if(!mod||chester)
          box(seatW*.91,h*(chester?.40:.33),d*.12,x,h*.71,-d*.38,
            chester?M:(s==='sofa-nord'?F:L),'fabric',true);
      }
      if(mod){
        box(w*.99,h*.36,d*.17,0,h*.54,-d*.42,D,'fabric',true);
        box(w*.42,h*.25,d*.64,w*.25,h*.34,d*.36,F,'fabric',true);
        box(w*.40,h*.12,d*.55,w*.25,h*.53,d*.37,L,'fabric',true);
      }else if(chaise){
        box(w*.41,h*.27,d*.64,w*.27,h*.37,d*.29,M,'fabric',true);
        box(w*.39,h*.13,d*.60,w*.27,h*.54,d*.29,F,'fabric',true);
        box(w*.08,h*.31,d*.50,w*.45,h*.56,d*.19,L,'fabric',true);
      }else{
        if(chester){
          for(const side of [-1,1]){
            const arm=cyl(w*.11,d*.83,d*.12,side*(w*.50-w*.11),h*.67,0,M,'fabric');
            arm.rotation.x=Math.PI/2;
            for(const z of [-d*.24,d*.04,d*.32])
              dot(side*(w*.50-w*.11),h*.75,z,.015,L);
          }
          for(const x of [-w*.30,-w*.15,0,w*.15,w*.30])
            for(const y of [h*.68,h*.82])dot(x,y,-d*.313,.014,D);
        }else for(const side of [-1,1]){
          box(arms,h*(mod?.33:.42),d*.82,
            side*(w/2-arms*.52),h*.57,0,
            compact?F:M,'fabric',true);
        }
      }
      if(compact){
        ball(w*.23,h*.11,d*.26,0,h*.57,d*.09,L);
        ball(w*.38,h*.16,d*.11,0,h*.77,-d*.29,M);
      }
      if(s==='sofa-luna'){
        for(const x of [-w*.20,w*.20])ball(w*.085,h*.10,d*.065,x,h*.82,-d*.23,L);
      }
      if(s==='sofa-nord'){
        box(w*.89,h*.10,d*.91,0,h*.18,0,D,'wood',true);
        for(const x of [-w*.30,0,w*.30]){
          ball(w*.105,h*.095,d*.068,x,h*.82,-d*.27,F);
          box(w*.20,h*.025,d*.055,x,h*.71,-d*.44,D,'fabric');
        }
      }

    }
    return root;
  }
  if(item.shape==='ottoman'){
    if(s==='pouf-drum'){
      cyl(w*.46,h*.74,d*.46,0,h*.52,0,F,'fabric');
      cyl(w*.46,h*.045,d*.46,0,h*.92,0,M,'fabric');
      for(let i=0;i<12;i++){
        const a=i*Math.PI/6;
        line(Math.sin(a)*w*.458,h*.22,Math.cos(a)*d*.458,
          Math.sin(a)*w*.458,h*.84,Math.cos(a)*d*.458,.008,D,'fabric');
      }
    }else{
      ball(w*.46,h*.34,d*.46,0,h*.60,0,F);
      box(w*.81,h*.15,d*.81,0,h*.18,0,M,'wood',true);
      feet(h*.15,.11,.045);
      dot(0,h*.91,0,.018,L);
    }
    return root;
  }
  if(item.shape==='bench'){
    box(w*.94,h*.13,d*.94,0,h*.82,0,F,'fabric',true);
    for(const x of [-w*.41,w*.41]){
      box(w*.07,h*.73,d*.06,x,h*.39,0,M);
      line(x,h*.46,-d*.38,x,h*.46,d*.38,.028,D,'wood');
    }
    return root;
  }
  // ------------------------------ BEDROOM ------------------------------
  if(item.shape==='bed'||item.shape==='daybed'){
    const canopy=s==='bed-canopy',platform=s==='bed-platform',rattan=s==='bed-rattan';
    const storage=s==='bed-storage',metal=s==='daybed-iron';
    const day=s==='bed-day'||metal,aurora=s==='bed-aurora',lineBed=s==='bed-line';
    const mattress=canopy?.48:platform?.30:day?.40:.42;
    const base=mattress-.13;
    if(platform){
      box(w*.99,.13,d*.98,0,.16,0,M,'wood',true);
      box(w*.79,.18,d*.75,0,.14,0,D,'wood');
    }else{
      box(w*.96,.17,d*.96,0,base,0,M,'wood',true);
      if(!day&&s!=='bed-solo')feet(.10,.11,.057);
    }
    box(w*.90,.15,d*.87,0,mattress,0,0xf0ece2,'fabric',true);
    box(w*.87,.047,d*.58,0,mattress+.09,d*.19,F,'fabric',true);
    const pillows=w>1.45?2:1;
    for(let i=0;i<pillows;i++){
      const x=(i-(pillows-1)/2)*w*.43;
      box((w*.69)/pillows,.075,d*.16,x,mattress+.12,-d*.34,L,'fabric',true);
    }
    if(canopy){
      for(const x of [-w*.46,w*.46])for(const z of [-d*.46,d*.46])
        box(.07,h*.98,.07,x,h*.50,z,M,'wood');
      for(const z of [-d*.46,d*.46])
        box(w*.96,.065,.065,0,h*.94,z,M,'wood');
      for(const x of [-w*.46,w*.46])
        box(.065,.065,d*.92,x,h*.94,0,M,'wood');
      box(w*.90,.10,.08,0,h*.68,-d*.45,F,'fabric',true);
    }else if(rattan){
      box(w*.97,.73,.082,0,.66,-d*.45,M,'wood',true);
      for(let i=-6;i<=6;i++){
        const x=i*w*.066;
        line(x,.40,-d*.39,x,1.0-.1*Math.abs(i)/6,-d*.39,.012,D,'wood');
      }
      for(const yy of [.43,.50,.58,.66,.74,.82,.90])
        box(w*.79,.012,.025,0,yy,-d*.39,L);
    }else if(aurora){
      const backH=Math.min(h*.87,.80);
      box(w*.99,backH,.13,0,backH/2+.05,-d*.44,F,'fabric',true);
      for(const x of [-w*.31,-w*.1,w*.1,w*.31]){
        box(w*.18,backH*.78,.035,x,backH*.54,-d*.36,L,'fabric',true);
        for(const y of [backH*.40,backH*.63])dot(x,y,-d*.332,.016,D);
      }
    }else if(lineBed){
      for(const y of [.40,.52,.64])
        box(w*.97,.07,.07,0,y,-d*.43,M,'wood',true);
      for(const x of [-w*.44,w*.44])
        box(.06,.72,.07,x,.39,-d*.43,D);
    }else if(storage){
      box(w*.99,.48,d*.97,0,.29,0,M,'wood',true);
      for(const side of [-1,1]){
        for(let i=0;i<2;i++){
          const z=(i-.5)*d*.39;
          box(.025,.23,d*.32,side*w*.49,.25,z,L);
          dot(side*w*.52,.28,z,.022,D);
        }
      }
      box(w*.94,.60,.08,0,.58,-d*.45,D,'wood',true);
    }else if(platform){
      box(w*.79,.22,.07,0,.35,-d*.43,L,'wood',true);
    }else if(metal){
      for(const x of [-w*.47,w*.47]){
        line(x,.12,-d*.43,x,.88,-d*.43,.024,D);
        line(x,.12,d*.43,x,.76,d*.43,.024,D);
      }
      for(const z of [-d*.43,d*.43]){
        line(-w*.47,.82,z,w*.47,.82,z,.025,D);
        for(let i=0;i<7;i++){
          const x=(-.39+i*.13)*w;
          line(x,.45,z,x,.82,z,.015,D);
        }
      }
    }else if(day){
      box(w*.92,.45,.11,0,.61,-d*.43,M,'fabric',true);
      for(const x of [-w*.46,w*.46])
        box(w*.09,.38,d*.87,x,.57,0,M,'fabric',true);
    }else{
      // Solo and the other originals each have a different headboard style.
      box(w*.95,.61,.10,0,.49,-d*.44,s==='bed-solo'?M:L,'wood',true);
      box(w*.85,.10,.035,0,.73,-d*.37,D);
    }
    return root;
  }
  // ------------------------------- STORAGE -------------------------------
  if(['wardrobe','dresser','sideboard','nightstand','shelves'].includes(item.shape)){
    const ladder=s==='shelf-ladder',asym=s==='shelf-asym',cubes=s==='shelf-open';
    const shelves=item.shape==='shelves';
    const industrial=s==='dresser-industrial',rattan=s==='dresser-rattan';
    const drawers=item.shape==='dresser'||item.shape==='nightstand';
    const glass=s==='sideboard-glass',open=s==='sideboard';
    if(shelves){
      if(ladder){
        // Tapered shelves and angled side supports, clear triangular silhouette.
        for(const side of [-1,1])
          line(side*w*.47,0,d*.35,side*w*.26,h,-d*.25,.035,M,'wood');
        for(let i=0;i<5;i++){
          const yy=h*(.11+i*.18);
          const scale=1-i*.11;
          box(w*scale,.050,d*.79,0,yy,0,M);
          for(let j=0;j<i%3+1;j++)
            box(.085,.18,.16,-w*scale*.32+j*.16,yy+.11,-d*.13,
              j%2?L:D,'wood');
        }
      }else{
        for(const side of [-1,1])
          box(.058,h*.94,d*.90,side*w*.47,h*.50,0,M);
        for(let i=0;i<5;i++){
          const yy=h*(.09+i*.215);
          box(w*.95,.053,d*.91,0,yy,0,L);
        }
        if(asym||cubes){
          const cuts=asym?[-.22,.18]:[-.18,.16];
          for(let j=0;j<4;j++){
            const x=w*(asym?[-.28,.09,-.12,.28][j]:cuts[j%2]);
            box(.04,h*.185,d*.89,x,h*(.205+j*.215),0,D);
          }
          if(asym){
            for(let j=0;j<4;j++){
              const x=w*(j%2?.25:-.23);
              box(w*.23,.18,d*.29,x,h*(.18+j*.215),0,F,'fabric',true);
            }
          }else for(let j=0;j<5;j++)
            ball(w*.07,.06,d*.13,(j%2?-.30:.28)*w,h*(.17+j*.21),0,F,'ceramic');
        }else{
          for(let row=0;row<4;row++)for(let col=0;col<8;col++){
            const x=(-.39+col*.11)*w;
            const bookH=h*(.11+.023*((row+col)%3));
            box(w*.055,bookH,d*.42,x,h*(row*.215+.09)+bookH*.49,-d*.11,
              [L,D,F,M][(row+col)%4]);
          }
        }
      }
      return root;
    }
    if(industrial){
      // Exposed black structural rack and shallow wood trays.
      for(const x of [-w*.45,w*.45])for(const z of [-d*.42,d*.42])
        box(.045,h*.94,.045,x,h*.50,z,D,'metal');
      for(let i=0;i<3;i++){
        const yy=h*(.22+i*.27);
        box(w*.87,.12,d*.81,0,yy,0,M);
        box(w*.84,.10,.035,0,yy,d*.44,L);
        box(w*.12,.022,.03,0,yy,d*.47,D,'metal');
      }
      for(const side of [-1,1])
        line(side*w*.45,h*.10,-d*.42,side*w*.45,h*.87,d*.42,.022,D,'metal');
      return root;
    }
    if(item.shape==='wardrobe'){
      box(w*.97,h*.87,d*.91,0,h*.53,-d*.01,M,'wood',true);
      const sliding=s==='wardrobe-sliding',vintage=s==='wardrobe-vintage';
      const doors=sliding?2:s==='wardrobe-wide'?3:2;
      for(let i=0;i<doors;i++){
        const dw=w*.91/doors;
        const xx=(i-(doors-1)/2)*dw;
        const mirrored=s==='wardrobe-mirror'&&i===0;
        if(sliding){
          box(dw*1.02,h*.79,.035,xx+(i?-.015:.015),h*.54,d*(i?.475:.50),
            i===0?L:D,'wood',true);
          box(dw*.86,h*.69,.018,xx,h*.54,d*(i?.50:.52),
            i===0?L:0x8a9da0,i===0?'wood':'ceramic');
          box(.019,h*.22,.04,xx+(i===0?dw*.32:-dw*.32),h*.56,d*.54,D,'metal');
        }else{
          box(dw*.96,h*.78,.025,xx,h*.55,d*.465,
            mirrored?0x99bbc4:vintage?L:L,mirrored?'ceramic':'wood',true);
          if(vintage){
            // Antique paneled fronts and carved-looking crown.
            box(dw*.83,h*.34,.027,xx,h*.69,d*.49,M);
            box(dw*.83,h*.23,.027,xx,h*.33,d*.49,M);
            box(dw*.68,h*.29,.023,xx,h*.69,d*.515,L);
            box(dw*.68,h*.17,.023,xx,h*.33,d*.515,L);
          }
          if(mirrored)
            box(dw*.82,h*.69,.017,xx,h*.55,d*.50,0xc0dce0,'ceramic');
          box(.025,h*.12,.038,xx+(i%2?-.28:.28)*dw,h*.52,d*.51,D,'metal');
        }
      }
      if(sliding){
        for(const y of [h*.11,h*.96])box(w*.97,.028,.07,0,y,d*.48,D,'metal');
      }else if(vintage){
        box(w*.99,.055,d*.98,0,h*.982,0,L,'wood',true);
        box(w*.96,.04,d*.93,0,h*.93,0,D);
        feet(h*.12,.10,.085);
      }else{
        box(w*.97,.05,d*.94,0,h*.97,0,L);
        feet(h*.10,.10,.064);
      }
      if(s==='wardrobe-tall')rail(h*.16,d*.48,w*.88,D);
      return root;
    }
    if(glass||open){
      // Recessed open compartment is visible, no flat blocked facade.
      for(const xx of [-w*.47,0,w*.47])box(.05,h*.84,d*.91,xx,h*.52,0,M);
      for(const yy of [h*.13,h*.52,h*.94])box(w*.96,.06,d*.92,0,yy,0,M);
      box(w*.96,h*.80,.025,0,h*.54,-d*.44,D);
      if(glass){
        for(const xx of [-w*.25,w*.25]){
          box(w*.45,h*.73,.023,xx,h*.54,d*.46,L);
          box(w*.36,h*.64,.026,xx,h*.54,d*.49,0x9bced8,'ceramic');
          box(.025,h*.65,.045,xx,h*.54,d*.52,D,'metal');
          dot(xx,h*.54,d*.54,.018,M);
        }
        for(const yy of [h*.36,h*.70])
          box(w*.84,.038,d*.78,0,yy,0,L);
      }else{
        for(const xx of [-w*.27,w*.02]){
          box(w*.22,h*.73,.035,xx,h*.54,d*.47,L);
          dot(xx+w*.09,h*.54,d*.51,.019,D);
        }
        for(const yy of [h*.32,h*.65])
          box(w*.38,.04,d*.72,w*.26,yy,0,L);
      }
      feet(h*.13,.10,.055);
      return root;
    }
    // Drawer family: no two identical face patterns.
    if(drawers){
      const n=item.shape==='nightstand'?2:3;
      box(w*.96,h*.85,d*.94,0,h*.55,0,M,'wood',true);
      box(w,.055,d,0,h*.96,0,L);
      if(rattan)for(const x of [-w*.41,w*.41])
        line(x,.13,-d*.41,x,.85,-d*.41,.03,D,'wood');
      for(let i=0;i<n;i++){
        const y=h*(.25+(i+.5)*.64/n);
        const dy=h*.63/n;
        box(w*.88,dy*.90,.025,0,y,d*.48,rattan?D:L);
        if(rattan){
          for(let xx=-5;xx<=5;xx++)
            box(w*.012,dy*.74,.011,xx*w*.070,y,d*.505,
              xx%2?M:L,'wood');
          box(w*.12,.022,.029,0,y,d*.53,D,'metal');
        }else if(s==='dresser-nora'){
          for(const xx of [-w*.23,w*.23])box(w*.14,.025,.029,xx,y,d*.51,D,'metal');
        }else{
          box(w*.24,.030,.035,0,y,d*.52,D,'metal',true);
        }
      }
      if(s==='dresser-mini')box(w*.90,.05,.06,0,h*.15,d*.46,D);
      if(item.shape==='nightstand')feet(h*.12,.075,.055);
      else feet(h*.12,.11,.065);
      return root;
    }
  }
  // --------------------------- TABLES & CHAIRS ---------------------------
  if(item.shape==='table'||item.shape==='desk'){
    const desk=item.shape==='desk';
    const tabletopY=desk&&h>1.2?.76:h*.91;
    if(s==='table-round'){
      cyl(w*.48,.065,d*.48,0,h*.89,0,M);
      cyl(w*.07,h*.69,d*.07,0,h*.48,0,D);
      cyl(w*.29,.055,d*.29,0,h*.09,0,D);
    }else if(s==='table-oval'){
      cyl(w*.47,.075,d*.47,0,h*.89,0,L);
      for(const x of [-w*.25,w*.25]){
        box(w*.12,h*.72,d*.44,x,h*.40,0,M,'wood',true);
        box(w*.25,.045,d*.53,x,h*.06,0,D);
      }
    }else if(s==='table-coffee'){
      // A natural leaf shape with slim splayed legs.
      const top=ball(w*.46,.042,d*.42,0,h*.80,0,M,'wood');
      top.rotation.y=-.15;
      for(const x of [-w*.30,w*.30])
        for(const z of [-d*.25,d*.25])
          line(x*.92,h*.07,z*.9,x,h*.75,z,.028,D,'wood');
      box(w*.61,.037,d*.43,0,h*.34,0,L);
    }else if(s==='table-industrial'){
      box(w*.99,.09,d*.98,0,h*.90,0,M,'wood',true);
      for(const x of [-w*.39,w*.39]){
        for(const z of [-d*.39,d*.39])
          line(x,0,z,x,h*.81,z,.032,D);
        line(x,0,-d*.39,x,h*.79,d*.39,.027,D);
        line(x,0,d*.39,x,h*.79,-d*.39,.027,D);
      }
    }else if(s==='table-glass'){
      box(w*.98,.041,d*.96,0,h*.92,0,0x9ec8d0,'ceramic',true);
      box(w*.94,.015,d*.04,0,h*.89,d*.43,D,'metal');
      for(const x of [-w*.32,w*.32]){
        line(x,0,-d*.37,-x,h*.87,d*.37,.036,D);
        line(x,0,d*.37,-x,h*.87,-d*.37,.036,D);
      }
    }else if(s==='desk-corner'){
      // Real L-shaped desk: empty notch on viewer side.
      box(w*.96,.079,d*.44,0,.72,-d*.27,M,'wood',true);
      box(w*.41,.079,d*.87,w*.285,.72,d*.01,M,'wood',true);
      for(const x of [-w*.43,w*.43])
        for(const z of [-d*.40])box(.064,.70,.06,x,.35,z,D);
      for(const z of [d*.40])box(.064,.70,.06,w*.43,.35,z,D);
      box(w*.28,.27,d*.40,-w*.25,.55,-d*.27,L);
      for(let i=0;i<2;i++)
        box(w*.23,.07,.025,-w*.25,.52+i*.11,-d*.055,M);
    }else if(s==='desk-hutch'){
      box(w*.96,.072,d*.95,0,.72,0,M,'wood',true);
      for(const x of [-w*.42,w*.42])for(const z of [-d*.37,d*.37])
        box(.07,.68,.07,x,.34,z,D);
      // Tall hutch is part of the same item, but doesn't cover the workspace.
      for(const x of [-w*.42,w*.42])
        box(.055,h*.45,d*.18,x,.78+h*.225,-d*.39,M);
      for(const yy of [1.10,1.36,1.60].filter(y=>y<h))
        box(w*.88,.053,d*.22,0,yy,-d*.39,L);
      box(w*.27,.24,d*.53,w*.27,.54,d*.13,L);
      box(w*.07,.026,.04,w*.27,.59,d*.40,D,'metal');
    }else if(s==='desk-large'){
      box(w,.10,d*.95,0,tabletopY,0,M,'wood',true);
      for(const x of [-w*.43,w*.43])for(const z of [-d*.39,d*.39])
        box(.07,tabletopY-.09,.07,x,(tabletopY-.09)/2,z,D);
      box(w*.30,.39,d*.68,w*.28,tabletopY-.25,0,L);
      for(let i=0;i<3;i++){
        const yy=tabletopY-.39+i*.12;
        box(w*.265,.08,.035,w*.28,yy,d*.36,M);
        box(w*.09,.023,.045,w*.28,yy,d*.39,D,'metal');
      }
      box(w*.27,.053,d*.34,-w*.25,.42,-d*.24,L);
    }else if(s==='desk-simple'){
      box(w*.97,.075,d*.94,0,tabletopY,0,M,'wood',true);
      for(const x of [-w*.43,w*.43])for(const z of [-d*.39,d*.39])
        box(.058,tabletopY-.07,.058,x,(tabletopY-.07)/2,z,D);
      box(w*.43,.043,d*.30,w*.14,tabletopY-.18,-d*.23,L);
      box(w*.07,.14,d*.15,w*.33,tabletopY-.27,d*.10,D);
    }else{
      // Family dining table: strong trestle and long skirt.
      box(w*.99,.085,d*.99,0,h*.91,0,M,'wood',true);
      for(const x of [-w*.43,w*.43])for(const z of [-d*.40,d*.40])
        box(.075,h*.83,.075,x,h*.415,z,D);
      box(w*.75,.055,d*.05,0,h*.47,-d*.33,D);
      box(.05,h*.42,d*.74,0,h*.47,0,D);
    }
    return root;
  }
  if(item.shape==='chair'){
    const industrial=s==='chair-industrial',bistro=s==='chair-bistro',padded=s==='chair-padded';
    const seat=h*.48;
    if(bistro){
      cyl(w*.42,.065,d*.38,0,seat,0,M,'wood');
      for(const x of [-w*.34,w*.34])for(const z of [-d*.32,d*.32])
        line(x,0,z,x,seat,z,.026,D,'wood');
      // Round bistro back with central spindles.
      for(let i=0;i<13;i++){
        const t=Math.PI*i/12;
        const x=Math.cos(t)*w*.39,y=seat+Math.sin(t)*(h-seat);
        if(i>0)line(Math.cos(Math.PI*(i-1)/12)*w*.39,
          seat+Math.sin(Math.PI*(i-1)/12)*(h-seat),-d*.35,
          x,y,-d*.35,.020,M,'wood');
      }
      for(const x of [-w*.22,0,w*.22])
        line(x,seat+.04,-d*.35,x,h*.83,-d*.35,.012,D,'wood');
    }else if(industrial){
      box(w*.90,.055,d*.88,0,seat,0,D,'metal');
      for(const x of [-w*.39,w*.39])for(const z of [-d*.38,d*.38])
        line(x,0,z,x,seat,z,.020,D);
      for(const x of [-w*.38,w*.38])
        line(x,seat,-d*.37,x,h*.96,-d*.36,.022,D);
      for(let i=0;i<4;i++)
        box(w*.76,.028,.032,0,h*(.63+i*.09),-d*.37,L,'wood');
    }else if(padded){
      box(w*.97,.11,d*.91,0,seat,0,F,'fabric',true);
      for(const x of [-w*.41,w*.41])for(const z of [-d*.39,d*.39])
        box(.052,seat-.04,.052,x,(seat-.04)/2,z,D);
      const back=ball(w*.43,h*.18,d*.10,0,h*.79,-d*.36,F);
      back.rotation.x=-.07;
      ball(w*.23,h*.14,d*.04,0,h*.79,-d*.27,L);
    }else{
      box(w*.90,.073,d*.91,0,seat,0,M,'wood',true);
      for(const x of [-w*.40,w*.40])for(const z of [-d*.38,d*.38])
        box(.055,seat-.01,.055,x,(seat-.01)/2,z,D);
      for(const x of [-w*.40,w*.40])box(.052,h*.47,.052,x,h*.75,-d*.38,D);
      for(const yy of [h*.74,h*.90])
        box(w*.82,.056,.035,0,yy,-d*.38,M,'wood',true);
    }
    return root;
  }
  if(item.shape==='stool'){
    const round=s==='stool-round';
    if(round){
      cyl(w*.45,h*.10,d*.45,0,h*.93,0,M);
      for(let i=0;i<4;i++){
        const ang=Math.PI*(i+.5)/2;
        const x=Math.cos(ang)*w*.31,z=Math.sin(ang)*d*.31;
        line(x*.80,0,z*.80,x,h*.88,z,.034,D,'wood');
      }
      cyl(w*.28,.027,d*.28,0,h*.29,0,D);
    }else{
      box(w*.96,h*.13,d*.94,0,h*.88,0,M,'wood',true);
      feet(h*.81,.09,.07);
      box(w*.78,.05,d*.045,0,h*.35,-d*.32,D);
    }
    return root;
  }
  // -------------------------------- LIGHTING -----------------------------
  if(item.shape==='lamp'){
    const arc=s==='lamp-arc',factory=s==='lamp-industrial';
    const paper=s==='lamp-paper',duo=s==='lamp-double';
    if(paper){
      cyl(w*.21,.055,d*.21,0,.052,0,D,'metal');
      line(0,.05,0,0,h*.94,0,.018,D);
      for(let i=0;i<5;i++){
        const y=h*(.25+i*.13);
        ball(w*(i%2?.38:.43),h*.09,d*(i%2?.38:.43),
          0,y,0,0xf0e6d3,'fabric');
        cyl(w*.28,.014,d*.28,0,y+h*.04,0,L,'wood');
      }
      ball(w*.32,h*.09,d*.32,0,h*.84,0,0xf0e6d3);
    }else if(arc){
      cyl(w*.13,.055,d*.26,-w*.36,.045,0,D,'metal');
      const curve=[
        [-w*.36,.06,0],[-w*.36,h*.35,0],[-w*.28,h*.67,0],
        [-w*.10,h*.88,0],[w*.20,h*.97,0],[w*.36,h*.93,0]
      ] as [number,number,number][];
      for(let i=1;i<curve.length;i++)rod(curve[i-1],curve[i],.028,D);
      const shade=cyl(w*.13,h*.13,d*.28,w*.36,h*.81,0,F,'fabric');
      shade.rotation.z=.18;
      cyl(w*.07,.022,d*.16,w*.36,h*.73,0,L,'ceramic');
    }else if(factory){
      cyl(w*.26,.06,d*.26,0,.055,0,D,'metal');
      line(0,.06,0,0,h*.75,0,.028,D);
      line(0,h*.75,0,w*.22,h*.89,0,.022,D);
      const shade=new THREE.Mesh(new THREE.CylinderGeometry(.20,1,1,12),finish(D,'metal'));
      shade.position.set(w*.22,h*.80,0);shade.scale.set(w*.32,h*.24,d*.32);
      shade.rotation.z=.27;root.add(shade);
      cyl(w*.13,.021,d*.13,w*.22,h*.65,0,0xf5dfb5,'ceramic');
    }else if(duo){
      cyl(w*.27,.055,d*.30,0,.05,0,D,'metal');
      line(0,.06,0,0,h*.94,0,.027,D);
      for(const side of [-1,1]){
        const top=h*(side>0?.87:.64);
        line(0,top-.03,0,side*w*.33,top,0,.025,D);
        const shade=new THREE.Mesh(new THREE.CylinderGeometry(.66,1,1,12),finish(F,'fabric'));
        shade.scale.set(w*.18,h*.11,d*.26);
        shade.position.set(side*w*.33,top-.07,0);
        root.add(shade);
      }
    }else if(s==='lamp-tripod'){
      for(let i=0;i<3;i++){
        const a=i*Math.PI*2/3;
        line(Math.sin(a)*w*.36,0,Math.cos(a)*d*.36,0,h*.80,0,.027,M,'wood');
      }
      const shade=new THREE.Mesh(new THREE.CylinderGeometry(.64,1,1,16),finish(F,'fabric'));
      shade.scale.set(w*.37,h*.25,d*.37);shade.position.y=h*.81;root.add(shade);
      cyl(w*.22,.02,d*.22,0,h*.96,0,L,'fabric');
    }else if(s==='lamp-sphere'){
      cyl(w*.29,.045,d*.29,0,.05,0,D,'metal');
      line(0,.05,0,0,h*.78,0,.025,D);
      ball(w*.40,w*.40,d*.40,0,h*.84,0,0xf6e6cc,'ceramic');
    }else{
      cyl(w*.29,.055,d*.29,0,.05,0,D,'metal');
      line(0,.06,0,0,h*.80,0,.024,D);
      const shade=new THREE.Mesh(new THREE.CylinderGeometry(.56,1,1,14),finish(F,'fabric'));
      shade.scale.set(w*.37,h*.23,d*.37);shade.position.y=h*.82;root.add(shade);
      cyl(w*.23,.019,d*.23,0,h*.96,0,L,'fabric');
    }
    return root;
  }
  // -------------------------------- PLANTS -------------------------------
  if(item.shape==='plant'){
    const mini=s==='plant-mini',cactus=s==='plant-cactus',palm=s==='plant-palm';
    const rubber=s==='plant-rubber',monstera=s==='plant-monstera';
    const potHeight=mini?.23:cactus?.26:h*.24;
    cyl(w*.29,potHeight,d*.29,0,potHeight*.50,0,
      (palm||monstera)?0xd7b497:L,'ceramic');
    cyl(w*.30,.02,d*.30,0,potHeight,0,D,'ceramic');
    if(cactus){
      cyl(w*.105,h*.59,d*.11,0,h*.57,0,0x5f9566,'fabric');
      ball(w*.106,h*.09,d*.11,0,h*.88,0,0x5f9566);
      for(const side of [-1,1]){
        line(0,h*.53,0,side*w*.30,h*.53,0,w*.08,0x5a8f60,'fabric');
        cyl(w*.08,h*.20,d*.08,side*w*.29,h*.63,0,0x5a8f60,'fabric');
        ball(w*.08,h*.06,d*.08,side*w*.29,h*.73,0,0x5a8f60);
      }
      for(let j=0;j<12;j++){
        const a=j*Math.PI/6;
        line(Math.sin(a)*w*.103,h*.38,Math.cos(a)*d*.103,
          Math.sin(a)*w*.103,h*.82,Math.cos(a)*d*.103,.004,L);
      }
    }else if(mini){
      for(let i=0;i<9;i++){
        const a=i*Math.PI*2/9;
        const leaf=ball(w*.085,h*.20,d*.082,Math.sin(a)*w*.18,
          h*.49,Math.cos(a)*d*.18,i%2?0x6a9c73:0x9ac18f);
        leaf.rotation.z=Math.sin(a)*-.48;
        leaf.rotation.x=Math.cos(a)*.48;
      }
      ball(w*.10,h*.14,d*.10,0,h*.73,0,0x91b58b);
    }else if(palm){
      line(0,potHeight,0,0,h*.85,0,.035,0x796141,'wood');
      // Curving palm fronds reach outward and droop: not a flat tree canopy.
      for(let i=0;i<11;i++){
        const a=i*Math.PI*2/11;
        const x=Math.cos(a)*w*.42,z=Math.sin(a)*d*.43;
        line(0,h*.85,0,x*.52,h*.95,z*.52,.022,0x678a58,'wood');
        line(x*.52,h*.95,z*.52,x,h*.66,z,.017,0x678a58,'wood');
        for(const t of [.32,.49,.67,.83]){
          const cx=x*t,cz=z*t,cy=h*(.95-(t-.52)*.32);
          for(const side of [-1,1]){
            const leaf=ball(w*.045,h*.020,d*.105,
              cx+side*Math.sin(a)*w*.065,cy,
              cz-side*Math.cos(a)*d*.075,i%2?0x4c8855:0x6ba064);
            leaf.rotation.y=a;
          }
        }
      }
    }else if(monstera){
      line(0,potHeight,0,0,h*.91,0,.025,0x5f704a,'wood');
      for(let i=0;i<7;i++){
        const a=i*Math.PI*2/7,x=Math.cos(a)*w*.27,z=Math.sin(a)*d*.27;
        const yy=h*(.56+(i%3)*.13);
        line(0,potHeight,0,x*.86,yy,z*.86,.019,0x638451,'wood');
        const leaf=ball(w*.18,h*.055,d*.17,x,yy,z,i%2?0x498257:0x7ab16f);
        leaf.rotation.y=a;leaf.rotation.z=Math.cos(a)*-.30;
        for(const side of [-1,1])ball(w*.04,h*.035,d*.10,
          x+side*w*.08,yy,z+side*d*.07,0x5a9662);
      }
    }else if(rubber){
      line(0,potHeight,0,0,h*.91,0,.027,0x66573e,'wood');
      for(let i=0;i<9;i++){
        const a=i*2.39996,yy=h*(.39+i*.058);
        const x=Math.cos(a)*w*.25,z=Math.sin(a)*d*.23;
        line(0,yy-.05,0,x,yy,z,.010,0x6b8d57,'wood');
        const leaf=ball(w*.18,h*.038,d*.12,x,yy,z,i%2?0x407a56:0x669b61);
        leaf.rotation.y=a;leaf.rotation.z=Math.cos(a)*.24;
      }
    }else{
      // Ficus tree with distinct trunk and layered rounded crown.
      line(0,potHeight,0,0,h*.80,0,.045,0x7b6348,'wood');
      for(let i=0;i<13;i++){
        const a=i*2.39996;
        const xx=Math.cos(a)*w*(.18+.045*(i%3));
        const zz=Math.sin(a)*d*(.18+.045*(i%3));
        ball(w*.15,h*.105,d*.16,xx,h*(.56+(i%4)*.10),zz,
          i%2?0x5b8656:0x83a86a);
      }
    }
    return root;
  }
  // ------------------------------- DÉCOR --------------------------------
  if(item.shape==='rug'){
    if(s==='rug-round'){
      cyl(w*.49,.018,d*.49,0,.018,0,F,'fabric');
      for(const r of [.34,.24,.15]){
        const ring=new THREE.Mesh(new THREE.RingGeometry(r-.018,r,36),
          finish(r===.24?D:L,'fabric'));
        ring.rotation.x=-Math.PI/2;
        ring.scale.set(w*.96,d*.96,1);
        ring.position.y=.034;
        root.add(ring);
      }
    }else{
      box(w*.99,.020,d*.98,0,.014,0,F,'fabric',true);
      if(s==='rug-weave'){
        for(let i=0;i<11;i++){
          const z=(i-5)*d*.082;
          box(w*.87,.004,d*.016,0,.029,z,i%3===0?D:L,'fabric');
        }
        for(const x of [-w*.46,w*.46])
          for(let i=-8;i<=8;i++)
            box(w*.019,.005,d*.012,x,.020,i*d*.053,L,'fabric');
      }else{
        box(w*.91,.006,d*.89,0,.027,0,L,'fabric');
        box(w*.85,.008,d*.83,0,.032,0,F,'fabric');
        for(const x of [-w*.35,w*.35])
          for(const z of [-d*.28,d*.28])
            ball(w*.065,.004,d*.085,x,.037,z,D,'fabric');
        for(const x of [-w*.43,w*.43])
          box(w*.023,.004,d*.83,x,.039,0,D,'fabric');
      }
    }
    return root;
  }
  if(item.shape==='mirror'){
    const round=s==='mirror-round',window=s==='mirror-window',arch=s==='mirror-arch';
    if(round){
      cyl(w*.32,.03,d*.33,0,.05,0,D,'metal');
      line(0,.05,0,0,h*.40,0,.034,D,'metal');
      const rim=cyl(w*.46,d*.35,w*.46,0,h*.67,0,M,'metal');
      rim.rotation.x=Math.PI/2;
      const reflection=cyl(w*.41,d*.025,w*.41,0,h*.67,d*.20,0xb5d9dd,'ceramic');
      reflection.rotation.x=Math.PI/2;
      line(-w*.20,h*.39,0,w*.20,h*.39,0,.023,D);
    }else{
      box(w*.98,h*.77,d*.36,0,h*.39,0,M,'wood',true);
      ball(w*.49,h*.20,d*.18,0,h*.79,0,M,'wood');
      box(w*.87,h*.69,.023,0,h*.40,d*.18,0xa4cad3,'ceramic');
      ball(w*.43,h*.15,.021,0,h*.78,d*.18,0xb5d9dd,'ceramic');
      if(window){
        for(const x of [-w*.25,0,w*.25])
          box(.021,h*.79,.028,x,h*.48,d*.21,D,'metal');
        for(const y of [h*.34,h*.59])
          box(w*.85,.022,.028,0,y,d*.21,D,'metal');
        box(w*.94,.028,d*.24,0,.035,0,D,'metal');
      }else if(arch){
        for(const yy of [h*.30,h*.53])
          box(w*.76,.012,.012,0,yy,d*.20,0xddebef,'ceramic');
        for(const x of [-w*.44,w*.44])
          box(.021,h*.66,.027,x,h*.41,d*.20,D,'metal');
      }else{
        for(const x of [-w*.43,w*.43])
          box(.033,h*.79,.04,x,h*.41,d*.20,D,'metal');
        for(const yy of [h*.14,h*.87])
          box(w*.88,.030,.037,0,yy,d*.20,L,'wood');
        box(w*.63,.012,.013,0,h*.45,d*.205,0xdceef0,'ceramic');
      }
    }
    return root;
  }
  return null;
}
