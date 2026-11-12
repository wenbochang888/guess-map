// 「各省像什么」配乐（原创合成）：120BPM、D 小调、30 秒，拍点与 src/shapes/timeline.ts 对齐（每拍 0.5 秒 = 15 帧）。
// 画风参考：深夜、电影感、低频厚重、全程推进不留空。音色函数与 make-music.mjs 相同，另加 808 低音、
// 低音鼓（tom）、暗色拨弦；只用 Node 标准库，固定种子，无采样、无现成旋律。
// 运行：node promo-3d/scripts/make-music-shapes.mjs   → promo-3d/public/audio/shapes/music-shapes.wav
//
// 段落（秒）：
//   0       开场重击（钩子），808 + 鼓组 + 拨弦固定音型直接进
//   0–14    律动：底鼓 1 / 2.5 / 3 拍，2、4 拍带尾巴的拍手，16 分踩镲，808 跟和弦根音
//   14–15   tom 滚奏 + 起音 → 15.0 重击（换你猜）
//   15–22   竞猜：半速鼓，808 八分音符脉冲，紧张
//   22–26   最后一个：撤鼓，只留低音持续音、滴答和稀疏拨弦
//   25.5–26 滚奏 → 26.0 重击回鼓（片尾），29.5 收束重击
import {writeFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const OUT = fileURLToPath(new URL('../public/audio/shapes/music-shapes.wav', import.meta.url));
const SR = 48000, DUR = 30, N = DUR * SR, B = 0.5;
let seed = 0x5a7e2026;
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

// ---------- 新音色 ----------
/** 808：正弦 + 轻微下滑 + 饱和，长尾 */
function sub808(m, dur) {
  const f = midi(m), x = buf(dur); let ph = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR; ph += f * (1 + 0.5 * Math.exp(-t * 40)) / SR;
    x[i] = Math.tanh(2.2 * Math.sin(2 * Math.PI * ph)) / Math.tanh(2.2) * Math.min(1, t / 0.003) * Math.min(1, (dur - t) / 0.05) * (0.75 + 0.25 * Math.exp(-t * 3));
  }
  return x;
}
/** 低音鼓：下滑正弦 + 皮面噪声 */
function tom(f0) {
  const x = buf(0.5); let ph = 0;
  for (let i = 0; i < x.length; i++) { const t = i / SR; ph += (f0 + f0 * 0.8 * Math.exp(-t * 18)) / SR; x[i] = Math.sin(2 * Math.PI * ph) * Math.exp(-t * 7) + 0.18 * rnd() * Math.exp(-t * 80); }
  return lp1(x, 2500);
}
/** 带尾巴的拍手（用衰减噪声模拟房间混响） */
function clapTail() {
  const c = clap(), x = buf(0.9);
  for (let i = 0; i < x.length; i++) x[i] = (i < c.length ? c[i] : 0) + 0.22 * rnd() * Math.exp(-i / SR / 0.22) * Math.min(1, i / SR / 0.01);
  return hp1(lp2(x, 5000), 600);
}
/** 暗色拨弦：FM 拨奏 + 低通 */
function pluck(m, dur = 0.4) {
  const f = midi(m), x = buf(dur);
  for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = Math.sin(2 * Math.PI * f * t + 1.4 * Math.exp(-t / 0.05) * Math.sin(2 * Math.PI * f * t)) * Math.exp(-t / 0.13) * Math.min(1, t / 0.002); }
  return lp2(x, 2600);
}
/** 低音持续音（D） */
function drone(dur) {
  const x = buf(dur);
  for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = (Math.sin(2 * Math.PI * midi(26) * t) + 0.4 * Math.sin(2 * Math.PI * midi(38) * t + 0.3 * Math.sin(2 * Math.PI * 0.25 * t))) * Math.min(1, t / 0.6) * Math.min(1, (dur - t) / 0.4); }
  return x;
}

// ---------- 和声（D 小调） ----------
const CH = {Dm: [62, 65, 69], Bb: [62, 65, 70], F: [60, 65, 69], C: [60, 64, 67], Gm: [62, 67, 70], A: [61, 64, 69]};
const ROOT = {Dm: 26, Bb: 34, F: 29, C: 36, Gm: 31, A: 33};
const BARS = ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'Gm', 'Dm', 'A', 'Dm', 'Dm'];
const chordAt = (t) => BARS[Math.min(14, Math.floor(t / 2))];
const span = (a, b, step = B, off = 0) => { const r = []; for (let t = a + off; t < b - 1e-6; t += step) r.push(+t.toFixed(4)); return r; };
const inRanges = (t, rs) => rs.some(([a, b]) => t >= a - 1e-6 && t < b - 1e-6);

// ---------- 编排 ----------
const K = kick(), CT = clapTail(), HC = hat(0.03), HO = hat(0.16), CR = crash(), BM = boom();
const FULL = [[0, 14], [26, 29.5]], HALF = [[15, 22]];
const kicks = [];
for (let bar = 0; bar < 15; bar++) {
  const t0 = bar * 2;
  [0, 0.75, 1.0, 1.625].forEach((o) => { if (inRanges(t0 + o, FULL)) kicks.push(t0 + o); });
  if (inRanges(t0, HALF)) kicks.push(t0, t0 + 1.25);
}
[14, 14.25, 14.5, 14.75].forEach((t) => kicks.push(t));
kicks.forEach((t) => put(drums, t, K, 1.0));
// 重击：开场、换你猜、回鼓、收束
[0, 15, 26, 29.5].forEach((t) => { put(drums, t, BM, 0.55); put(drums, t, CR, 0.16); });
// 拍手：律动段 2、4 拍；半速段只在 3 拍
[...span(0, 14, 1, 0.5), ...span(26, 29.5, 1, 0.5)].forEach((t) => put(drums, t, CT, 0.42, 0.05));
span(15, 22, 2, 1).forEach((t) => put(drums, t, CT, 0.48, 0.05));
// 踩镲 16 分（重音在反拍）
[...span(0, 14, B / 4), ...span(15, 22, B / 4), ...span(26, 29.5, B / 4)].forEach((t, i) => put(drums, t, HC, i % 4 === 2 ? 0.17 : i % 2 ? 0.07 : 0.1, i % 2 ? 0.3 : -0.2));
span(22, 25.5, B / 2).forEach((t, i) => put(drums, t, HC, i % 2 ? 0.15 : 0.08, i % 2 ? 0.3 : -0.3));
[3.75, 7.75, 11.75, 27.75].forEach((t) => put(drums, t, HO, 0.14, 0.25));
// tom 滚奏：14–15 冲进「换你猜」；每 4 小节末尾一小段
const toms = (a, n, f0, g) => span(a, a + n * B / 4, B / 4).forEach((t, i) => put(drums, t, tom(f0 * (1 - i * 0.04)), g, (i % 2 ? 0.25 : -0.25)));
toms(14, 8, 140, 0.5); toms(7.5, 2, 120, 0.4); toms(25.5, 4, 150, 0.45);
put(drums, 13, riser(2), 0.25); put(drums, 25, riser(1), 0.2);

// 808：律动段跟底鼓走；半速段八分音符脉冲；最后一题只留持续音
for (let bar = 0; bar < 15; bar++) {
  const t0 = bar * 2, r = ROOT[BARS[bar]];
  if (inRanges(t0, FULL)) [[0, 0.7], [0.75, 0.25], [1.0, 0.6], [1.625, 0.35]].forEach(([o, d]) => put(music, t0 + o, sub808(r, d), 0.42));
  if (inRanges(t0, HALF)) span(t0, t0 + 2, B / 2).forEach((t) => put(music, t, sub808(r, 0.22), 0.34));
}
put(music, 22, drone(4.2), 0.32);
// 暗色铺底
BARS.forEach((c, b) => put(music, b * 2, pad(CH[c].map((m) => m - 12), 2.25, b === 11 || b === 12 ? 700 : 1100), 0.13, b % 2 ? 0.25 : -0.25));
// 拨弦固定音型（16 分，和弦音上下行），制造「想知道下一个」的推进感
const ARP = [0, 2, 1, 2, 0, 2, 1, 3];
for (let bar = 0; bar < 15; bar++) {
  const t0 = bar * 2, ch = CH[BARS[bar]], notes = [ch[0], ch[1], ch[2], ch[0] + 12];
  const sparse = bar === 11 || bar === 12; // 最后一题：稀疏
  span(t0, t0 + 2, B / 4).forEach((t, i) => {
    if (t >= 29.5 || (t >= 14 && t < 15)) return;
    if (sparse && i % 4) return;
    put(music, t, pluck(notes[ARP[i % 8]] + 12, 0.35), (i % 4 === 0 ? 0.13 : 0.08) * (sparse ? 1.4 : 1), (i % 2 ? 0.35 : -0.35));
  });
}

// ---------- 侧链 + 混音 ----------
const duck = new Float32Array(N).fill(1);
kicks.forEach((t) => { const s0 = Math.round(t * SR); for (let i = 0; i < 0.3 * SR && s0 + i < N; i++) duck[s0 + i] = Math.min(duck[s0 + i], 1 - 0.55 * Math.exp(-i / SR / 0.09)); });
const out = [new Float32Array(N), new Float32Array(N)];
let peak = 0;
for (let c = 0; c < 2; c++) for (let i = 0; i < N; i++) {
  const t = i / SR, fade = Math.min(1, (DUR - t) / 0.25);
  const v = Math.tanh((drums[c][i] + music[c][i] * duck[i]) * 1.5) * fade; // 更重的软削波：密、响、贴脸
  out[c][i] = v; peak = Math.max(peak, Math.abs(v));
}
const g = 10 ** (-1.2 / 20) / peak;

const data = Buffer.alloc(44 + N * 4);
data.write('RIFF', 0); data.writeUInt32LE(36 + N * 4, 4); data.write('WAVE', 8); data.write('fmt ', 12);
data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(2, 22); data.writeUInt32LE(SR, 24);
data.writeUInt32LE(SR * 4, 28); data.writeUInt16LE(4, 32); data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) for (let c = 0; c < 2; c++) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, out[c][i] * g)) * 32767), 44 + i * 4 + c * 2);
await mkdir(new URL('../public/audio/shapes/', import.meta.url), {recursive: true});
await writeFile(OUT, data);
console.log(`wrote ${OUT} (${DUR}s, ${kicks.length} kicks)`);
