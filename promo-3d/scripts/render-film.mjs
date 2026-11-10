// 渲染成片。在仓库根目录运行：
//   node promo-3d/scripts/render-film.mjs --preview --version=v1      # 540×960 预览片（快）
//   node promo-3d/scripts/render-film.mjs --version=v1                # 1080×1920 正式片
// 选项：--frames=0-299（只渲染一段，调试用）  --concurrency=8
// 输出：promo-3d/output/<version>/caiditu-3d-30s[-preview].mp4，已存在时拒绝覆盖。
import {bundle} from '@remotion/bundler';
import {openBrowser, selectComposition, renderMedia} from '@remotion/renderer';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {mkdir, writeFile, access} from 'node:fs/promises';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
const preview = process.argv.includes('--preview');
const version = arg('version') ?? 'v1';
if (!/^[a-z0-9-]+$/.test(version)) throw Error('invalid --version');
const range = arg('frames')?.split('-').map(Number);
const concurrency = Number(arg('concurrency') ?? Math.max(2, Math.floor(os.cpus().length / 2)));
const gl = process.env.GL ?? (process.platform === 'darwin' ? 'angle' : 'swangle');
const browserExecutable = process.env.REMOTION_BROWSER ?? null;

try { await access(path.join(ROOT, 'public/captures/layout.json')); } catch { throw Error('缺少真实素材：先运行 node promo-3d/scripts/capture.mjs --seed=61 --expect=山东省,江西省'); }
const OUT = path.join(ROOT, 'output', version);
await mkdir(OUT, {recursive: true});
const name = `caiditu-3d-30s${preview ? '-preview' : ''}${range ? `-f${range[0]}-${range[1]}` : ''}.mp4`;
const outputLocation = path.join(OUT, name);
try { await access(outputLocation); throw Error(`已存在：${outputLocation}（换一个 --version）`); } catch (e) { if (e.code !== 'ENOENT') throw e; }

console.log(`bundling… (gl=${gl}, concurrency=${concurrency})`);
const serveUrl = await bundle({entryPoint: path.join(ROOT, 'src/index.ts'), publicDir: path.join(ROOT, 'public')});
const chromiumOptions = {gl};
const browser = await openBrowser('chrome', {browserExecutable, chromiumOptions});
const t0 = Date.now();
try {
  const base = {serveUrl, browserExecutable, puppeteerInstance: browser, chromiumOptions, timeoutInMilliseconds: 180000};
  const composition = await selectComposition({...base, id: 'Film', inputProps: {guides: false, audio: true}});
  let last = -1;
  await renderMedia({
    ...base, composition, inputProps: {guides: false, audio: true}, outputLocation,
    codec: 'h264', crf: preview ? 23 : 16, pixelFormat: 'yuv420p', colorSpace: 'bt709', imageFormat: 'jpeg', jpegQuality: 95,
    audioCodec: 'aac', audioBitrate: '192k', scale: preview ? 0.5 : 1, concurrency,
    frameRange: range ? [range[0], range[1]] : null,
    onProgress: ({progress}) => { const p = Math.floor(progress * 20); if (p !== last) { last = p; console.log(`${name}: ${p * 5}%  ${Math.round((Date.now() - t0) / 1000)}s`); } },
  });
} finally { await browser.close({silent: true}); }
await writeFile(path.join(OUT, `${name}.json`), JSON.stringify({file: name, version, preview, frames: range ?? [0, 899], fps: 30, size: preview ? [540, 960] : [1080, 1920], gl, concurrency, platform: process.platform, seconds: Math.round((Date.now() - t0) / 1000), renderedAt: new Date().toISOString()}, null, 2));
console.log(`done → ${outputLocation}`);
