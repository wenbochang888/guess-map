import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const bank = JSON.parse(await readFile('src/data/questions.json','utf8'));
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1200,height:800},deviceScaleFactor:1});
await page.goto('http://127.0.0.1:4187');
await page.screenshot({path:'artifacts/home-desktop.png',fullPage:true,animations:'disabled'});
for(const mode of ['countries','cities']){
 for(let offset=0;offset<bank[mode].length;offset+=20){
  const rows=bank[mode].slice(offset,offset+20);
  await page.setContent(`<html lang="zh-CN"><head><meta charset="utf-8"><style>body{background:#f8f6f0;font-family:system-ui;color:#243d36;margin:20px}.sheet{display:grid;grid-template-columns:repeat(5,1fr);gap:14px}figure{margin:0;border:1px solid #dedfd3;padding:10px;background:#fffefa}svg{width:100%;height:118px}path{fill:#243d36}figcaption{font-size:13px;margin:8px 0}.context{height:44px}.context .region{fill:#e9ebdf;stroke:#a4ad9e;stroke-width:2}</style></head><body><h2>地图展示核查 · ${mode} · ${offset+1}–${offset+rows.length}</h2><div class="sheet">${rows.map(q=>`<figure><svg viewBox="0 0 400 300"><path d="${q.path}" fill-rule="nonzero"/></svg><figcaption>${q.name} / ${q.region}</figcaption>${q.context?`<svg class="context" viewBox="0 0 400 300"><path class="region" d="${bank.regions.find(r=>r.id===q.regionId)?.path}"/><path d="${q.context.highlight}"/></svg>`:''}</figure>`).join('')}</div></body></html>`);
  await page.screenshot({path:`artifacts/map-sheet-${mode}-${offset/20+1}.png`,fullPage:true});
 }
}
await browser.close();
