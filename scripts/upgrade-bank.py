"""Convert pinned legacy maps into v2 schema without inventing missing boundaries.
This snapshot intentionally remains release-blocked until complete licensed data is supplied.
"""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
def upgrade(bank):
    regions=[]
    for code,name,kind in json.loads((ROOT/'scripts/data/regions.json').read_text()):
        old=next((q for q in bank['cities'] if q['region']==name),None)
        regions.append({'id':code,'name':name,'kind':kind,'status':'sample' if old else 'missing','path':old['context']['path'] if old else '', 'coverageComplete':False})
    for q in bank['cities']:
        region=next(r for r in regions if r['name']==q['region'])
        q['regionId']=region['id'];q['adminType']='city';q['context']={'regionId':region['id'],'highlight':q['context']['highlight']}
        names=q.pop('choices');q['choices']=[next(x['id'] for x in bank['cities'] if x['name']==n and x['region']==q['region']) for n in names]
    countries=bank['countries']
    curation=json.loads((ROOT/'scripts/data/country-curation.json').read_text())
    if set(curation['countries']) != {q['id'] for q in countries}:
        raise ValueError('Country curation and target catalog differ')
    for q in countries:
        entry=curation['countries'][q['id']]
        q['difficulty']=entry['familiarityBand']
        q['distractors']=entry['distractors']
        for level in ('easy','medium','hard'):
            pool=q['distractors'][level]
            if len(pool)<3 or len(pool)!=len(set(pool)) or q['id'] in pool or any(x not in curation['countries'] for x in pool):
                raise ValueError('Invalid curated candidates: '+q['id'])
        q['choices']=[q['id']]+q['distractors']['medium'][:3]
    bank.update(version='2026-11-07.3',regions=regions,coverage={'complete':False,'scope':'mainland-31-prefectures-and-municipality-counties','status':'blocked-missing-verified-boundaries','note':'目前仅10省40道历史精选城市题，非全国完整题库；四个直辖市区县待补齐。','curation':'draft-needs-playtest'})
    bank['notices']=[{'name':'Natural Earth 5.1.2','license':'Public Domain','attribution':'Made with Natural Earth. Free vector and raster map data @ naturalearthdata.com.','licenseUrl':'naturalearthdata.com/about/terms-of-use/'},{'name':'OCHA ROAP / HDX · China COD-AB (2020)','license':'CC BY-IGO 3.0','attribution':'Modified: selected ADM1/ADM2 features, projected, fitted and simplified. No endorsement by the United Nations or any data provider is implied.','licenseUrl':'creativecommons.org/licenses/by/3.0/igo/'}]
    return bank
if __name__=='__main__':
    import argparse
    p=argparse.ArgumentParser();p.add_argument('input',type=Path);p.add_argument('output',type=Path);a=p.parse_args()
    a.output.write_text(json.dumps(upgrade(json.loads(a.input.read_text())),ensure_ascii=False,separators=(',',':'))+'\n')
