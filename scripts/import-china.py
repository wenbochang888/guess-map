#!/usr/bin/env python3
"""Import an explicitly reviewed, licensed mainland-31 boundary bundle.
Run: python3 -I scripts/import-china.py --bundle /absolute/path --output-root /project [--check]
No downloads or downloaded code are executed. See docs/china-data-import.md.
"""
import argparse, hashlib, json, math, re, runpy
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
MAPS = runpy.run_path(str(ROOT/'scripts/prepare-maps.py'))
def encode(value): return (json.dumps(value,ensure_ascii=False,separators=(',',':'))+'\n').encode()
def digest(data): return hashlib.sha256(data).hexdigest()
def require(condition, message):
    if not condition: raise ValueError(message)
def contained(root, relative):
    path=(root/relative).resolve()
    require(path.is_relative_to(root.resolve()),'Bundle path escapes its directory')
    return path

def rings_of(feature):
    polygons=MAPS['geojson_polygons'](feature['geometry']); result=[]
    for polygon in polygons:
        for index,raw in enumerate(polygon):
            require(len(raw)>=4 and raw[0][:2]==raw[-1][:2],'Unclosed or undersized polygon ring')
            ring=[]
            for point in raw:
                x,y=point[:2]
                require(isinstance(x,(int,float)) and isinstance(y,(int,float)) and math.isfinite(x) and math.isfinite(y) and -180<=x<=180 and -90<=y<=90,'Invalid WGS84 position')
                ring.append((x,y))
            area=MAPS['signed_area'](ring)
            require(abs(area)>1e-12,'Degenerate geographic ring')
            # Normalize GeoJSON ring winding, preserving holes for SVG nonzero fill.
            if (area>0)!=(index==0): ring.reverse()
            result.append(ring)
    require(result,'Empty polygon')
    return result

def build(bundle, output_root, check=False):
    manifest=json.loads((bundle/'manifest.json').read_bytes())
    require(manifest.get('formatVersion')==1,'Unsupported manifest format')
    require(re.fullmatch(r'\d{4}-\d{2}-\d{2}(?:[.\w-]+)?',manifest.get('version','')),'Version must identify the snapshot')
    review=manifest.get('review',{})
    require(all(review.get(k) is True for k in ['coverage','license','geometry']) and review.get('by') and review.get('on'),'Missing explicit human coverage/license/geometry review evidence')
    require(manifest.get('administrativeDate') and manifest.get('exceptions') is not None,'Administrative date and explicit exceptions list are required')
    registry=manifest['registryEvidence']
    registry_bytes=contained(bundle,registry['path']).read_bytes()
    require(digest(registry_bytes)==registry['sha256'] and registry.get('url'),'Registry evidence hash/URL missing or mismatched')
    sources={};evidence=[]
    # Share-alike databases need a separate obligations review, not a generic allowlist.
    licenses={'CC0-1.0','CC-BY-4.0','CC-BY-3.0','CC-BY-IGO-3.0','PDDL-1.0','Public-Domain'}
    for source in manifest['sources']:
        require(source['id'] not in sources,'Duplicate source id')
        require(source.get('license') in licenses and source.get('redistributionAllowed') is True,'Source license not reviewed for this importer')
        require(all(source.get(k) for k in ['url','version','attribution','licenseUrl','licenseEvidencePath','licenseEvidenceSha256']),'Incomplete source attribution/license evidence')
        raw=contained(bundle,source['path']).read_bytes();license_raw=contained(bundle,source['licenseEvidencePath']).read_bytes()
        require(digest(raw)==source['sha256'] and digest(license_raw)==source['licenseEvidenceSha256'],'Source or license evidence hash mismatch')
        geo=json.loads(raw);require(geo.get('type')=='FeatureCollection' and 'crs' not in geo,'Expected RFC7946 WGS84 FeatureCollection without custom CRS')
        features={}
        for f in geo['features']:
            identity=str(f.get('id',f.get('properties',{}).get('id','')))
            require(identity and identity not in features,'Every geometry requires a unique stable feature ID')
            features[identity]=f
        sources[source['id']]=features
        evidence.append({k:v for k,v in source.items() if k not in ['path','licenseEvidencePath']})
    expected_catalog=json.loads((ROOT/'scripts/data/regions.json').read_text())
    catalog={code:(name,kind) for code,name,kind in expected_catalog}
    require({r['id'] for r in manifest['regions']}==set(catalog) and len(manifest['regions'])==31,'All 31 unique mainland regions must be present')
    regions=[];cities=[];processing=[];report=[];ids=set()
    for r in manifest['regions']:
        require((r['name'],r['kind'])==catalog[r['id']],'Region name/type differs from reviewed 31-region catalog')
        parent=rings_of(sources[r['sourceId']][str(r['featureId'])])
        project,parameters=MAPS['projection'](parent);parent_projected=project(parent);frame=MAPS['fit'](parent_projected,12)
        regions.append({'id':r['id'],'name':r['name'],'kind':r['kind'],'status':'complete','coverageComplete':True,'path':MAPS['svg_path'](frame(parent_projected),0.55)})
        expected=r['expectedUnits'];require(len(expected)>=4,'Fewer than four targets: explicitly review a same-level cross-region choice policy before import')
        local_ids=['city-'+u['id'] for u in expected]
        for u in expected:
            require(re.fullmatch(r'\d{6}',u['id']) and u['id'] not in ids,'Duplicate/invalid official administrative code')
            ids.add(u['id']);require(u.get('name') and u.get('codeEvidence'),'Unit name and explicit code/parent mapping evidence required')
            require(u['adminType'] in (['district','county'] if r['kind']=='municipality' else ['city','prefecture']),'Wrong target administrative level')
            require(u.get('parentId')==r['id'],'Target belongs to wrong province/municipality')
            raw=rings_of(sources[u['sourceId']][str(u['featureId'])]);p=project(raw);highlight=frame(p)
            require(all(-0.05<=x<=400.05 and -0.05<=y<=300.05 for ring in highlight for x,y in ring),'Target extends outside parent display frame; review the actual geometry/parent association')
            identity='city-'+u['id'];others=[x for x in local_ids if x!=identity]
            require(u.get('difficulty',2) in [1,2,3],'Invalid opening difficulty hint')
            cities.append({'id':identity,'name':u['name'],'region':r['name'],'regionId':r['id'],'adminType':u['adminType'],'difficulty':u.get('difficulty',2),'path':MAPS['svg_path'](MAPS['fit'](p,18)(p)),'context':{'regionId':r['id'],'highlight':MAPS['svg_path'](highlight,0.35)},'choices':[identity]+others[:3]})
            processing.append({'id':identity,'source':u['sourceId'],'sourceFeature':u['featureId'],'parentSource':r['sourceId'],'parentFeature':r['featureId'],'projection':parameters,'codeEvidence':u['codeEvidence']})
        report.append({'id':r['id'],'name':r['name'],'status':'complete','complete':True,'expectedQuestions':len(expected),'actualQuestions':len(expected)})
    bank=json.loads((output_root/'src/data/questions.json').read_text())
    bank.update(version=manifest['version'],regions=regions,cities=cities,coverage={'complete':True,'scope':'mainland-31-prefectures-and-municipality-counties','status':'reviewed-import','note':'大陆31地区，按已核验目录的指定行政层级收录；非全国所有县市。','administrativeDate':manifest['administrativeDate']})
    bank['notices']=[n for n in bank.get('notices',[]) if n['name'].startswith('Natural Earth')]+[{'name':s.get('name',s['id']),'license':s['license'],'attribution':s['attribution'].replace('https://','').replace('http://',''),'licenseUrl':s['licenseUrl'].replace('https://','').replace('http://','')} for s in evidence]
    question_bytes=encode(bank)
    notices=json.loads((output_root/'public/assets/data-licenses.json').read_text())
    if notices.get('mapApprovalScope',{}).get('questionBankSha256') != digest(question_bytes):
        notices['mapReviewStatus']='待重新核对审图范围'
        notices.pop('mapApprovalNumber',None)
        notices.pop('mapApprovalScope',None)
    notices['version']=bank['version'];notices['sources']=[s for s in notices['sources'] if s['id']=='natural-earth']+evidence
    notices['coverage']=bank['coverage'];notices['administrativeCurrency']='仅对应'+manifest['administrativeDate']+'目录时点，非实时边界'
    notices['questionBank']={'countries':len(bank['countries']),'cities':len(cities),'bytes':len(question_bytes),'sha256':digest(question_bytes)}
    notices['processing']['features']=[f for f in notices['processing']['features'] if f['id'].startswith('country-')]+processing
    notices['processing']['distractors']='Country curation by level; same-region city/region choices with ID-based scoring.'
    notices['limitations']=['公开许可和人工目录核对不替代地图法定审核；几何导入变化须重新核对审图范围，平台与真机验收待完成。','只覆盖约定行政层级，省直管县级单位的范围例外见coverage-report。']
    notices['registryEvidence']={k:v for k,v in registry.items() if k!='path'}
    coverage={'version':bank['version'],'complete':True,'regions':report,'review':review,'registryEvidence':notices['registryEvidence'],'exceptions':manifest['exceptions'],'sources':evidence,'blockers':[]}
    outputs={'src/data/questions.json':question_bytes,'public/assets/data-licenses.json':encode(notices),'public/assets/coverage-report.json':encode(coverage)}
    for relative,data in outputs.items():
        dest=output_root/relative
        if check: require(dest.read_bytes()==data,'Reproducibility mismatch: '+relative)
        else: dest.write_bytes(data)
    return {'version':bank['version'],'regions':31,'targets':len(cities),'sha256':digest(question_bytes),'check':check}
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--bundle',required=True,type=Path);parser.add_argument('--output-root',type=Path,default=ROOT);parser.add_argument('--check',action='store_true');a=parser.parse_args()
    print(json.dumps(build(a.bundle,a.output_root,a.check),ensure_ascii=False))
