import {C, FONT} from '../design';
import {E, CHAT_Q, CHAT_A} from '../timeline';
import {ramp, ease, rng} from '../anim';
import {PIXEL_ROWS} from '../overlay/PixelTu';
import {box, type Captures, type ShotId} from '../assets';
import {CSS_W, CSS_H} from './space';

// 屏幕贴图：3 倍 CSS 像素，与采集截图（dpr 3）一一对应。
export const DPR = 3, CW = CSS_W * DPR, CH = CSS_H * DPR;

const PIX_FILL: Record<string, string> = {G: C.ink, O: C.accent, K: '#ecd2a2', k: '#dcb97f'};
/** 聊天屏里像素小图的位置（CSS 像素，左上角）与尺寸；3D 小图从这里「跳出」 */
export const SPRITE = {x: 40, y: 360, size: 132};

function pixelSprite(g: CanvasRenderingContext2D, x: number, y: number, size: number, f: number) {
  const cols = PIXEL_ROWS[0].length, cell = size / cols, r = rng(7);
  // E.emerge 之后像素块向上飞散并淡出，同时 3D 小图出现
  const burst = ramp(f, E.emerge - 2, E.emerge + 14, ease.out);
  PIXEL_ROWS.forEach((row, j) => [...row].forEach((ch, i) => {
    const vx = (r() - 0.5) * 120, vy = -60 - r() * 160;
    if (ch === '.') return;
    g.globalAlpha = 1 - burst;
    g.fillStyle = PIX_FILL[ch];
    g.fillRect(x + i * cell + vx * burst, y + j * cell + vy * burst, cell + 0.5, cell + 0.5);
  }));
  g.globalAlpha = 1;
}

function bubble(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, stroke?: string) {
  g.beginPath(); g.roundRect(x, y, w, h, 18); g.fillStyle = fill; g.fill();
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1; g.stroke(); }
}

function wrap(g: CanvasRenderingContext2D, text: string, maxW: number) {
  const lines: string[] = []; let line = '';
  for (const ch of text) { if (g.measureText(line + ch).width > maxW && line) { lines.push(line); line = ch; } else line += ch; }
  if (line) lines.push(line);
  return lines;
}

/** S1/S2：米白聊天界面（CSS 像素坐标绘制） */
function drawChat(g: CanvasRenderingContext2D, f: number) {
  g.fillStyle = C.paper; g.fillRect(0, 0, CSS_W, CSS_H);
  // 状态栏 + 顶栏
  g.fillStyle = C.ink; g.font = `600 15px ${FONT}`; g.textBaseline = 'middle';
  g.fillText('10:24', 28, 24);
  g.fillStyle = C.surface; g.fillRect(0, 44, CSS_W, 64);
  g.fillStyle = C.line; g.fillRect(0, 108, CSS_W, 1);
  g.fillStyle = C.ink; g.font = `500 26px ${FONT}`; g.fillText('‹', 18, 76);
  pixelSprite(g, 128, 60, 30, 0);
  g.font = `700 17px ${FONT}`; g.fillStyle = C.ink; g.fillText('小图', 166, 70);
  g.fillStyle = C.right; g.beginPath(); g.arc(170, 92, 4, 0, Math.PI * 2); g.fill();
  g.font = `500 12px ${FONT}`; g.fillStyle = C.muted; g.fillText('在线 · 猜地图向导', 180, 92);

  // 输入框：逐字打出问题，发送后清空
  const typed = f >= E.send ? '' : CHAT_Q.slice(0, Math.floor(CHAT_Q.length * ramp(f, E.typeStart, E.typeEnd)));
  bubble(g, 16, 770, 300, 48, C.surface, C.line);
  g.font = `500 15px ${FONT}`; g.fillStyle = typed ? C.ink : C.muted;
  const shown = typed || (f >= E.send ? '' : '说点什么…');
  const lines = wrap(g, shown, 270);
  const last = lines.length ? lines[lines.length - 1] : '';
  g.fillText(lines.length > 1 ? last : shown, 32, 794);
  if (f < E.send && Math.floor(f / 8) % 2 === 0) { // 光标
    g.fillStyle = C.accent; g.fillRect(32 + g.measureText(lines.length > 1 ? last : typed).width + 2, 782, 2, 24);
  }
  const sendHot = f >= E.typeEnd && f < E.send + 4;
  g.fillStyle = sendHot ? C.accent : '#d9cbb0'; g.beginPath(); g.arc(348, 794, 24, 0, Math.PI * 2); g.fill();
  g.strokeStyle = C.surface; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath(); g.moveTo(348, 805); g.lineTo(348, 784); g.moveTo(339, 792); g.lineTo(348, 783); g.lineTo(357, 792); g.stroke();

  // 用户气泡（墨绿）
  if (f >= E.send) {
    const t = ramp(f, E.send, E.send + 8, ease.outBack);
    g.save(); g.translate(374, 132); g.scale(t, t); g.translate(-374, -132);
    g.font = `500 16px ${FONT}`;
    const ql = wrap(g, CHAT_Q, 220), w = Math.max(...ql.map((l) => g.measureText(l).width)) + 32, h = ql.length * 26 + 22;
    bubble(g, 374 - w, 132, w, h, C.ink);
    g.fillStyle = C.surface; ql.forEach((l, i) => g.fillText(l, 374 - w + 16, 132 + 24 + i * 26));
    g.restore();
    g.font = `500 11px ${FONT}`; g.fillStyle = C.muted; g.fillText('今天 10:24', 162, 124);
  }
  // 小图回复：先「···」，再「好嘞！」
  if (f >= E.dots) {
    pixelSprite(g, 16, 222, 28, 0);
    const reply = f >= E.reply;
    const t = ramp(f, reply ? E.reply : E.dots, (reply ? E.reply : E.dots) + 8, ease.outBack);
    g.save(); g.translate(52, 216); g.scale(t, t); g.translate(-52, -216);
    if (!reply) {
      bubble(g, 52, 216, 76, 44, '#ebe2cd');
      [0, 1, 2].forEach((i) => { const up = Math.sin((f - E.dots) * 0.5 - i * 0.9) > 0.3 ? -3 : 0;
        g.fillStyle = C.ink2; g.beginPath(); g.arc(74 + i * 16, 238 + up, 4.5, 0, Math.PI * 2); g.fill(); });
    } else {
      bubble(g, 52, 216, 92, 44, '#ebe2cd');
      g.font = `700 18px ${FONT}`; g.fillStyle = C.ink; g.fillText(CHAT_A, 70, 239);
    }
    g.restore();
  }
  // 像素小图蹦出，随后飞散（3D 小图从这里跳出屏幕）
  if (f >= E.spritePop) {
    const t = ramp(f, E.spritePop, E.spritePop + 8, ease.outBack);
    const s = SPRITE.size * t;
    if (f < E.emerge + 16) pixelSprite(g, SPRITE.x + (SPRITE.size - s) / 2, SPRITE.y + (SPRITE.size - s), s, f);
  }
}

const SHOT_TIMES: [number, ShotId][] = [
  [E.toHome, 'home'], [E.toQ1[0], 'q1'], [E.tapRight, 'q1-correct'], [E.toQ2[0], 'q2'], [E.tapWrong, 'q2-wrong'], [E.toResult[0], 'result'],
];
function baseShot(f: number): ShotId {
  let id: ShotId = 'home';
  for (const [t, s] of SHOT_TIMES) if (f >= t) id = s;
  return id;
}

// 按拍弹出的元素：弹出前用背景色盖住，弹出时从 0.6 倍回弹到原大小（截图里的真实元素，不重画）
type Pop = {shot: ShotId; cls: string; at: number; idx?: number};
const POPS: Pop[] = [
  ...E.q1Pops.map((at, idx) => ({shot: 'q1' as const, cls: 'answer-button', at, idx})),
  ...E.q2Pops.map((at, idx) => ({shot: 'q2' as const, cls: 'answer-button', at, idx})),
  {shot: 'q1-correct', cls: 'feedback-line', at: E.tapRight},
  {shot: 'q2-wrong', cls: 'feedback-line', at: E.tapWrong},
  {shot: 'q2-wrong', cls: 'primary-button', at: E.tapWrong + 8},
  {shot: 'result', cls: 'score-ring', at: E.scorePop},
];
const bgCache = new Map<string, string>();
function bgAt(img: HTMLImageElement, x: number, y: number) {
  const k = `${img.src}@${x},${y}`;
  if (!bgCache.has(k)) {
    const c = document.createElement('canvas'); c.width = c.height = 1;
    const cg = c.getContext('2d')!; cg.drawImage(img, x, y, 1, 1, 0, 0, 1, 1);
    const [r, gg, b] = cg.getImageData(0, 0, 1, 1).data; bgCache.set(k, `rgb(${r},${gg},${b})`);
  }
  return bgCache.get(k)!;
}
function drawShot(g: CanvasRenderingContext2D, cap: Captures, id: ShotId, x: number, f: number) {
  const img = cap.img[id];
  g.drawImage(img, x, 0, CW, CH);
  for (const p of POPS) {
    if (p.shot !== id || f >= p.at + 8) continue;
    const boxes = cap.layout.shots.find((s) => s.id === id)!.boxes.filter((b) => b.cls.split(' ').includes(p.cls));
    const b = boxes[p.idx ?? 0]; if (!b) continue;
    const m = 4, bx = (b.x - m) * DPR, by = (b.y - m) * DPR, bw = (b.w + 2 * m) * DPR, bh = (b.h + 2 * m) * DPR;
    g.fillStyle = bgAt(img, 12 * DPR, Math.round((b.y + b.h / 2) * DPR));
    g.fillRect(x + bx, by, bw, bh);
    if (f < p.at) continue;
    const t = ramp(f, p.at, p.at + 7, ease.outBack), sc = 0.6 + 0.4 * t;
    g.save(); g.globalAlpha = ramp(f, p.at, p.at + 3);
    g.translate(x + bx + bw / 2, by + bh / 2); g.scale(sc, sc);
    g.drawImage(img, bx, by, bw, bh, -bw / 2, -bh / 2, bw, bh);
    g.restore();
  }
}

/** 每帧绘制屏幕内容到 g（画布尺寸 CW×CH） */
export function drawScreen(g: CanvasRenderingContext2D, f: number, cap: Captures | null) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, CW, CH);
  const chatFade = ramp(f, E.toHome, E.toHome + 10);
  if (f < E.toHome + 10) { g.setTransform(DPR, 0, 0, DPR, 0, 0); drawChat(g, f); g.setTransform(1, 0, 0, 1, 0, 0); }
  if (!cap || f < E.toHome) return;
  g.globalAlpha = chatFade;
  const id = baseShot(f);
  // 切屏用「推入」：新页面从右侧推入，旧页面略向左移并压暗（叠化会让两屏文字糊在一起）
  const pushes: [readonly number[], ShotId, ShotId][] = [
    [E.toQ1, 'home', 'q1'], [E.toQ2, 'q1-correct', 'q2'], [E.toResult, 'q2-wrong', 'result'],
  ];
  const push = pushes.find(([r]) => f >= r[0] && f < r[1]);
  if (push) {
    const p = ramp(f, push[0][0], push[0][1], ease.inOut);
    drawShot(g, cap, push[1], -p * CW * 0.3, f);
    g.fillStyle = `rgba(20,18,15,${0.35 * p})`; g.fillRect(0, 0, CW, CH);
    drawShot(g, cap, push[2], (1 - p) * CW, f);
  } else drawShot(g, cap, id, 0, f);
  g.globalAlpha = 1;

  // 地区面板：从底部滑出，选中「全部地区」后滑回
  const open = ramp(f, E.pickerOpen[0], E.pickerOpen[1], ease.out) * (1 - ramp(f, E.pickerClose[0], E.pickerClose[1], ease.in));
  if (open > 0) {
    g.globalAlpha = open;
    g.drawImage(cap.img.picker, 0, (1 - open) * CH * 0.5, CW, CH);
    g.globalAlpha = 1;
  }
  // 地图卡被小图「拿起」时，原位置留出纸色空位
  const lifted = ramp(f, E.cardUp[0], E.cardUp[0] + 6) * (1 - ramp(f, E.cardDown[1] - 4, E.cardDown[1]));
  if (lifted > 0) {
    const b = box(cap.layout, 'q1', 'question-map');
    g.globalAlpha = lifted;
    g.fillStyle = C.paper; g.beginPath(); g.roundRect(b.x * DPR, b.y * DPR, b.w * DPR, b.h * DPR, 14 * DPR); g.fill();
    g.setLineDash([10 * DPR, 8 * DPR]); g.strokeStyle = C.kraftLine; g.lineWidth = 2 * DPR; g.stroke(); g.setLineDash([]);
    g.globalAlpha = 1;
  }
}
