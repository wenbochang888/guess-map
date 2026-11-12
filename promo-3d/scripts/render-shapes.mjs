// 渲染「各省像什么」。在仓库根目录运行：
//   node promo-3d/scripts/render-shapes.mjs --comp=ShapesSample --version=s1          # 1080×1920
//   node promo-3d/scripts/render-shapes.mjs --comp=ShapesSample --version=s1 --preview  # 540×960
// 输出：promo-3d/output/shapes/<version>/<comp>[-preview].mp4，已存在时拒绝覆盖。
import {bundle} from '@remotion/bundler';
import {openBrowser, selectComposition, renderMedia} from '@remotion/renderer';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {mkdir, writeFile, access} from 'node:fs/promises';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
const preview = process.argv.includes('--preview');
const comp = arg('comp') ?? 'ShapesSample';
const version = arg('version') ?? 's1';
if (!/^[a-z0-9-]+$/.test(version) || !/^[A-Za-z]+$/.test(comp)) throw Error('invalid --version/--comp');
const concurrency = Number(arg('concurrency') ?? Math.max(2, Math.floor(os.cpus().length / 2)));
const gl = process.env.GL ?? (process.platform === 'darwin' ? 'angle' : 'swangle');
const browserExecutable = process.env.REMOTION_BROWSER ?? null;

for (const f of ['public/audio/shapes/musi.mp3', 'public/audio/shapes/scribble.wav']) {
  try { await access(path.join(ROOT, f)); } catch { throw Error(`缺少音频 ${f}：先运行 bash promo-3d/scripts/mac-run.sh shapes-audio`); }
}
const OUT = path.join(ROOT, 'output', 'shapes', version);
await mkdir(OUT, {recursive: true});
const name = `${comp}${preview ? '-preview' : ''}.mp4`;
const outputLocation = path.join(OUT, name);
try { await access(outputLocation); throw Error(`已存在：${outputLocation}（换一个 --version）`); } catch (e) { if (e.code !== 'ENOENT') throw e; }

console.log(`bundling… (comp=${comp}, gl=${gl}, concurrency=${concurrency})`);
const serveUrl = await bundle({entryPoint: path.join(ROOT, 'src/index.ts'), publicDir: path.join(ROOT, 'public')});
const chromiumOptions = {gl};
const browser = await openBrowser('chrome', {browserExecutable, chromiumOptions});
const t0 = Date.now();
try {
  const base = {serveUrl, browserExecutable, puppeteerInstance: browser, chromiumOptions, timeoutInMilliseconds: 180000};
  const composition = await selectComposition({...base, id: comp});
  let last = -1;
  await renderMedia({
    ...base, composition, outputLocation,
    codec: 'h264', crf: preview ? 23 : 16, pixelFormat: 'yuv420p', colorSpace: 'bt709', imageFormat: 'jpeg', jpegQuality: 95,
    audioCodec: 'aac', audioBitrate: '192k', scale: preview ? 0.5 : 1, concurrency,
    onProgress: ({progress}) => { const p = Math.floor(progress * 20); if (p !== last) { last = p; console.log(`${name}: ${p * 5}%  ${Math.round((Date.now() - t0) / 1000)}s`); } },
  });
} finally { await browser.close({silent: true}); }
await writeFile(path.join(OUT, `${name}.json`), JSON.stringify({file: name, comp, version, preview, gl, concurrency, platform: process.platform, seconds: Math.round((Date.now() - t0) / 1000), renderedAt: new Date().toISOString()}, null, 2));
console.log(`done → ${outputLocation}`);
