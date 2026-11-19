import { paintedMap } from './ArtKit';

const oakTones = ['#b19175', '#b99b80', '#c0a086', '#aa886d', '#bd9d7f', '#b59477'];

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
    // A broad bounce under the window and darker edges are baked into the floor.
    const bounce = ctx.createRadialGradient(285, 115, 38, 285, 115, 315);
    bounce.addColorStop(0, '#ffe4b04c');
    bounce.addColorStop(1, '#ffe4b000');
    ctx.fillStyle = bounce;
    ctx.fillRect(0, 0, 768, 768);
    for (const [x0, y0, x1, y1] of [[0, 0, 100, 0], [0, 0, 0, 110]]) {
      const edge = ctx.createLinearGradient(x0, y0, x1, y1);
      edge.addColorStop(0, '#62452b3d');
      edge.addColorStop(1, '#62452b00');
      ctx.fillStyle = edge;
      ctx.fillRect(0, 0, 768, 768);
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
    sky.addColorStop(0, '#6d9ead');
    sky.addColorStop(0.44, '#a8c6c1');
    sky.addColorStop(1, '#eee1bd');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 512, 256);
    const haze = ctx.createRadialGradient(355, 69, 7, 355, 69, 131);
    haze.addColorStop(0, '#ffe6acbb');
    haze.addColorStop(1, '#ffe6ac00');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#fff1c8';
    ctx.beginPath();
    ctx.arc(355, 69, 22, 0, Math.PI * 2);
    ctx.fill();
    for (const [x, y, rx] of [[55, 67, 64], [188, 80, 47], [438, 105, 50]]) {
      const cloud = ctx.createLinearGradient(0, y - 10, 0, y + 9);
      cloud.addColorStop(0, '#fff1d563');
      cloud.addColorStop(1, '#e3ded50b');
      ctx.fillStyle = cloud;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, 11, -0.026, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const [top, bottom, ridge, valley] of [
      ['#aeb7a3', '#bbc4b0', 47, 172], ['#729684', '#a2b294', 83, 210],
      ['#567e6d', '#8ba48a', 117, 238], ['#6c915f', '#a3ab71', 161, 278],
    ] as const) {
      const slope = ctx.createLinearGradient(0, ridge, 0, 256);
      slope.addColorStop(0, top);
      slope.addColorStop(1, bottom);
      ctx.fillStyle = slope;
      ctx.beginPath();
      ctx.moveTo(0, ridge + 63);
      ctx.bezierCurveTo(104, ridge - 12, 229, valley + 13, 318, (ridge + valley) / 2 + 31);
      ctx.bezierCurveTo(386, ridge + 26, 432, ridge + 38, 512, ridge + 71);
      ctx.lineTo(512, 256);
      ctx.lineTo(0, 256);
      ctx.fill();
    }
    for (let i = 0; i < 32; i++) {
      const x = (i * 97) % 512;
      const y = 226 + (i * 13) % 26;
      ctx.fillStyle = i % 2 ? '#69866350' : '#cfcb9160';
      ctx.beginPath();
      ctx.ellipse(x, y, 9 + i % 10, 2 + i % 4, 0, 0, Math.PI * 2);
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
