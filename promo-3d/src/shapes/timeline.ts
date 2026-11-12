// 「各省像什么」唯一时间源。配乐：资料/musi.mp3 截取 66.382–106.80 秒（40.4 秒），112.81BPM。
// 所有动作挂在配乐的拍点网格上：第 b 拍 = F(b) 帧（b 可为小数）。段落（拍）：
//   b0–15  乐句 A（满编，b12–15 有 4 拍小回落）     b16–31 乐句 B（b28–31 小回落）
//   b32–35 乐句 C 开头                               b36–63 回落段（半速）   b64–67 近乎静音
//   b68    重新炸起（片尾墙）                         b76    结束（最后 15 帧淡出）
// 实测重音：
//   前半段（b0–35）鼓型 8 拍一循环，k = 拍号 mod 8：k0、k2 军鼓重击；k1 底鼓最重，k4、k5.5 底鼓；
//     k2.5–3.5 与 k6 几乎是空拍 —— 盖章、到站只放在 k0/1/2/4/5.5，绝不放 k3、k6。
//   回落段（b36–63）每 4 拍一记最重的军鼓：b38、42、46、50、54、58、62；底鼓在 b≡0、b≡3（mod 4）。
export const FPS = 30, WIDTH = 1080, HEIGHT = 1920;
export const BEAT_SEC = 60 / 112.81;
// f2 实测：鼓点比画面拍点平均晚 46ms（76 个整拍的中位数），裁剪点后移到 66.40 秒（第 1992 帧），剩约 +13ms（声音略晚于画面，人耳不易察觉）
export const MUSIC_START_SEC = 66.40;
export const MUSIC_TRIM = Math.round(MUSIC_START_SEC * FPS); // 传给 <Audio trimBefore>
export const F = (b: number) => Math.round(b * BEAT_SEC * FPS);
export const TOTAL = F(76);
export const SAMPLE_END = F(24); // 样片：钩子 + 4 个省

/** 每个机位站点之间的世界坐标间距（省份厚片沿 x 轴排在地面上，镜头移过去） */
export const GAP = 7;

/** 手机竖屏遮挡区（小红书 / 抖音 / 视频号取并集，估计值）：要读的内容都放在安全区里 */
export const SAFE = {top: 220, bottom: 1420, rightX: 910, rightTop: 760};
export const TEXT_TOP = 240;

/** 左上角逐句字幕（无旁白，字幕就是叙事）。k 为关键词：上色 + 下划线；big 为结论行（盖章式砸下）。 */
export type Part = string | {k: string; c: 'blue' | 'red'};
export type Line = {at: number; parts: Part[]; big?: boolean};

/** dx / scale：偏宽的省缩小、左移，避开右侧点赞按钮列 */
export type Prov = {name: string; dx?: number; scale?: number};

type Base = {x: number; from: number; to: number; lines: Line[]; count?: {at: number; n: number}; cut?: boolean};
/** 展示站。dark：回落段的暗剪影站，涂鸦先像粉笔一样画在暗剪影上，meta 那一拍（重军鼓）亮灯 */
export type ShowStation = Base & {kind: 'show'; p: Prov; draw: [number, number]; meta: number; hook?: boolean; dark?: boolean};
/** 双省站：湖南在左朝右、江西在右朝左，一起翻起、一起画 */
export type PairStation = Base & {kind: 'pair'; ps: (Prov & {ox: number})[]; draw: [number, number]; meta: number};
/** 甘肃三选一：每个选项弹出时厚片上换一种涂鸦，clear 之后清空，留给评论区 */
export type Option = {at: number; letter: string; word: string; art: string};
export type GansuStation = Base & {kind: 'gansu'; p: Prov; options: Option[]; clear: number};
/** 片尾墙：31 块厚片平铺成 5×7，镜头俯视；讲过的亮、甘肃亮着「?」，其余是暗剪影 */
export type WallStation = Base & {kind: 'wall'; drop: number; wave: number; cta: number};
export type Station = ShowStation | PairStation | GansuStation | WallStation;

const b = (k: string): Part => ({k, c: 'blue'}), r = (k: string): Part => ({k, c: 'red'});
const WIDE = {dx: -0.2, scale: 0.9}; // 偏宽的省

/** 展示站 4 拍。
 *  从 k0 起：到站 + 第一句（军鼓）→ k1 第二句（底鼓）→ k2 结论盖章 + 计数（军鼓）。
 *  从 k4 起（k6 是空拍）：到站 + 第一句（底鼓）→ k4.5 第二句 → k5.5 结论盖章（底鼓）。
 *  dark（回落段）：到站暗剪影 + 第一句 → +1 第二句（底鼓）→ +2 重军鼓亮灯 + 盖章。 */
function show(i: number, beat: number, p: Prov, l1: Part[], l2: Part[], key: Part[], n: number, dark = false): ShowStation {
  const late = !dark && beat % 8 === 4;
  const l2At = beat + (late ? 0.5 : 1), stamp = beat + (late ? 1.5 : 2);
  return {kind: 'show', dark, x: i * GAP, from: F(beat), to: F(beat + 4), p, draw: [F(beat + (late ? 0.25 : 0.5)), F(stamp)], meta: F(stamp),
    count: {at: F(stamp), n},
    lines: [{at: F(beat), parts: l1}, {at: F(l2At), parts: l2}, {at: F(stamp), parts: key, big: true}]};
}

export const WALL_X = 16 * GAP;

export const STATIONS: Station[] = [
  // 钩子：第 0 帧就是一句大标题「中国各省 / 分别像什么？」（学 video3 的开头，越简单越好）+ 立在光里的厚片（也是封面）；右上角计数 0→31
  {kind: 'show', hook: true, x: 0, from: 0, to: F(8), p: {name: '黑龙江'}, draw: [F(2), F(4.5)], meta: F(5.5), count: {at: F(5.5), n: 1}, // 天鹅盖章在 k5.5 底鼓上（k6 是空拍）
    lines: [
      {at: 0, parts: ['中国各省'], big: true},
      {at: 0, parts: ['分别', r('像什么'), '？'], big: true},
      {at: F(4), parts: ['黑龙江，像一只伸长脖子的']},
      {at: F(5.5), parts: [b('天鹅'), '。'], big: true},
    ]},
  show(1, 8, {name: '广东'}, ['广东呢？'], ['一只被', r('咬了一口'), '的'], [b('炸鸡腿'), '。'], 2),
  show(2, 12, {name: '青海', ...WIDE}, ['青海，'], ['一只', r('耳朵贴着背'), '的'], [b('兔子'), '。'], 3),
  show(3, 16, {name: '云南'}, ['云南，'], ['尾巴', r('整个张开'), '了——'], [b('开屏的孔雀'), '。'], 4),
  show(4, 20, {name: '陕西'}, ['陕西最应景：'], ['兵马俑里', r('跪着拉弓'), '的那位'], [b('跪射俑'), '。'], 5),
  // 湖南（盘发姑娘，朝右）+ 江西（小伙，朝左），和真实方位一致；ox 让两块轮廓的中心大约各在 ±0.95
  {kind: 'pair', x: 5 * GAP, from: F(24), to: F(28), draw: [F(24.5), F(26)], meta: F(26), count: {at: F(26), n: 7},
    ps: [{name: '湖南', ox: -1.03, scale: 0.62}, {name: '江西', ox: 0.83, scale: 0.62}], // f1 实测：原来江西右半边伸进点赞按钮列
    lines: [{at: F(24), parts: ['湖南和江西，']}, {at: F(25), parts: [r('盘发姑娘'), '和小伙子']}, {at: F(26), parts: [b('脸对脸'), '。'], big: true}]},
  show(6, 28, {name: '西藏', dx: -0.6, scale: 0.85}, // 西藏最宽：再左移、再缩小，鞋头避开右侧按钮列
   ['西藏，'], [r('鞋带'), '都系好了的'], [b('登山鞋'), '。'], 8),
  show(7, 32, {name: '河北'}, ['河北，'], ['把', r('北京天津'), '卡在中间的'], [b('大扳手'), '。'], 9),
  // 回落段：一拍一个省，重军鼓 b38/42/46/50/54 亮灯揭晓
  show(8, 36, {name: '山西'}, ['山西，'], ['像人的'], [b('左肺'), '。'], 10, true),
  show(9, 40, {name: '吉林'}, ['吉林，'], ['一只', r('往前冲'), '的'], [b('恐龙'), '。'], 11, true),
  show(10, 44, {name: '湖北'}, ['湖北，'], [r('握在手里'), '的'], [b('水枪'), '。'], 12, true),
  show(11, 48, {name: '广西'}, ['广西，'], [r('倒着放'), '的'], [b('皇帝帽'), '。'], 13, true),
  show(12, 52, {name: '新疆', ...WIDE}, ['新疆，'], ['一只', r('竖着耳朵'), '的'], [b('狗头'), '。'], 14, true),
  // 甘肃：三个说法各占一拍弹出，b62 重军鼓「评论区扣字母！」，b64–67 静音段定住
  {kind: 'gansu', x: 13 * GAP, from: F(56), to: F(68), p: {name: '甘肃', ...WIDE}, clear: F(62),
    options: [
      {at: F(59), letter: 'A', word: '哑铃', art: '甘肃A'},
      {at: F(60), letter: 'B', word: '河马', art: '甘肃B'},
      {at: F(61), letter: 'C', word: '狗骨头', art: '甘肃C'},
    ],
    lines: [
      {at: F(56), parts: ['最后一个，甘肃。']},
      {at: F(58), parts: ['它', r('像什么'), '？'], big: true},
      {at: F(62), parts: [b('评论区扣字母'), '！'], big: true},
      {at: F(64), parts: ['（答案我先不说）']},
    ]},
  // 片尾墙：b68 重新炸起时硬切到俯视，和开头的问题首尾呼应
  {kind: 'wall', cut: true, x: WALL_X, from: F(68), to: TOTAL, drop: F(68), wave: F(71), cta: F(73),
    lines: [
      {at: F(68), parts: ['剩下 ', r('16'), ' 个省，'], big: true},
      {at: F(70), parts: ['你能', b('认出几个'), '？'], big: true},
    ]},
];

/** 片尾墙：屏幕上 5×7 网格（x 80–890、y 540–1401，避开右侧按钮列和底栏），顺序打乱，不拼成中国地图 */
export const WALL_GRID = {cols: 5, x0: 80, y0: 540, cw: 162, ch: 123, box: 150};
export const WALL_ORDER = ['新疆', '山东', '广东', '宁夏', '浙江', '吉林', '青海', '重庆', '福建', '西藏', '安徽', '湖北', '黑龙江', '北京', '贵州',
  '海南', '湖南', '辽宁', '天津', '云南', '山西', '广西', '江西', '上海', '内蒙古', '甘肃', '陕西', '江苏', '河南', '河北', '四川'];
export const SHOWN = new Set(['黑龙江', '广东', '青海', '云南', '陕西', '湖南', '江西', '西藏', '河北', '山西', '吉林', '湖北', '广西', '新疆']);

export const TOTAL_PROVINCES = 31; // 题库覆盖的 31 个省（区、市）
export const APPROVAL_NOTE = '比喻仅供娱乐';
