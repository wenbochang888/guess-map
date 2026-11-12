#!/usr/bin/env python3
"""Append additional sovereign-country outlines to the existing bank. Standard library only.

Run with python3 -I from the workspace. The Natural Earth input path is explicit and
hash-pinned; China cities/regions and the original 60 country entries are never modified.

  python3 -I scripts/expand-countries.py --natural-earth /path/ne_50m_admin_0_countries.geojson
  python3 -I scripts/expand-countries.py --natural-earth ... --check
  python3 -I scripts/expand-countries.py --natural-earth ... --contact-sheet out.html
"""
import argparse
import hashlib
import html
import importlib.util
import json
import math
from pathlib import Path
import random
import sys

sys.dont_write_bytecode = True  # importing prepare-maps.py must not leave __pycache__ in the repo
ROOT = Path(__file__).resolve().parents[1]
VERSION = "2026-11-11.1"

_spec = importlib.util.spec_from_file_location("prepare_maps", ROOT / "scripts/prepare-maps.py")
pm = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(pm)

# (Natural Earth ADM0_A3, 中文名, 大洲, 熟悉度档位 1-3)
NEW_COUNTRIES = [
    ("RUS", "俄罗斯", "欧洲", 1), ("PRK", "朝鲜", "亚洲", 2), ("MMR", "缅甸", "亚洲", 2),
    ("IRN", "伊朗", "亚洲", 2), ("IRQ", "伊拉克", "亚洲", 2), ("AFG", "阿富汗", "亚洲", 3),
    ("TJK", "塔吉克斯坦", "亚洲", 3), ("KGZ", "吉尔吉斯斯坦", "亚洲", 3), ("TKM", "土库曼斯坦", "亚洲", 3),
    ("SYR", "叙利亚", "亚洲", 3), ("JOR", "约旦", "亚洲", 3), ("YEM", "也门", "亚洲", 3),
    ("KWT", "科威特", "亚洲", 3),
    ("NLD", "荷兰", "欧洲", 2), ("BEL", "比利时", "欧洲", 2), ("DNK", "丹麦", "欧洲", 2),
    ("ISL", "冰岛", "欧洲", 2), ("HUN", "匈牙利", "欧洲", 3), ("SVK", "斯洛伐克", "欧洲", 3),
    ("BGR", "保加利亚", "欧洲", 3), ("HRV", "克罗地亚", "欧洲", 3), ("BLR", "白俄罗斯", "欧洲", 3),
    ("LTU", "立陶宛", "欧洲", 3), ("LVA", "拉脱维亚", "欧洲", 3), ("EST", "爱沙尼亚", "欧洲", 3),
    ("SVN", "斯洛文尼亚", "欧洲", 3), ("BIH", "波黑", "欧洲", 3), ("ALB", "阿尔巴尼亚", "欧洲", 3),
    ("MDA", "摩尔多瓦", "欧洲", 3), ("GEO", "格鲁吉亚", "亚洲", 3),
    ("LBY", "利比亚", "非洲", 2), ("TUN", "突尼斯", "非洲", 3), ("SDN", "苏丹", "非洲", 3),
    ("SDS", "南苏丹", "非洲", 3), ("TCD", "乍得", "非洲", 3), ("NER", "尼日尔", "非洲", 3),
    ("MLI", "马里", "非洲", 3), ("SEN", "塞内加尔", "非洲", 3), ("CIV", "科特迪瓦", "非洲", 3),
    ("CMR", "喀麦隆", "非洲", 3), ("AGO", "安哥拉", "非洲", 3), ("ZMB", "赞比亚", "非洲", 3),
    ("ZWE", "津巴布韦", "非洲", 3), ("MOZ", "莫桑比克", "非洲", 3), ("COD", "刚果（金）", "非洲", 3),
    ("UGA", "乌干达", "非洲", 3),
    ("VEN", "委内瑞拉", "南美洲", 2), ("ECU", "厄瓜多尔", "南美洲", 2), ("BOL", "玻利维亚", "南美洲", 3),
    ("PRY", "巴拉圭", "南美洲", 3), ("URY", "乌拉圭", "南美洲", 3), ("PAN", "巴拿马", "北美洲", 3),
    ("CRI", "哥斯达黎加", "北美洲", 3), ("GTM", "危地马拉", "北美洲", 3), ("HND", "洪都拉斯", "北美洲", 3),
    ("JAM", "牙买加", "北美洲", 2), ("DOM", "多米尼加", "北美洲", 3),
    ("NZL", "新西兰", "大洋洲", 1),
]

# Deliberately not included; recorded in the snapshot so the omission is reviewable.
EXCLUDED = [
    {"code": "IND", "reason": "Natural Earth 边界含藏南及克什米尔争议画法，与我国立场不符"},
    {"code": "PAK", "reason": "Natural Earth 边界含克什米尔争议画法"},
    {"code": "SRB", "reason": "Natural Earth 将科索沃单列，塞尔维亚轮廓不完整"},
    {"code": "SOM", "reason": "Natural Earth 将索马里兰单列，索马里轮廓不完整"},
    {"code": "ISR", "reason": "涉及巴勒斯坦及戈兰高地画法"},
    {"code": "CHN/HKG/MAC/TWN", "reason": "不使用中国及港澳台几何"},
    {"code": "dependencies/micro-states", "reason": "属地不列作国家；微型岛国在1:50m精度下轮廓不可辨"},
    {"code": "FJI", "reason": "群岛分散，1:50m 轮廓缩放后仅剩散点，不可辨认"},
]


def _center(polygon):
    x0, y0, x1, y1 = pm.bbox(polygon[:1])
    return (x0 + x1) / 2, (y0 + y1) / 2


# Polygon-level extent rules (outer-ring bbox centre), disclosed per feature like France.
EXTENT_RULES = {
    "NLD": ("Netherlands: outside European extent", lambda lon, lat: -6 <= lon <= 10 and 49 <= lat <= 55),
    "ECU": ("Ecuador: Galápagos Islands omitted", lambda lon, lat: lon > -85),
    "NZL": ("New Zealand: outside main-island extent (Chatham/sub-Antarctic islands, Tokelau)",
            lambda lon, lat: 166 <= lon <= 179 and -48 <= lat <= -34),
    "RUS": ("Russia: Crimean peninsula polygon omitted", lambda lon, lat: not (32 <= lon <= 37 and 44 <= lat <= 46.3)),
}
SCOPE_NOTES = {"NLD": "欧洲本土", "ECU": "不含加拉帕戈斯群岛", "NZL": "本土主要岛屿"}


def retain(polygons, code):
    if code not in EXTENT_RULES:
        return [ring for polygon in polygons for ring in polygon], []
    reason, keep = EXTENT_RULES[code]
    kept, removed = [], []
    for index, polygon in enumerate(polygons):
        lon, lat = _center(polygon)
        if keep(lon, lat):
            kept.extend(polygon)
        else:
            removed.append({"polygonIndex": index, "bbox": list(pm.bbox(polygon[:1])), "reason": reason})
    return kept, removed


def anchor(rings):
    """Centre of the largest ring, longitude kept in [-180, 180)."""
    largest = max(rings, key=lambda r: abs(pm.signed_area(r)))
    return _center([largest])


def distance(a, b):
    dlon = pm.lon_delta(a[0], b[0]) * math.cos(math.radians((a[1] + b[1]) / 2))
    return math.hypot(dlon, a[1] - b[1])


def distractors(code, catalog, anchors):
    me = catalog[code]
    rng = random.Random("distractors-" + code)
    others = sorted(c for c in catalog if c != code)
    nearest = sorted(others, key=lambda c: (distance(anchors[code], anchors[c]), c))
    same = [c for c in nearest if catalog[c]["region"] == me["region"]]
    far = [c for c in others if catalog[c]["region"] != me["region"]]
    medium = (same + [c for c in nearest if c not in same])[:4]
    medium += rng.sample([c for c in far if c not in medium], 4)
    easy = rng.sample(far, 8)
    hard = nearest[:8]
    to_id = lambda codes: ["country-" + c.lower() for c in codes]
    return {"easy": to_id(easy), "medium": to_id(medium), "hard": to_id(hard)}


def build(raw):
    if hashlib.sha256(raw).hexdigest() != pm.PINNED["natural_earth"]:
        raise ValueError("Natural Earth hash mismatch")
    features = {f["properties"]["ADM0_A3"]: f for f in json.loads(raw)["features"]}
    bank = json.loads((ROOT / "src/data/questions.json").read_text("utf-8"))
    snapshot = json.loads((ROOT / "scripts/data/country-snapshot.json").read_text("utf-8"))
    curation = json.loads((ROOT / "scripts/data/country-curation.json").read_text("utf-8"))

    original_codes = [c for c, *_ in pm.COUNTRIES]
    original_ids = {"country-" + c.lower() for c in original_codes}
    original = [q for q in bank["countries"] if q["id"] in original_ids]
    if len(original) != 60:
        raise ValueError("Original 60-country catalog missing")
    if any(c in original_codes for c, *_ in NEW_COUNTRIES) or len({c for c, *_ in NEW_COUNTRIES}) != len(NEW_COUNTRIES):
        raise ValueError("Duplicate country code")
    excluded = {"IND", "PAK", "SRB", "SOM", "ISR", "CHN", "HKG", "MAC", "TWN"}
    if excluded & {c for c, *_ in NEW_COUNTRIES}:
        raise ValueError("Excluded country listed")

    catalog = {c: {"region": r} for c, _, r, _ in pm.COUNTRIES}
    catalog.update({c: {"region": r} for c, _, r, _ in NEW_COUNTRIES})
    anchors = {}
    for code in original_codes:
        rings, _ = pm.retain_country(pm.geojson_polygons(features[code]["geometry"]), code)
        anchors[code] = anchor(rings)

    added, processing, curated = [], [], {}
    for code, name, region, band in NEW_COUNTRIES:
        feature = features[code]
        if feature["properties"]["TYPE"] not in ("Country", "Sovereign country", "Sovereignty"):
            raise ValueError(f"Not a country: {code}")
        rings, removed = retain(pm.geojson_polygons(feature["geometry"]), code)
        anchors[code] = anchor(rings)
        project, parameters = pm.projection(rings)
        projected = project(rings)
        path = pm.svg_path(pm.fit(projected, 18)(projected))
        qid = "country-" + code.lower()
        added.append({"id": qid, "name": name, "region": region, "difficulty": band, "path": path, "choices": []})
        processing.append({"id": qid, "sourceFeature": code, "projection": parameters,
                           "retainedRings": len(rings), "omittedPolygons": removed})
    for question, (code, *_rest) in zip(added, NEW_COUNTRIES):
        picks = distractors(code, catalog, anchors)
        question["distractors"] = picks
        question["choices"] = [question["id"]] + picks["medium"][:3]
        curated[question["id"]] = {"familiarityBand": question["difficulty"], "status": "auto-draft", "distractors": picks}

    bank["countries"] = original + added
    bank["version"] = VERSION
    snapshot["countries"] = bank["countries"]
    snapshot["source"]["usedFor"] = (f"{len(bank['countries'])} 个主权国家轮廓；不使用中国、香港、澳门、台湾几何；"
                                     "不将属地列作国家；排除边界画法与我国立场不符的国家")
    snapshot["processing"]["features"] = [f for f in snapshot["processing"]["features"] if f["id"] in original_ids] + processing
    snapshot["processing"]["remoteTerritories"] = (
        "France: European mainland and Corsica only. Netherlands: European part only. Ecuador: Galápagos omitted. "
        "New Zealand: main islands only (Chatham, sub-Antarctic islands and Tokelau omitted). Russia: Crimean peninsula "
        "polygon omitted. Every omitted polygon is listed per feature below; all other source polygons are retained.")
    snapshot["processing"]["excluded"] = EXCLUDED
    snapshot["processing"]["distractors"] = (
        "City choices use stable IDs from the same province; original 60 country distractors follow the human curation "
        "table; the 2026-11-11 additions use deterministic auto-draft candidates (medium: nearest same-continent + "
        "seeded other-continent; hard: nearest overall; easy: seeded other-continent), pending playtest.")
    curation["countries"] = {k: v for k, v in curation["countries"].items() if k in original_ids}
    curation["countries"].update(curated)
    curation["autoDraft"] = "Entries with status auto-draft were generated by scripts/expand-countries.py on 2026-11-11."
    return bank, snapshot, curation


def contact_sheet(bank, out):
    names = {q["id"]: q["name"] for q in bank["countries"]}
    added = bank["countries"][60:]
    cells = "".join(
        f'<figure><svg viewBox="0 0 400 300"><rect width="400" height="300" fill="#f3ead8"/>'
        f'<path d="{q["path"]}" fill="#22392f"/></svg><figcaption><b>{html.escape(q["name"])}</b> '
        f'· {q["region"]} · 档{q["difficulty"]}<br>中：{"、".join(names[i] for i in q["distractors"]["medium"])}'
        f'</figcaption></figure>' for q in added)
    out.write_text('<meta charset="utf-8"><title>新增国家联系表</title><style>body{font:13px sans-serif;margin:16px}'
                   'main{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}'
                   'figure{margin:0}svg{width:100%;display:block}</style>'
                   f'<h1>新增 {len(added)} 国</h1><main>{cells}</main>', "utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--natural-earth", required=True, type=Path)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--contact-sheet", type=Path)
    args = parser.parse_args()
    bank, snapshot, curation = build(args.natural_earth.read_bytes())
    outputs = {
        ROOT / "src/data/questions.json": pm.encode_json(bank),
        ROOT / "scripts/data/country-snapshot.json": pm.encode_json(snapshot),
        ROOT / "scripts/data/country-curation.json": (json.dumps(curation, ensure_ascii=False, indent=2) + "\n").encode("utf-8"),
    }
    questions = outputs[ROOT / "src/data/questions.json"]
    sha = hashlib.sha256(questions).hexdigest()
    report = json.loads((ROOT / "public/assets/coverage-report.json").read_text("utf-8"))
    report.update(version=VERSION, countries=len(bank["countries"]))
    licenses = json.loads((ROOT / "public/assets/data-licenses.json").read_text("utf-8"))
    licenses["version"] = VERSION
    licenses["questionBank"].update(countries=len(bank["countries"]), bytes=len(questions), sha256=sha)
    next(s for s in licenses["sources"] if s["id"] == "natural-earth")["usedFor"] = snapshot["source"]["usedFor"]
    licenses["mapApprovalScope"].update(
        countries=len(bank["countries"]), questionBankSha256=sha,
        confirmation="用户于2026-11-08确认正式批准文件覆盖当时全部最终成图（60国）；2026-11-11按用户指示扩展至"
                     f"{len(bank['countries'])}国并沿用该审图号，新增轮廓的审图范围由用户另行处理；本地未留存批准文件。")
    pretty = lambda value: (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    outputs[ROOT / "public/assets/coverage-report.json"] = pretty(report)
    outputs[ROOT / "public/assets/data-licenses.json"] = pretty(licenses)
    if args.check:
        stale = [str(p.relative_to(ROOT)) for p, data in outputs.items() if p.read_bytes() != data]
        if stale:
            raise SystemExit("Not reproducible: " + ", ".join(stale))
    else:
        for p, data in outputs.items():
            p.write_bytes(data)
    if args.contact_sheet:
        contact_sheet(bank, args.contact_sheet)
    print(json.dumps({"countries": len(bank["countries"]), "added": len(bank["countries"]) - 60,
                      "version": VERSION, "bytes": len(questions),
                      "questionsSha256": sha, "check": args.check}, ensure_ascii=False))


if __name__ == "__main__":
    main()
