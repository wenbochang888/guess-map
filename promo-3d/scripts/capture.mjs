// 真实界面采集：用真实游戏 + 真实点击，按分镜截取 7 个状态，写出截图与 layout.json。
// 在仓库根目录运行（复用根工程的 vite 与 @playwright/test）：
//   node promo-3d/scripts/capture.mjs --search          # 只搜索合适的随机种子，不截图
//   node promo-3d/scripts/capture.mjs --seed=61 --expect=山东省,江西省   # 正式采集并校验题序
// 选项：--out=<目录>（默认 promo-3d/public/captures）。已有 layout.json 时拒绝覆盖。
// 注意：截图字体取决于本机系统字体，正式素材请在 Mac 上采集（苹方）。
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile, access} from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'vite';
import {chromium} from '@playwright/test';

const ROOT = process.env.GAME_ROOT ?? process.cwd();
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
const SEARCH = process.argv.includes('--search');
const EXPECT = arg('expect')?.split(',');
const OUT = path.resolve(arg('out') ?? path.join(ROOT, 'promo-3d/public/captures'));
const VIEWPORT = {width: 390, height: 844};
// 分镜要求：第一题是轮廓有记忆点、大多数人能认出的省；第二题是容易犹豫的省（演示猜错）。
const Q1 = ['山东省', '海南省', '黑龙江省', '内蒙古自治区', '甘肃省', '台湾省'];
const Q2 = ['江西省', '贵州省', '湖南省', '安徽省', '山西省', '湖北省', '河南省'];
const CORRECT_AFTER_WRONG = 6; // 第二题答错后再连续答对几题，结算页才不是 1 分的冷清画面

const sha = (x) => createHash('sha256').update(x).digest('hex');
const bank = JSON.parse(await readFile(path.join(ROOT, 'src/data/questions.json'), 'utf8'));
const byPath = new Map(bank.regions.map((r) => [r.path, r]));

const server = await createServer({root: ROOT, server: {host: '127.0.0.1', port: 0, open: false}, logLevel: 'warn'});
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch();

async function openGame(seed) {
  const ctx = await browser.newContext({viewport: VIEWPORT, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'zh-CN', colorScheme: 'light', timezoneId: 'Asia/Shanghai', serviceWorkers: 'block', reducedMotion: 'no-preference'});
  await ctx.addInitScript((s) => { let x = s >>> 0; Math.random = () => { x = (Math.imul(1664525, x) + 1013904223) >>> 0; return x / 4294967296; }; }, seed);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install({time: new Date('2026-11-10T04:00:00Z')});
  await page.clock.pauseAt(new Date('2026-11-10T04:00:01Z'));
  await page.goto(base, {waitUntil: 'networkidle'});
  return {ctx, page, errors};
}
async function current(page) {
  const d = await page.locator('.question-map .outline-map>path').getAttribute('d');
  const q = byPath.get(d);
  assert.ok(q, 'question path not found in bank');
  return q;
}
async function startDefault(page) {
  // 默认「猜中国大陆地区 · 全部地区（31 省）」
  await page.locator('.start-button').tap();
  await page.clock.runFor(400);
}
async function tapAnswer(page, name, correct) {
  const btns = page.locator('.answer-button');
  const n = await btns.count();
  for (let i = 0; i < n; i++) {
    const text = (await btns.nth(i).locator('span').nth(1).innerText()).trim();
    if ((text === name) === correct) { await btns.nth(i).tap(); return text; }
  }
  throw Error(`no ${correct ? 'correct' : 'wrong'} option for ${name}`);
}

async function search(limit = 600) {
  const hits = [];
  for (let seed = 1; seed <= limit && hits.length < 8; seed++) {
    const {ctx, page} = await openGame(seed);
    try {
      await startDefault(page);
      const q1 = await current(page);
      if (!Q1.includes(q1.name)) continue;
      await tapAnswer(page, q1.name, true);
      await page.clock.runFor(700);
      const q2 = await current(page);
      if (Q2.includes(q2.name)) { hits.push({seed, q1: q1.name, q2: q2.name}); console.log(JSON.stringify(hits.at(-1))); }
    } finally { await ctx.close(); }
  }
  return hits;
}

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {})));
  });
}
const BOX_SELECTORS = ['.region-trigger', '.start-button', '.region-option--all', '.question-map', '.answer-button', '.feedback-line', '.game-topline', '.next-button', '.score-ring', '.primary-button'];
async function boxes(page) {
  return page.locator(BOX_SELECTORS.join(',')).evaluateAll((els) => els.map((el) => {
    const r = el.getBoundingClientRect();
    return {cls: el.className, text: el.textContent.trim().slice(0, 40), x: r.x, y: r.y, w: r.width, h: r.height};
  }).filter((b) => b.w > 0 && b.h > 0));
}

async function capture(seed) {
  try { await access(path.join(OUT, 'layout.json')); throw Error(`${OUT}/layout.json exists; use a new --out`); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  await mkdir(OUT, {recursive: true});
  const {ctx, page, errors} = await openGame(seed);
  const manifest = {purpose: '宣传片真实状态素材（非连续录屏）；同一局真实游戏，按分镜顺序截取。', seed, viewport: VIEWPORT, dpr: 3, platform: process.platform, shots: [], clicks: []};
  const shot = async (id, extra = {}) => {
    await settle(page);
    const png = await page.screenshot({path: path.join(OUT, `${id}.png`)});
    manifest.shots.push({id, file: `captures/${id}.png`, sha256: sha(png), clock: await page.evaluate(() => Date.now()), boxes: await boxes(page), ...extra});
  };
  const click = async (locator, label) => {
    const b = await locator.boundingBox(); assert.ok(b);
    manifest.clicks.push({label, cx: b.x + b.width / 2, cy: b.y + b.height / 2, clock: await page.evaluate(() => Date.now())});
    await locator.tap();
  };
  const state = async () => ({score: await page.locator('.score strong').innerText(), lives: await page.locator('.lives').getAttribute('aria-label')});
  try {
    // S3 ① 选范围：首页 → 更换 → 地区面板 → 全部地区 → 开始猜
    await shot('home');
    await click(page.locator('.region-trigger'), '更换');
    await page.clock.runFor(400);
    await shot('picker');
    await click(page.locator('.region-option--all'), '全部地区');
    await page.clock.runFor(400);
    await click(page.locator('.start-button'), '开始猜');
    await page.clock.runFor(400);
    // S4 ② 第一题答对
    const q1 = await current(page);
    if (EXPECT) assert.equal(q1.name, EXPECT[0], 'seed gave a different first question');
    await shot('q1', {question: q1.name, choices: await page.locator('.answer-button>span:nth-child(2)').allTextContents(), ...(await state())});
    const map = await page.locator('.question-map').screenshot({path: path.join(OUT, 'q1-map.png')});
    manifest.mapCutout = {file: 'captures/q1-map.png', sha256: sha(map)};
    await click(page.locator('.answer-button', {hasText: q1.name}).first(), `答对 ${q1.name}`);
    await page.clock.runFor(150);
    await shot('q1-correct', {question: q1.name, ...(await state())});
    await page.clock.runFor(550);
    // S5 ③ 第二题答错，保留原生揭晓
    const q2 = await current(page);
    assert.notEqual(q2.id, q1.id);
    if (EXPECT) assert.equal(q2.name, EXPECT[1], 'seed gave a different second question');
    await shot('q2', {question: q2.name, choices: await page.locator('.answer-button>span:nth-child(2)').allTextContents(), ...(await state())});
    const wrong = await tapAnswer(page, q2.name, false);
    manifest.clicks.push({label: `答错 ${q2.name}（选了 ${wrong}）`, clock: await page.evaluate(() => Date.now())});
    await page.clock.runFor(150);
    await shot('q2-wrong', {question: q2.name, picked: wrong, ...(await state())});
    await page.clock.runFor(3000);
    // 之后真实地连续答对几题、再答错两题，进入结算页
    for (let i = 0; i < CORRECT_AFTER_WRONG; i++) { const q = await current(page); await tapAnswer(page, q.name, true); await page.clock.runFor(700); }
    for (let i = 0; i < 2; i++) { const q = await current(page); await tapAnswer(page, q.name, false); await page.clock.runFor(3100); }
    await page.locator('.result-config').waitFor();
    await page.clock.runFor(1500);
    await shot('result');
    assert.deepEqual(errors, []);
    await writeFile(path.join(OUT, 'layout.json'), JSON.stringify(manifest, null, 2));
    console.log(JSON.stringify({out: OUT, q1: q1.name, q2: q2.name, shots: manifest.shots.map((s) => s.id)}));
  } finally { await ctx.close(); }
}

try {
  if (SEARCH) await search();
  else { const seed = Number(arg('seed')); assert.ok(Number.isInteger(seed), 'need --seed=<n> (run --search first)'); await capture(seed); }
} finally { await browser.close(); await server.close(); }
