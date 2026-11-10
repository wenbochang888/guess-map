// 唯一时间源：30fps，900 帧。切点按 120BPM（每小节 60 帧）对齐。
export const FPS = 30, TOTAL = 900, WIDTH = 1080, HEIGHT = 1920;

export const SCENE = {
  chat: [0, 120], intro: [120, 240], step1: [240, 420], step2: [420, 600], step3: [600, 780], outro: [780, 900],
} as const;

// 节拍：120BPM，每拍 15 帧，每小节 60 帧。关键动作（踩按钮、切镜、弹出、音效）都落在拍点上，
// 和 scripts/make-music.mjs 生成的配乐对齐。
export const BEAT = 15, BAR = 60;
export const onBeat = (n: number) => n * BEAT;

export const E = {
  // S1 聊天开场（无鼓铺垫，打字按 16 分音符）
  typeStart: 8, typeEnd: 72, send: 75, dots: 90, reply: 105,
  // S2 第 4 秒鼓点进入：像素小图蹦出 → 3D 小图跳出 → 落地（拍点）
  spritePop: 120, emerge: 135, landDesk: 165, titleIn: 165, titleOut: 234,
  // S3 ① 选范围
  toHome: 240, hopToChip: [258, 274], tapChip: 285, pickerOpen: [286, 298], hopToAll: [303, 320], tapAll: 330, pickerClose: [331, 343],
  hopToStart: [360, 378], tapStart: 390, toQ1: [391, 399], q1Pops: [405, 409, 413, 416],
  // S4 ② 看轮廓，四选一（地图卡按拍转四个 90°）
  hopUnderCard: [421, 436], cardUp: [436, 450], cardSpin: [465, 480, 495, 510], cardDown: [510, 525], hopToRight: [529, 546], tapRight: 555, happy: [558, 585],
  // S5 ③ 猜错看答案（犹豫段音乐撤鼓，踩错落在拍点）
  toQ2: [592, 600], q2Pops: [600, 604, 608, 611], hopToMid: [604, 619], hesitate: [622, 668], hopToWrong: [668, 682], tapWrong: 690, slump: [692, 738],
  toResult: [742, 750], hopOff: [742, 764], scorePop: 750,
  // S6 收尾（26 秒硬切 + 重拍）
  runStart: 795, runEnd: 855, endIn: 840, wave: [858, 900],
} as const;

export const CHAT_Q = '小图，给大家介绍一下猜地图怎么玩？';
export const CHAT_A = '好嘞！';

// 章节（顶部进度与胶囊）
export const STEPS = [
  {n: 1, kicker: '第一步', title: '选范围', sub: '全国 31 省，或者只猜你的家乡省', range: SCENE.step1, color: '#c4502a'},
  {n: 2, kicker: '第二步', title: '看轮廓，四选一', sub: '不用抢时间，慢慢认', range: SCENE.step2, color: '#5f8a68'},
  {n: 3, kicker: '第三步', title: '猜错看答案', sub: '不倒计时 · 错 3 次才结束', range: SCENE.step3, color: '#d9a441'},
] as const;
