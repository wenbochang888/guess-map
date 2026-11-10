import React, {useMemo} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {MeshReflectorMaterial, RoundedBox} from '@react-three/drei';
import {useCurrentFrame} from 'remotion';
import {C, FONT} from '../design';
import {E, SCENE, BEAT} from '../timeline';
import {ramp, ease, mix, mixV, rng} from '../anim';
import {box, type Captures} from '../assets';
import {css, SW, CSS_W, SCREEN_Y} from './space';
import {RUN_FROM, RUN_TO, runnerX} from './mascotRig';
import cards from '../data/cards.json';

/** 暗色反光桌面 */
export const Desk: React.FC = () => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
    <planeGeometry args={[80, 80]} />
    <MeshReflectorMaterial resolution={512} blur={[400, 120]} mixBlur={1} mixStrength={1.6} mirror={0.4}
      roughness={0.8} depthScale={0.6} minDepthThreshold={0.4} maxDepthThreshold={1.4} color="#14120f" metalness={0.35} />
  </mesh>
);

function radialTexture(inner: string) {
  const s = 128, cv = document.createElement('canvas'); cv.width = cv.height = s;
  const g = cv.getContext('2d')!, gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, inner); gr.addColorStop(0.55, inner); gr.addColorStop(0.8, inner.replace(/[\d.]+\)$/, '0.35)')); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** 底鼓包络（与 make-music.mjs 的 kicks 一致：4–21 秒每拍、23 秒单击、25–28 秒每拍） */
export function kickPulse(f: number) {
  const on = (f >= 120 && f < 630) || (f >= 690 && f < 700) || (f >= 750 && f < 855);
  return on ? Math.exp(-(f % BEAT) / 4) : 0;
}

/** 远处的暖色虚化光斑（参考片的 bokeh），只在低机位时入画 */
export const Bokeh: React.FC = () => {
  const f = useCurrentFrame();
  const items = useMemo(() => {
    const r = rng(11), cols = ['rgba(255,196,120,0.9)', 'rgba(232,120,80,0.85)', 'rgba(150,200,170,0.75)', 'rgba(255,236,200,0.9)'];
    const tex = cols.map(radialTexture);
    return Array.from({length: 46}, () => ({
      p: [mix(-14, 22, r()), mix(0.6, 6.5, r()), mix(-26, -9, r())] as [number, number, number],
      s: mix(0.5, 1.6, r()), tex: tex[Math.floor(r() * tex.length)], ph: r() * 6.28, a: mix(0.35, 0.9, r()),
    }));
  }, []);
  // 鼓点段光斑随底鼓轻微「呼吸」（每拍一次亮起再衰减）
  const pulse = kickPulse(f);
  return (
    <group>
      {items.map((b, i) => (
        <sprite key={i} position={[b.p[0], b.p[1] + Math.sin(f * 0.02 + b.ph) * 0.08, b.p[2]]} scale={b.s * (1 + 0.06 * pulse)}>
          <spriteMaterial map={b.tex} transparent opacity={b.a * (0.8 + 0.2 * Math.sin(f * 0.05 + b.ph)) * (0.85 + 0.35 * pulse)} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
      ))}
    </group>
  );
};

/** 角色脚下的柔和投影（比实时阴影便宜且稳定） */
export const BlobShadow: React.FC<{x: number; z: number; ground: number; height: number; scale: number}> = ({x, z, ground, height, scale}) => {
  const tex = useMemo(() => radialTexture('rgba(0,0,0,0.75)'), []);
  const k = Math.max(0.3, 1 - height * 0.8);
  return (
    <mesh position={[x, ground + 0.004, z]} rotation={[-Math.PI / 2, 0, 0]} scale={[scale * 1.5 * k, scale * 1.2 * k, 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={tex} transparent opacity={0.7 * k} depthWrite={false} />
    </mesh>
  );
};

/** S4：题面地图卡浮出屏幕、旋转一圈、再放回 */
export const LiftedMapCard: React.FC<{cap: Captures}> = ({cap}) => {
  const f = useCurrentFrame();
  const b = box(cap.layout, 'q1', 'question-map');
  const tex = useMemo(() => { const t = new THREE.Texture(cap.img['q1-map']); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16; t.needsUpdate = true; return t; }, [cap]);
  if (f < E.cardUp[0] || f >= E.cardDown[1]) return null;
  const k = SW / CSS_W, w = b.w * k, h = b.h * k;
  const [cx, , cz] = css(b.x + b.w / 2, b.y + b.h / 2);
  const up = ramp(f, E.cardUp[0], E.cardUp[1], ease.inOut) * (1 - ramp(f, E.cardDown[0], E.cardDown[1], ease.inOut));
  // 按拍转四个 90°：每次 6 帧快转后停住
  const spin = E.cardSpin.reduce((acc, at) => acc + ramp(f, at - 6, at, ease.snap) * (Math.PI / 2), 0);
  const y = mix(SCREEN_Y + 0.004, 1.15, up) + Math.sin(f * 0.12) * 0.03 * up;
  return (
    <group position={[cx, y, mix(cz, cz + 0.35, up)]} rotation={[mix(-Math.PI / 2, -0.32, up), spin, 0]} scale={mix(1, 0.72, up)}>
      <RoundedBox args={[w, h, 0.03]} radius={0.012} smoothness={2} position={[0, 0, -0.016]}>
        <meshStandardMaterial color={C.kraft2} roughness={0.7} />
      </RoundedBox>
      <mesh><planeGeometry args={[w, h]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
      <mesh rotation={[0, Math.PI, 0]} position={[0, 0, -0.032]}><planeGeometry args={[w, h]} /><meshStandardMaterial color={C.kraft} roughness={0.8} /></mesh>
    </group>
  );
};

function cardTexture(name: string, path: string) {
  const W = 600, H = 480, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;
  g.fillStyle = C.kraft; g.beginPath(); g.roundRect(0, 0, W, H, 28); g.fill();
  g.strokeStyle = C.kraftLine; g.globalAlpha = 0.6; g.lineWidth = 2;
  for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(i * W / 6, 0); g.lineTo(i * W / 6, H); g.stroke(); }
  for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(0, i * H / 5); g.lineTo(W, i * H / 5); g.stroke(); }
  g.globalAlpha = 1;
  // 题库原始路径（400×300 视框），原样缩放，不改边界
  g.save(); g.translate(60, 70); g.scale(1.2, 1.2); g.fillStyle = C.ink; g.fill(new Path2D(path), 'nonzero'); g.restore();
  g.font = `700 34px ${FONT}`; const tw = g.measureText(name).width;
  g.fillStyle = C.accent; g.beginPath(); g.roundRect(24, 22, tw + 32, 52, 10); g.fill();
  g.fillStyle = C.surface; g.textBaseline = 'middle'; g.fillText(name, 40, 49);
  g.font = `500 18px ${FONT}`; g.fillStyle = C.muted; g.fillText(cards.approval, 26, H - 26);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16; return t;
}

export const CARD_X = (i: number) => RUN_FROM[0] + 0.9 + i * 1.3;
/** S6：真实省份轮廓卡排成一条「时间线」，小图跑过时依次立起 */
export const CardStrip: React.FC<{runnerX: number}> = ({runnerX}) => {
  const f = useCurrentFrame();
  const texs = useMemo(() => cards.cards.map((c) => cardTexture(c.name, c.path)), []);
  if (f < SCENE.outro[0]) return null;
  const len = Math.max(0, runnerX - RUN_FROM[0]);
  return (
    <group>
      {texs.map((t, i) => {
        const x = CARD_X(i), up = ramp(runnerX, x - 0.9, x - 0.2, ease.outBack);
        return (
          <group key={i} position={[x, 0, 0.75]} rotation={[mix(-Math.PI / 2, -0.12, up), -0.08, 0]}>
            <mesh position={[0, 0.5, 0]}><planeGeometry args={[1.15, 0.92]} /><meshStandardMaterial map={t} roughness={0.75} emissive="#ffffff" emissiveMap={t} emissiveIntensity={0.25} /></mesh>
          </group>
        );
      })}
      {/* 发光路径：随小图奔跑延伸 */}
      <mesh position={[RUN_FROM[0] + len / 2, 0.006, RUN_TO[2] - 0.25]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[Math.max(0.001, len), 0.05]} />
        <meshBasicMaterial color="#ffb07a" toneMapped={false} />
      </mesh>
      <mesh position={[RUN_FROM[0] + len / 2, 0.005, RUN_TO[2] - 0.25]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[Math.max(0.001, len), 0.45]} />
        <meshBasicMaterial color={C.accent} transparent opacity={0.22} toneMapped={false} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
};

type Pose = readonly number[];
/** 机位：[目标x,y,z, 距离, 仰角°, 方位角°（0=正对 +z）, fov]，按环绕参数插值。
 * 每个镜头在 at 帧（拍点）到位：之前 whip 帧内「快甩」过来（ease.snap + 运动模糊），
 * 到位后停住，只沿 drift 极轻微地漂移；glide 表示整段平滑移动（开场铺垫、跟跑）。whip: 0 为硬切。 */
type Shot = {at: number; pose: Pose; drift?: Pose; whip?: number; glide?: boolean};
export const SHOTS: Shot[] = [
  // S1 聊天：无鼓段，平滑缓推
  {at: 0, pose: [0, 0, 0.75, 8.8, 56, 7, 36]},
  {at: 75, pose: [0, 0, 0.7, 8.4, 59, 4, 36], glide: true},
  {at: 105, pose: [0, 0, 0.6, 8.1, 62, 2, 36], glide: true},
  {at: 120, pose: [0, 0, 0.5, 8.4, 58, 4, 36], glide: true},
  {at: 150, pose: [0.3, 0.3, 0.6, 7.4, 48, 10, 36], glide: true},
  // S2 小图落桌（拍点）→ 低机位停住，缓慢绕半圈
  {at: E.landDesk, pose: [1.85, -0.12, 1.25, 4.8, 12, 26, 34], drift: [1.85, -0.12, 1.25, 4.5, 11, 34, 34], whip: 12},
  // S3 ① 选范围
  {at: 240, pose: [0, 0, 0.75, 9.2, 56, -4, 36], drift: [0, 0, 0.7, 9.0, 57, -3, 36], whip: 10},
  {at: E.tapChip, pose: [0, 0, 0.35, 8.3, 62, -2, 36], drift: [0, 0, 0.32, 8.15, 62, -1, 36], whip: 8},
  {at: 345, pose: [0, 0, 0.75, 8.8, 57, 0, 36], drift: [0, 0, 0.75, 8.6, 57, 0, 36], whip: 8},
  // S4 ② 看轮廓：地图卡浮起 → 低机位看转卡 → 回俯拍 → 踩对推近
  {at: 420, pose: [0, 0.5, 0.25, 8.3, 50, 0, 36], drift: [0, 0.55, 0.25, 8.0, 49, 3, 36], whip: 10},
  {at: 465, pose: [0, 0.8, 0.3, 6.4, 30, 12, 36], drift: [0, 0.8, 0.3, 6.2, 30, 16, 36], whip: 9},
  {at: 525, pose: [0, 0, 0.75, 8.7, 56, 0, 36], drift: [0, 0, 0.8, 8.5, 56, 2, 36], whip: 10},
  {at: E.tapRight, pose: [0.35, 0, 1.15, 6.6, 52, 10, 36], drift: [0.35, 0, 1.15, 6.4, 52, 12, 36], whip: 8},
  // S5 ③ 猜错：犹豫时缓慢压近（紧张）→ 踩错小幅弹回 → 结算页 → 拉远
  {at: 600, pose: [0, 0, 0.75, 8.7, 56, 0, 36], whip: 10},
  {at: 630, pose: [0, 0.1, 1.15, 6.3, 46, -8, 36], drift: [0, 0.1, 1.2, 5.8, 46, -10, 36], whip: 9},
  {at: E.tapWrong, pose: [-0.1, 0.1, 1.2, 6.6, 46, -10, 36], drift: [-0.1, 0.1, 1.2, 6.4, 46, -11, 36], whip: 6},
  {at: E.scorePop, pose: [0, 0, 0.6, 9.0, 58, 0, 36], drift: [0, 0, 0.45, 11.5, 64, 0, 38], whip: 10},
  // S6 硬切到奔跑（x 锁定小图），到终点抬升
  {at: 780, pose: [3.6, 0.55, 1.4, 5.6, 12, 0, 34], whip: 0},
  {at: E.runEnd, pose: [10.4, 0.6, 1.4, 5.8, 13, 4, 34], glide: true},
  {at: 899, pose: [10.4, 1.25, 1.2, 8.4, 14, 4, 36], glide: true},
];

const W = (s: Shot) => (s.glide ? 0 : s.whip ?? 9);
/** f 帧（可为小数，运动模糊用）的机位参数 */
export function camPose(f: number): number[] {
  let i = 0;
  while (i + 1 < SHOTS.length && f >= SHOTS[i + 1].at) i++;
  const cur = SHOTS[i], next = SHOTS[i + 1];
  let v: number[];
  if (next?.glide) {
    v = mixV(cur.pose, next.pose, ease.inOut(clamp((f - cur.at) / (next.at - cur.at))));
  } else if (next && W(next) > 0 && f >= next.at - W(next)) {
    // 正在快甩进入 next：起点是 cur 漂移结束的位置
    v = mixV(cur.drift ?? cur.pose, next.pose, ease.snap(clamp((f - (next.at - W(next))) / W(next))));
  } else {
    const holdEnd = next ? next.at - W(next) : cur.at + 60;
    v = cur.drift ? mixV(cur.pose, cur.drift, clamp((f - cur.at) / Math.max(1, holdEnd - cur.at))) : [...cur.pose];
  }
  // 奔跑段镜头横向锁定小图，避免缓动不同步导致角色出画
  if (f >= SCENE.outro[0] && f < E.runEnd) v[0] = runnerX(f) - 0.2;
  return v;
}
const clamp = (t: number) => Math.min(1, Math.max(0, t));

/** 当前是否在快甩中（运动模糊只在这些帧开启，节省渲染时间） */
export function inWhip(f: number) {
  return SHOTS.some((s) => !s.glide && W(s) > 0 && f > s.at - W(s) - 1 && f < s.at + 1);
}

export function applyCam(cam: THREE.PerspectiveCamera, v: readonly number[]) {
  const [tx, ty, tz, d, el, az, fov] = v;
  const e = (el * Math.PI) / 180, a = (az * Math.PI) / 180;
  cam.position.set(tx + d * Math.cos(e) * Math.sin(a), ty + d * Math.sin(e), tz + d * Math.cos(e) * Math.cos(a));
  cam.fov = fov; cam.near = 0.05; cam.far = 120; cam.updateProjectionMatrix();
  cam.lookAt(tx, ty, tz);
}

export const CameraRig: React.FC = () => {
  const f = useCurrentFrame();
  const cam = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  applyCam(cam, camPose(f));
  return null;
};
