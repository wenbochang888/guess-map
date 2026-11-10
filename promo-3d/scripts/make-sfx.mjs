// 原创音效合成：只用 Node 标准库，固定种子，结果可复现；不含任何第三方采样。
// 运行：node promo-3d/scripts/make-sfx.mjs   → 写出 promo-3d/public/audio/sfx/*.wav
import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const OUT = fileURLToPath(new URL('../public/audio/sfx/', import.meta.url));
const SR = 48000;
let seed = 0x5eed1234;
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
const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d)); // 起音 a 秒，衰减时间常数 d 秒
function lowpass(x, fc) { const k = 1 - Math.exp(-2 * Math.PI * fc / SR); let y = 0; return x.map((v) => (y += k * (v - y))); }
function highpass(x, fc) { const lp = lowpass(Float32Array.from(x), fc); return x.map((v, i) => v - lp[i]); }
function normalize(x, peakDb) { const p = x.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1, g = Math.pow(10, peakDb / 20) / p; return x.map((v) => v * g); }
/** 柔和马林巴式音符：基频 + 4 倍泛音，快起音、指数衰减 */
function note(x, start, freq, dur, amp = 1) {
  const s0 = Math.round(start * SR);
  for (let i = 0; i < dur * SR && s0 + i < x.length; i++) {
    const t = i / SR, e = env(t, 0.003, dur / 4);
    x[s0 + i] += amp * e * (Math.sin(2 * Math.PI * freq * t) + 0.25 * Math.sin(2 * Math.PI * freq * 4 * t) * Math.exp(-t * 30));
  }
}
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

const S = {};
// 打字：极短的带通噪声「嗒」
S.tick = (() => { const x = len(0.04); for (let i = 0; i < x.length; i++) x[i] = rnd() * env(i / SR, 0.0008, 0.006); return normalize(highpass(lowpass(x, 6000), 1800), -14); })();
// 发送：上扬的气声「嗖」
S.send = (() => { const x = len(0.22); let ph = 0; for (let i = 0; i < x.length; i++) { const t = i / SR, f = 300 + 1500 * (t / 0.22); ph += f / SR; x[i] = (rnd() * 0.6 + 0.4 * Math.sin(2 * Math.PI * ph)) * Math.sin(Math.PI * t / 0.22) ** 2; } return normalize(lowpass(highpass(x, 400), 5000), -12); })();
// 收到消息：两音轻「叮咚」（A5→E6）
S.msg = (() => { const x = len(0.5); note(x, 0, midi(81), 0.35, 0.7); note(x, 0.07, midi(88), 0.4, 0.6); return normalize(x, -12); })();
// 像素弹出：下滑方波「啵」+ 像素颗粒
S.pop = (() => { const x = len(0.25); let ph = 0; for (let i = 0; i < x.length; i++) { const t = i / SR, f = 900 * Math.exp(-t * 14) + 180; ph += f / SR; x[i] = (Math.sin(2 * Math.PI * ph) > 0 ? 0.5 : -0.5) * env(t, 0.002, 0.05); } return normalize(lowpass(x, 4500), -11); })();
// 落地：低频「咚」+ 一点木质噪声
S.thud = (() => { const x = len(0.35); let ph = 0; for (let i = 0; i < x.length; i++) { const t = i / SR, f = 140 * Math.exp(-t * 9) + 55; ph += f / SR; x[i] = Math.sin(2 * Math.PI * ph) * env(t, 0.002, 0.08) + 0.25 * rnd() * env(t, 0.001, 0.01); } return normalize(lowpass(x, 2500), -8); })();
// 踩按钮：短促木鱼「哒」
S.tap = (() => { const x = len(0.12); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = Math.sin(2 * Math.PI * 1150 * t) * env(t, 0.0008, 0.018) + 0.4 * rnd() * env(t, 0.0005, 0.004); } return normalize(highpass(x, 300), -10); })();
// 答对：D 大调上行三音（D5 F#5 A5）+ 高八度点缀
S.correct = (() => { const x = len(0.8); [74, 78, 81].forEach((m, i) => note(x, i * 0.075, midi(m), 0.45, 0.8)); note(x, 0.24, midi(86), 0.5, 0.35); return normalize(x, -9); })();
// 答错：温和的下行全音（E5→D5），不刺耳、不嘲笑
S.wrong = (() => { const x = len(0.7); note(x, 0, midi(76), 0.35, 0.6); note(x, 0.14, midi(74), 0.5, 0.55); return normalize(lowpass(x, 3500), -12); })();
// 镜头/面板滑动：带通噪声「呼」
S.whoosh = (() => { const x = len(0.45); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = rnd() * Math.sin(Math.PI * t / 0.45) ** 3; } return normalize(lowpass(highpass(x, 600), 3000), -18); })();
// 脚步：轻「哒」，奔跑时连发
S.step = (() => { const x = len(0.06); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = Math.sin(2 * Math.PI * 420 * t) * env(t, 0.001, 0.012) + 0.3 * rnd() * env(t, 0.0005, 0.005); } return normalize(lowpass(x, 3000), -16); })();
// 片尾：D6/9 琶音亮片
S.sparkle = (() => { const x = len(1.4); [74, 78, 81, 86, 88, 93].forEach((m, i) => note(x, i * 0.06, midi(m), 0.9, 0.55)); return normalize(x, -11); })();

await mkdir(OUT, {recursive: true});
for (const [k, v] of Object.entries(S)) await writeFile(path.join(OUT, `${k}.wav`), wav(v));
console.log(`wrote ${Object.keys(S).length} sfx to ${OUT}`);
