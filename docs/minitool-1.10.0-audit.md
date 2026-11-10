# 小红书小工具 1.10.0 规范复核

> 本文保留上一轮验证历史。当前省级默认玩法及最新产物记录见 [validation-provinces.md](validation-provinces.md)。
日期：2026-11-08。指定 skill 已下载并解压到 `.codex/skills/minitool-zip-builder/`，版本元数据为1.10.0。已读取 SKILL.md、全部相关 references，并获取当前在线文档（页面更新日期2026-11-06）。

## 结论

修正后的构建目录和ZIP通过官方静态产物审计，各保留1条单JS体积提示。静态检查不证明社区内容审核通过，也不替代平台模拟器或真机验证。

旧ZIP本身也能通过官方体积审计；该脚本不解析HTML/JS/CSS语义。逐条对照在线文档§2.7，发现入口脚本位于 assets/app.js，与当前入口JS/CSS应在assets之外的资源优化约定不一致。现已改为根目录app.js，同步构建、HTML引用和发布检查；正式打包现在强制运行官方目录及ZIP审计。没有证据证明该路径差异就是本次社区拒审原因。

## 逐项复核

| 项目 | 结果 |
| --- | --- |
| ZIP结构 | 6文件，根目录index.html/app.js/style.css，无嵌套入口、开发依赖、map或构建配置 |
| 资源与CSP | 相对包内路径，经典外置脚本，无内联script/行内事件/module/iframe/object/base或自建CSP |
| 禁用能力 | 未发现网页联网、剪贴板、Web定位、传感器、WebRTC、后台线程、动态代码执行、WASM、下载或站外跳转调用 |
| JS | ES2017解析通过；Vite目标es2017/chrome61，无replaceAll/at/flat/flatMap/finally等更新API作为唯一依赖 |
| CSS | cssTarget chrome61，Grid使用grid-gap；无Flex gap、:has、inset、clamp等核心依赖；focus基础规则与focus-visible增强分开；env安全区有静态/变量回退 |
| 当前平台API | 存储、窗口信息、短振动、关注、分享和排行榜按当前公开契约检查，版本与方法检测及失败降级保留 |
| 排行榜 | 仍为内测；未授权隐藏，真实成绩每局一次，有限退避、缓存、昵称不持久化；上传必须勾选用户头像昵称授权 |
| 分享 | 用户点击触发type=card；仅全屏容器有效，调用失败提示降级 |
| 性能 | 无Base64/图片/媒体/GIS运行库/WebGL；单题SVG渲染，31地区与最多100名榜单；无数万条数据库或日志 |
| 地图数据 | 478题及31父区域为核心离线数据；题库指纹未变，未重新简化、拆分或压缩字符串隐藏体积提示 |

## 实际执行

- `npm test`：81/81通过。
- `npm run package`：TypeScript、构建、自定义静态审计、题库/审图字段一致性检查、官方目录与ZIP审计均通过。
- `node .codex/skills/minitool-zip-builder/scripts/audit_artifact.mjs dist`：旧目录PASS、1提示；最终目录另以Python版检查。
- `python3 -I .codex/skills/minitool-zip-builder/scripts/audit_artifact.py dist`：最终目录PASS、1提示。
- `python3 -I .codex/skills/minitool-zip-builder/scripts/audit_artifact.py artifacts/guess-map-xhs.zip`：最终ZIP PASS、1提示。
- 最终ZIP逐文件与dist比较一致，引用资源全部存在，题库SHA-256保持不变。

普通浏览器测试不作为小工具功能或兼容性验收依据。本轮没有启动普通浏览器或重复登录、上传。

## 产物与提示

- 上传包：`artifacts/guess-map-xhs.zip`。
- ZIP大小：847,155字节；解压文本合计3,023,160字节。
- SHA-256：`a41dd369d038c49ff21a5241aafc5dda6994ab42a0c0d115053bbba764929b3e`。
- 单JS：2,688,007字节（约2.56 MiB）；超过2 MiB提示线，需真机观察读取、解析和内存。不是审计ERROR，ZIP低于建议2 MiB及硬上限10 MiB。
- 审图号沿用用户确认信息；本轮仅校验配置与题库指纹一致性，未独立核验行政批准文件。

交付后须将同一ZIP上传至创服平台，先完成平台模拟器完整功能验证，再分别Android真机扫码、iOS真机扫码验证。Chrome61兼容性、WebView性能及真实宿主能力均未实测。社区内容拒审须结合后台具体原因另行定位，不能把静态PASS写作平台已通过。

依据：

- Skill：`.codex/skills/minitool-zip-builder/SKILL.md`。
- 在线文档：<https://miniapp-sandbox.xiaohongshu.com/minitool/doc>。
