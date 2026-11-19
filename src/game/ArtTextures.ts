import { paintedMap } from './ArtKit';

const oakTones = ['#ba9779', '#c1a087', '#c6a487', '#ad896d', '#c3a184', '#b99678'];

export function oakFloor() {
  return paintedMap('oak-floor', 768, 768, (ctx) => {
    ctx.fillStyle = '#8d7058';
    ctx.fillRect(0, 0, 768, 768);
    for (let row = 0; row < 21; row++) {
      const y = row * 36.58;
      const length = 194;
      for (let col = -1; col < 5; col++) {
        const x = col * length + (row * 81) % length;
        const tone = ((row * 17 + col * 7) % oakTones.length + oakTones.length) % oakTones.length;
        ctx.fillStyle = oakTones[tone];
        ctx.fillRect(x + 0.7, y + 0.6, length - 1, 35.9);
        ctx.fillStyle = '#fff2cf29';
        ctx.fillRect(x + 1, y + 0.9, length - 1.5, 1.2);
        for (let grain = 0; grain < 13; grain++) {
          const gy = y + 3 + (row * 7 + grain * 13) % 30;
          const wave = Math.sin(col * 17 + grain * 5 + row * 29);
          ctx.beginPath();
          ctx.moveTo(x + 3, gy);
          ctx.bezierCurveTo(x + 32, gy + wave * 2, x + 70, gy - wave * 4, x + 191, gy + wave * 1.5);
          ctx.strokeStyle = grain % 2 ? '#f3e0bf36' : '#69493123';
          ctx.lineWidth = 0.7;
          ctx.stroke();
        }
        if ((row * 5 + col * 3) % 4 === 0) {
          const knot = x + 60 + row % 5 * 16;
          for (const radius of [3, 6, 10]) {
            ctx.beginPath();
            ctx.ellipse(knot, y + 18, radius, radius * 0.26, 0.03, 0, Math.PI * 2);
            ctx.strokeStyle = '#6748333d';
            ctx.stroke();
          }
        }
      }
    }
  });
}

export function upholsteryWeave() {
  return paintedMap('upholstery-weave', 128, 128, (ctx) => {
    ctx.fillStyle = '#f5f2ea';
    ctx.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 4) {
      ctx.fillStyle = '#4e484219';
      ctx.fillRect(0, y, 128, 1);
      for (let x = y % 8 ? 2 : 0; x < 128; x += 4) {
        ctx.fillStyle = '#625e5023';
        ctx.fillRect(x, y + 1, 1, 2);
        ctx.fillStyle = '#fffdf5';
        ctx.fillRect(x + 1, y + 2, 2, 1);
      }
    }
  });
}

export function gardenView() {
  return paintedMap('garden', 512, 256, (ctx) => {
    const sky = ctx.createLinearGradient(0, 0, 0, 220);
    sky.addColorStop(0, '#83b3bd');
    sky.addColorStop(1, '#f6e7b9');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#fff2bf';
    ctx.beginPath();
    ctx.arc(351, 63, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f5f1d8b0';
    for (const [x, y, rx, ry] of [[54, 74, 52, 9], [110, 68, 42, 12], [436, 90, 68, 8]]) {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const [color, crest, dip] of [
      ['#9eafa0', 15, 219], ['#759980', 61, 231], ['#527962', 105, 254], ['#729a67', 154, 299],
    ] as const) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, crest + 87);
      ctx.bezierCurveTo(147, crest, 264, dip, 512, crest + 95);
      ctx.lineTo(512, 256);
      ctx.lineTo(0, 256);
      ctx.fill();
    }
    for (const [x, y, size] of [[68, 231, 82], [119, 248, 51], [426, 262, 72], [491, 249, 118]]) {
      ctx.fillStyle = '#3d624f';
      ctx.fillRect(x - 2, y - size, 4, size);
      for (let layer = 0; layer < 3; layer++) {
        const top = y - size + layer * size * 0.15;
        const halfWidth = size * (0.16 + layer * 0.07);
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x + halfWidth, top + size * 0.47);
        ctx.lineTo(x - halfWidth, top + size * 0.47);
        ctx.fill();
      }
    }
  });
}

export function botanicalPrint() {
  return paintedMap('botanical', 128, 160, (ctx) => {
    ctx.fillStyle = '#f3dfbc';
    ctx.fillRect(0, 0, 128, 160);
    ctx.fillStyle = '#ca765c';
    ctx.beginPath();
    ctx.arc(89, 49, 21, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#526f5c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(42, 130);
    ctx.quadraticCurveTo(72, 104, 57, 44);
    ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    for (let i = 0; i < 5; i++) {
      const side = i % 2 ? 1 : -1;
      ctx.beginPath();
      ctx.ellipse(60 + side * 13, 54 + i * 13, 18, 6, -side * 0.58, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

export function wovenRug(style: 'living' | 'work' | 'sleep') {
  return paintedMap('rug-' + style, 256, 256, (ctx) => {
    const palette = {
      living: ['#a36963', '#bd8e79', '#e8bea0'],
      work: ['#638077', '#819b89', '#c5bd9f'],
      sleep: ['#bfaa91', '#d1b99e', '#e4d2b4'],
    }[style];
    ctx.fillStyle = palette[0];
    ctx.fillRect(0, 0, 256, 256);
    for (const width of [11, 20, 35]) {
      ctx.lineWidth = width === 20 ? 4 : 2;
      ctx.strokeStyle = width === 20 ? palette[2] : palette[1];
      ctx.strokeRect(width, width, 256 - width * 2, 256 - width * 2);
    }
    ctx.fillStyle = palette[1];
    for (let y = 55; y < 230; y += 36) for (let x = 53; x < 225; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, y - 7);
      ctx.lineTo(x + 5, y);
      ctx.lineTo(x, y + 7);
      ctx.lineTo(x - 5, y);
      ctx.fill();
    }
    ctx.fillStyle = '#fff2d214';
    for (let y = 1; y < 256; y += 4) ctx.fillRect(0, y, 256, 1);
  });
}

export function kitchenTiles() {
  return paintedMap('tile', 512, 96, (ctx) => {
    ctx.fillStyle = '#c5b79c';
    ctx.fillRect(0, 0, 512, 96);
    for (let y = 0; y < 96; y += 24) for (let x = -24; x < 512; x += 48) {
      const left = x + (y % 48 ? 24 : 0);
      ctx.fillStyle = ['#f2e2c6', '#e5d5b9', '#ebdfcb'][(y / 24 + (x + 24) / 48) % 3];
      ctx.fillRect(left + 1, y + 1, 46, 22);
      ctx.fillStyle = '#fff3d9';
      ctx.fillRect(left + 2, y + 2, 44, 2);
    }
  });
}


export function tvStill() {
  return paintedMap('tv-still', 256, 144, (ctx) => {
    ctx.fillStyle = '#304e5a';
    ctx.fillRect(0, 0, 256, 144);
    ctx.fillStyle = '#edaf86';
    ctx.beginPath();
    ctx.arc(167, 57, 25, 0, Math.PI * 2);
    ctx.fill();
    for (const [color, edge] of [['#6c8c85', 91], ['#355e60', 115]] as const) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, edge);
      ctx.bezierCurveTo(72, edge - 72, 128, edge + 24, 256, edge - 37);
      ctx.lineTo(256, 144);
      ctx.lineTo(0, 144);
      ctx.fill();
    }
    ctx.fillStyle = '#f5d2a5';
    for (const [x, y] of [[32, 29], [51, 53], [111, 23], [222, 46], [232, 20]]) {
      ctx.fillRect(x, y, 2, 2);
    }
  });
}

export function deskDisplay() {
  return paintedMap('desk-display', 256, 160, (ctx) => {
    ctx.fillStyle = '#213c42';
    ctx.fillRect(0, 0, 256, 160);
    ctx.fillStyle = '#354f52';
    ctx.fillRect(0, 0, 256, 17);
    ctx.fillRect(0, 17, 49, 143);
    ctx.fillStyle = '#203339';
    ctx.fillRect(49, 127, 207, 33);
    for (let i = 0; i < 11; i++) {
      const x = 62 + [0, 10, 20, 20, 10][i % 5];
      const y = 28 + i * 8;
      ctx.fillStyle = ['#d6a17c', '#8dbba4', '#e1ce9a'][i % 3];
      ctx.fillRect(x, y, 23 - i % 4 * 3, 2);
      ctx.fillStyle = '#73969a';
      ctx.fillRect(x + 30, y, 56 + i % 5 * 12, 2);
    }
    ctx.fillStyle = '#a8c4a4';
    ctx.fillRect(60, 138, 48, 2);
    ctx.fillRect(65, 146, 76, 2);
  });
}
