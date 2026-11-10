"""Build the mainland-31 bank from pinned CTAmap GeoPackages; no GIS dependency."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import runpy
import sqlite3
import struct

ROOT = Path(__file__).resolve().parents[1]
TOOLS = runpy.run_path(str(ROOT / 'scripts/prepare-maps.py'))
VERSION = '2026-11-08.1'
MAIN_TOLERANCE = 1.0
CONTEXT_TOLERANCE = 1.4
HIGHLIGHT_TOLERANCE = 1.0
HASHES = {
    'province': 'bb4706a1999f45a1d8a82d4907f754515eb8628bf2bd489be23b4754e05aa681',
    'prefecture': '6a35915313444d4e669fdc147eade4eb50d67489c38c00f340d871baa624ad85',
    'county': '4c7f4cfed6ff0bf96ed569ef3a653bc19506c4e95781349b201084349a19c980',
}
SOURCE_URL = 'https://www.shengshixian.com/pages/d35ae5/'
DOWNLOAD = 'https://pub-480fcfcea00742058bae6bc1c86d288c.r2.dev/'
DEGENERATE_RINGS = []
MUNICIPALITIES = {'110000': 16, '120000': 16, '310000': 16, '500000': 37}
# The selected source's 333 prefectures, excluding municipality placeholders.
EXPECTED = dict(zip(['130000','140000','150000','210000','220000','230000','320000','330000','340000','350000','360000','370000','410000','420000','430000','440000','450000','460000','510000','520000','530000','540000','610000','620000','630000','640000','650000'],[11,11,12,14,9,13,13,11,16,9,11,16,17,13,14,21,14,4,21,9,16,7,10,14,8,5,14]))
EXPECTED.update(MUNICIPALITIES)

def geometry(blob, feature):
    if blob[:3] != b'GP\x00' or blob[3] & 0xf0:
        raise ValueError('Unsupported or empty GeoPackage geometry')
    flags = blob[3]
    envelope = (flags >> 1) & 7
    if envelope > 4:
        raise ValueError('Invalid GeoPackage envelope')
    order = '<' if flags & 1 else '>'
    if struct.unpack_from(order + 'i', blob, 4)[0] != 4326:
        raise ValueError('Expected WGS84')
    offset = 8 + [0, 32, 48, 48, 64][envelope]
    polygons = []
    def parse(pos):
        endian = blob[pos]
        if endian not in (0, 1):
            raise ValueError('Invalid WKB byte order')
        fmt = '<' if endian else '>'
        kind, count = struct.unpack_from(fmt + 'II', blob, pos + 1)
        pos += 9
        if kind == 6:
            for _ in range(count):
                pos = parse(pos)
        elif kind == 3:
            polygon = []
            for i in range(count):
                n = struct.unpack_from(fmt + 'I', blob, pos)[0]; pos += 4
                ring = [struct.unpack_from(fmt + 'dd', blob, pos + j * 16) for j in range(n)]
                pos += n * 16
                if n < 4 or ring[0] != ring[-1] or any(not math.isfinite(v) or abs(v) > (180 if k == 0 else 90) for p in ring for k, v in enumerate(p)):
                    raise ValueError('Invalid WGS84 ring')
                x0,y0 = ring[0]
                area = math.fsum((a[0]-x0)*(b[1]-y0)-(b[0]-x0)*(a[1]-y0) for a,b in zip(ring,ring[1:])) / 2
                if abs(area) < 1e-14:
                    if i == 0:
                        raise ValueError('Degenerate exterior ring: ' + feature)
                    DEGENERATE_RINGS.append({'feature':feature,'ringIndex':i,'areaDegreesSquared':area,'reason':'Numerically zero-area interior ring (< 0.00013 square metres at equator)'})
                    continue
                if (area > 0) != (i == 0):
                    ring.reverse()
                polygon.append(ring)
            polygons.append(polygon)
        else:
            raise ValueError('Unsupported WKB type: ' + str(kind))
        return pos
    if parse(offset) != len(blob) or not polygons:
        raise ValueError('Invalid WKB length')
    return [ring for polygon in polygons for ring in polygon]

def svg_path(rings, tolerance):
    parts = []
    for raw in rings:
        ring, precision = TOOLS['simplify_ring'](raw, tolerance)
        for decimals in (precision, 4, 6, 8, 10):
            rounded = [(round(x, decimals), round(y, decimals)) for x,y in ring]
            x0,y0 = rounded[0]
            area = math.fsum((a[0]-x0)*(b[1]-y0)-(b[0]-x0)*(a[1]-y0) for a,b in zip(rounded,rounded[1:]+rounded[:1]))
            if len(set(rounded)) >= 3 and area * TOOLS['signed_area'](raw) > 0:
                break
        else:
            raise ValueError('Serialization would collapse a source ring')
        def fmt(value):
            text = f"{value:.{decimals}f}".rstrip('0').rstrip('.')
            return '0' if text in ('', '-0') else text
        parts.append('M' + 'L'.join(fmt(x)+','+fmt(y) for x,y in rounded) + 'Z')
    return ''.join(parts)

def rows(path, level):
    if hashlib.sha256(path.read_bytes()).hexdigest() != HASHES[level]:
        raise ValueError('Source hash mismatch: ' + level)
    with sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True) as db:
        db.enable_load_extension(False)
        db.row_factory = sqlite3.Row
        table = 'T2026_' + level
        if tuple(db.execute('SELECT srs_id,z,m FROM gpkg_geometry_columns WHERE table_name=?', (table,)).fetchone()) != (4326, 0, 0):
            raise ValueError('Unsupported geometry metadata')
        return [dict(r) for r in db.execute('SELECT * FROM "' + table + '" ORDER BY fid')]

def build(args):
    catalog = json.loads((ROOT / 'scripts/data/regions.json').read_text())
    seed = json.loads((ROOT / 'scripts/data/country-snapshot.json').read_text())
    province = {r['省级码']: r for r in rows(args.province, 'province')}
    pref = rows(args.prefecture, 'prefecture')
    county = rows(args.county, 'county')
    cities, regions, report_rows, provenance = [], [], [], []
    for code, name, kind in catalog:
        parent = province[code]
        if parent['省'] != name:
            raise ValueError('Province name mismatch: ' + code)
        rings = geometry(parent['geom'], code)
        project, projection = TOOLS['projection'](rings)
        frame = TOOLS['fit'](project(rings), 12)
        background = svg_path(frame(project(rings)), CONTEXT_TOLERANCE)
        selected = [r for r in (county if kind == 'municipality' else pref) if r['省级码'] == code and (r['县级类'] in ('市辖区','县','自治县') if kind == 'municipality' else r['地级类'] in ('地级市','自治州','地区','盟'))]
        selected.sort(key=lambda r: r['区划码'])
        if len(selected) != EXPECTED[code] or len({r['区划码'] for r in selected}) != len(selected):
            raise ValueError('Target catalog mismatch: ' + code)
        region_questions, centers = [], {}
        for r in selected:
            unit_code, unit_name = r['区划码'], r['地名']
            if len(unit_code) != 6 or not unit_code.isdigit() or not unit_code.startswith(code[:2]):
                raise ValueError('Invalid administrative code: ' + unit_code)
            unit_rings = geometry(r['geom'], unit_code)
            projected = project(unit_rings)
            unit_frame = TOOLS['fit'](projected, 18)
            main = svg_path(unit_frame(projected), MAIN_TOLERANCE)
            highlight_rings = frame(projected)
            if any(x < -0.5 or x > 400.5 or y < -0.5 or y > 300.5 for ring in highlight_rings for x,y in ring):
                raise ValueError('Highlight outside parent frame: ' + unit_code)
            highlight = svg_path(highlight_rings, HIGHLIGHT_TOLERANCE)
            admin_type = ('district' if r['县级类'] == '市辖区' else 'county') if kind == 'municipality' else ('city' if r['地级类'] == '地级市' else 'prefecture')
            q = {'id': 'china-' + unit_code, 'name': unit_name, 'region': name, 'regionId': code, 'adminType': admin_type, 'difficulty': 2, 'path': main, 'context': {'regionId': code, 'highlight': highlight}, 'choices': []}
            region_questions.append(q)
            x0,y0,x1,y1 = TOOLS['bbox'](projected); centers[q['id']] = ((x0+x1)/2,(y0+y1)/2)
            provenance.append({'id': q['id'], 'sourceCode': unit_code, 'sourceName': unit_name, 'parentId': code, 'sourceLayer': 'county' if kind == 'municipality' else 'prefecture', 'sourceType': r['县级类'] if kind == 'municipality' else r['地级类'], 'projection': projection, 'retainedRings': len(unit_rings)})
        for q in region_questions:
            x,y = centers[q['id']]
            candidates = sorted((r for r in region_questions if r['id'] != q['id']), key=lambda r: ((centers[r['id']][0]-x)**2+(centers[r['id']][1]-y)**2, r['id']))
            q['choices'] = [q['id']] + [r['id'] for r in candidates[:3]]
            if len(q['choices']) != 4:
                raise ValueError('Insufficient in-region choices')
        cities.extend(region_questions)
        regions.append({'id': code, 'name': name, 'kind': kind, 'status': 'complete', 'coverageComplete': True, 'path': background})
        report_rows.append({'id': code, 'name': name, 'kind': kind, 'complete': True, 'expectedQuestions': EXPECTED[code], 'actualQuestions': len(selected), 'units': [{'id':q['id'],'name':q['name'],'adminType':q['adminType']} for q in region_questions]})
    if len(cities) != 418:
        raise ValueError('Expected 333 prefectures + 85 municipality counties')
    source = {'id':'ctamap','name':'CTAmap v2.0 · 2026 snapshot','version':'v2.0 (2026-09-01); snapshot 2026-01-01 00:00','url':SOURCE_URL,'doi':'https://doi.org/10.5281/zenodo.22179207','license':'CC BY 4.0','licenseUrl':'https://creativecommons.org/licenses/by/4.0/','attribution':'Cheng, R., Xiao, C., Wang, Y. & Hu, Y. CTAmap: a continuous vector dataset of Chinese administrative divisions from 2000 to 2026. Modified: selected mainland province/prefecture/municipality-county features; projected, fitted and simplified. No endorsement implied.','licenseEvidence':json.loads((ROOT/'scripts/data/ctamap-evidence.json').read_text()),'files':[{'url':DOWNLOAD+'T2026_'+level+'.gpkg','sha256':digest} for level,digest in HASHES.items()],'usedFor':'31 province backgrounds; 333 prefectures and 85 municipality counties'}
    coverage = {'complete':True,'scope':'mainland-31-prefectures-and-municipality-counties','status':'source-snapshot-complete','note':'大陆31地区，333个地级行政区＋85个直辖市区县；按CTAmap 2026年初快照，不含普通省份的省直辖县级单位。数据覆盖校验不替代地图审核。','curation':'draft-needs-playtest'}
    notice = {'name':source['name'],'license':source['license'],'attribution':source['attribution'],'licenseUrl':'creativecommons.org/licenses/by/4.0/'}
    bank = {'version':VERSION,'countries':seed['countries'],'cities':cities,'regions':regions,'coverage':coverage,'notices':[seed['notice'],notice]}
    bank_bytes = (json.dumps(bank,ensure_ascii=False,separators=(',',':'))+'\n').encode()
    excluded = [{'code':r['区划码'],'name':r['地名'],'regionId':r['省级码'],'sourceType':r['地级类'],'reason':'Municipality parent placeholder' if r['省级码'] in MUNICIPALITIES else 'Outside selected prefecture scope: directly administered county-level unit'} for r in pref if r['地级类']=='不统计']
    report = {'version':VERSION,**coverage,'countries':60,'cities':418,'prefectures':333,'municipalityCounties':85,'regions':report_rows,'excludedPrefectureRows':excluded,'degenerateSourceInteriors':DEGENERATE_RINGS,'source':SOURCE_URL,'snapshot':'2026-01-01','administrativeReview':'Counts and source identifiers checked; not a current official registry certification','chongqingChangeEvidence':'https://www.cq.gov.cn/zwgk/zfxxgkml/zfgb/2025/d16q/202511/t20251124_15183601.html'}
    processing = seed['processing'].copy()
    processing.update(mainSimplificationPx=MAIN_TOLERANCE, contextSimplificationPx=CONTEXT_TOLERANCE, highlightSimplificationPx=HIGHLIGHT_TOLERANCE, countryMainSimplificationPx=0.65, chinaSimplificationPx={'main':MAIN_TOLERANCE,'context':CONTEXT_TOLERANCE,'highlight':HIGHLIGHT_TOLERANCE}, rings='All nondegenerate exterior/interior rings retained and normalized for nonzero fill; 293 numerically zero-area source interior slivers are listed in the coverage report; no islands relocated or independently enlarged', roundingDecimals='1 normally; adaptive 4/6/8/10 to prevent tiny-ring collapse', contextAlignment='Shared parent projection, scaling and translation',features=seed['processing']['features']+provenance)
    licenses = {'version':VERSION,'mapReviewStatus':'待重新核对审图范围','administrativeCurrency':'CTAmap 2026年初快照；不保证截至今日行政现势','performanceStatus':'静态与桌面浏览器检查；移动WebView性能未实测','questionBank':{'countries':60,'cities':418,'bytes':len(bank_bytes),'sha256':hashlib.sha256(bank_bytes).hexdigest()},'sources':[seed['source'],source],'processing':processing,'coverage':coverage,'limitations':['CC BY 4.0 permits redistribution with attribution and modification notices; no endorsement implied.','Ordinary provinces contain prefecture-level units only; municipalities contain county-level units.','All nondegenerate source rings retained without relocation or independent island enlargement; numerically zero-area interior slivers are recorded in the coverage report.','Coverage is relative to the pinned source snapshot, not an official map review.'],'curationStatus':'draft-needs-playtest'}
    # Regeneration must not silently reuse approval for changed geometry.
    existing = json.loads((ROOT/'public/assets/data-licenses.json').read_text())
    if existing.get('mapApprovalScope',{}).get('questionBankSha256') == hashlib.sha256(bank_bytes).hexdigest():
        for key in ('mapReviewStatus','mapApprovalNumber','mapApprovalScope'):
            licenses[key] = existing[key]
        licenses['limitations'] = existing['limitations']
        licenses = {**existing, **licenses}
    outputs = {'src/data/questions.json':bank_bytes,'public/assets/data-licenses.json':(json.dumps(licenses,ensure_ascii=False,indent=2)+'\n').encode(),'public/assets/coverage-report.json':(json.dumps(report,ensure_ascii=False,indent=2)+'\n').encode()}
    for file,content in outputs.items():
        dest = args.output_root / file
        if args.check:
            if dest.read_bytes() != content:
                raise ValueError('Reproducibility mismatch: '+file)
        else:
            dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(content)
    print(('Verified' if args.check else 'Generated') + ': 60 countries, 418 China units, 31 regions; '+str(len(bank_bytes))+' bytes')

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    for level in HASHES:
        parser.add_argument('--'+level,type=Path,required=True)
    parser.add_argument('--output-root',type=Path,default=ROOT)
    parser.add_argument('--check',action='store_true')
    build(parser.parse_args())
