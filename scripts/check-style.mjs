// 样式门禁：令牌对比度 + 字号下限 + Chrome 61 不支持的唯一实现。
// 用法：node scripts/check-style.mjs [dist/style.css]
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const errors = [];
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dir = path.join(root, 'src/styles');

const tokens = {};
const tokenSource = await readFile(path.join(dir, 'tokens.css'), 'utf8');
for (const [, name, value] of tokenSource.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g)) tokens[name] = value;

const lin = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const luminance = hex => { const [r, g, b] = lin(hex); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// [前景, 背景, 最低对比度, 说明]：文字 4.5，图形/大字 3
const pairs = [
  ['ink', 'paper', 4.5, '正文'], ['ink', 'surface', 4.5, '卡片正文'], ['muted', 'paper', 4.5, '次要文字'], ['muted', 'surface', 4.5, '卡片次要文字'],
  ['muted', 'kraft', 4.5, '牛皮纸上的次要文字'], ['accent-text', 'paper', 4.5, '陶土红小字'], ['accent-text', 'accent-soft', 4.5, '徽标文字'],
  ['accent-text', 'surface', 4.5, '卡片上的陶土红小字'], ['surface', 'ink', 4.5, '主按钮文字'], ['surface', 'ink-2', 4.5, '主按钮 hover'], ['surface', 'accent', 3, '称号（大号粗体）'],
  ['right-fg', 'right-bg', 4.5, '答对'], ['wrong-fg', 'wrong-bg', 4.5, '答错'], ['dim', 'paper', 4.5, '揭晓后变暗的选项'], ['dim', 'surface', 4.5, '变暗选项（卡面）'],
  ['accent', 'paper', 3, '陶土红图形'], ['right-line', 'paper', 3, '答对描边'], ['wrong-line', 'paper', 3, '答错描边'], ['ink', 'kraft', 4.5, '牛皮纸上的轮廓/文字'],
  ['ink', 'seg-bg', 4.5, '分段控件文字'], ['accent', 'kraft', 3, '牛皮纸上的位置高亮'],
];
for (const [fg, bg, min, note] of pairs) {
  if (!tokens[fg] || !tokens[bg]) { errors.push(`令牌缺失：${fg} / ${bg}`); continue; }
  const value = ratio(tokens[fg], tokens[bg]);
  console.log(`${value >= min ? 'ok  ' : 'FAIL'} ${fg} on ${bg} ${value.toFixed(2)} (≥${min}) ${note}`);
  if (value < min) errors.push(`对比度不足：${fg}/${bg} ${value.toFixed(2)} < ${min}（${note}）`);
}

const files = process.argv[2] ? [path.resolve(process.argv[2])] : (await readdir(dir)).filter(f => f.endsWith('.css')).map(f => path.join(dir, f));
const fontScale = Object.fromEntries([...tokenSource.matchAll(/--(t-[a-z0-9]+):\s*(\d+)px/g)].map(m => [m[1], Number(m[2])]));
for (const file of files) {
  const css = (await readFile(file, 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
  const scaleValues = new Set(Object.values(fontScale));
  for (const [, px] of css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) {
    if (Number(px) < 11) errors.push(`${path.basename(file)} 字号 ${px}px < 11px`);
    else if (!scaleValues.has(Number(px))) errors.push(`${path.basename(file)} 字号 ${px}px 不在字号阶梯内，请改用 var(--t-*)`);
  }
  for (const [, name] of css.matchAll(/font-size:\s*var\(--(t-[a-z0-9]+)\)/g)) if (!(name in fontScale)) errors.push(`${path.basename(file)} 未知字号令牌 ${name}`);
  const banned = [
    [/(^|[;{\s])(?:row-|column-)?gap\s*:/g, 'flex/grid 标准 gap（Chrome 61 请用 margin 或 grid-gap）'],
    [/aspect-ratio\s*:/g, 'aspect-ratio'], [/(^|[^\w-])(?:clamp|min|max)\(/g, 'min()/max()/clamp()'],
    [/(^|[;{\s])inset\s*:/g, 'inset 简写'], [/:has\(/g, ':has()'], [/@container/g, '@container'], [/@layer/g, '@layer'],
    [/color-mix\(|oklch\(|oklab\(/g, '现代颜色函数'], [/(?:\d|\))(?:dvh|svh|lvh)\b/g, '动态视口单位'],
    [/backdrop-filter/g, 'backdrop-filter（须有实色兜底，本项目暂不使用）'], [/margin-inline|padding-inline|margin-block|padding-block/g, '逻辑属性'],
  ];
  for (const [pattern, name] of banned) if (pattern.test(css)) errors.push(`${path.basename(file)} 含 ${name}`);
  const animated = [...css.matchAll(/transition:\s*([^;}]+)/g)].map(m => m[1]);
  for (const t of animated) for (const prop of t.split(',').map(x => x.trim().split(/\s+/)[0])) if (!['transform', 'opacity', 'background', 'color', 'border-color', ''].includes(prop) && !prop.startsWith('var(') && !prop.startsWith('none')) errors.push(`${path.basename(file)} 动效属性 ${prop} 不在白名单（transform/opacity/颜色）`);
}
if (errors.length) { console.error('\n样式检查失败：\n- ' + errors.join('\n- ')); process.exit(1); }
console.log(`\n样式检查通过（${files.length} 个文件）`);
