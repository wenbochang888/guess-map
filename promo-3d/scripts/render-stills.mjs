// 渲染静帧：node scripts/render-stills.mjs <CompositionId> <outDir> [frame,frame,...] [--scale=1]
// 浏览器：REMOTION_BROWSER=/path/to/chrome-headless-shell；GL：GL=angle（Mac）/ swangle（Linux 软件渲染）。
import {bundle} from '@remotion/bundler';
import {openBrowser, selectComposition, renderStill} from '@remotion/renderer';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {mkdir} from 'node:fs/promises';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const [id, outDir, framesArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!id || !outDir) throw Error('usage: render-stills.mjs <id> <outDir> [frames]');
const scale = Number(process.argv.find((a) => a.startsWith('--scale='))?.split('=')[1] ?? 1);
const frames = (framesArg ?? '0').split(',').map(Number);
const gl = process.env.GL ?? (process.platform === 'darwin' ? 'angle' : 'swangle');
const browserExecutable = process.env.REMOTION_BROWSER ?? null;
await mkdir(outDir, {recursive: true});
const serveUrl = await bundle({entryPoint: path.join(ROOT, 'src/index.ts'), publicDir: path.join(ROOT, 'public')});
const chromiumOptions = {gl};
const browser = await openBrowser('chrome', {browserExecutable, chromiumOptions});
try {
  const base = {serveUrl, browserExecutable, puppeteerInstance: browser, chromiumOptions, timeoutInMilliseconds: 120000};
  const composition = await selectComposition({...base, id});
  for (const frame of frames) {
    const output = path.join(outDir, `${id}-f${String(frame).padStart(3, '0')}.png`);
    const t = Date.now();
    await renderStill({...base, composition, frame, output, imageFormat: 'png', scale});
    console.log(`${output} ${Date.now() - t}ms`);
  }
} finally { await browser.close({silent: true}); }
