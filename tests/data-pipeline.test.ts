import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { config } from '../src/config';
import { releaseErrors } from '../scripts/check-release.mjs';
const root=process.cwd();
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
test('审图门禁拒绝号码、状态或批准指纹不匹配',()=>{
 const bank=JSON.parse(readFileSync('src/data/questions.json','utf8')),report=JSON.parse(readFileSync('public/assets/coverage-report.json','utf8')),licenses=JSON.parse(readFileSync('public/assets/data-licenses.json','utf8'));
 assert.deepEqual(releaseErrors(bank,report,licenses,config.mapApprovalNumber),[]);
 assert.ok(releaseErrors(bank,report,{...licenses,mapApprovalNumber:''},config.mapApprovalNumber).length);
 assert.ok(releaseErrors(bank,report,{...licenses,mapReviewStatus:'待核对'},config.mapApprovalNumber).length);
 assert.ok(releaseErrors(bank,report,{...licenses,mapApprovalScope:{questionBankSha256:'changed'}},config.mapApprovalNumber).length);
});
test('正式发布检查接受完整快照，并拒绝删题或伪造目录',()=>{
 const r=spawnSync(process.execPath,['scripts/check-release.mjs'],{cwd:root,encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/准入检查通过/);
 const bank=JSON.parse(readFileSync('src/data/questions.json','utf8')),report=JSON.parse(readFileSync('public/assets/coverage-report.json','utf8'));bank.cities[0].id='forged-target';assert.ok(releaseErrors(bank,report).some((e:string)=>e.includes('逐单位目录')));bank.cities.pop();assert.ok(releaseErrors(bank,report).some((e:string)=>e.includes('数量')));
});
test('数据导入器：隔离的合成几何仅用于测试，完整匹配/可复现/缺地区拒绝/哈希拒绝',()=>{
 mkdirSync(path.join(root,'.scratch'),{recursive:true});const scratch=mkdtempSync(path.join(root,'.scratch/import-test-'));
 try {
  const bundle=path.join(scratch,'bundle'),out=path.join(scratch,'output');mkdirSync(bundle);mkdirSync(path.join(out,'src/data'),{recursive:true});mkdirSync(path.join(out,'public/assets'),{recursive:true});
  writeFileSync(path.join(out,'src/data/questions.json'),readFileSync('src/data/questions.json'));writeFileSync(path.join(out,'public/assets/data-licenses.json'),readFileSync('public/assets/data-licenses.json'));
  const catalog=JSON.parse(readFileSync('scripts/data/regions.json','utf8'));
  const square=(x:number,y:number,w:number)=>({type:'Polygon',coordinates:[[[x,y],[x+w,y],[x+w,y+w],[x,y+w],[x,y]]]});
  const features:any[]=[],regions:any[]=[];
  for(const [id,name,kind] of catalog){
   features.push({type:'Feature',id,properties:{},geometry:square(100,30,2)});
   const expectedUnits=[];
   for(let i=0;i<4;i++){const code=String(Number(id)+101+i);features.push({type:'Feature',id:code,properties:{},geometry:square(100.2+(i%2)*.5,30.2+Math.floor(i/2)*.5,.3)});expectedUnits.push({id:code,name:`TEST_FIXTURE_${id}_${i}`,parentId:id,adminType:kind==='municipality'?'district':'city',sourceId:'synthetic-test',featureId:code,codeEvidence:'SYNTHETIC TEST ONLY, not real boundaries'});}
   regions.push({id,name,kind,sourceId:'synthetic-test',featureId:id,expectedUnits});
  }
  const geo=JSON.stringify({type:'FeatureCollection',features}),license='SYNTHETIC TEST FIXTURE ONLY - generated test rectangles',registry='SYNTHETIC TEST REGISTRY, NOT REAL ADMINISTRATIVE DATA';
  writeFileSync(path.join(bundle,'geometry.json'),geo);writeFileSync(path.join(bundle,'license.txt'),license);writeFileSync(path.join(bundle,'registry.txt'),registry);
  const manifest={formatVersion:1,version:'2026-11-07.test-fixture',administrativeDate:'TEST_ONLY',registryEvidence:{path:'registry.txt',sha256:hash(registry),url:'https://example.invalid/test-only'},review:{by:'TEST ONLY',on:'2026-11-07',coverage:true,license:true,geometry:true},sources:[{id:'synthetic-test',path:'geometry.json',sha256:hash(geo),url:'https://example.invalid/test-only',version:'TEST ONLY',license:'CC0-1.0',licenseUrl:'https://example.invalid/test-license',licenseEvidencePath:'license.txt',licenseEvidenceSha256:hash(license),redistributionAllowed:true,attribution:'SYNTHETIC TEST ONLY'}],regions,exceptions:[]};
  const run=(check=false)=>spawnSync('python3',['-I','scripts/import-china.py','--bundle',bundle,'--output-root',out,...(check?['--check']:[])],{cwd:root,encoding:'utf8'});
  const save=()=>writeFileSync(path.join(bundle,'manifest.json'),JSON.stringify(manifest));save();
  const first=run();assert.equal(first.status,0,first.stderr);assert.equal(JSON.parse(first.stdout).targets,124);assert.equal(run(true).status,0);
  const bank=JSON.parse(readFileSync(path.join(out,'src/data/questions.json'),'utf8'));assert.equal(bank.regions.length,31);assert.equal(bank.cities.length,124);assert.equal(bank.cities[0].adminType,'district');
  manifest.regions=regions.slice(1);save();const missing=run();assert.notEqual(missing.status,0);assert.match(missing.stderr,/31 unique/);
  manifest.regions=regions;manifest.sources[0].sha256='0'.repeat(64);save();const mismatch=run();assert.notEqual(mismatch.status,0);assert.match(mismatch.stderr,/hash mismatch/);
  manifest.sources[0].sha256=hash(geo);manifest.sources[0].path='../outside.json';save();assert.match(run().stderr,/escapes/);
 }finally{rmSync(scratch,{recursive:true,force:true});}
});

test('GeoPackage解析识别大小端和envelope，保留孔洞，拒绝错误类型与坐标',()=>{
 const code=String.raw`
import runpy,struct,sys
m=runpy.run_path(sys.argv[1]);decode=m['geometry']
outer=[(0.,0.),(4.,0.),(4.,4.),(0.,4.),(0.,0.)]
hole=[(1.,1.),(2.,1.),(2.,2.),(1.,2.),(1.,1.)]
for fmt,byte in [('<',1),('>',0)]:
 for envelope in (0,1):
  head=b'GP\x00'+bytes([byte|(envelope<<1)])+struct.pack(fmt+'i',4326)+(struct.pack(fmt+'dddd',0,4,0,4) if envelope else b'')
  wkb=struct.pack(fmt+'BII',byte,6,1)+struct.pack(fmt+'BII',byte,3,2)
  for ring in (outer,hole):
   wkb+=struct.pack(fmt+'I',len(ring))+b''.join(struct.pack(fmt+'dd',*p) for p in ring)
  decoded=decode(head+wkb,'TEST_ONLY');assert len(decoded)==2
  assert m['TOOLS']['signed_area'](decoded[0])>0 and m['TOOLS']['signed_area'](decoded[1])<0
  for invalid in (b'BAD'+(head+wkb)[3:],head+wkb+b'x',head+struct.pack(fmt+'BII',byte,1006,1),head+wkb.replace(struct.pack(fmt+'dd',4.,0.),struct.pack(fmt+'dd',181.,0.))):
   try:decode(invalid,'TEST_ONLY')
   except (ValueError,struct.error):pass
   else:raise AssertionError('Invalid geometry accepted')
print('GPKG parser checks passed')
`;
 const result=spawnSync('python3',['-I','-',path.join(root,'scripts/prepare-china.py')],{input:code,encoding:'utf8',cwd:root});assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/checks passed/);
});
