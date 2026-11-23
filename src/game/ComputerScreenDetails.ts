import type { ComputerScene } from './ComputerScreenArt';

/** Small animated foreground layers on the existing canvas screens.
 * Preserve game scenes and the established computer task / desktop state.
 * These are visual stories, never fake rewards or server-side career progress.
 */
export function drawComputerDetails(
  c: CanvasRenderingContext2D, scene: ComputerScene, seconds: number,
): void {
  const t=Math.max(0,seconds);
  const pulse=Math.sin(t*2);
  const pill=(x:number,y:number,w:number,color:string)=>{
    c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,3,1.5);c.fill();
  };
  const text=(s:string,x:number,y:number,color:string,size=8)=>{
    c.fillStyle=color;c.font='600 '+size+'px system-ui';c.fillText(s,x,y,239-x);
  };
  if(scene.mode==='code'){
    // A real-feeling IDE: filenames, token colors, an insertion caret,
    // a small running terminal and alternating compile / debug phases.
    c.fillStyle='#0a1625';c.fillRect(65,25,179,13);
    text('simlife / src / scene.ts',72,34,'#bbd8df',7);
    const names=['scene.ts','npc.ts','ui.ts'];
    for(let i=0;i<3;i++){
      const y=47+i*13;
      pill(19,y,7,i===Math.floor(t/9)%3?'#76dcca':'#708195');
      text(names[i],28,y+2,'#b9cfdb',6);
    }
    const lines=['const world = createWorld();','world.update(delta);',
      'npc.follow(path);','ui.render(state);','// gameplay interaction'];
    const phase=Math.floor(t/5)%3;
    const written=Math.floor(t*5)%lines.length;
    c.fillStyle='#132437';c.fillRect(73,92,169,31);
    text(phase===0?'● ТЕРМИНАЛ   npm run dev':phase===1?'✓ Сборка завершена':'✓ Проверка сцены',
      78,102,phase===0?'#f7c88b':'#87dfb4',7);
    pill(79,110,158,'#2a4953');
    pill(79,110,Math.max(5,Math.floor((t*20)%153)),phase===0?'#8bd0e8':'#83d5ac');
    // A highlighted editing line makes typing visibly different from an idle PC.
    c.fillStyle='#203a50';c.fillRect(80,39+written*9,157,9);
    text(lines[written],84,46+written*9,'#9ccfe1',7);
    if(Math.floor(t*3)%2===0)pill(166+(Math.floor(t*2)%5)*7,42+written*9,2,'#e5efce');
  }else if(scene.mode==='hair'){
    // Alina's specialist client protocol rather than a generic hairdresser UI.
    const stage=Math.floor(t/6)%3;
    c.fillStyle='#80576b';c.fillRect(125,26,112,14);
    text(['ДИАГНОСТИКА','СОСТАВ / ЭТАПЫ','РЕЗУЛЬТАТ'][stage],131,36,'#fff2df',8);
    c.fillStyle='#f7e8dc';c.fillRect(129,44,102,72);
    for(let i=0;i<8;i++){
      const x=137+i*11;
      c.beginPath();c.lineWidth=2.2;
      c.strokeStyle=i%3===0?'#785149':'#a87454';
      c.moveTo(x,50);
      const bend=stage===0?7:stage===1?4:1;
      c.bezierCurveTo(x+bend,71+Math.sin(t*.8+i)*2,x-bend,94,x,107);
      c.stroke();
    }
    c.fillStyle=stage===2?'#6b9d83':'#b27b89';
    c.fillRect(134,113,92*(stage===0?.33:stage===1?.7:1),3);
    text(stage===0?'Структура волоса':stage===1?'Этап обработки':'Визуальная оценка',
      20,123,'#704f64',7);
    // A cursor follows the treatment diagram.
    c.fillStyle='#5f536d';c.fillRect(142+(Math.floor(t*12)%7)*11,78,2,9);
  }else if(scene.mode==='study'){
    const lesson=Math.floor(t/7)%4;
    c.fillStyle='#325b5b';c.fillRect(18,27,218,13);
    text(['Тема 1 · Основы','Тема 2 · Практика','Тема 3 · Разбор','Тема 4 · Итоги'][lesson],
      24,36,'#f5ead5',8);
    c.fillStyle='#477d71';
    c.fillRect(21,103,208,5);
    c.fillStyle='#a6dfc5';
    c.fillRect(21,103,Math.min(208,32+(t%7)*25),5);
  }else if(scene.mode==='notes'){
    const row=Math.floor(t/2.7)%5;
    c.fillStyle='#57836d';
    c.fillRect(27,52+row*13,158,1);
    if(Math.floor(t*2)%2===0)c.fillRect(37+(Math.floor(t*6)%20)*7,51+row*13,2,10);
  }else if(scene.mode==='browser'||scene.mode==='mail'){
    const x=scene.mode==='browser'?24+(Math.floor(t*9)%12)*16:38+(Math.floor(t*9)%14)*12;
    const y=scene.mode==='browser'?57+(Math.floor(t/2)%3)*12:51+(Math.floor(t/3)%4)*16;
    c.save();c.strokeStyle='#263f4c';c.lineWidth=1.6;
    c.beginPath();c.moveTo(x,y);c.lineTo(x+2,y+10);c.lineTo(x+5,y+7);
    c.lineTo(x+9,y+14);c.lineTo(x+12,y+12);c.lineTo(x+7,y+5);c.closePath();c.stroke();
    c.restore();
  }else if(scene.mode==='video'){
    c.fillStyle='#f1f2e7';c.fillRect(226,30,2,2);
    c.globalAlpha=.35+.2*pulse;c.fillRect(232,30,2,2);c.globalAlpha=1;
  }
}
