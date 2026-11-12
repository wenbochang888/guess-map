// 蜡笔涂鸦：把 doodles.json 里的笔画画到画布上，支持按进度逐笔出现。
// 坐标与题库路径同一 400×300 视框；画布四周留 MARGIN 视框单位，涂鸦可以画到轮廓外面。
import doodles from './doodles.json';

export const MARGIN = 60;
export const PX = 2.4; // 每个视框单位对应的画布像素
export const CANVAS_W = Math.round((400 + 2 * MARGIN) * PX), CANVAS_H = Math.round((300 + 2 * MARGIN) * PX);

type Raw = {t: 'l' | 'c' | 'f' | 'o' | 't'; p?: number[]; c?: [number, number]; r?: number; w?: number; fill?: string; smooth?: boolean; text?: string; size?: number};
type Item = {raw: Raw; pts: [number, number][]; len: number; closed: boolean};

// 配色跟随画风：墨色线 + 朱红点缀（厚片是奶油纸色）
const INK = '#2a1f18', HALO = '#fff6e6';
const FILLS: Record<string, string> = {ink: INK, cream: HALO, white: '#ffffff', pink: '#e0705a', bone: HALO, eye: '#3f7f8c', blush: 'rgba(214,90,70,0.5)', gold: '#e0a43a', red: '#c8452c'};
export const DOODLE_FONT = '"Noto Serif SC", serif';
const BASE_W = 3.1; // 墨线宽（视框单位）
const HALO_W = 3.4;   // 奶油色描边比墨线宽出的部分

function catmull(pts: [number, number][], closed: boolean, n = 10): [number, number][] {
  if (pts.length < 3) return pts;
  const P = closed ? [pts[pts.length - 1], ...pts, pts[0], pts[1]] : [pts[0], ...pts, pts[pts.length - 1]];
  const out: [number, number][] = [];
  const segs = closed ? pts.length : pts.length - 1;
  for (let i = 1; i <= segs; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)) as [number, number]);
    }
  }
  out.push(closed ? out[0] : pts[pts.length - 1]);
  return out;
}

const cache = new Map<string, {items: Item[]; total: number}>();
export function prepare(name: string) {
  const hit = cache.get(name);
  if (hit) return hit;
  const raws = ((doodles as unknown as Record<string, Raw[]>)[name] ?? []);
  const items: Item[] = raws.map((raw) => {
    if (raw.t === 't') return {raw, pts: [raw.c!], len: 30, closed: false};
    if (raw.t === 'o') {
      const [cx, cy] = raw.c!, r = raw.r!;
      const pts = Array.from({length: 33}, (_, k) => [cx + r * Math.cos(-Math.PI / 2 + k * Math.PI / 16), cy + r * Math.sin(-Math.PI / 2 + k * Math.PI / 16)] as [number, number]);
      return {raw, pts, len: 2 * Math.PI * r, closed: true};
    }
    const closed = raw.t === 'c' || raw.t === 'f';
    let pts: [number, number][] = [];
    for (let i = 0; i < raw.p!.length; i += 2) pts.push([raw.p![i], raw.p![i + 1]]);
    pts = raw.smooth === false ? (closed ? [...pts, pts[0]] : pts) : catmull(pts, closed);
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return {raw, pts, len, closed};
  });
  // 小圆点（眼睛等）在进度里按最短 18 单位计，避免一闪而过
  const total = items.reduce((s, it) => s + Math.max(18, it.len), 0);
  const res = {items, total};
  cache.set(name, res);
  return res;
}

const X = (x: number) => (x + MARGIN) * PX, Y = (y: number) => (y + MARGIN) * PX;

function partial(pts: [number, number][], len: number, frac: number) {
  if (frac >= 1) return pts;
  const want = len * frac, out: [number, number][] = [pts[0]];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (acc + d >= want) {
      const t = (want - acc) / (d || 1);
      out.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t]);
      return out;
    }
    acc += d; out.push(pts[i]);
  }
  return out;
}

function stroke(g: CanvasRenderingContext2D, pts: [number, number][], color: string, w: number) {
  if (pts.length < 2) return;
  g.strokeStyle = color; g.lineWidth = w * PX; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(X(pts[0][0]), Y(pts[0][1]));
  for (let i = 1; i < pts.length; i++) g.lineTo(X(pts[i][0]), Y(pts[i][1]));
  g.stroke();
}

/** 画出 progress（0..1）对应的涂鸦。先整体画一层奶油色描边，再画墨线，任何底色上都清楚。 */
export function drawDoodle(g: CanvasRenderingContext2D, name: string, progress: number) {
  g.clearRect(0, 0, CANVAS_W, CANVAS_H);
  if (progress <= 0) return;
  const {items, total} = prepare(name);
  let budget = progress * total;
  const shown: {it: Item; frac: number}[] = [];
  for (const it of items) {
    const cost = Math.max(18, it.len);
    if (budget <= 0) break;
    shown.push({it, frac: Math.min(1, budget / cost)});
    budget -= cost;
  }
  for (const pass of ['halo', 'fill', 'ink'] as const) {
    for (const {it, frac} of shown) {
      const {raw} = it, w = (raw.w ?? 1) * BASE_W, fill = raw.fill ? FILLS[raw.fill] : undefined;
      if (raw.t === 't') { // 文字标注：画到这里时淡入（奶油色，写在轮廓外的暗处）
        if (pass === 'ink') {
          g.globalAlpha = frac; g.font = `700 ${(raw.size ?? 16) * PX}px ${DOODLE_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillStyle = raw.fill ? FILLS[raw.fill] : HALO; g.fillText(raw.text ?? '', X(raw.c![0]), Y(raw.c![1])); g.globalAlpha = 1;
        }
        continue;
      }
      const pts = partial(it.pts, it.len, frac);
      if (raw.fill === 'bone' && raw.t === 'l') { // 骨头：粗奶油色线 + 墨色边
        if (pass === 'halo') stroke(g, pts, INK, w * 2.2 + 2);
        if (pass === 'fill') stroke(g, pts, HALO, w * 2.2 - 1);
        continue;
      }
      if (pass === 'halo') stroke(g, pts, HALO, w + HALO_W);
      if (pass === 'fill' && fill && raw.fill !== 'none' && (raw.t === 'f' || raw.t === 'o')) {
        g.globalAlpha = Math.min(1, frac * frac * 1.2);
        g.fillStyle = fill; g.beginPath();
        it.pts.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))));
        g.closePath(); g.fill();
        if (raw.fill === 'eye') { // 孔雀翎眼：中心墨点
          const [cx, cy] = raw.c!; g.fillStyle = INK; g.beginPath(); g.arc(X(cx), Y(cy), raw.r! * 0.45 * PX, 0, Math.PI * 2); g.fill();
        }
        g.globalAlpha = 1;
      }
      if (pass === 'ink') stroke(g, pts, INK, raw.t === 'o' ? 1.4 : w);
    }
  }
}
