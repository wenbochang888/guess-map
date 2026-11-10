// 3D 宣传片配乐（原创合成）：120BPM、D 大调、30 秒，节拍与 src/timeline.ts 对齐（每拍 0.5 秒 = 15 帧）。
// 只用 Node 标准库，固定种子，结果可复现；不含任何第三方采样或现成旋律。
// 运行：node promo-3d/scripts/make-music.mjs   → promo-3d/public/audio/music-3d.wav
//
// 段落（秒）：
//   0–4   聊天开场：薄铺底 + 轻沙锤，2–4 秒起音墙 + 军鼓滚奏，4.0 重拍进鼓（小图跳出屏幕）
//   4–21  律动：每拍底鼓、反拍踩镲与低音、2/4 拍拍手（8 秒起）、和弦短音；4/12/26 秒出现品牌动机 D–A–F#–E
//   21–25 犹豫/猜错：撤鼓，只留滴答踩镲和低通铺底；23.0 单击（踩错）
//   25–28 结算页回鼓，25.5 起滚奏，26.0 硬切重拍（奔跑）
//   28–30 片尾：重拍 + 长和弦 + 琶音收束
import {writeFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const OUT = fileURLToPath(new URL('../public/audio/music-3d.wav', import.meta.url));
const SR = 48000, DUR = 30, N = DUR * SR, B = 0.5; // 每拍 0.5 秒
let seed = 0x3d3d2026;
const rnd = () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
const midi = (m) => 440 * 2 ** ((m - 69) / 12);

// 两条总线：鼓（不压缩）和乐器（被底鼓侧链压低，产生「呼吸」律动）
const drums = [new Float32Array(N), new Float32Array(N)];
const music = [new Float32Array(N), new Float32Array(N)];
function put(bus, t0, x, gain = 1, pan = 0) {
  const s0 = Math.round(t0 * SR), gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
  for (let i = 0; i < x.length && s0 + i < N; i++) if (s0 + i >= 0) { bus[0][s0 + i] += x[i] * gl; bus[1][s0 + i] += x[i] * gr; }
}
const buf = (sec) => new Float32Array(Math.round(sec * SR));
const lp1 = (x, fc) => { let y = 0; const k = 1 - Math.exp(-2 * Math.PI * fc / SR); return x.map((v) => (y += k * (v - y))); };
const hp1 = (x, fc) => { const l = lp1(Float32Array.from(x), fc); return x.map((v, i) => v - l[i]); };
const lp2 = (x, fc) => lp1(lp1(x, fc), fc);
const blep = (p, dt) => (p < dt ? (p /= dt, p + p - p * p - 1) : p > 1 - dt ? (p = (p - 1) / dt, p * p + p + p + 1) : 0);

// ---------- 音色 ----------
function kick() {
  const x = buf(0.45); let ph = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR, f = 52 + 120 * Math.exp(-t * 30); ph += f / SR;
    x[i] = Math.sin(2 * Math.PI * ph) * Math.min(1, t / 0.001) * Math.exp(-t * 10) + 0.25 * rnd() * Math.exp(-t * 400);
  }
  return x.map((v) => Math.tanh(1.8 * v) / Math.tanh(1.8));
}
function boom() { // 重拍下的长低音
  const x = buf(1.2); let ph = 0;
  for (let i = 0; i < x.length; i++) { const t = i / SR; ph += (40 + 30 * Math.exp(-t * 8)) / SR; x[i] = Math.sin(2 * Math.PI * ph) * Math.exp(-t * 2.6) * Math.min(1, t / 0.004); }
  return x;
}
function clap() {
  const x = buf(0.35);
  for (let i = 0; i < x.length; i++) {
    const t = i / SR; let e = 0;
    for (const t0 of [0, 0.009, 0.018]) if (t >= t0) e += Math.exp(-(t - t0) / 0.004);
    if (t > 0.018) e += 0.55 * Math.exp(-(t - 0.018) / 0.09);
    x[i] = rnd() * e;
  }
  return hp1(lp2(x, 4500), 900);
}
const hat = (decay) => { const x = buf(decay * 6); for (let i = 0; i < x.length; i++) x[i] = rnd() * Math.exp(-i / SR / decay); return hp1(hp1(x, 7000), 7000); };
const shaker = () => { const x = buf(0.08); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = rnd() * Math.min(1, t / 0.006) * Math.exp(-t / 0.025); } return hp1(x, 5000); };
const crash = () => { const x = buf(2.4); for (let i = 0; i < x.length; i++) x[i] = rnd() * Math.exp(-i / SR / 0.7); return lp1(hp1(hp1(x, 4000), 4000), 12000); };
function riser(dur) {
  const x = buf(dur); let y = 0;
  for (let i = 0; i < x.length; i++) { const u = i / x.length, fc = 300 * 30 ** u, k = 1 - Math.exp(-2 * Math.PI * fc / SR); y += k * (rnd() - y); x[i] = y * u * u; }
  return hp1(x, 200);
}
/** 锯齿合成（PolyBLEP 抗混叠），可多声部失谐 */
function saws(freqs, dur, detune = 0) {
  const x = buf(dur), ph = [];
  const voices = freqs.flatMap((f) => (detune ? [f * 2 ** (-detune / 1200), f, f * 2 ** (detune / 1200)] : [f]));
  voices.forEach(() => ph.push((rnd() + 1) / 2));
  for (let i = 0; i < x.length; i++) {
    let v = 0;
    voices.forEach((f, j) => { const dt = f / SR; ph[j] = (ph[j] + dt) % 1; v += 2 * ph[j] - 1 - blep(ph[j], dt); });
    x[i] = v / voices.length;
  }
  return x;
}
/** 滤波包络：截止频率随时间从 hi 衰减到 lo */
function sweepLP(x, lo, hi, tau) {
  let a = 0, b = 0;
  return x.map((v, i) => { const fc = lo + (hi - lo) * Math.exp(-i / SR / tau), k = 1 - Math.exp(-2 * Math.PI * fc / SR); a += k * (v - a); b += k * (a - b); return b; });
}
function bass(m, dur) {
  const f = midi(m), x = saws([f], dur), sub = buf(dur);
  for (let i = 0; i < sub.length; i++) sub[i] = Math.sin(2 * Math.PI * f * i / SR);
  const y = sweepLP(x, 180, 1100, 0.07);
  return y.map((v, i) => { const t = i / SR; return (v * 0.8 + sub[i] * 0.3) * Math.min(1, t / 0.004) * Math.min(1, (dur - t) / 0.03); });
}
function stab(chord, dur = 0.22) {
  const x = sweepLP(saws(chord.map(midi), dur, 7), 500, 4200, 0.05);
  return x.map((v, i) => v * Math.exp(-i / SR / 0.11) * Math.min(1, i / SR / 0.002));
}
function pad(chord, dur, cutoff) {
  const x = lp2(saws(chord.map(midi), dur, 9), cutoff);
  return x.map((v, i) => { const t = i / SR; return v * Math.min(1, t / 0.25) * Math.min(1, (dur - t) / 0.35); });
}
function bell(m, dur = 0.6) { // 电钢/钟琴感拨奏：FM
  const f = midi(m), x = buf(dur);
  for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = Math.sin(2 * Math.PI * f * t + 2.2 * Math.exp(-t / 0.12) * Math.sin(2 * Math.PI * 2 * f * t)) * Math.exp(-t / 0.32) * Math.min(1, t / 0.002); }
  return x;
}

// ---------- 和声 ----------
const CH = {D: [62, 66, 69], A: [61, 64, 69], Bm: [62, 66, 71], G: [62, 67, 71], Em: [64, 67, 71]};
const ROOT = {D: 38, A: 33, Bm: 35, G: 31, Em: 40};
const BARS = ['D', 'A', 'D', 'A', 'Bm', 'G', 'D', 'A', 'Bm', 'G', 'D', 'Em', 'A', 'D', 'D']; // 15 小节 × 2 秒
const chordAt = (t) => BARS[Math.min(14, Math.floor(t / 2))];
const span = (a, b, step = B, off = 0) => { const r = []; for (let t = a + off; t < b - 1e-6; t += step) r.push(+t.toFixed(4)); return r; };

// ---------- 编排 ----------
const K = kick(), CL = clap(), HC = hat(0.035), HO = hat(0.18), SH = shaker(), CR = crash(), BM = boom();
const kicks = [...span(4, 21), 23, ...span(25, 28.01)];
kicks.forEach((t) => put(drums, t, K, 0.95));
[4, 23, 26, 28].forEach((t) => put(drums, t, BM, t === 23 ? 0.35 : 0.4));
[4, 26, 28].forEach((t) => put(drums, t, CR, 0.22));
// 拍手：2、4 拍
[...span(8, 21, 1, 0.5), ...span(26, 28, 1, 0.5)].forEach((t) => put(drums, t, CL, 0.42, 0.05));
// 滚奏：进鼓前、回鼓后冲向硬切
const roll = (a, b, g0, g1) => span(a, b, B / 4).forEach((t, i, arr) => put(drums, t, CL, g0 + (g1 - g0) * i / (arr.length - 1), 0.05));
roll(3, 4, 0.06, 0.34); roll(25.5, 26, 0.12, 0.36);
// 踩镲
[...span(4, 21, B, B / 2), ...span(25, 28, B, B / 2)].forEach((t, i) => put(drums, t, HC, 0.2, 0.25));
span(21, 23, B / 2).forEach((t, i) => put(drums, t, HC, i % 2 ? 0.2 : 0.13, i % 2 ? 0.3 : -0.3)); // 犹豫：滴答
span(23.5, 25, B, B / 2).forEach((t) => put(drums, t, HC, 0.13, 0.25));
[7.75, 13.75, 19.75, 27.75].forEach((t) => put(drums, t, HO, 0.16, 0.25)); // 段落前的开镲
// 沙锤 16 分（开场轻轻给出时值感）
span(0.5, 4, B / 2).forEach((t, i) => put(drums, t, SH, i % 2 ? 0.14 : 0.09, -0.35));
[...span(8, 21, B / 4), ...span(26, 28, B / 4)].forEach((t, i) => put(drums, t, SH, i % 4 === 2 ? 0.06 : 0.03, -0.35));
// 起音墙
put(drums, 2, riser(2), 0.3); put(drums, 7, riser(1), 0.12); put(drums, 13, riser(1), 0.12); put(drums, 19, riser(1), 0.12);
put(drums, 21.5, riser(1.5), 0.14); put(drums, 25, riser(1), 0.2);

// 低音：反拍 8 分音符
[...span(4, 21, B, B / 2), ...span(25, 28, B, B / 2)].forEach((t) => put(music, t, bass(ROOT[chordAt(t)], 0.22), 0.2));
// 和弦短音：反拍（8 秒起）
[...span(8, 21, B, B / 2), ...span(26, 28, B, B / 2)].forEach((t) => put(music, t, stab(CH[chordAt(t)].map((m) => m + 12)), 0.1, 0.15));
// 铺底：每小节一个和弦
BARS.forEach((c, b) => {
  const t = b * 2, cut = b < 2 ? 900 : b === 11 || b === 12 ? 700 : b >= 13 ? 2200 : 1700, g = b < 2 ? 0.42 : b === 11 || b === 12 ? 0.36 : 0.11;
  put(music, t, pad(CH[c], b === 14 ? 2.0 : 2.25, cut), g, b % 2 ? 0.2 : -0.2);
});
put(music, 21, pad(CH.D, 1.25, 800), 0.36, 0); // 犹豫段提前撤成低通铺底
// 品牌动机 D–A–F#–E 与回答句（16 分音符位置, midi, 时值 16 分）
const M1 = [[0, 74, 3], [3, 69, 3], [6, 66, 2], [8, 64, 6]];
const M2 = [[0, 66, 3], [3, 69, 3], [6, 71, 2], [8, 69, 4], [12, 73, 4]];
const phrase = (t0, m) => m.forEach(([p, n, d]) => put(music, t0 + p * B / 4, bell(n + 12, Math.max(0.35, d * B / 4 + 0.25)), 0.16, 0.1));
phrase(4, M1); phrase(6, M2); phrase(12, M1); phrase(14, M2); phrase(26, M1);
// 片尾：28.0 长和弦 + 琶音
put(music, 28, stab(CH.D.map((m) => m + 12), 1.4), 0.2, 0);
[74, 78, 81, 86, 90].forEach((m, i) => put(music, 28 + i * B / 2, bell(m, 1.2), 0.12, (i % 2 ? 0.25 : -0.25)));

// ---------- 侧链 + 混音 ----------
const duck = new Float32Array(N).fill(1);
kicks.forEach((t) => { const s0 = Math.round(t * SR); for (let i = 0; i < 0.4 * SR && s0 + i < N; i++) duck[s0 + i] = Math.min(duck[s0 + i], 1 - 0.65 * Math.exp(-i / SR / 0.11)); });
const out = [new Float32Array(N), new Float32Array(N)];
let peak = 0;
for (let c = 0; c < 2; c++) for (let i = 0; i < N; i++) {
  const t = i / SR, fade = Math.min(1, (DUR - t) / 0.6);
  const v = Math.tanh((drums[c][i] + music[c][i] * duck[i]) * 1.1) * fade;
  out[c][i] = v; peak = Math.max(peak, Math.abs(v));
}
const g = 10 ** (-1.5 / 20) / peak; // 峰值 -1.5 dBFS

// ---------- 写 WAV（16-bit 立体声）----------
const data = Buffer.alloc(44 + N * 4);
data.write('RIFF', 0); data.writeUInt32LE(36 + N * 4, 4); data.write('WAVE', 8); data.write('fmt ', 12);
data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(2, 22); data.writeUInt32LE(SR, 24);
data.writeUInt32LE(SR * 4, 28); data.writeUInt16LE(4, 32); data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) for (let c = 0; c < 2; c++) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, out[c][i] * g)) * 32767), 44 + i * 4 + c * 2);
await mkdir(new URL('../public/audio/', import.meta.url), {recursive: true});
await writeFile(OUT, data);
console.log(`wrote ${OUT} (${DUR}s, ${kicks.length} kicks)`);
