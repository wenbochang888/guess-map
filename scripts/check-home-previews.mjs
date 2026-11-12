import { readFile } from 'node:fs/promises';
import path from 'node:path';

// 两个首页示例都复用题库现有轮廓，不引入新的地图图片或几何。
export function previewSourceErrors(metadata, bank) {
  const errors = [];
  const china = metadata?.chinaMainland, country = metadata?.countries;
  if (china?.status !== 'ready') errors.push('广东省首页示例未就绪。');
  if (country?.status !== 'ready') errors.push('国家首页示例未就绪，禁止将占位状态打包为最终版。');
  for (const [label, item] of [['广东省', china], ['国家', country]]) {
    if (item && item.geometryChanged !== false) errors.push(`${label}首页示例必须复用题库轮廓，不得改动几何。`);
    if (item && 'imageFile' in item) errors.push(`${label}首页示例不再使用外部地图图片。`);
  }
  if (bank) {
    if (!bank.regions?.some(region => region.id === '440000' && region.path)) errors.push('题库缺少广东省轮廓。');
    if (!bank.countries?.some(question => question.id === 'country-ita' && question.path)) errors.push('题库缺少意大利轮廓。');
  }
  return errors;
}

if (process.argv[1]?.endsWith('check-home-previews.mjs')) {
  const root = path.resolve(process.argv[2] || 'public');
  try {
    const metadata = JSON.parse(await readFile(path.join(root, 'assets/home-preview-sources.json'), 'utf8'));
    const bank = JSON.parse(await readFile(path.resolve('src/data/questions.json'), 'utf8'));
    const errors = previewSourceErrors(metadata, bank);
    if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
    else console.log('首页示例发布检查通过：广东省与意大利轮廓均复用题库。');
  } catch (error) {
    console.error('首页示例发布检查失败：' + error.message); process.exitCode = 1;
  }
}
