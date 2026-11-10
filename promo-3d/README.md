# 猜地图 · 3D 竖屏宣传片（小红书）

参考 `资料/video1.MP4` 的画风与结构：暗场桌面 + 暖色光斑，3D 吉祥物「小图」，聊天打字开场，编号章节卡。30 秒、1080×1920、30fps，只发小红书。计划见 `/home/cage/.claude/plans/video1-mp4-b-nifty-cloud.md`。

独立 Remotion 4.0.484 + three.js 工程，**不修改业务代码、`promo/`、`promo-shotcraft/`**。

## 在 Mac 上渲染（推荐流程）

```sh
bash promo-3d/scripts/mac-run.sh setup      # 首次：装依赖（需联网）
bash promo-3d/scripts/mac-run.sh capture    # 真实游戏采集 7 张截图 → promo-3d/public/captures/
bash promo-3d/scripts/mac-run.sh stills     # 10 张样式帧（带小红书遮挡参考线）→ promo-3d/output/stills-*/
bash promo-3d/scripts/mac-run.sh preview v1 # 540×960 预览片 → promo-3d/output/v1/caiditu-3d-30s-preview.mp4
bash promo-3d/scripts/mac-run.sh final v1   # 1080×1920 正式片 + 验收报告
```

- 渲染复用 Playwright 自带的 chrome-headless-shell（`setup` 里 `npx playwright install chromium` 装的那份），不额外下载；脚本找不到时会提示并退出，不会去 Google 下载。也可以手动指定 `REMOTION_BROWSER=/path/to/chrome-headless-shell`。
- 截图必须在 Mac 上采集：字体取决于本机系统字体（苹方）。已有 `public/captures/layout.json` 时脚本拒绝覆盖，重采前先把旧目录改名。
- 输出文件已存在时拒绝覆盖；换一个版本号，例如 `final v2`。
- 默认 `GL=angle`（GPU）。并发数默认是 CPU 核数的一半，可以加 `--concurrency=8`（直接调 `render-film.mjs` 时）。
- 只渲染一段做调试：`node promo-3d/scripts/render-film.mjs --preview --version=t1 --frames=420-599`。
- 实时预览/调参：`npm run studio --prefix promo-3d`（http://localhost:5199）。

## 分镜（帧 @30fps，唯一时间源 `src/timeline.ts`）

| 镜 | 帧 | 内容 |
|---|---|---|
| S1 聊天开场 | 0–119 | 输入框逐字打出「小图，给大家介绍一下猜地图怎么玩？」→ 发送 →「···」→「好嘞！」 |
| S2 登场 + 标题 | 120–239 | 像素小图蹦出、飞散，3D 小图跳出屏幕落到桌面招手；「猜 / 地图 · 3 步上手玩」 |
| S3 ① 选范围 | 240–419 | 真实首页 → 小图踩「更换」→ 地区面板 → 踩「全部地区」→ 踩「开始猜」 |
| S4 ② 看轮廓，四选一 | 420–599 | 山东地图卡浮出屏幕旋转一圈再放回 → 小图踩「山东省」→ 真实答对反馈 +「认出来了！+1」 |
| S5 ③ 猜错看答案 | 600–779 | 江西：小图左右犹豫 → 踩错 → 真实揭晓 → 沮丧挠头 → 结算页（7 分） |
| S6 收尾 | 780–899 | 小图沿发光线奔跑，6 张真实省份轮廓卡依次立起 →「猜地图 · 换你，亲自试一局？」 |

小图踩按钮的位置读自 `public/captures/layout.json` 的真实按钮坐标，重新采集后会自动对齐。

## 素材与合规

- **界面**：`scripts/capture.mjs` 在真实游戏里用固定种子（61）真实点击得到，同一局连续状态；结算 7 分也是真实打出来的（第二题答错后连续答对 6 题，再答错 2 题）。不是逐帧录屏。
- **片尾轮廓卡**：`scripts/extract-cards.mjs` 从 `src/data/questions.json` 原样复制 6 个省级路径（CTAmap v2.0，CC BY 4.0），每张卡都带「审图号：GS(2026)4921号」。题库每省单独缩放、不共坐标，所以**不拼接中国全图**（拼出来缺台湾和南海诸岛会有合规风险）。
- **吉祥物**：原创「小图」，由 App 图标立体化而来，不使用参考片的 Claude 形象。定稿图见 `output/checkpoint-1/`（选定 B 暖牛皮纸）。
- **配乐**：`public/audio/music-3d.wav` 由 `scripts/make-music.mjs` 原创合成（120BPM、D 大调、沿用品牌动机 D–A–F#–E，固定种子，无采样）。按本片拍点编排：0–4s 铺垫，4.0 进鼓，21–25s 犹豫段撤鼓、23.0 踩错单击，25.0 结算回鼓，26.0 硬切重拍，28.0 片尾。改了 `timeline.ts` 的拍点要同步改这个脚本再重新生成。
- **音效**：`scripts/make-sfx.mjs` 用 Node 标准库合成，固定种子，无第三方采样。
- **字体**：`@fontsource/noto-sans-sc`（思源黑体，SIL OFL）。
- 无旁白（系统合成音色不能公开使用）。

## 节奏设计（对照参考片量化分析后的改造）

- 120BPM，每拍 15 帧。踩按钮、切镜、章节卡、选项弹出、答对/答错、结算都落在拍点，音效与画面同帧。
- 镜头「快甩 + 停住」：`Props.tsx` 的 `SHOTS`，每个镜头在拍点到位，之前 6–12 帧用 `ease.snap` 快甩；停住后只轻微漂移。开场聊天段保持平滑缓推（无鼓段，和进鼓后的顿挫形成对比）。
- 快甩帧开启相机运动模糊（`three/MotionBlur.tsx`，16 个子帧累加），普通帧不额外耗时。
- 屏幕里的选项、反馈条、「下一题」、结算分数环按拍弹出（`screen.ts` 的 `POPS`）；远处光斑随底鼓呼吸。

## 代码结构

- `src/Film.tsx` 总装；`src/timeline.ts` 时间点；`src/anim.ts` 插值/弹簧
- `src/three/Mascot.tsx` 小图模型与姿态参数；`mascotRig.ts` 跳跃/踩按钮/犹豫/奔跑编排
- `src/three/screen.ts` 手机屏幕贴图：聊天动画 + 真实截图切换（逐帧画布）
- `src/three/Props.tsx` 桌面、光斑、浮起地图卡、轮廓卡时间线、机位关键帧（环绕参数）
- `src/overlay/Overlays.tsx` 顶部进度、章节胶囊、标题卡、片尾、小红书遮挡参考线
- `src/SoundTrack.tsx` 配乐与音效时间表；`scripts/make-music.mjs` 配乐合成
- `scripts/verify-film.mjs` 规格/解码/响度验收（用 Remotion 自带精简 ffmpeg：loudnorm 测响度，rawvideo 解码检查）

## 已验证 / 未验证

在 Linux 沙盒（软件 GL、临时截图）验证过：类型检查、关键帧构图、0–179 帧半分辨率试渲（无黑帧、音轨正常 −16.2 LUFS / −3.9 dBTP）、验收脚本。**没有**在 Mac 上实际跑过；Linux 上采集的临时截图字体不对，没有放进仓库。也没有在小红书真机上验证遮挡和完播，遮挡区参考线是估计值。
