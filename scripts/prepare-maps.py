#!/usr/bin/env python3
"""Prepare the small offline map bank. Python standard library only.

Run with python3 -I from the workspace, never from a downloaded archive directory.
Raw input paths are explicit; no source code or archive members are executed.
See docs/data-sources.md for pinned downloads, attribution and known limitations.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import random
import re
import struct
import zipfile

VERSION = "2026-11-07.3"
NE_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_countries.geojson"
HDX_URL = "https://data.humdata.org/dataset/17a2aaa2-dea9-4a2e-8b3f-92d1bdfb850c/resource/9e67ddf9-ce26-4b7a-82b1-51e5ca0714c8/download/chn_adm_ocha_2020_shp.zip"
HDX_META_URL = "https://data.humdata.org/api/3/action/package_show?id=cod-ab-chn"
NE_LICENSE = "https://www.naturalearthdata.com/about/terms-of-use/"
CITY_LICENSE = "https://creativecommons.org/licenses/by/3.0/igo/legalcode.en"
PINNED = {
    "natural_earth": "3e458fc036ad0a66411f2c1e6cac49c5d7bfb81cb1123bc513b22511a2b7fdeb",
    "china_shp": "f6a1f0fd969dbcc830e395c8211746730a80e8429585e045c6b0da92cd6e0ec9",
}
# Explicit sovereign-state allowlist, not the entire Natural Earth country layer.
# China, Hong Kong, Macao, Taiwan, dependencies and disputed entities are absent.
COUNTRIES = [
    ("JPN", "日本", "亚洲", 1), ("KOR", "韩国", "亚洲", 1),
    ("MNG", "蒙古国", "亚洲", 2), ("THA", "泰国", "亚洲", 1),
    ("VNM", "越南", "亚洲", 1), ("KHM", "柬埔寨", "亚洲", 2),
    ("LAO", "老挝", "亚洲", 2), ("MYS", "马来西亚", "亚洲", 2),
    ("IDN", "印度尼西亚", "亚洲", 2), ("PHL", "菲律宾", "亚洲", 2),
    ("NPL", "尼泊尔", "亚洲", 2), ("BTN", "不丹", "亚洲", 3),
    ("LKA", "斯里兰卡", "亚洲", 1), ("BGD", "孟加拉国", "亚洲", 3),
    ("SAU", "沙特阿拉伯", "亚洲", 2), ("OMN", "阿曼", "亚洲", 3),
    ("ARE", "阿联酋", "亚洲", 3), ("TUR", "土耳其", "亚洲", 1),
    ("KAZ", "哈萨克斯坦", "亚洲", 2), ("UZB", "乌兹别克斯坦", "亚洲", 3),
    ("GBR", "英国", "欧洲", 1), ("IRL", "爱尔兰", "欧洲", 2),
    ("FRA", "法国", "欧洲", 1), ("DEU", "德国", "欧洲", 1),
    ("ITA", "意大利", "欧洲", 1), ("ESP", "西班牙", "欧洲", 1),
    ("PRT", "葡萄牙", "欧洲", 1), ("GRC", "希腊", "欧洲", 2),
    ("NOR", "挪威", "欧洲", 2), ("SWE", "瑞典", "欧洲", 2),
    ("FIN", "芬兰", "欧洲", 2), ("POL", "波兰", "欧洲", 2),
    ("AUT", "奥地利", "欧洲", 3), ("CHE", "瑞士", "欧洲", 2),
    ("CZE", "捷克", "欧洲", 3), ("ROU", "罗马尼亚", "欧洲", 3),
    ("UKR", "乌克兰", "欧洲", 2), ("EGY", "埃及", "非洲", 1),
    ("ZAF", "南非", "非洲", 1), ("KEN", "肯尼亚", "非洲", 2),
    ("TZA", "坦桑尼亚", "非洲", 3), ("ETH", "埃塞俄比亚", "非洲", 3),
    ("GHA", "加纳", "非洲", 3), ("NGA", "尼日利亚", "非洲", 2),
    ("DZA", "阿尔及利亚", "非洲", 2), ("MAR", "摩洛哥", "非洲", 2),
    ("MDG", "马达加斯加", "非洲", 1), ("NAM", "纳米比亚", "非洲", 3),
    ("BWA", "博茨瓦纳", "非洲", 3), ("USA", "美国", "北美洲", 1),
    ("CAN", "加拿大", "北美洲", 1), ("MEX", "墨西哥", "北美洲", 1),
    ("BRA", "巴西", "南美洲", 1), ("ARG", "阿根廷", "南美洲", 1),
    ("CHL", "智利", "南美洲", 1), ("PER", "秘鲁", "南美洲", 2),
    ("COL", "哥伦比亚", "南美洲", 2), ("AUS", "澳大利亚", "大洋洲", 1),
    ("CUB", "古巴", "北美洲", 1), ("PNG", "巴布亚新几内亚", "大洋洲", 3),
]
# Four questions per province => every distractor is also a playable same-province city.
CITY_GROUPS = {
    "江苏省": ["南京市", "苏州市", "无锡市", "徐州市"],
    "浙江省": ["杭州市", "宁波市", "温州市", "舟山市"],
    "广东省": ["广州市", "深圳市", "珠海市", "汕头市"],
    "四川省": ["成都市", "绵阳市", "乐山市", "宜宾市"],
    "湖北省": ["武汉市", "宜昌市", "襄阳市", "黄冈市"],
    "湖南省": ["长沙市", "岳阳市", "衡阳市", "张家界市"],
    "福建省": ["福州市", "厦门市", "泉州市", "漳州市"],
    "河南省": ["郑州市", "洛阳市", "开封市", "南阳市"],
    "安徽省": ["合肥市", "芜湖市", "黄山市", "安庆市"],
    "江西省": ["南昌市", "九江市", "赣州市", "景德镇市"],
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def encode_json(value):
    return (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")


def signed_area(ring):
    return sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(ring, ring[1:] + ring[:1])) / 2


def bbox(rings):
    points = [p for r in rings for p in r]
    return (min(p[0] for p in points), min(p[1] for p in points),
            max(p[0] for p in points), max(p[1] for p in points))


def lon_delta(lon, center):
    return (lon - center + 180) % 360 - 180


def projection(rings):
    # Plate carree / local equirectangular, reference parallel at bbox mid-latitude.
    # Unwrap around the largest ring so Alaska/Aleutians do not split at 180 degrees.
    largest = max(rings, key=lambda r: abs(signed_area(r)))
    lon0 = sum(p[0] for p in largest) / len(largest)
    lat0 = (min(p[1] for r in rings for p in r) + max(p[1] for r in rings for p in r)) / 2
    k = math.cos(math.radians(lat0))

    def project(raw):
        return [[(lon_delta(x, lon0) * k, -y) for x, y in r] for r in raw]
    return project, {"centralMeridian": round(lon0, 6), "standardParallel": round(lat0, 6)}


def fit(rings, padding):
    x0, y0, x1, y1 = bbox(rings)
    scale = min((400 - 2 * padding) / (x1 - x0), (300 - 2 * padding) / (y1 - y0))
    return lambda raw: [[((x - (x0 + x1) / 2) * scale + 200,
                         (y - (y0 + y1) / 2) * scale + 150) for x, y in r] for r in raw]


def segment_distance_sq(p, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    t = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy))) if dx or dy else 0
    return (p[0] - a[0] - t * dx) ** 2 + (p[1] - a[1] - t * dy) ** 2


def simplify_line(points, tolerance):
    keep = {0, len(points) - 1}
    stack = [(0, len(points) - 1)]
    while stack:
        start, end = stack.pop()
        if end <= start + 1:
            continue
        index = max(range(start + 1, end), key=lambda i: segment_distance_sq(points[i], points[start], points[end]))
        if segment_distance_sq(points[index], points[start], points[end]) > tolerance ** 2:
            keep.add(index)
            stack.extend(((start, index), (index, end)))
    return [points[i] for i in sorted(keep)]


def simplify_ring(raw, tolerance):
    ring = list(raw[:-1] if raw[0] == raw[-1] else raw)
    # Split a closed ring at its farthest vertex; open RDP would collapse its closure.
    split = max(range(1, len(ring)), key=lambda i: segment_distance_sq(ring[i], ring[0], ring[0]))
    result = simplify_line(ring[:split + 1], tolerance)[:-1] + simplify_line(ring[split:] + ring[:1], tolerance)[:-1]
    if len(result) < 3 or signed_area(result) * signed_area(ring) <= 0:
        result = ring
    # Retain tiny islands even when rounding to 0.1px would erase their area.
    rounded = [(round(x, 1), round(y, 1)) for x, y in result]
    precision = 1 if len(set(rounded)) >= 3 and signed_area(rounded) * signed_area(result) > 0 else 4
    return result, precision


def svg_path(rings, tolerance=0.65):
    parts = []
    for raw in rings:
        if len(raw) < 3 or abs(signed_area(raw)) < 1e-12:
            raise ValueError("Degenerate input ring")
        ring, precision = simplify_ring(raw, tolerance)
        def fmt(value):
            s = f"{value:.{precision}f}".rstrip("0").rstrip(".")
            return "0" if s in ("", "-0") else s
        parts.append("M" + "L".join(fmt(x) + "," + fmt(y) for x, y in ring) + "Z")
    return "".join(parts)


def geojson_polygons(geometry):
    if geometry["type"] == "Polygon":
        return [geometry["coordinates"]]
    if geometry["type"] == "MultiPolygon":
        return geometry["coordinates"]
    raise ValueError("Only polygon geometry is supported")


def retain_country(polygons, code):
    # Only European France is shown; this is explicitly disclosed in the manifest.
    removed = []
    selected = []
    for index, polygon in enumerate(polygons):
        bounds = bbox(polygon[:1])
        if code == "FRA" and not (-6 <= (bounds[0] + bounds[2]) / 2 <= 10 and 41 <= (bounds[1] + bounds[3]) / 2 <= 52):
            removed.append({"polygonIndex": index, "bbox": list(bounds), "reason": "France: outside European extent"})
        else:
            selected.append((index, polygon))
    # Never use distance from mainland centroid as an island filter: it would
    # wrongly remove islands adjacent to other parts of an extended archipelago.
    kept = [ring for _, polygon in selected for ring in polygon]
    return kept, removed


def dbf_rows(data):
    count = struct.unpack_from("<I", data, 4)[0]
    header, record_size = struct.unpack_from("<HH", data, 8)
    fields = []
    for offset in range(32, header - 1, 32):
        name = data[offset:offset + 11].split(b"\0")[0].decode("ascii")
        fields.append((name, data[offset + 16]))
    rows = []
    for i in range(count):
        offset = header + i * record_size
        if data[offset:offset + 1] == b"*":
            raise ValueError("Deleted DBF row; refusing misaligned shape records")
        offset += 1
        row = {}
        for name, length in fields:
            row[name] = data[offset:offset + length].decode("utf-8").strip()
            offset += length
        rows.append(row)
    return rows


def shapefile_rings(data):
    if struct.unpack_from(">I", data)[0] != 9994 or struct.unpack_from("<I", data, 32)[0] != 5:
        raise ValueError("Expected ESRI polygon shapefile")
    records = []
    offset = 100
    while offset < len(data):
        _, words = struct.unpack_from(">II", data, offset)
        start = offset + 8
        end = start + words * 2
        if end > len(data) or struct.unpack_from("<I", data, start)[0] != 5:
            raise ValueError("Invalid polygon record")
        parts_count, points_count = struct.unpack_from("<II", data, start + 36)
        indices = list(struct.unpack_from("<" + "I" * parts_count, data, start + 44)) + [points_count]
        points_start = start + 44 + parts_count * 4
        points = [struct.unpack_from("<dd", data, points_start + i * 16) for i in range(points_count)]
        if any(not math.isfinite(v) for p in points for v in p):
            raise ValueError("Non-finite coordinate")
        records.append([points[a:b] for a, b in zip(indices, indices[1:])])
        offset = end
    return records


def read_china(path, level):
    stem = f"chn_admbnda_adm{level}_ocha_2020"
    with zipfile.ZipFile(path) as archive:
        # Read exactly named members in memory; no archive extraction or code execution.
        prj = archive.read(stem + ".prj").decode("ascii")
        if not prj.startswith("GEOGCS[") or "WGS_1984" not in prj:
            raise ValueError("Expected WGS84 geographic coordinates")
        rows = dbf_rows(archive.read(stem + ".dbf"))
        shapes = shapefile_rings(archive.read(stem + ".shp"))
        if len(rows) != len(shapes):
            raise ValueError("DBF / SHP row count mismatch")
        return [(row, rings) for row, rings in zip(rows, shapes)]


def choose(name, pool, seed):
    rng = random.Random(seed)
    others = sorted(set(pool) - {name})
    result = [name] + rng.sample(others, 3)
    rng.shuffle(result)
    return result


def build_countries(raw):
    features = {f["properties"]["ADM0_A3"]: f for f in json.loads(raw)["features"]}
    result, processing = [], []
    for code, name, region, difficulty in COUNTRIES:
        feature = features[code]
        if feature["properties"]["TYPE"] not in ("Country", "Sovereign country", "Sovereignty"):
            raise ValueError(f"Not a country: {code}")
        rings, removed = retain_country(geojson_polygons(feature["geometry"]), code)
        project, parameters = projection(rings)
        projected = project(rings)
        path = svg_path(fit(projected, 18)(projected))
        pool = [n for _, n, r, _ in COUNTRIES if r == region]
        if len(pool) < 4:
            pool = [n for _, n, _, _ in COUNTRIES]
        result.append({"id": "country-" + code.lower(), "name": name, "region": region,
                       "difficulty": difficulty, "path": path, "choices": choose(name, pool, code)})
        processing.append({"id": "country-" + code.lower(), "sourceFeature": code,
                           "projection": parameters, "retainedRings": len(rings), "omittedPolygons": removed})
    return result, processing


def build_cities(path):
    provinces = {p["ADM1_ZH"]: (p, rings) for p, rings in read_china(path, 1)}
    features = {(p["ADM1_ZH"], p["ADM2_ZH"]): (p, rings) for p, rings in read_china(path, 2)}
    result, processing = [], []
    for province, names in CITY_GROUPS.items():
        parent, parent_rings = provinces[province]
        project, parameters = projection(parent_rings)
        parent_projected = project(parent_rings)
        context_fit = fit(parent_projected, 12)
        context_path = svg_path(context_fit(parent_projected), 0.55)
        for index, name in enumerate(names):
            props, rings = features[province, name]
            if props["Admin_type"] != "Prefecture-level city" or props["ADM1_PCODE"] != parent["ADM1_PCODE"]:
                raise ValueError(f"Unexpected city type or parent: {name}")
            projected = project(rings)
            highlighted = context_fit(projected)
            if any(not (-0.05 <= x <= 400.05 and -0.05 <= y <= 300.05) for ring in highlighted for x, y in ring):
                raise ValueError(f"City does not fit province frame: {name}")
            identity = "city-" + props["ADM2_PCODE"].lower()
            result.append({"id": identity, "name": name, "region": province,
                           "difficulty": 1 if index == 0 else 2 if index < 3 else 3,
                           "path": svg_path(fit(projected, 18)(projected)),
                           "context": {"path": context_path, "highlight": svg_path(highlighted, 0.35), "label": province},
                           "choices": choose(name, names, identity)})
            processing.append({"id": identity, "sourceFeature": props["ADM2_PCODE"],
                               "parentFeature": props["ADM1_PCODE"], "projection": parameters,
                               "retainedRings": len(rings), "omittedPolygons": []})
    return result, processing


def validate(bank):
    assert len(bank["countries"]) == 60 and len(bank["cities"]) == 40
    ids, names = set(), set()
    for category in ("countries", "cities"):
        for q in bank[category]:
            assert q["id"] not in ids and q["name"] not in names
            ids.add(q["id"])
            names.add(q["name"])
            assert q["difficulty"] in (1, 2, 3)
            assert len(q["choices"]) == len(set(q["choices"])) == 4 and q["name"] in q["choices"]
            assert all(re.search(r"[一-鿿]", n) for n in q["choices"])
            paths = [q["path"]]
            if category == "cities":
                assert set(q["choices"]) == set(CITY_GROUPS[q["region"]])
                assert q["context"]["label"] == q["region"]
                paths += [q["context"]["path"], q["context"]["highlight"]]
            for path in paths:
                assert re.fullmatch(r"(?:M-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?(?:L-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?){2,}Z)+", path)
                numbers = list(map(float, re.findall(r"-?\d+(?:\.\d+)?", path)))
                assert all(0 <= v <= (400 if i % 2 == 0 else 300) for i, v in enumerate(numbers))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("natural-earth", "china-shp", "hdx-metadata", "natural-earth-license", "city-license"):
        parser.add_argument("--" + name, required=True, type=Path)
    parser.add_argument("--output-root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--check", action="store_true", help="Rebuild in memory and compare without writing")
    parser.add_argument("--legacy-sample", action="store_true", help="Explicitly allow rebuilding the obsolete 10-province sample snapshot")
    args = parser.parse_args()
    if not args.legacy_sample:
        parser.error("Legacy 40-city builder: use prepare-china.py for the nationwide bank; --legacy-sample is required for historical reproduction.")
    inputs = {key: getattr(args, key).read_bytes() for key in
              ("natural_earth", "china_shp", "hdx_metadata", "natural_earth_license", "city_license")}
    for key, expected in PINNED.items():
        if digest(inputs[key]) != expected:
            raise ValueError(f"Unrecognized {key} snapshot; inspect source/version/license before updating pins")
    metadata = json.loads(inputs["hdx_metadata"])["result"]
    if metadata["license_id"] != "cc-by-igo" or metadata["id"] != "17a2aaa2-dea9-4a2e-8b3f-92d1bdfb850c":
        raise ValueError("Unexpected HDX identity or license")
    countries, country_processing = build_countries(inputs["natural_earth"])
    cities, city_processing = build_cities(args.china_shp)
    bank = {"version": VERSION, "countries": countries, "cities": cities}
    validate(bank)
    # Keep raw source validation above, then normalize shared contexts and ID choices.
    import runpy
    bank = runpy.run_path(str(Path(__file__).with_name("upgrade-bank.py")))["upgrade"](bank)
    questions = encode_json(bank)
    licenses = {
        "version": VERSION, "mapReviewStatus": "待重新核对审图范围", "administrativeCurrency": "不保证行政区划最新",
        "performanceStatus": "仅完成静态数据检查；移动设备性能未实测",
        "questionBank": {"countries": len(countries), "cities": len(cities), "bytes": len(questions), "sha256": digest(questions)},
        "sources": [
            {"id": "natural-earth", "name": "Natural Earth", "version": "5.1.2; 1:50m admin_0_countries",
             "url": NE_URL, "sha256": digest(inputs["natural_earth"]), "license": "Public Domain",
             "licenseUrl": NE_LICENSE, "licenseEvidenceSha256": digest(inputs["natural_earth_license"]),
             "attribution": "Made with Natural Earth. Free vector and raster map data @ naturalearthdata.com.",
             "usedFor": "60 个主权国家轮廓；不使用中国、香港、澳门、台湾几何；不将属地列作国家"},
            {"id": "hdx-ocha-china", "name": "China - Subnational Administrative Boundaries (COD-AB)",
             "provider": "OCHA Regional Office for Asia and the Pacific (ROAP); vetting: ITOS, funded by USAID",
             "version": "chn_adm_ocha_2020_SHP; resource snapshot SHA-256 pinned", "url": HDX_URL,
             "sha256": digest(inputs["china_shp"]), "datasetUrl": "https://data.humdata.org/dataset/cod-ab-chn",
             "metadataUrl": HDX_META_URL, "metadataSha256": digest(inputs["hdx_metadata"]),
             "metadataModified": metadata["metadata_modified"], "license": "CC BY-IGO 3.0",
             "licenseUrl": CITY_LICENSE, "licenseEvidenceSha256": digest(inputs["city_license"]),
             "attribution": "Source: OCHA ROAP / HDX, China - Subnational Administrative Boundaries (COD-AB), chn_adm_ocha_2020. CC BY-IGO 3.0. Modified: selected ADM1/ADM2 features, projected, fitted and simplified; Chinese names retained. No endorsement by the United Nations or any data provider is implied.",
             "upstreamProvenance": "HDX describes original sources only as publicly available online sources; source is unofficial. No independent official provenance or current-boundary certification is claimed.",
             "usedFor": "10 省的 40 个普通地级市与所属省域；未使用直辖市、港澳台或全国边界"},
        ],
        "processing": {"viewBox": "0 0 400 300", "northUp": True,
                       "projection": "Local equirectangular, x=(unwrapped longitude-central meridian)*cos(standard parallel), y=-latitude; uniform scale and centered padding",
                       "mainPaddingPx": 18, "contextPaddingPx": 12,
                       "mainSimplificationPx": 0.65, "contextSimplificationPx": 0.55, "highlightSimplificationPx": 0.35,
                       "roundingDecimals": "1; tiny rings fall back to 4 decimals if 1 decimal collapses their area",
                       "contextAlignment": "Province path and city highlight share the exact same projection and affine fit. Main city is separately fitted using the province projection.",
                       "rings": "Keep nearby islands and holes with source winding; no city/province polygons removed. Render using SVG default nonzero fill rule.",
                       "remoteTerritories": "Only France uses a geographic extent: European mainland and Corsica, not overseas regions. Every omitted polygon is listed per feature below. All source polygons of other selected countries are retained, including adjacent islands and remote parts; no mainland-centroid distance filter is used.",
                       "difficulty": "Manually assigned gameplay heuristic; not an objective geographic classification",
                       "distractors": "City choices use stable IDs from the same province; country distractors follow the versioned easy/medium/hard curation table (draft pending playtest).",
                       "features": country_processing + city_processing},
        "limitations": ["地图待人工审核，不是标准地图或测绘成果，不声明通过地图审查。",
                        "HDX 行政边界建立日期未知，资源标记 2020，不能保证当前行政区划。",
                        "Natural Earth 为小比例尺制图概化数据，部分岛屿在上游数据中本就不存在；保留的是所选源中的相邻岛屿。",
                        "球面地图的局部等距圆柱投影不是全域等角投影；仅使用统一缩放，未横纵拉伸。",
                        "城市样本仅覆盖 10 个省，不代表全国；四选一和难度为本项目编排。",
                        "省域与城市独立简化，边缘可存在亚像素级差异；省域位置图使用相同投影与变换。",
                        "上游数据和许可网页不随游戏打包，仅保留 URL、版本、校验值与必要署名。"],
    }
    licenses["coverage"] = bank["coverage"]
    licenses["curationStatus"] = "draft-needs-playtest"
    outputs = {"src/data/questions.json": questions, "public/assets/data-licenses.json": encode_json(licenses), "public/assets/coverage-report.json": encode_json({"version": VERSION, "complete": False, "note": bank["coverage"]["note"], "regions": [{"id": r["id"], "name": r["name"], "status": r["status"], "complete": r["coverageComplete"], "actualQuestions": sum(q["regionId"] == r["id"] for q in bank["cities"]), "expectedQuestions": None} for r in bank["regions"]], "blockers": ["缺少全国地级行政目录与几何逐项核验", "缺少四直辖市完整且许可明确的区县边界", "国家干扰项编排待人工试玩校准" ]})}
    for relative, data in outputs.items():
        destination = args.output_root / relative
        if args.check:
            if destination.read_bytes() != data:
                raise ValueError(f"Reproducibility check failed: {relative}")
        else:
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(data)
    print(json.dumps({"countries": len(countries), "cities": len(cities), "questionsBytes": len(questions),
                      "questionsSha256": digest(questions), "check": args.check}, ensure_ascii=False))


if __name__ == "__main__":
    main()
