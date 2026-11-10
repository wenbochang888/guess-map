# 轮廓题库：当前来源、范围与复现

## 当前交付口径

- 版本：`2026-11-08.1`；60 个国家、418 个中国行政单元、31 个父地区。
- 题库：2,573,912 字节；SHA-256：`57e28d04923158e760e50a38b4e27ba5f1ab4f2fd2a019c67696e252f3b9431d`。
- 中国题量：333 个地级行政区＋85 个直辖市区县。北京16、天津16、上海16、重庆37。
- `coverage.complete`表示固定来源快照在约定层级已完整匹配；不是全国所有县市、实时行政目录认证或地图审核通过。
- 普通省/自治区出地级市、自治州、地区、盟；直辖市出下辖区、县、自治县。不含港澳台入口。
- 39 条源文件中的“不统计”行逐项排除：4个直辖市父级占位、35个省直辖县级单位。没有将它们冒充地级市。
- 地级市中不设区的东莞、中山、儋州等正常入题。各题与干扰项使用稳定代码ID，同地区内四选一，按ID判分。

## 1. 国家：Natural Earth（保持原60国不变）

- Natural Earth 5.1.2，1:50m `admin_0_countries`。
- 原数据：<https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_countries.geojson>
- SHA-256：`3e458fc036ad0a66411f2c1e6cac49c5d7bfb81cb1123bc513b22511a2b7fdeb`。
- 公共领域许可：<https://www.naturalearthdata.com/about/terms-of-use/>；保留“Made with Natural Earth”致谢。
- 本次中国数据替换没有改变国家轮廓、难度或候选。国家基准保存在 `scripts/data/country-snapshot.json`，自动测试逐项对比。
- 60国使用主权国家白名单；不将属地直接当国家，不使用Natural Earth的中国、香港、澳门、台湾几何生成题目。
- 法国唯一明确筛选欧洲本土及科西嘉岛，排除海外部分；不是展示法国完整领土，题面已有标注。其他所选国家保留源要素全部多边形，包括远岛；无岛屿搬移、独立放大或大陆中心距离裁切。
- 国家原始处理记录（包含法国排除多边形）随 `data-licenses.json` 保留。旧源详细记录见 `data-sources-v0.2-preview.md`。

## 2. 中国：CTAmap v2.0

- 发布页：<https://www.shengshixian.com/pages/d35ae5/>。
- 页面明确标注数据许可 **CC BY 4.0**；页脚MIT许可不当作数据许可。
- CC BY 4.0正文：<https://creativecommons.org/licenses/by/4.0/legalcode.en>，允许商业复制、修改与再分发，须保留署名、来源和许可链接、声明修改，不得暗示背书或附加限制。
- 署名：Cheng, R., Xiao, C., Wang, Y. & Hu, Y. *CTAmap: a continuous vector dataset of Chinese administrative divisions from 2000 to 2026.*
- 数据存档标识：<https://doi.org/10.5281/zenodo.22179207>。本次下载和哈希核验针对发布页直链的三个实际GPKG，不声称已独立读取Zenodo全部存档。
- v2.0发布日期2026-09-01；2026图层表示2026-01-01 00:00（即2025年末）状态，不是今天的行政现势。
- 发布页称WGS84 / EPSG:4326、GCJ-02偏移已反解；文件元数据实际为4326、二维MultiPolygon。
- 许可页面证据摘要及原HTML哈希：`scripts/data/ctamap-evidence.json`。完整署名、修改说明、文件URL与校验值也随包写入 `public/assets/data-licenses.json`。

| 文件 | 字节 | SHA-256 |
| --- | ---: | --- |
| T2026_province.gpkg | 11,177,984 | `bb4706a1999f45a1d8a82d4907f754515eb8628bf2bd489be23b4754e05aa681` |
| T2026_prefecture.gpkg | 28,041,216 | `6a35915313444d4e669fdc147eade4eb50d67489c38c00f340d871baa624ad85` |
| T2026_county.gpkg | 64,118,784 | `4c7f4cfed6ff0bf96ed569ef3a653bc19506c4e95781349b201084349a19c980` |

下载基址：`https://pub-480fcfcea00742058bae6bc1c86d288c.r2.dev/`。实际省级文件34行、地级文件372行、县级文件2854行；只按既定层级与31地区筛选，不按文件总数盲目入题。

### 重庆与海岛的特别检查

- 重庆2025年调整撤销江北区、渝北区，设立两江新区；不能按旧38区县名单硬凑。当前源快照有37区县，含两江新区。官方依据：[渝府发〔2025〕15号](https://www.cq.gov.cn/zwgk/zfxxgkml/zfgb/2025/d16q/202511/t20251124_15183601.html)。
- 崇明等源要素表示行政区几何，不应直接把多边形数量当作岛屿数量、把行政界误当海岸线。核查原始范围后没有自行重画或按猜测搬移岛屿；[上海市政府关于长兴、横沙归属的记录](https://www.shanghai.gov.cn/nw9822/20200906/0001-9822_109807.html)用于范围核对，不作为新的几何来源。
- 舟山、三沙、珠海等保留分散岛屿与原有相对位置。三沙的实地面积相对分布范围很小，采用等比群岛展示及位置小图；不剪掉远岛来放大主岛。

## 3. 几何处理与精度

- 标准库 `sqlite3`只读打开、禁止加载扩展；先校验固定SHA，再读图层与WGS84元数据。
- 按GeoPackage flags计算envelope长度，解析WKB字节序、Polygon / MultiPolygon；拒绝非二维类型、空几何、非法/非有限坐标、非闭环及退化外环。
- 外环/内环按角色归一方向，SVG使用`nonzero`保孔。全量保留有效环，不独立拉伸、移动岛屿。
- 源省域有293条数值上近零面积的内环细缝，稳定平移后的鞋带面积绝对值低于1e-14平方度（赤道不足0.00013平方米）；仅剔除这些非面积内环，不剔除外环或正常岛屿。逐条feature、ringIndex和面积写入覆盖报告。
- 局部等距圆柱投影，北朝上；省背景与城市高亮使用同一投影、缩放和平移，主图单独等比适配。主图18、父图12个viewBox单位内边距；坐标框400×300。
- 闭环分两段RDP简化。国家仍0.65；中国主图1.0、父图1.4、高亮1.0个viewBox单位。手机显示更小，构建时去除亚像素级冗余，不依赖运行时GIS。
- 按最终显示精度优化后，题库由3,330,365降至2,573,912字节（减少约22.7%），所有3373个中国主图/父图/高亮有效环均保留，国家数据逐字节语义不变。
- 坐标通常1位小数；极小环按4/6/8/10位提升，避免序列化坍缩。检查每个输出环保留至少三个不同顶点及原方向。
- 独立简化的省/市边缘可能有亚像素差异，不声明测绘精度、自交或拓扑权威认证。

## 4. 可复现生成（无新增依赖）

```sh
SOURCE_ROOT="$PWD/.scratch/ctamap-inputs"
mkdir -p "$SOURCE_ROOT"
P=$(mktemp -d "$SOURCE_ROOT/province.XXXXXX")
F=$(mktemp -d "$SOURCE_ROOT/prefecture.XXXXXX")
C=$(mktemp -d "$SOURCE_ROOT/county.XXXXXX")
BASE=https://pub-480fcfcea00742058bae6bc1c86d288c.r2.dev
curl --fail --location --max-time 300 "$BASE/T2026_province.gpkg" --output "$P/province.gpkg"
curl --fail --location --max-time 300 "$BASE/T2026_prefecture.gpkg" --output "$F/prefecture.gpkg"
curl --fail --location --max-time 300 "$BASE/T2026_county.gpkg" --output "$C/county.gpkg"
python3 -I scripts/prepare-china.py --province "$P/province.gpkg" --prefecture "$F/prefecture.gpkg" --county "$C/county.gpkg"
python3 -I scripts/prepare-china.py --province "$P/province.gpkg" --prefecture "$F/prefecture.gpkg" --county "$C/county.gpkg" --check
npm run data:check
```

从可信工作区运行，不进入下载目录运行解释器，不执行下载内容。每个外来文件使用独立新目录。源哈希不符必须重新审核，不能为了让脚本通过而盲改校验值。

生成器输出题库、许可清单、覆盖报告。`--check`重建并逐字节比较这三个文件，`--output-root`可写入独立副本。国家使用冻结快照，不在此次中国生成过程中重新画国家边界。

旧 `prepare-maps.py` / `upgrade-bank.py` 只用于历史十省样本复现；现在必须明确传 `--legacy-sample`，并指向独立 `--output-root`，防止误覆盖全国新版。备用已审核GeoJSON导入见 `china-data-import.md`。

## 5. 验收边界

代码检查包括31地区、333＋85题量、完整逐单位目录、ID/父级/层级、同地区四唯一选项、非空合法路径、坐标范围、序列化环、国家未变与三文件字节复现。联系表用于检查展示，不是地理权威证明。

**地图审图号：GS(2026)4921号，按用户确认覆盖当前全部最终成图；本地未留存批准文件。** 截至今日官方行政目录逐单位独立认证、小红书模拟器/Android/iOS验收及目标用户难度实验尚未完成。 CC许可与来源方研究声明不能代替上述审核；浏览器帧率/耗时也不冒充手机性能。


## 6. 首页展示示例（2026-11-09 最终修正）

- 中国大陆玩法首页使用广东省（目录 ID `440000`）的现有省级轮廓。仅引用原始 `path`，不重新投影、不修改几何；游戏默认仍为大陆31个省级地区。
- 国家首页改用政府网站公开转载的2023年版中国标准地图原图，来源页面：<https://www.btdsss.gov.cn/c/2023-08-29/866123.shtml>；原始JPEG：<https://www.btdsss.gov.cn/upload/resources/image/2023/08/29/513727.jpg>。页面介绍2023年版标准地图发布、免费浏览下载及直接使用时标注审图号的要求。
- 原图1279×904，177,339字节，完整保存为 `public/china-standard-map.jpg`。SHA-256：`d28e8f31f38e47ee0b1b1573cbe6be14a527aad661215d5429c24bcad22c69d1`。原图下边沿印刷审图号为 **GS(2023)2766号**；页面另以可读字号标注该号码。
- 官方使用说明：<https://ghzyj.sh.gov.cn/hyxw/20230222/c97d40c87fc84a0f8cd414a6bf2b8fb9.html>。其中说明直接使用自然资源部门户网站提供的标准地图可不再送审，但需标注审图号。本项目使用政府公开转载的该版完整图，记录原始转载出处，不声称已从不可访问的标准地图主站独立下载或核对其文件指纹。
- 图片逐字节保留，不描摹成SVG、不改边界、不裁剪、不去掉台湾或南海诸岛附图、不改变地图内容，仅由CSS等比展示完整图片。不会将已有省级独立归一化的path拼接成全国图。
- 此图仅用于首页展示，不作为游戏题目，不改变正式60国题库、候选答案、46题默认玩法及成绩规则。新增示例采用其自身原图标注，**不冒用原游戏题库的GS(2026)4921号**。
- 展示配置见 `src/data/home-previews.ts`，随包记录见 `public/assets/home-preview-sources.json`。此前占位已移除；`scripts/check-home-previews.mjs` 会阻止未就绪、缺来源、缺原图或指纹不匹配的最终打包。
- 正式题库SHA-256仍为 `57e28d04923158e760e50a38b4e27ba5f1ab4f2fd2a019c67696e252f3b9431d`；原题库批准记录没有被改写。
