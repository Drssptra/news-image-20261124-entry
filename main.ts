// news-image-20261124 — a newspaper front page summing up Tuesday 24 November 2026.
// Draws a 1024x1024 PNG with a hand-rolled bitmap font and a hand-rolled PNG
// encoder (raw RGB scanlines, zlib deflate, CRC32). Node stdlib only, no network,
// deterministic: every run writes the same bytes to $MAKEFUN_OUTPUT_DIR/entry.png.

const { mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const zlib = require("node:zlib");

// ---------------------------------------------------------------- CRC32
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

function encodePNG(width, height, rgb) {
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0; // filter: none
    rgb.copy(raw, y * (1 + width * 3) + 1, y * width * 3, (y + 1) * width * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- 5x7 font
// Each glyph is 7 rows of 5 bits, written as strings of 0/1.
const FONT = {
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  '"': ["01010", "01010", "00000", "00000", "00000", "00000", "00000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  ",": ["00000", "00000", "00000", "00000", "00100", "00100", "01000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
};

// ---------------------------------------------------------------- canvas
const W = 1024;
const H = 1024;
const PAPER = [248, 244, 232];
const INK = [26, 26, 26];
const NAVY = [30, 58, 95];
const RED = [168, 35, 26];
const GREEN = [32, 112, 58];
const GOLD = [176, 132, 24];
const GREY = [120, 116, 108];
const SKY = [214, 232, 240];

class Canvas {
  constructor() {
    this.pixels = Buffer.alloc(W * H * 3);
    for (let i = 0; i < W * H; i++) {
      this.pixels[i * 3] = PAPER[0];
      this.pixels[i * 3 + 1] = PAPER[1];
      this.pixels[i * 3 + 2] = PAPER[2];
    }
  }
  set(x, y, c) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3;
    this.pixels[i] = c[0];
    this.pixels[i + 1] = c[1];
    this.pixels[i + 2] = c[2];
  }
  rect(x, y, w, h, c) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c);
  }
  frame(x, y, w, h, c, t) {
    this.rect(x, y, w, t, c);
    this.rect(x, y + h - t, w, t, c);
    this.rect(x, y, t, h, c);
    this.rect(x + w - t, y, t, h, c);
  }
  hline(x, y, w, c, t) {
    this.rect(x, y, w, t || 1, c);
  }
  vline(x, y, h, c, t) {
    this.rect(x, y, t || 1, h, c);
  }
  line(x0, y0, x1, y1, c, t) {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    const th = t || 1;
    for (let guard = 0; guard < 4000; guard++) {
      this.rect(x - Math.floor(th / 2), y - Math.floor(th / 2), th, th, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }
  circle(cx, cy, r, c, fill) {
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        const d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
        if (fill ? d <= r * r : d <= r * r && d >= (r - 1) * (r - 1)) this.set(x, y, c);
      }
    }
  }
  textWidth(s, scale) {
    return s.length * 6 * scale - scale;
  }
  drawText(s, x, y, scale, c) {
    const up = s.toUpperCase();
    let cx = x;
    for (const ch of up) {
      const g = FONT[ch] || FONT["?"];
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 5; col++) {
          if (g[row][col] === "1") this.rect(cx + col * scale, y + row * scale, scale, scale, c);
        }
      }
      cx += 6 * scale;
    }
    return cx;
  }
  drawTextCentered(s, cx, y, scale, c) {
    const w = this.textWidth(s, scale);
    this.drawText(s, cx - Math.floor(w / 2), y, scale, c);
  }
  wrap(s, maxW, scale) {
    const words = s.split(" ");
    const lines = [];
    let cur = "";
    for (const word of words) {
      const trial = cur ? cur + " " + word : word;
      if (this.textWidth(trial, scale) <= maxW || !cur) cur = trial;
      else {
        lines.push(cur);
        cur = word;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }
  paragraph(s, x, y, maxW, scale, c, leading) {
    const lines = this.wrap(s, maxW, scale);
    let yy = y;
    for (const line of lines) {
      this.drawText(line, x, yy, scale, c);
      yy += 7 * scale + (leading || 4);
    }
    return yy;
  }
}

// ---------------------------------------------------------------- scenes
function drawTrain(cv, x, y, w, h) {
  cv.rect(x, y + h - 14, w, 3, INK); // rails
  cv.rect(x, y + h - 6, w, 3, INK);
  for (let i = x; i < x + w; i += 18) cv.vline(i, y + h - 12, 7, INK, 2);
  const bodyY = y + 22;
  cv.rect(x + 8, bodyY, w - 16, 52, NAVY); // carriages
  cv.rect(x + 8, bodyY, 52, 52, RED); // locomotive
  cv.rect(x + 14, bodyY + 8, 40, 18, SKY); // cab window
  for (let i = 0; i < 3; i++) {
    const wx = x + 76 + i * 56;
    cv.rect(wx, bodyY + 10, 40, 20, SKY);
    cv.frame(wx, bodyY + 10, 40, 20, PAPER, 2);
  }
  cv.rect(x + 8, bodyY + 52, w - 16, 8, GOLD); // skirt
  for (let i = 0; i < 5; i++) cv.circle(x + 26 + i * 52, y + h - 18, 9, INK, true);
  for (let i = 0; i < 5; i++) cv.circle(x + 26 + i * 52, y + h - 18, 4, GREY, true);
  cv.rect(x + 16, bodyY - 14, 10, 14, INK); // chimney
  cv.circle(x + 21, bodyY - 22, 7, GREY, true);
  cv.circle(x + 30, bodyY - 32, 9, GREY, true);
}

function drawPodium(cv, x, y, w, h) {
  // globe
  cv.circle(x + 52, y + 46, 34, SKY, true);
  cv.circle(x + 52, y + 46, 34, NAVY, false);
  cv.line(x + 20, y + 46, x + 84, y + 46, NAVY, 2);
  cv.line(x + 52, y + 14, x + 52, y + 78, NAVY, 2);
  // podium steps (end above the NO DEAL line)
  cv.rect(x + 110, y + 58, 46, h - 84, NAVY);
  cv.rect(x + 162, y + 38, 46, h - 84, RED);
  cv.rect(x + 214, y + 58, 46, h - 84, NAVY);
  // flags on poles
  for (let i = 0; i < 3; i++) {
    const fx = x + 122 + i * 52;
    cv.vline(fx, y + 6, 34, INK, 2);
    cv.rect(fx + 2, y + 6, 22, 12, i === 1 ? RED : NAVY);
  }
  cv.drawText("NO DEAL", x + 108, y + h - 22, 2, RED);
}

function drawChart(cv, x, y, w, h) {
  cv.vline(x + 14, y + 8, h - 24, INK, 2); // y axis
  cv.hline(x + 14, y + h - 16, w - 28, INK, 2); // x axis
  const pts = [
    [x + 24, y + 22],
    [x + 64, y + 30],
    [x + 104, y + 26],
    [x + 144, y + 52],
    [x + 184, y + 48],
    [x + 224, y + 78],
    [x + 258, y + 96],
  ];
  for (let i = 0; i < pts.length - 1; i++) cv.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], RED, 4);
  cv.line(pts[6][0], pts[6][1], pts[6][0] - 14, pts[6][1] - 4, RED, 4);
  cv.line(pts[6][0], pts[6][1], pts[6][0] - 2, pts[6][1] - 14, RED, 4);
  for (const p of pts) cv.circle(p[0], p[1], 4, INK, true);
  cv.drawText("-20%", x + w - 78, y + 2, 2, RED);
}

function drawFactory(cv, x, y, w, h) {
  cv.rect(x + 16, y + 52, w - 32, h - 52, GREY); // hall
  cv.rect(x + 16, y + 40, 40, 12, INK); // sawtooth roof
  cv.rect(x + 64, y + 32, 40, 20, INK);
  cv.rect(x + 112, y + 40, 40, 12, INK);
  cv.rect(x + w - 46, y + 6, 22, h - 6, INK); // chimney
  cv.circle(x + w - 35, y - 2, 9, GREY, true);
  cv.circle(x + w - 22, y - 12, 11, GREY, true);
  cv.circle(x + w - 48, y - 12, 8, GREY, true);
  // windows
  for (let i = 0; i < 4; i++) cv.rect(x + 28 + i * 52, y + 66, 30, 22, [255, 190, 60]);
  // flame in the gap between windows 2 and 3
  cv.line(x + 109, y + h - 2, x + 121, y + h - 34, RED, 3);
  cv.line(x + 133, y + h - 2, x + 121, y + h - 34, RED, 3);
  cv.line(x + 121, y + h - 34, x + 121, y + h - 52, [255, 190, 60], 4);
}

function drawChess(cv, x, y, w, h) {
  const bs = 88;
  const ox = x + Math.floor((w - bs) / 2);
  const oy = y + 2;
  const sq = Math.floor(bs / 8);
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 0) cv.rect(ox + c * sq, oy + r * sq, sq, sq, PAPER);
      else cv.rect(ox + c * sq, oy + r * sq, sq, sq, INK);
    }
  }
  cv.frame(ox, oy, bs, bs, INK, 2);
  // white king
  cv.circle(ox + 3 * sq + 7, oy + 1 * sq + 7, 10, PAPER, true);
  cv.circle(ox + 3 * sq + 7, oy + 1 * sq + 7, 10, INK, false);
  cv.rect(ox + 3 * sq + 3, oy + 1 * sq - 4, 8, 6, PAPER);
  // black queen
  cv.circle(ox + 4 * sq + 7, oy + 6 * sq + 7, 10, INK, true);
  cv.circle(ox + 4 * sq + 7, oy + 6 * sq + 7, 10, PAPER, false);
  cv.drawText("GUKESH VS SINDAROV", x, y + h - 20, 2, NAVY);
}

function drawBatsman(cv, x, y, w, h) {
  // big score on the left of the figure
  cv.drawText("128", x, y + 18, 6, NAVY);
  const fx = x + 150;
  cv.circle(fx + 40, y + 30, 14, INK, true); // head
  cv.line(fx + 40, y + 44, fx + 34, y + 84, INK, 4); // torso
  cv.line(fx + 34, y + 84, fx + 18, y + h - 8, INK, 4); // back leg
  cv.line(fx + 34, y + 84, fx + 54, y + h - 8, INK, 4); // front leg
  cv.line(fx + 38, y + 54, fx + 66, y + 40, INK, 4); // arms to bat
  cv.line(fx + 66, y + 40, fx + 92, y + 14, GOLD, 6); // bat
  cv.circle(fx + 104, y + 10, 7, RED, true); // ball
  cv.line(fx + 92, y + 14, fx + 104, y + 10, INK, 2);
  cv.rect(x, y + h - 6, w, 4, GREEN); // pitch
}

// ---------------------------------------------------------------- page
function storyPanel(cv, x, y, w, h, num, headline, body, scene) {
  cv.frame(x, y, w, h, INK, 2);
  cv.rect(x + 2, y + 2, 30, 30, RED);
  cv.drawText(String(num), x + 11, y + 9, 2, PAPER);
  const tx = x + 44;
  const tw = w - 56;
  let yy = y + 12;
  const headLines = cv.wrap(headline, tw, 2);
  for (const line of headLines) {
    cv.drawText(line, tx, yy, 2, INK);
    yy += 18;
  }
  yy += 4;
  yy = cv.paragraph(body, tx, yy, tw, 2, INK, 4);
  if (scene) scene(cv, x + 12, yy + 4, w - 24, y + h - (yy + 4) - 10);
}

function main() {
  const cv = new Canvas();
  const M = 24; // margin
  const inner = W - 2 * M;

  // masthead
  cv.drawTextCentered("THE TUESDAY GLOBE", W / 2, 26, 6, NAVY);
  cv.hline(M, 84, inner, INK, 3);
  cv.hline(M, 90, inner, INK, 1);
  cv.drawTextCentered("TUESDAY 24 NOVEMBER 2026", W / 2, 104, 2, INK);
  cv.drawText("SIX STORIES THAT SHAPED THE DAY", M, 128, 2, RED);
  cv.drawText("PRICE: ONE READ", W - M - cv.textWidth("PRICE: ONE READ", 2), 128, 2, GREY);

  // lead story, full width
  const leadY = 152;
  const leadH = 178;
  cv.frame(M, leadY, inner, leadH, INK, 2);
  cv.rect(M + 2, leadY + 2, 30, 30, RED);
  cv.drawText("1", M + 13, leadY + 9, 2, PAPER);
  const lx = M + 44;
  const lw = 600;
  let ly = leadY + 12;
  for (const line of cv.wrap("SARYU-KAMALA EXPRESS ROLLS OUT", lw, 3)) {
    cv.drawText(line, lx, ly, 3, INK);
    ly += 25;
  }
  ly += 6;
  ly = cv.paragraph(
    "Modi and Nepal PM Balendra Shah flag off the Ayodhya-Janakpur Dham train. 8 pacts signed; Rs 15,000 crore package.",
    lx,
    ly,
    lw,
    2,
    INK,
    4
  );
  drawTrain(cv, M + 668, leadY + 46, 292, leadH - 84);
  cv.drawText("AYODHYA - JANAKPUR", M + 668, leadY + leadH - 22, 2, NAVY);

  // grid: stories 2 and 3, then 4 and 5
  const gw = Math.floor((inner - 16) / 2);
  const gy1 = 342;
  const gy2 = 586;
  const gh = 232;
  storyPanel(
    cv, M, gy1, gw, gh, 2,
    "COP31 ENDS WITH NO DEAL",
    "Longest COP ever: nearly 200 nations reject the Antalya Pact, which never mentions fossil fuels. EU walks out.",
    drawPodium
  );
  storyPanel(
    cv, M + gw + 16, gy1, gw, gh, 3,
    "TRUMP BLAMES DEMS FOR $6TN ROUT",
    "Trump says $6 trillion vanished since the Democrats' 3 Nov midterm win; Nasdaq down 20% (his claim). Bessent: mix of factors.",
    drawChart
  );
  storyPanel(
    cv, M, gy2, gw, gh, 4,
    "BANTEN FACTORY FIRE: 24 DEAD",
    "About 30 still missing after the blaze; DNA identification may take weeks.",
    drawFactory
  );
  storyPanel(
    cv, M + gw + 16, gy2, gw, gh, 5,
    "CHESS CROWN FIGHT STARTS TODAY",
    "Gukesh defends vs Sindarov, Game 1 in Geneva. Both 20 - youngest title match ever. 14 games, $2.5m fund.",
    drawChess
  );

  // story 6, full width
  const s6y = 830;
  const s6h = 170;
  cv.frame(M, s6y, inner, s6h, INK, 2);
  cv.rect(M + 2, s6y + 2, 30, 30, RED);
  cv.drawText("6", M + 13, s6y + 9, 2, PAPER);
  const sx = M + 44;
  let sy = s6y + 12;
  for (const line of cv.wrap("PANT 128, TEST ENDS IN A DRAW", 560, 3)) {
    cv.drawText(line, sx, sy, 3, INK);
    sy += 25;
  }
  sy += 6;
  cv.paragraph(
    "Record for an Asian wicketkeeper as India-NZ first Test is drawn in Wellington.",
    sx,
    sy,
    560,
    2,
    INK,
    4
  );
  drawBatsman(cv, M + 640, s6y + 16, 320, s6h - 28);
  cv.drawText("WELLINGTON", M + 44, s6y + s6h - 22, 2, NAVY);

  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  mkdirSync(outDir, { recursive: true });
  const png = encodePNG(W, H, cv.pixels);
  writeFileSync(join(outDir, "entry.png"), png);
  process.stdout.write("wrote entry.png " + png.length + " bytes, " + W + "x" + H + "\n");
}

main();
