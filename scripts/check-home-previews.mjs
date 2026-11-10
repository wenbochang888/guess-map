import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

export function previewSourceErrors(metadata) {
  const errors = [];
  if (metadata?.chinaMainland?.status !== 'ready') errors.push('广东省首页示例未就绪。');
  const country = metadata?.countries;
  if (country?.status !== 'ready') errors.push('中国全国首页示例未就绪，禁止将占位状态打包为最终版。');
  if (!country || !/^GS\(\d{4}\)\d+号$/.test(country.approvalNumber || '')) errors.push('中国全国示例缺少独立的原图审图号。');
  if (!country || !/^[\w-]+\.(png|jpe?g)$/.test(country.imageFile || '')) errors.push('中国全国示例缺少包内图片路径。');
  if (!country || !/^[a-f0-9]{64}$/.test(country.sha256 || '')) errors.push('中国全国示例缺少图片指纹。');
  if (!country || !/^https:\/\//.test(country.sourceUrl || '') || !/^https:\/\//.test(country.usageEvidenceUrl || '')) errors.push('中国全国示例缺少来源及直接使用依据。');
  if (country?.modification !== 'none') errors.push('标准地图必须完整使用原图，不裁剪、不描摹、不改动地图内容。');
  return errors;
}

if (process.argv[1]?.endsWith('check-home-previews.mjs')) {
  const root = path.resolve(process.argv[2] || 'public');
  try {
    const metadata = JSON.parse(await readFile(path.join(root, 'assets/home-preview-sources.json'), 'utf8'));
    const errors = previewSourceErrors(metadata);
    if (!errors.length) {
      const country = metadata.countries;
      const image = await readFile(path.join(root, country.imageFile));
      if (createHash('sha256').update(image).digest('hex') !== country.sha256) errors.push('中国全国示例图片指纹不符。');
      const png = image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const jpeg = image[0] === 255 && image[1] === 216 && image[2] === 255;
      if (!png && !jpeg) errors.push('中国全国示例不是有效的PNG/JPEG文件。');
    }
    if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
    else console.log('首页示例发布检查通过：广东省轮廓与中国全国原图均已就绪。');
  } catch (error) {
    console.error('首页示例发布检查失败：' + error.message); process.exitCode = 1;
  }
}
