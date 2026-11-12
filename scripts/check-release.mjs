import { readFile } from 'node:fs/promises';
export function releaseErrors(bank, report, licenses, approvalNumber) {
 const errors=[];
 if (licenses?.mapApprovalScope?.countries !== bank.countries.length || licenses?.mapApprovalScope?.chinaMainlandRegions !== bank.cities.length || licenses?.mapApprovalScope?.includesLocationInsets !== true) errors.push('地图审图范围未覆盖全部题目与位置小图。');
 if (licenses?.mapReviewStatus !== '已取得审图号' || !approvalNumber || licenses?.mapApprovalNumber !== approvalNumber) errors.push('地图审核状态或审图号缺失、不一致。');
 if (!licenses?.mapApprovalScope?.questionBankSha256 || licenses?.questionBank?.sha256 !== licenses?.mapApprovalScope?.questionBankSha256 || licenses?.questionBank?.countries !== bank.countries.length || licenses?.questionBank?.cities !== 418) errors.push('地图批准范围与题库不一致。');
 if (new Set(bank.cities.map(q=>q.id)).size!==bank.cities.length || bank.cities.some(q=>!bank.regions.some(r=>r.id===q.regionId))) errors.push('中国目标ID重复或父地区缺失。');
 if (!bank.coverage?.complete || !report.complete) errors.push('全国地区题库未完成核验；不能将精选题预览打包为全国正式版。');
 if (bank.version !== report.version) errors.push('覆盖报告与题库版本不一致。');
 if (bank.regions.length !== 31 || new Set(bank.regions.map(r=>r.id)).size !== 31) errors.push('省级目录不是31个唯一地区。');
 if (report.regions?.length !== 31 || new Set(report.regions.map(r=>r.id)).size !== 31) errors.push('覆盖报告缺少31地区逐项清单。');
 for (const r of bank.regions) {
  const targets=bank.cities.filter(q=>q.regionId===r.id);
  const actual=targets.length;
  const row=report.regions?.find(x=>x.id===r.id);
  if (row?.units && (row.units.length!==actual || new Set(row.units.map(q=>q.id)).size!==actual || targets.some(q=>!row.units.some(unit=>unit.id===q.id && unit.name===q.name && unit.adminType===q.adminType)))) errors.push(`${r.name}的逐单位目录不匹配。`);
  if (!r.coverageComplete || r.status!=='complete' || !r.path || !actual || !row?.complete || row.actualQuestions!==actual || row.expectedQuestions!==actual) errors.push(`${r.name}的目标目录与题目数量未完整匹配。`);
 }
 return errors;
}
if (process.argv[1]?.endsWith('check-release.mjs')) {
 const bank=JSON.parse(await readFile('src/data/questions.json','utf8'));
 const report=JSON.parse(await readFile('public/assets/coverage-report.json','utf8'));
 const licenses=JSON.parse(await readFile('public/assets/data-licenses.json','utf8'));
 const configSource=await readFile('src/config.ts','utf8');
 const approvalNumber=/const mapApprovalNumber = '([^']+)'/.exec(configSource)?.[1];
 const { createHash }=await import('node:crypto');
 const actualHash=createHash('sha256').update(await readFile('src/data/questions.json')).digest('hex');
 const errors=releaseErrors(bank,report,licenses,approvalNumber);
 if(actualHash!==licenses.questionBank?.sha256) errors.push('题库发生变化，须重新核对地图批准范围。');
 if(errors.length){console.error(errors.join('\n'));process.exitCode=1;} else console.log('全国题库发布准入检查通过；审图号一致，仍须完成平台与真机验收。');
}
