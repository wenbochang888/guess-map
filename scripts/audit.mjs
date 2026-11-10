import { readdir, readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'acorn';
const allowed = new Set(['.html','.js','.css','.json','.svg','.png','.jpg','.jpeg','.webp','.gif','.woff','.woff2']);
const errors = [], warnings = [], files = [];
async function walk(dir) { for (const e of await readdir(dir, { withFileTypes: true })) { const p = path.join(dir,e.name); if(e.isDirectory()) await walk(p); else files.push(p); } }
await walk('dist');
let total = 0;
for (const file of files) {
  const size = (await stat(file)).size; total += size;
  if (!allowed.has(path.extname(file)) || /(?:node_modules|\.DS_Store|\.map$)/.test(file)) errors.push(`不支持文件 ${file}`);
  if (size > 2 * 1024 ** 2) warnings.push(`单文件超过2MiB ${file}`);
  if (!/\.(js|css|html)$/.test(file)) continue;
  const s = await readFile(file,'utf8');
  if (/猜中国城市|中国全域榜|中国 · 全部地区/.test(s)) errors.push(`残留旧题库范围文案 ${file}`);
  if (/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|RTCPeerConnection|new\s+(?:SharedWorker|Worker)\s*\(|\beval\s*\(|new\s+Function\s*\(|WebAssembly|window\.open\s*\(|requestFullscreen|navigator\.clipboard/.test(s)) errors.push(`禁用运行时能力 ${file}`);
  const runtime = s.replace(/https:\/\/vuejs\.org\/error-reference\/#runtime-/g, '').replace(/http:\/\/www\.w3\.org\/(?:2000\/svg|1998\/Math\/MathML|1999\/xlink)/g, '');
  if (/https?:\/\//.test(runtime)) errors.push(`运行代码含外部URL ${file}`);
  if (file.endsWith('.js')) {
    try { parse(s,{ecmaVersion:2017,sourceType:'script'}); } catch(e) { errors.push(`不是ES2017经典脚本 ${e.message}`); }
  }
}
const html = await readFile('dist/index.html','utf8');
const approvalNumber = /const mapApprovalNumber = '([^']+)'/.exec(await readFile('src/config.ts','utf8'))?.[1];
const appScript = await readFile('dist/app.js','utf8');
if (/轮廓示例待核验|确认地图素材和适用审图范围后展示/.test(appScript)) errors.push('正式构建残留首页地图占位提示');
const licenses = JSON.parse(await readFile('dist/assets/data-licenses.json','utf8'));
if (!approvalNumber || !appScript.includes(approvalNumber) || licenses.mapApprovalNumber !== approvalNumber || licenses.mapReviewStatus !== '已取得审图号') errors.push('构建产物审图号或审核状态不一致');
if (/type=["']module|<script\b[^>]*>\s*[^<\s]|\son\w+=|<iframe|<object|<base\b|http-equiv=["']Content-Security-Policy/i.test(html)) errors.push('HTML脚本/CSP结构不合规');
if (/<(?:script|link)\b[^>]*(?:src|href)=["']\.\/assets\//i.test(html)) errors.push('入口JS/CSS不能放入assets资源优化目录');
for (const m of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
  if (!m[1].startsWith('./')) errors.push(`非相对路径 ${m[1]}`);
  try { await stat(path.join('dist',m[1])); } catch { errors.push(`资源缺失 ${m[1]}`); }
}
if(total > 5 * 1024 ** 2) warnings.push('解压文本与资源超过5MiB，需复核');
const result={checkedAt:new Date().toISOString(),errors,warnings,totalBytes:total,files:files.length,containerValidation:'pending',chrome61DeviceValidation:'pending'};
await mkdir('artifacts',{recursive:true});
await writeFile('artifacts/static-audit.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
if(errors.length) process.exitCode=1;
