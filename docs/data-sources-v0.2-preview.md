> 历史记录：当前状态以 README.md、docs/validation.md 和 data-licenses.json 为准；本文件保留当时事实。

# 轮廓题库数据来源与复现

## 交付状态

- 题库版本：`2026-11-07.3`。
- `src/data/questions.json`：**60 个国家、40 个中国普通地级市**，405,834 字节（约 396.3 KiB；省域几何共享，不再使用600KB硬目标）。
- JSON SHA-256：`64d3732adc609b1e6dd873113c07ff05e0619a1ef04945b53749dbebbd31bf78`。
- 城市分布：江苏、浙江、广东、四川、湖北、湖南、福建、河南、安徽、江西，各 4 题；不是全国城市库。无直辖市、县域冒充地级市或虚构轮廓。
- 选项以稳定实体ID保存并按ID判分，显示中文名称；每题恰好4个不同选项且包含唯一答案。40道城市题的干扰项均来自同省。国家按三档编排候选，开局固定本局四选项。
- 地区目录已建立31项，但当前10省仍仅为样本、其他21地区无已核验题目；不声明全国完成。详见`china-data-import.md`和包内`coverage-report.json`。
- **地图状态：待人工审核。** 不是标准地图或测绘成果，不声明符合地图审查要求、不声明行政区划最新。不能将下述来源方自述的复核等同于本项目通过地图审核。
- 性能仅检查静态数据体积；手机/WebView 首屏解析、帧率及内存均**未实测**。

## 1. 国家：Natural Earth

- 数据提供者：Natural Earth。
- 版本：`natural-earth-vector` 标签 `v5.1.2`，`ne_50m_admin_0_countries.geojson`（1:50m）。
- 原始数据 URL：<https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_countries.geojson>
- SHA-256：`3e458fc036ad0a66411f2c1e6cac49c5d7bfb81cb1123bc513b22511a2b7fdeb`。
- 许可：**Public Domain，公共领域**。已核对官网条款：所有版本的栅格和矢量数据均为公共领域，可修改和传播，不要求许可或署名。
- 许可原文：<https://www.naturalearthdata.com/about/terms-of-use/>
- 本次读取的许可 HTML SHA-256：`35235c1304e4bdfd084ae89e0143bfeff9c98414f7ee183eb2ae982b93b3246d`。
- 建议保留的致谢：`Made with Natural Earth. Free vector and raster map data @ naturalearthdata.com.`

国家采用脚本中的 60 个主权国家白名单，不直接把整个 admin_0 图层当国家列表。没有把属地或争议实体作为国家选项。**不选取中国国家实体，也不读取中国、香港、澳门、台湾的 Natural Earth 几何来生成题目。** `region` 为中文大洲；土耳其、哈萨克斯坦按本项目分组放在亚洲，不是对跨洲属性作排他性断言。

### 岛屿与法国地理范围

保留所选原始国家要素中的外环、内环和岛屿；没有按“距最大陆块中心很远”删除其他国家的小岛，这种做法会错误删去群岛中的邻近岛屿。美国保留源数据中的阿拉斯加、夏威夷和阿留申群岛；挪威、加拿大等也保留各自要素中的全部多边形。各岛屿不单独搬移、放大或拉伸；跨 180° 经线使用经度展开。

**唯一显式的国家地理范围筛选是法国**：展示欧洲本土和科西嘉岛等欧洲部分，而不是完整法国领土。保留外环包围盒中心落在经度 `[-6,10]`、纬度 `[41,52]` 的多边形。排除了源要素中的 7 个海外多边形：马约特、留尼汪、马提尼克、瓜德罗普的 3 个岛屿多边形、法属圭亚那。这不是对这些地区主权属性的判断；法国题仅供辨认欧洲部分，不能用于展示完整国家领土。`data-licenses.json` 逐项记录原多边形索引、原经纬度包围盒和排除理由。

Natural Earth 本身已作小比例尺概化，因此“保留岛屿”仅指保留所选源要素中已有的岛屿；不代表纳入现实中的每个岛屿。未添加任何自行猜测的边界。

## 2. 城市及所属省域：HDX / OCHA COD-AB

- 数据集：**China - Subnational Administrative Boundaries (COD-AB)**。
- 发布组织：**OCHA Regional Office for Asia and the Pacific (ROAP)**。
- 数据集页面：<https://data.humdata.org/dataset/cod-ab-chn>
- 元数据 API：<https://data.humdata.org/api/3/action/package_show?id=cod-ab-chn>
- 元数据 ID：`17a2aaa2-dea9-4a2e-8b3f-92d1bdfb850c`。
- 下载资源：`chn_adm_ocha_2020_SHP.zip`。
- URL：<https://data.humdata.org/dataset/17a2aaa2-dea9-4a2e-8b3f-92d1bdfb850c/resource/9e67ddf9-ce26-4b7a-82b1-51e5ca0714c8/download/chn_adm_ocha_2020_shp.zip>
- ZIP SHA-256：`f6a1f0fd969dbcc830e395c8211746730a80e8429585e045c6b0da92cd6e0ec9`。
- 资源标记为 2020；HDX 元数据 `dataset_date` 为 2020-09-10，行政边界建立日期为未知。当前所用元数据 `metadata_modified` 为 `2025-06-27T10:03:35.667435`，**这不是边界生效或行政最新日期**。
- 元数据 JSON SHA-256：`a2840988dd3cdaeef310d33474c58c7077224e85f08f51c6827456d4a8bd15fd`。
- 已核对元数据 `license_id=cc-by-igo`，并读取许可正文：**CC BY-IGO 3.0**。
- 许可正文：<https://creativecommons.org/licenses/by/3.0/igo/legalcode.en>
- 本次读取的许可 HTML SHA-256：`93ddf7e4b9e665bedbb185db6f888126ceadb1f4661917ee8f868aef8e48786a`。

### 署名及来源限制

在展示/分发衍生轮廓时须保留来源、许可链接及修改说明，不能只保留不对使用者开放的构建脚本。机器可读署名已存入 `public/assets/data-licenses.json`；业务界面应提供可访问的“数据来源/许可”入口。建议采用以下文本，并保留对应超链接：

> Source: OCHA ROAP / HDX, China - Subnational Administrative Boundaries (COD-AB), chn_adm_ocha_2020. CC BY-IGO 3.0. Modified: selected ADM1/ADM2 features, projected, fitted and simplified; Chinese names retained. No endorsement by the United Nations or any data provider is implied.

HDX 说明来源为 **unofficial**，原始来源仅写为 `publicly available online sources`，另说明由 ITOS 在 USAID 资助下进行 vetting。本项目依据 HDX 发布页明确声明的 CC BY-IGO 许可使用，不把其上游溯源描述扩写成中国官方授权或独立完成权属审计。其中文名及边界存在历史和质量限制；例如源文件仍包含莱芜市、另有“株州市”疑似错字。二者均未入选，不通过自行合并、修改名称或编造几何修补源数据。

### 入选城市

| 省 | 4 个城市 |
| --- | --- |
| 江苏省 | 南京市、苏州市、无锡市、徐州市 |
| 浙江省 | 杭州市、宁波市、温州市、舟山市 |
| 广东省 | 广州市、深圳市、珠海市、汕头市 |
| 四川省 | 成都市、绵阳市、乐山市、宜宾市 |
| 湖北省 | 武汉市、宜昌市、襄阳市、黄冈市 |
| 湖南省 | 长沙市、岳阳市、衡阳市、张家界市 |
| 福建省 | 福州市、厦门市、泉州市、漳州市 |
| 河南省 | 郑州市、洛阳市、开封市、南阳市 |
| 安徽省 | 合肥市、芜湖市、黄山市、安庆市 |
| 江西省 | 南昌市、九江市、赣州市、景德镇市 |

只从 `Admin_type=Prefecture-level city` 的要素中选取。使用源文件 `ADM2_ZH` 作为无歧义中文市名；题目 ID 是来源 `ADM2_PCODE` 加 `city-` 前缀，**来源 PCODE 不是对中国现行官方行政代码的声明**。父省用 `ADM1_PCODE` 关联并校验。仅使用 10 省 ADM1 和所选城市 ADM2，不使用全国总轮廓、直辖市或港澳台。没有删减这些省和城市的任何源多边形；舟山等群岛保留源数据中的岛屿。

### 可读性筛选

整库联系表检查发现，新西兰源要素在保留全部远离岛屿时，主岛会缩得过小，不适合首版手机识别。首版整题不选新西兰，替换为古巴；没有裁掉其岛屿后冒充完整领土。

## 3. 未使用的候选来源

已查询 geoBoundaries 当前 `gbOpen/CHN/ADM2`，返回 `CHN-ADM2-17275852`：

- `boundaryCanonical=County Level`，共 2,391 要素；数据中为县/县级单元，并非地级市。
- 元数据声明其许可为 PDDL 1.0，ADM1 则声明 Public Domain，并不是一套“CC BY 的地级市+省”数据。
- 因级别不符合本题库，**完全未将其几何放入产物**。没有将县名替换成地级市名称，也没有凭名称猜测合并县域。
- API 仅用于核对候选：<https://www.geoboundaries.org/api/current/gbOpen/CHN/ADM2/>

未使用参考项目数据、amCharts 等有额外商业或品牌限制的数据、GADM 非商业限制数据，也没有添加第三方依赖。

## 4. 投影、简化和接口

输出 schema：

```text
{version:string,countries:Question[],cities:Question[],regions:Region[],coverage:Coverage,notices:Attribution[]}
Question = {
  id:string,name:string,region:string,difficulty:1|2|3,path:string,
  regionId?:string,adminType?:string,context?:{regionId:string,highlight:string},
  choices:EntityId[],distractors?:{easy:EntityId[],medium:EntityId[],hard:EntityId[]}
}
```

- 所有 SVG 路径均已经投影、归一化到 `viewBox="0 0 400 300"`，无需客户端 GIS 库。北朝上，无旋转。
- 使用局部等距圆柱投影：`x=(展开经度-中央经度)*cos(标准纬线)`，`y=-纬度`。中央经度由最大环顶点均值确定，标准纬线为展示范围纬度包围盒中点。采用同一个比例因子等比适配，**不横纵独立拉伸**。这不是对大范围区域完全无投影形变的承诺。
- 主图内边距 18px；省域位置图内边距 12px。
- 对每道城市题，主图与位置图使用所属省的同一投影参数；主图单独放大适配城市。`regions[id].path`为共享省域路径，`context.regionId`关联它，`context.highlight`为城市高亮；两者严格共享省域缩放和平移，不是分别居中。省名取地区目录，不再每题重复存储。
- Ramer–Douglas–Peucker 构建期简化，容差主图 0.65px、省域 0.55px、城市高亮 0.35px。闭环分两段简化；若退化或改变环方向则保留原环。保留内环方向，使用 SVG 默认 `nonzero` 填充规则。
- 坐标通常保留 1 位小数；若会让极小岛屿退化，改用 4 位。无岛屿搬移或人工放大。省与城市边缘独立简化，可能出现亚像素差异，不是法定边界对齐精度。
- 难度为手工玩法分组，不是客观地理指标。国家使用`scripts/data/country-curation.json`的分档干扰项草稿，不再按同洲随机生成所有难度；简单23题、中等46题、困难60题为累进目标池，前三题从当前池相对容易组抽取。编排尚未经过目标用户实验。
- 每个要素的来源 ID、投影参数、保留环数与法国排除多边形记录在 `data-licenses.json`，不向题目 schema 添加客户端不需要的大量字段。

## 5. 零依赖复现

脚本 `scripts/prepare-maps.py` 只使用 Python 标准库，不联网、不安装依赖、不会解压或执行 ZIP 成员；只按固定成员名在内存解析 ADM1/ADM2 的 SHP/DBF/PRJ。源数据不入游戏包。

每个下载文件必须进入各自新建的空目录。示例从可信工作区执行，不要 `cd` 到下载目录后运行解释器：

```bash
SOURCE_ROOT="$PWD/.scratch/map-inputs"
mkdir -p "$SOURCE_ROOT"
NE_DIR=$(mktemp -d "$SOURCE_ROOT/ne.XXXXXX")
CHINA_DIR=$(mktemp -d "$SOURCE_ROOT/china.XXXXXX")
META_DIR=$(mktemp -d "$SOURCE_ROOT/meta.XXXXXX")
NE_LICENSE_DIR=$(mktemp -d "$SOURCE_ROOT/ne-license.XXXXXX")
CITY_LICENSE_DIR=$(mktemp -d "$SOURCE_ROOT/city-license.XXXXXX")

curl --fail --location --max-time 180 \
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_countries.geojson' \
  --output "$NE_DIR/countries.geojson"
curl --fail --location --max-time 180 \
  'https://data.humdata.org/dataset/17a2aaa2-dea9-4a2e-8b3f-92d1bdfb850c/resource/9e67ddf9-ce26-4b7a-82b1-51e5ca0714c8/download/chn_adm_ocha_2020_shp.zip' \
  --output "$CHINA_DIR/china.zip"
curl --fail --location --max-time 60 \
  'https://data.humdata.org/api/3/action/package_show?id=cod-ab-chn' \
  --output "$META_DIR/metadata.json"
curl --fail --location --max-time 60 \
  'https://www.naturalearthdata.com/about/terms-of-use/' \
  --output "$NE_LICENSE_DIR/terms.html"
curl --fail --location --max-time 60 \
  'https://creativecommons.org/licenses/by/3.0/igo/legalcode.en' \
  --output "$CITY_LICENSE_DIR/license.html"

python3 -I /Users/apple/work/workspace/guess-map/scripts/prepare-maps.py \
  --natural-earth "$NE_DIR/countries.geojson" \
  --china-shp "$CHINA_DIR/china.zip" \
  --hdx-metadata "$META_DIR/metadata.json" \
  --natural-earth-license "$NE_LICENSE_DIR/terms.html" \
  --city-license "$CITY_LICENSE_DIR/license.html"
```

同样参数追加`--check`仅在内存重建并逐字节比较题库、许可清单和覆盖报告，不写入文件。生成器先校验固定旧源快照，再调用`upgrade-bank.py`规范化共享几何、候选和覆盖状态；它不会凭空扩展全国数据。`--output-root` 可设置输出工作区根目录。

两个几何输入的 SHA-256 已在脚本固定；若来源替换内容，脚本拒绝继续，必须重新核实版本、许可及边界，不能仅为了通过而盲目更新校验值。HDX API 和许可网页是动态资源，其页面 hash 可能随时间改变，即使几何不变也会使许可清单字节不同；要逐字节复现本次完整清单，请保留本次原始输入快照于游戏包之外。单有最新元数据下载链接，不等于保证将来能恢复完全相同的快照。

本次快照位置（临时目录可能被系统清理）：

```text
/private/tmp/guess-map-ne.YPwkrr/countries.geojson
/private/tmp/guess-map-hdx-shp.cIbz3G/chn_adm_ocha_2020_shp.zip
/private/tmp/guess-map-hdx.BZwSoT/metadata.json
/private/tmp/guess-map-ne-license.7nz0cr/terms.html
/private/tmp/guess-map-cc-license.bt78Ff/license.html
```

## 6. 已做检查与未完成事项

自动生成检查包括：60/40 数量、ID/名称唯一性、恰好 4 个唯一中文选项、答案存在、难度取值、城市类型和父省关联、同省干扰项、SVG 命令合法性、所有坐标位于 400×300 内、省与城市位置图共享投影/变换，以及v2稳定ID、候选表和31地区覆盖声明一致性；600KB旧项目目标已移除，实际受ZIP规范和性能预算约束。`--check` 可复核相同输入的字节级可复现性。

本次v2实际运行：`--check`字节级复现通过，题库hash与许可清单一致；40道城市的主图、高亮和共享省域背景与变更前逐字节相同。国家/城市原100题的地图路径未借本次重构进行边界重画。全国覆盖检查按预期拒绝当前样本数据；未将合成测试矩形或待审来源几何打入产品。

这些检查**不等同于**人工地图审核、行政现势性核查、拓扑权威认证、全国完整性、产品真机性能测试或 ZIP 包验收。最终应用上线前仍需业务方完成人工地图检查、来源署名入口和实际设备测试；本次全国扩充尚未完成，不以代码框架替代缺失地图。
