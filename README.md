# 猜地图 · 小红书小工具

离线四选一地理小游戏：不倒计时，答对一题一分，累计错三题结束，题库全部答完也正常结算。

## 当前状态（v0.4，2026-11-11）：连续闯关

中国大陆默认先猜 **31 道省级轮廓题**（打散），答完不结算、不提示，直接接 **418 道下级题**（333 个地级行政区，以及北京16、天津16、上海16、重庆37个区县，全部打散）；一局最多449题。国家题库扩充为 **118 国**。来源为明确标注 CC BY 4.0 的 CTAmap v2.0（2026 年初快照）和 Natural Earth 5.1.2。审图号 GS(2026)4921号；2026-11-11 新增58国轮廓按用户指示沿用该审图号，新增范围由用户另行处理。

- 首页模式顺序为“猜中国大陆地区”“猜国家”，首次默认中国大陆；示例分别使用广东省、意大利的题库轮廓（同一墨绿轮廓样式）。首页、地区入口、地区面板和榜单说明都不再显示题量。
- 国家点击“开始猜”直接游玩，不再选择难度。中国模式在首页显示“游玩范围”入口，默认全部31个省级行政区，点击“更换”打开地区面板，选中即生效；“开始猜”一步开局，与国家模式一致。
- 地区面板关闭（Escape、关闭按钮或点击遮罩）不改变当前范围，也不产生结算或成绩提交；回到首页恢复为全部省级地区。
- 答对约0.65秒后自动进入下一题；答错展示正确答案3秒后自动继续，保留按钮提前切题。第三错或最后一题答错，展示3秒后自动结算。提示为静态文字，不是答题倒计时。
- 进入后台或打开退出确认会暂停切题；回到前台或取消退出后重新留足阅读时间，旧计时器不会影响新题或新局。
- 重玩直接沿用上局设置，不重复确认；查看其他榜单不会改变待重玩配置。
- 国家共118题：原60国（含此前未启用的14国）＋ Natural Earth 新增58国，按熟悉度档位由易到难分段、段内打散；排除印度、巴基斯坦（争议边界画法）、塞尔维亚、索马里、以色列、斐济等，清单见 `scripts/data/country-snapshot.json`。新增国家干扰项为自动草稿（`auto-draft`），待试玩调整。继续使用board2和`countries:medium`记录。
- 国家首页不再使用中国标准地图原图（已从包内删除），改为意大利轮廓。
- 中国选择具体地区时，先出该地区全部下级题，再接其余全国下级题（不插省级题），一局最多418题。局内只显示“第 N 题”，不显示分母和进度条。
- 中国任何开局（全部地区或指定地区）的完成局都提交board5；个人最佳仍按开局地区分别记录（`cities:provinces`、`cities:<id>`，沿用旧记录）。结算称号按绝对分档：中国10/31/100分，国家10/30/60分。
- 结算页显示称号、得分环和“没认出的”文字回顾（不绘制地图）；左上直接回首页；正常结算仅查询一次关注关系，用户主动点击次级入口后才显示关注卡。
- 没有体力、道具、倒计时或强制分享。地图主图与位置小图分开排布，不互相遮挡。

本轮视觉与交互升级见 [`docs/validation-visual-v1.md`](docs/validation-visual-v1.md)（品牌统一为「猜地图」、设计系统、动效、逐屏自检）；首页与排行榜调整见 [`docs/validation-home-ranks.md`](docs/validation-home-ranks.md)；此前省级玩法验证见 [`docs/validation-provinces.md`](docs/validation-provinces.md)。

完整来源、覆盖与复现见 [`docs/data-sources.md`](docs/data-sources.md)。历史十省预览记录见 `docs/validation-v0.2-preview.md`，不再代表当前题库。

## 前端结构

- `src/styles/`：`tokens.css`（颜色、字号阶梯、间距、动效令牌）→ `base.css` → `components.css` → `home/game/result/ranks.css`，由 `index.css` 汇总为单个 `style.css`。
- `src/screens/`：`HomeScreen`、`GameScreen`、`ResultScreen`、`RanksScreen` 只负责展示；状态、计时器、榜单与关注逻辑仍在 `src/App.vue`。
- `src/components/`：`BrandMark`（折叠地图+问号）、`MapCard`（牛皮纸地图卡）、`SegmentedControl`、`ScoreRing`、`OutlineMap`、`RankTable`、`RegionPicker`、`AppDialog`、`Icon`。
- 动效只使用 transform/opacity 与颜色过渡；`prefers-reduced-motion` 下全部关闭。

## 本地运行

要求 Node.js 22、Python 3.9+：

```sh
npm ci
npm run build
npm run preview
```

打开 **http://127.0.0.1:4187**。本地预览带受限CSP，用于发现联网依赖；普通浏览器没有小红书宿主，排行榜及原生关注不会显示为真实可用。不能把浏览器测试视为小红书容器验收。

开发服务器：`npm run dev`，仅本机监听。

## 测试和打包

```sh
npm test
# 仅在缺少所需浏览器时安装：
npx playwright install chromium webkit
npm run test:e2e
npm run package
python3 -I .codex/skills/minitool-zip-builder/scripts/audit_artifact.py dist
python3 -I .codex/skills/minitool-zip-builder/scripts/audit_artifact.py artifacts/guess-map-xhs.zip
```

- **视觉升级版ZIP（待平台验收）**：`artifacts/guess-map-xhs-visual-v1-20261110.zip`（清单 `artifacts/package-manifest-visual-v1.json`，截图 `artifacts/visual-v1/`）；下方 20261109 旧包未被覆盖，上传前请自行选定其一。
- **最终修正版ZIP**：`artifacts/guess-map-xhs-final-20261109.zip`；同内容常规包为 `artifacts/guess-map-xhs.zip`。元数据：`artifacts/package-manifest.json`；结构与构建一致性记录：`artifacts/package-verification.json`。已补齐中国首页地图，不包含未就绪占位；正式打包会校验首页示例状态、原图指纹与来源记录。
- `npm run audit` 现在先运行 `scripts/check-style.mjs`：令牌对比度（文字≥4.5:1、图形≥3:1）、字号下限11px、Chrome 61不支持的唯一实现（gap/aspect-ratio/clamp/inset/:has等）、动效属性白名单，然后再做包体静态审计。
- `npm run data:check`：全国快照覆盖准入检查，现在应通过；同时检查审图号、审核状态及当前题库指纹；平台验收仍待完成。
- `npm run package`：构建、静态审计、覆盖门禁均通过后生成上述离线包。
- 当前使用指定的minitool-zip-builder 1.10.0；打包强制执行官方目录及ZIP审计。入口JS位于根目录app.js，当前规范复核见 `docs/minitool-1.10.0-audit.md`。
- 原 `artifacts/guess-map-preview.zip` 是十省40题旧预览；不要将它当作本次新版。
- `artifacts/static-audit.json`：静态规范检查；`playwright-report/index.html`：页面测试报告。
- `node scripts/visual-check.mjs`：生产预览启动后生成桌面首页和地图联系表。
- `artifacts/*mock*`、关注和结果测试截图均使用测试桩，不是真实平台用户关系或榜单记录。

生产为ES2017/Chrome61目标的经典IIFE，根目录`index.html`，相对资源路径；无运行时网络请求、CDN、在线地图或GIS运行库。所有所需静态资源与许可均随ZIP。

## 排行榜：位置与灰度

首页主操作区域下方直接展示当前玩法的**总榜**前10名，不足10名按实际数量展示；点击“查看完整排行榜”进入完整页面，默认总榜，今日/本周/总榜可切换，**每页10条前端分页**（平台最多返回100名且不支持翻页参数，最多10页）。结算页显示“总榜排名”。

`src/config.ts`的`leaderboardEnabled`默认true，代表允许探测，不是强制展示。设置false后重建可完全禁用。

| board | 口径 |
| --- | --- |
| 1 | 旧国家简单，保留内部兼容 |
| 2 | 当前统一国家玩法（118国） |
| 3 | 旧国家困难，保留内部兼容 |
| 4 | 历史城市/区县混合榜，新版停止读取和提交 |
| 5 | 中国大陆（省级→全国下级题，任何开局） |

- 中国榜与国家榜均提供今日/本周/总榜；进入完整榜和切换玩法默认总榜，首页固定总榜。board5/board2 总榜中保留旧规则下的低分（≤31/≤46），会被新成绩自然超过。国家榜不再提供难度筛选。首页及完整页共用30秒缓存及在途去重，不额外轮询；提交成绩后刷新对应首页榜。
- 方法、版本、只读查询确认后才显示；无宿主、低版、未授权或白名单拒绝会隐藏。
- 临时失败不是空榜；保留缓存、去重、有限退避、冷却和北京时间日界失效。
- 每个完成局真实成绩只提交一次，未知结果不重发；主动退出不提交，不补交历史离线分数。
- 前100名列表，本人前500名精确，之后显示500+；不捏造人数或百分位。
- 用户提供的2026-11-09全量安排仅用于验收，不在代码中按日期开权限。在线文档仍标内测，最终以宿主结果为准。
- 创服发布时须勾选**用户头像昵称授权**。纯前端不能保证反作弊，不直接绑定现金/实物奖励。
- 本次未新增云同步；平台云存储开放不等于需要把全部本地记录迁到云端。

## 关注作者

正常结算查询一次关注状态；明确未关注且平台支持时，在结果页次级操作区显示“关注作者”。主动点击入口打开可关闭说明卡，再次点击卡内按钮才调用原生关注确认。返回前台或榜单不重复查询、不自动弹窗；已关注、作者本人、未知关系、低版本或无宿主均隐藏入口。

点击“关注作者”才调用宿主`followAuthor`，不能静默替用户关注。取消不报成功，频控不重试；原生每天最多展示10次确认框。原生等待超过五秒时仍持有调用锁，关闭卡片或重玩不释放锁，防止重复原生流程。无明确终态时允许继续游戏，关注需完成原生确认或重新打开工具后再试。

## 数据、许可与验收

国家来源Natural Earth公共领域；中国地级行政区、直辖市区县及父地区来源CTAmap v2.0、CC BY 4.0。法国只展示欧洲本土及科西嘉岛，题面已标注。来源许可、修改说明、依赖许可、覆盖报告均随包；应用说明弹窗展示实际使用来源。

- [`docs/data-sources.md`](docs/data-sources.md)：来源、校验值、投影及复现。
- [`docs/china-data-import.md`](docs/china-data-import.md)：当前CTAmap生成入口和备用审核数据导入。
- [`docs/validation.md`](docs/validation.md)：本次真实执行的验证及待验收项。

审图号：**GS(2026)4921号**。用户已确认正式批准文件覆盖60国轮廓、418个中国大陆行政区轮廓及位置小图；本地未留存批准文件，不将用户确认写作独立官方核验。当前题库SHA-256与批准范围绑定，后续几何变化须重新核对。数据许可和地图审图号独立记录，平台与真机验收待完成。

小红书后台简介：**看轮廓，猜国家和中国大陆地区**。本轮后台连接超时，尚未更新后台或重新上传。

最终必须使用同一ZIP：先在**创服平台模拟器**完成验证，再分别用**Android真机扫码**、**iOS真机扫码**验证榜单权限、关注确认/取消/限频、安全区、后台恢复、存储与性能。Chrome61旧内核和真实设备尚未实测；普通浏览器及模拟宿主测试不替代这些步骤。
