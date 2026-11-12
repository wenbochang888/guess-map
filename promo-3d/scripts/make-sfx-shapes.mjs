// 「各省像什么」原创音效：只用 Node 标准库，固定种子，可复现，无第三方采样。
// 运行：node promo-3d/scripts/make-sfx-shapes.mjs   → promo-3d/public/audio/shapes/*.wav
import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const OUT = fileURLToPath(new URL('../public/audio/shapes/', import.meta.url));
const SR = 48000;
let seed = 0x0dd1e5;
const rnd = () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
function wav(samples) {
  const n = samples.length, buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) { const v = Math.max(-1, Math.min(1, samples[i])) * 32767 | 0; buf.writeInt16LE(v, 44 + i * 4); buf.writeInt16LE(v, 46 + i * 4); }
  return buf;
}
const len = (sec) => new Float32Array(Math.round(sec * SR));
function lowpass(x, fc) { const k = 1 - Math.exp(-2 * Math.PI * fc / SR); let y = 0; return x.map((v) => (y += k * (v - y))); }
function highpass(x, fc) { const lp = lowpass(Float32Array.from(x), fc); return x.map((v, i) => v - lp[i]); }
function normalize(x, peakDb) { const p = x.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1, g = 10 ** (peakDb / 20) / p; return x.map((v) => v * g); }

const S = {};
// 蜡笔涂鸦「沙沙」：0.6 秒（≈ 画 18 帧），一笔一笔的颗粒噪声，笔触间有起落
S.scribble = (() => {
  const x = len(0.62), strokes = [0, 0.09, 0.17, 0.27, 0.34, 0.43, 0.5];
  for (let i = 0; i < x.length; i++) {
    const t = i / SR; let e = 0;
    for (const s of strokes) { const u = (t - s) / 0.085; if (u > 0 && u < 1) e = Math.max(e, Math.sin(Math.PI * u) ** 0.7); }
    const grit = Math.abs(rnd()) > 0.82 ? 1.6 : 1; // 纸面颗粒
    x[i] = rnd() * e * grit * Math.min(1, (0.62 - t) / 0.05);
  }
  return normalize(lowpass(highpass(x, 1800), 7500), -13);
})();
// 「活过来」的弹簧「嘣～」：下滑后回弹的正弦 + 轻木质起音
S.boing = (() => {
  const x = len(0.55); let ph = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR, f = 330 + 260 * Math.exp(-t * 18) + 45 * Math.sin(2 * Math.PI * 11 * t) * Math.exp(-t * 5);
    ph += f / SR;
    x[i] = Math.sin(2 * Math.PI * ph) * Math.min(1, t / 0.003) * Math.exp(-t * 6) + 0.3 * rnd() * Math.exp(-t * 300);
  }
  return normalize(lowpass(x, 5000), -9);
})();

// 结论重击：极低频「咚」（60→38Hz）+ 胸腔感的低中频 + 一层短促的金属余韵，像电影预告片的落点
S.hit = (() => {
  const x = len(1.6); let ph = 0, ph2 = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR, f = 38 + 60 * Math.exp(-t * 12); ph += f / SR; ph2 += (110 + 80 * Math.exp(-t * 20)) / SR;
    x[i] = Math.sin(2 * Math.PI * ph) * Math.exp(-t * 2.2) * Math.min(1, t / 0.002)
      + 0.35 * Math.sin(2 * Math.PI * ph2) * Math.exp(-t * 9)
      + 0.5 * rnd() * Math.exp(-t * 60);
  }
  const shimmer = highpass(Float32Array.from(x, (_, i) => rnd() * Math.exp(-i / SR * 5)), 5000);
  return normalize(x.map((v, i) => Math.tanh(1.6 * v) + 0.12 * shimmer[i]), -3);
})();
// 字幕出现：很轻的木质「嗒」
S.tock = (() => { const x = len(0.09); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = Math.sin(2 * Math.PI * 820 * t) * Math.exp(-t * 90) + 0.3 * rnd() * Math.exp(-t * 500); } return normalize(highpass(x, 300), -16); })();
// 厚片翻起落定：低沉闷响 + 纸板的短促噪声
S.land = (() => {
  const x = len(0.5); let ph = 0;
  for (let i = 0; i < x.length; i++) { const t = i / SR, f = 70 + 90 * Math.exp(-t * 25); ph += f / SR; x[i] = Math.sin(2 * Math.PI * ph) * Math.exp(-t * 9) + 0.4 * rnd() * Math.exp(-t * 120); }
  return normalize(lowpass(x, 1800), -6);
})();
// 计数滴答：短高音
S.count = (() => { const x = len(0.05); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = Math.sin(2 * Math.PI * 2400 * t) * Math.exp(-t * 160); } return normalize(x, -14); })();

// 回落段亮灯：继电器「咔」+ 一记闷底 + 一层亮的余韵（和重军鼓同一下，压在鼓上不抢）
S.reveal = (() => {
  const x = len(0.9); let ph = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR; ph += (90 + 70 * Math.exp(-t * 30)) / SR;
    const click = rnd() * Math.exp(-t * 900);
    const thump = 0.6 * Math.sin(2 * Math.PI * ph) * Math.exp(-t * 14);
    const shimmer = 0.16 * [1320, 1980, 2640].reduce((a, f0, k) => a + Math.sin(2 * Math.PI * f0 * t + k) * Math.exp(-t * (4 + k)), 0) * Math.min(1, t / 0.01);
    x[i] = click + thump + shimmer;
  }
  return normalize(highpass(x, 60), -5);
})();
// 甘肃 A/B/C 弹出：短促的「啵」，三下音高依次升高
const pop = (f0) => { const x = len(0.18); let ph = 0; for (let i = 0; i < x.length; i++) { const t = i / SR; ph += f0 * (1 + 0.8 * Math.exp(-t * 60)) / SR; x[i] = Math.sin(2 * Math.PI * ph) * Math.exp(-t * 26) * Math.min(1, t / 0.002); } return normalize(x, -10); };
S.pop1 = pop(520); S.pop2 = pop(620); S.pop3 = pop(740);

await mkdir(OUT, {recursive: true});
for (const [k, v] of Object.entries(S)) await writeFile(path.join(OUT, `${k}.wav`), wav(v));
console.log(`wrote ${Object.keys(S).length} sfx to ${OUT}`);
