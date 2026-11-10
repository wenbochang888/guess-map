import {E, SCENE, BEAT} from '../timeline';
import {ramp, ease, mix, spring, clamp01} from '../anim';
import {box, type Layout} from '../assets';
import {css, SCREEN_Y, onPhone} from './space';
import {SPRITE} from './screen';
import type {MascotPose} from './Mascot';

type V3 = [number, number, number];
type Seg = {f: readonly number[]; from: V3; to: V3; h: number; stomp?: boolean};
export type MascotState = {pos: V3; pose: MascotPose; grow: number; ground: number};

export const RUN_FROM: V3 = [3.0, 0, 1.7], RUN_TO: V3 = [10.6, 0, 1.7];
const DESK: V3 = [1.85, 0, 1.25], DESK2: V3 = [-1.95, 0, 1.5];
const center = (b: {x: number; y: number; w: number; h: number}, dx = 0, dy = 0) => css(b.x + b.w / 2 + dx, b.y + b.h / 2 + dy);

/** 由采集到的真实按钮位置生成小图的路线 */
export function buildPath(L: Layout) {
  const chip = box(L, 'home', 'region-trigger');
  const all = box(L, 'picker', 'region-option--all');
  const start = box(L, 'home', 'start-button');
  const map = box(L, 'q1', 'question-map');
  const q1 = L.shots.find((s) => s.id === 'q1')!.question!;
  const q2s = L.shots.find((s) => s.id === 'q2-wrong')!;
  const right = box(L, 'q1', 'answer-button', q1);
  const wrong = box(L, 'q2', 'answer-button', q2s.picked);
  const answers = L.shots.find((s) => s.id === 'q2')!.boxes.filter((b) => b.cls.includes('answer-button'));
  const midY = (Math.min(...answers.map((b) => b.y)) + Math.max(...answers.map((b) => b.y + b.h))) / 2;
  const P = {
    emerge: css(SPRITE.x + SPRITE.size / 2, SPRITE.y + SPRITE.size),
    chip: center(chip, chip.w / 2 - 52), all: center(all, 40), start: center(start),
    under: css(map.x + map.w / 2, map.y + map.h + 26), right: center(right), mid: css(195, midY), wrong: center(wrong),
  };
  const segs: Seg[] = [
    {f: [E.emerge, E.landDesk], from: P.emerge, to: DESK, h: 1.0},
    {f: E.hopToChip, from: DESK, to: P.chip, h: 0.55},
    {f: [E.tapChip - 8, E.tapChip], from: P.chip, to: P.chip, h: 0.3, stomp: true},
    {f: E.hopToAll, from: P.chip, to: P.all, h: 0.5},
    {f: [E.tapAll - 8, E.tapAll], from: P.all, to: P.all, h: 0.3, stomp: true},
    {f: E.hopToStart, from: P.all, to: P.start, h: 0.55},
    {f: [E.tapStart - 9, E.tapStart], from: P.start, to: P.start, h: 0.4, stomp: true},
    {f: E.hopUnderCard, from: P.start, to: P.under, h: 0.6},
    {f: E.hopToRight, from: P.under, to: P.right, h: 0.6},
    {f: [E.tapRight - 8, E.tapRight], from: P.right, to: P.right, h: 0.35, stomp: true},
    // 开心蹦两下，落地都在拍点（570、585）
    {f: [E.happy[0], E.happy[0] + 12], from: P.right, to: P.right, h: 0.45},
    {f: [E.happy[0] + 15, E.happy[0] + 27], from: P.right, to: P.right, h: 0.3},
    {f: E.hopToMid, from: P.right, to: P.mid, h: 0.5},
    {f: E.hopToWrong, from: P.mid, to: P.wrong, h: 0.45},
    {f: [E.tapWrong - 8, E.tapWrong], from: P.wrong, to: P.wrong, h: 0.3, stomp: true},
    {f: E.hopOff, from: P.wrong, to: DESK2, h: 0.6},
  ];
  return {P, segs};
}

// 与节拍同步的周期（弧度/帧）：挥手每拍一次，挠头每 8 分音符一次，跑步每 16 分音符落一步
const WAVE = (2 * Math.PI) / BEAT, EIGHTH = (2 * Math.PI) / (BEAT / 2), SIXTEENTH = Math.PI / (BEAT / 4);

const groundAt = (x: number, z: number) => (onPhone(x, z) ? SCREEN_Y : 0);

export function mascotState(f: number, path: ReturnType<typeof buildPath>): MascotState {
  const {segs} = path;
  const pose: MascotPose = {};
  let pos: V3 = [...segs[0].from];
  let air = false, lastLand = -999, lastStomp = false, nextTake = 9999, dir = 0;

  if (f >= SCENE.outro[0]) return runState(f);

  for (const s of segs) {
    const [a, b] = s.f;
    if (f >= b) { pos = [...s.to]; lastLand = b; lastStomp = !!s.stomp; continue; }
    if (f >= a) {
      const t = (f - a) / (b - a);
      const x = mix(s.from[0], s.to[0], ease.inOut(t)), z = mix(s.from[2], s.to[2], ease.inOut(t));
      const g0 = groundAt(s.from[0], s.from[2]), g1 = groundAt(s.to[0], s.to[2]);
      const y = mix(g0, g1, t) + 4 * s.h * t * (1 - t);
      pos = [x, y, z]; air = true; dir = Math.atan2(s.to[0] - s.from[0], s.to[2] - s.from[2]);
      if (Math.hypot(s.to[0] - s.from[0], s.to[2] - s.from[2]) < 0.01) dir = 0;
      break;
    }
    nextTake = Math.min(nextTake, a);
    break;
  }
  if (!air) pos = [pos[0], groundAt(pos[0], pos[2]), pos[2]];

  // 起跳前蓄力、落地压扁回弹（踩按钮时更用力）
  const pre = clamp01(1 - (nextTake - f) / 5);
  pose.squash = air ? -0.1 : spring(f - lastLand, lastStomp ? 0.32 : 0.22) + (nextTake < 9999 ? pre * 0.14 : 0);
  pose.armL = pose.armR = air ? 1.1 : 0.15 + Math.max(0, spring(f - lastLand, 0.5));
  pose.turn = air ? Math.max(-0.7, Math.min(0.7, dir * 0.5)) : 0;
  pose.wiggle = spring(f - lastLand, 0.35, 0.12, 0.5);
  // 眨眼：每 ~2.3 秒一次
  const bl = (f + 17) % 70; pose.blink = bl < 3 ? [0.5, 1, 0.5][bl] : 0;

  // 登场：跳出屏幕时从小变大
  const grow = f < E.emerge ? 0 : ramp(f, E.emerge, E.emerge + 12, ease.outBack);
  // S2：落地后招手、歪头
  if (f >= E.landDesk + 18 && f < E.toHome + 6) {
    const w = f - (E.landDesk + 18);
    pose.armR = 2.2 + Math.sin(w * WAVE) * 0.45; pose.tilt = 0.12; pose.lookX = 0.3; pose.lookY = 0.3;
  }
  // S4：仰头看被拿起的地图卡
  if (f >= E.hopUnderCard[1] && f < E.cardDown[1]) { pose.lookY = 1; pose.armL = pose.armR = 2.4 + Math.sin(f * 0.3) * 0.1; pose.tilt = Math.sin(f * 0.08) * 0.08; }
  // S4：答对后开心蹦跳
  if (f >= E.happy[0] && f < E.happy[1]) { pose.armL = pose.armR = 2.5; pose.lookY = 0.5; }
  // S5：在两个选项间犹豫：左右张望、挠呆毛
  if (f >= E.hesitate[0] && f < E.hesitate[1]) {
    // 每拍换一次方向：4 帧快速转头，然后停住（踩点的「顿」）
    const k = Math.floor(f / BEAT), side = k % 2 ? -1 : 1;
    const sw = mix(-side, side, ramp(f - k * BEAT, 0, 4, ease.out));
    pose.lookX = -0.9 * sw; pose.turn = 0.45 * sw; pose.lookY = -0.4;
    pose.armR = 2.6; pose.wiggle = Math.sin((f - E.hesitate[0]) * EIGHTH) * 0.3; pose.tilt = 0.1 * sw;
  }
  // S5：猜错后沮丧挠头
  if (f >= E.slump[0] && f < E.hopOff[0]) { pose.squash = 0.08; pose.tilt = -0.16; pose.lookY = -0.8; pose.armL = 2.7 + Math.sin(f * EIGHTH) * 0.15; pose.wiggle = -0.4; }
  return {pos, pose, grow, ground: groundAt(pos[0], pos[2])};
}

/** S6：沿发光线奔跑，到终点转身挥手 */
export const runnerX = (f: number) => mix(RUN_FROM[0], RUN_TO[0], ramp(f, E.runStart, E.runEnd, (u) => (u < 0.15 ? (u * u) / 0.3 : u - 0.075) / 0.925));
function runState(f: number): MascotState {
  const x = runnerX(f);
  const running = f >= E.runStart && f < E.runEnd;
  const pose: MascotPose = {walk: (f - E.runStart) * SIXTEENTH, stride: running ? 1 : 0, turn: f < E.runEnd ? Math.PI / 2 * 0.85 : 0, lookX: running ? 0.6 : 0};
  if (running) { pose.armL = 0.6 + Math.sin(pose.walk!) * 0.5; pose.armR = 0.6 - Math.sin(pose.walk!) * 0.5; pose.wiggle = Math.sin(pose.walk! * 2) * 0.15; }
  if (f >= E.runEnd) {
    pose.turn = Math.PI / 2 * 0.85 * (1 - ramp(f, E.runEnd, E.runEnd + 10, ease.out));
    pose.squash = spring(f - E.runEnd, 0.2);
    if (f >= E.wave[0]) { pose.armR = 2.3 + Math.sin((f - E.wave[0]) * WAVE) * 0.45; pose.tilt = 0.12; pose.lookY = 0.3; }
  }
  const bl = (f + 5) % 70; pose.blink = bl < 3 ? [0.5, 1, 0.5][bl] : 0;
  const hop = running ? Math.abs(Math.sin(pose.walk!)) * 0.08 : 0;
  return {pos: [x, hop, RUN_TO[2]], pose, grow: 1, ground: 0};
}
