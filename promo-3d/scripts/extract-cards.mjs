// 从业务题库原样复制片尾轮廓卡用的省级路径（不改边界），并带上审图号。
// 在仓库根目录运行：node promo-3d/scripts/extract-cards.mjs
import {readFile, writeFile} from 'node:fs/promises';
const NAMES = ['山东省', '江西省', '海南省', '黑龙江省', '内蒙古自治区', '甘肃省'];
const bank = JSON.parse(await readFile('src/data/questions.json', 'utf8'));
const cfg = await readFile('src/config.ts', 'utf8');
const approval = cfg.match(/mapApprovalNumber\s*=\s*['"`]([^'"`]+)['"`]/)?.[1] ?? cfg.match(/(GS\(\d{4}\)\d+号)/)?.[1];
if (!approval) throw Error('approval number not found in src/config.ts');
const cards = NAMES.map((n) => { const r = bank.regions.find((x) => x.name === n); if (!r) throw Error(n); return {id: r.id, name: r.name, path: r.path}; });
await writeFile('promo-3d/src/data/cards.json', JSON.stringify({source: 'src/data/questions.json regions（CTAmap v2.0, CC BY 4.0）', approval: `审图号：${approval}`, viewBox: [400, 300], cards}, null, 1));
console.log(approval, cards.map((c) => c.name).join(' '));
