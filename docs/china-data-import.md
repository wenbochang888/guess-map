# 全国地区边界：数据准入与导入

## 当前入口（2026-11-08）

全国数据已接入：使用 `scripts/prepare-china.py` 从固定 SHA-256 的 CTAmap v2.0 三级 GeoPackage 生成31父地区、333个地级行政区、85个直辖市区县，共418题。各地区均可开始，覆盖报告包含逐题目录、来源时点及未入题的省直辖县级单位。许可、文件地址、校验值与复现参数见 `data-sources.md`。

`coverage.complete`仅表示约定行政层级在**固定来源快照**中的覆盖已完整匹配，不代表最新官方目录、拓扑权威认证或通过地图审核。没有伪造任何人工审核签名。

下方 `import-china.py` 仍是备用的已审核 GeoJSON 数据包导入器；本次 CTAmap 使用独立 GPKG 适配器，并未把研究数据伪装成已完成人工地图审核的数据包。

早期候选限制仍保留供追溯：HDX 2020 没有北京各区；geoBoundaries候选城区合并且存在旧县名。因此全国新版不再使用它们的中国几何，没有通过更名、拆分或拼接历史轮廓凑数。

## 备用数据包导入方式

取得有明确修改、再分发许可的边界数据，以及指定时点的行政目录。需要覆盖大陆31省区市；省/自治区按地级，四直辖市按县级。省直管县级单位列入exceptions，不能冒充地级；不设区的地级市仍须纳入。区分正式隶属、代管、统计层级、重名和撤并。

导入命令：

```sh
python3 -I scripts/import-china.py --bundle /绝对路径/已审核数据包
python3 -I scripts/import-china.py --bundle /绝对路径/已审核数据包 --check
npm run data:check
```

先用`--output-root`指向另一个包含当前题库及许可清单的项目副本，检查输出后再用于主工作区。导入会替换三个文件：题库、来源清单、覆盖报告；没有下载、执行外部代码或发布行为。

## 数据包格式

`manifest.json`包含以下结构（这是格式示意，不是已经核验的真实数据）：

```json
{
  "formatVersion": 1,
  "version": "YYYY-MM-DD.版本",
  "administrativeDate": "目录有效时点",
  "registryEvidence": {"path":"registry.json","sha256":"实际SHA256","url":"目录证据URL"},
  "review": {"by":"审核记录标识","on":"审核日期","coverage":true,"license":true,"geometry":true},
  "sources": [{
    "id":"source-id","path":"boundaries.geojson","sha256":"实际SHA256",
    "url":"源数据URL","version":"版本/时点",
    "license":"CC-BY-4.0","licenseUrl":"许可URL",
    "licenseEvidencePath":"license.txt","licenseEvidenceSha256":"实际SHA256",
    "redistributionAllowed":true,"attribution":"要求保留的完整署名"
  }],
  "regions": [{
    "id":"六位省级代码","name":"与regions.json一致的名称","kind":"province/autonomous/municipality之一",
    "sourceId":"source-id","featureId":"父区域的稳定要素ID",
    "expectedUnits":[{
      "id":"六位行政代码","name":"真实名称","parentId":"六位省级代码",
      "adminType":"city/prefecture/district/county之一",
      "sourceId":"source-id","featureId":"目标稳定要素ID",
      "codeEvidence":"来源ID与行政代码、隶属关系的核验记录","difficulty":2
    }]
  }],
  "exceptions":[{"id":"例外代码","name":"真实名称","reason":"不在约定层级内的原因","source":"核验依据"}]
}
```

实际必须提交31个唯一地区及各地区完整expectedUnits，而不是只提交示例。GeoJSON要求RFC7946/WGS84，FeatureCollection，每个Feature有唯一`id`或`properties.id`，只含Polygon/MultiPolygon。文件路径不得逃出数据包目录，哈希必须匹配。外部数据使用独立空目录保存，执行Python时保持`-I`，不从数据包目录运行解释器。

允许的已知许可标识：CC0-1.0、CC-BY-4.0、CC-BY-3.0、CC-BY-IGO-3.0、PDDL-1.0、Public-Domain。它们不是自动授权：必须有人核对来源、许可适用对象、修改与再分发权利和署名要求。ODbL等额外数据库义务未由本导入器自动实现，需要单独审查，不静默接入。

导入器校验哈希、31地区、稳定ID/层级/父级、几何坐标和非退化环、同坐标系位置图、四选项等机械条件；`review`只是人工审查记录，不是程序自己验证了法律许可、拓扑、自交或边界现势性。地图联系表和逐单位核对仍须人工完成。

各地区候选至少4个目标；少于4个时拒绝导入，需先明确并实现已审阅的跨地区同层级干扰策略，不能重复选项凑数。

## 国家编排审阅

`scripts/data/country-curation.json`列出每个国家的熟悉程度和各档候选。当前是初始人工分组编排，状态为`draft-needs-playtest`，还没有经过真实用户难度实验。正式发布前逐题检查选项和手机轮廓，并记录试玩结果；不得将草稿标签当成经过验证的客观难度。
