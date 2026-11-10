import argparse,pathlib,zipfile,hashlib,json,subprocess,datetime
parser=argparse.ArgumentParser();parser.add_argument('--preview',action='store_true');args=parser.parse_args()
root=pathlib.Path(__file__).resolve().parents[1]
if not args.preview:
 subprocess.run(['node',str(root/'scripts/check-release.mjs')],cwd=root,check=True)
 subprocess.run(['node',str(root/'scripts/check-home-previews.mjs'),str(root/'dist')],cwd=root,check=True)
out=root/('artifacts/guess-map-preview.zip' if args.preview else 'artifacts/guess-map-xhs.zip')
audit=root/'.codex/skills/minitool-zip-builder/scripts/audit_artifact.py'
subprocess.run(['python3','-I',str(audit),str(root/'dist')],cwd=root,check=True)
files=sorted(p for p in (root/'dist').rglob('*') if p.is_file())
assert (root/'dist/index.html') in files
assert (root/'dist/assets/coverage-report.json') in files
with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for p in files:z.write(p,p.relative_to(root/'dist').as_posix())
assert out.stat().st_size<=10*1024*1024
subprocess.run(['python3','-I',str(audit),str(out)],cwd=root,check=True)
result={'path':str(out),'status':'preview-incomplete-china-data' if args.preview else 'pending-platform-review','bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'mapApprovalNumber':json.loads((root/'public/assets/data-licenses.json').read_text())['mapApprovalNumber'],'files':len(files),'entry':'index.html','platformSimulator':'pending','android':'pending','ios':'pending'}
result['generatedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
if not args.preview:
 sources=json.loads((root/'dist/assets/home-preview-sources.json').read_text())
 result.update(featureCompletion='complete',homePreviewValidation='passed',homePreviews={'chinaMainland':sources['chinaMainland']['status'],'countries':sources['countries']['status'],'countryImage':sources['countries']['imageFile'],'countryImageApprovalNumber':sources['countries']['approvalNumber']},knownLimitations=[],chrome61DeviceValidation='pending',performanceDeviceValidation='pending')
(root/('artifacts/preview-manifest.json' if args.preview else 'artifacts/package-manifest.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps(result,ensure_ascii=False,indent=2))
