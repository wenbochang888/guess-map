// 「各省像什么」短片：从业务题库原样复制 31 个省级路径（不改边界），并带上审图号。
// 在仓库根目录运行：node promo-3d/scripts/extract-shapes.mjs  → promo-3d/src/shapes/provinces.json
import {readFile, writeFile} from 'node:fs/promises';
const bank = JSON.parse(await readFile('src/data/questions.json', 'utf8'));
const cfg = await readFile('src/config.ts', 'utf8');
const approval = cfg.match(/mapApprovalNumber\s*=\s*['"`]([^'"`]+)['"`]/)?.[1];
if (!approval) throw Error('approval number not found in src/config.ts');
const regions = bank.regions.map((r) => ({id: r.id, name: r.name, path: r.path}));
if (regions.length !== 31) throw Error(`expected 31 regions, got ${regions.length}`);
await writeFile('promo-3d/src/shapes/provinces.json', JSON.stringify({source: 'src/data/questions.json regions（CTAmap v2.0, CC BY 4.0）', approval: `审图号：${approval}`, viewBox: [400, 300], regions}));
console.log(approval, regions.length);
