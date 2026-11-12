import * as THREE from 'three';
import {ease, mixV} from '../anim';
import {STATIONS, WALL_X} from './timeline';

// 机位：[目标x,y,z, 距离, 仰角°, 方位角°, fov]。每个站点在 from 帧（拍点）到位，之前 WHIP 帧快甩（ease.snap + 运动模糊），
// 停住后只极轻微地推近漂移。cut 站点（片尾墙）不甩，在 from 那一帧硬切。
export const WHIP = 8;
type Pose = number[];
// 低机位：地平线落在画面上部，下方是渐隐的经纬网格地面；厚片中心约在画面 55% 高度，上方留给字幕
const SHOW: Pose = [0, 2.05, 0, 16.2, 12, -4, 34];
// 片尾墙：正上方俯视（89° 避开 lookAt 的万向锁），屏幕向下 = 世界 +z。距离 16、fov 34 → 平面上每个世界单位 ≈ 196 像素
export const WALL_DIST = 16;
const WALL: Pose = [WALL_X, 0, 0, WALL_DIST, 89, 0, 34];
export const WALL_PPU = 1920 / (2 * WALL_DIST * Math.tan((34 / 2) * Math.PI / 180));

function basePose(i: number): {pose: Pose; drift: Pose} {
  const s = STATIONS[i];
  if (s.kind === 'wall') { const d = WALL.slice(); d[3] -= 0.3; return {pose: WALL.slice(), drift: d}; }
  const p = SHOW.slice();
  p[0] = s.x;
  const d = p.slice(); d[3] -= 0.8; d[5] += 8;
  return {pose: p, drift: d};
}

const clamp = (t: number) => Math.min(1, Math.max(0, t));
const enterAt = (i: number) => STATIONS[i].from - (STATIONS[i].cut ? 0 : WHIP);

/** f 帧（可为小数，运动模糊用）的机位参数 */
export function camPose(f: number): Pose {
  let i = 0;
  while (i + 1 < STATIONS.length && f >= enterAt(i + 1)) i++;
  const cur = basePose(i), s = STATIONS[i];
  if (i > 0 && !s.cut && f < s.from) { // 从上一站快甩进来
    const prev = basePose(i - 1);
    return mixV(prev.drift, cur.pose, ease.snap(clamp((f - (s.from - WHIP)) / WHIP)));
  }
  const holdEnd = i + 1 < STATIONS.length ? enterAt(i + 1) : s.to;
  return mixV(cur.pose, cur.drift, clamp((f - s.from) / Math.max(1, holdEnd - s.from)));
}

/** 快甩进度 0..1（0 不在快甩中），用于压暗聚光 */
export function whipAmount(f: number) {
  for (let i = 1; i < STATIONS.length; i++) {
    const s = STATIONS[i];
    if (!s.cut && f > s.from - WHIP && f < s.from) return Math.sin(Math.PI * (f - (s.from - WHIP)) / WHIP);
  }
  return 0;
}

export function inWhip(f: number) {
  return STATIONS.some((s, i) => i > 0 && !s.cut && f > s.from - WHIP - 1 && f < s.from + 1);
}

export function applyCam(cam: THREE.PerspectiveCamera, v: readonly number[]) {
  const [tx, ty, tz, d, el, az, fov] = v;
  const e = (el * Math.PI) / 180, a = (az * Math.PI) / 180;
  cam.position.set(tx + d * Math.cos(e) * Math.sin(a), ty + d * Math.sin(e), tz + d * Math.cos(e) * Math.cos(a));
  cam.fov = fov; cam.near = 0.05; cam.far = 140; cam.updateProjectionMatrix();
  cam.lookAt(tx, ty, tz);
}
