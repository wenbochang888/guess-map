import React, {useMemo} from 'react';
import * as THREE from 'three';
import {RoundedBox} from '@react-three/drei';
import {C} from '../design';

// 「小图」：App 图标（牛皮纸方格卡 + 墨绿问号 + 陶土橙圆点）的立体版。
// 原点在两脚之间的地面上，身高约 1.95（含问号呆毛）。
export type MascotPose = {
  squash?: number;   // >0 压扁，<0 拉长
  blink?: number;    // 0 睁眼 → 1 闭眼
  tilt?: number;     // 歪头（绕 z，弧度）
  turn?: number;     // 身体朝向（绕 y，弧度）
  armL?: number; armR?: number; // 手臂抬起角（弧度，正值向上）
  walk?: number;     // 走路相位（弧度），0 为站定
  stride?: number;   // 步幅 0–1
  wiggle?: number;   // 呆毛摆动（弧度）
  lookX?: number; lookY?: number; // 眼睛偏移 -1..1
};

// kraft：与图标同色；warm：更饱和的牛皮纸，暗场里更跳。
export type MascotTone = 'kraft' | 'warm';
const TONES = {
  kraft: {body: C.kraft, line: C.kraftLine, limb: C.kraft2},
  warm: {body: '#ecd2a2', line: '#c9a46a', limb: '#dcb97f'},
} as const;

const W = 1.3, H = 1.05, D = 0.95, LEG = 0.3;

function useGridTexture(tone: MascotTone) {
  const T = TONES[tone];
  return useMemo(() => {
    const s = 512, cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const g = cv.getContext('2d')!;
    g.fillStyle = T.body; g.fillRect(0, 0, s, s);
    g.strokeStyle = T.line; g.lineWidth = 6; g.globalAlpha = 0.75;
    for (let i = 1; i < 4; i++) {
      g.beginPath(); g.moveTo(i * s / 4, 0); g.lineTo(i * s / 4, s); g.stroke();
      g.beginPath(); g.moveTo(0, i * s / 4); g.lineTo(s, i * s / 4); g.stroke();
    }
    g.globalAlpha = 0.35; g.strokeStyle = C.ink; g.lineWidth = 9;
    g.beginPath(); g.roundRect(34, 34, s - 68, s - 68, 40); g.stroke();
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return t;
  }, [tone]);
}

const hookCurve = new THREE.CatmullRomCurve3([
  [0, 0.06], [0, 0.17], [0.09, 0.26], [0.17, 0.36], [0.15, 0.47], [0.05, 0.53], [-0.07, 0.52], [-0.15, 0.45],
].map(([x, y]) => new THREE.Vector3(x, y, 0)));

export const Mascot: React.FC<MascotPose & {scale?: number; tone?: MascotTone}> = ({
  squash = 0, blink = 0, tilt = 0, turn = 0, armL = 0, armR = 0, walk = 0, stride = 0, wiggle = 0, lookX = 0, lookY = 0, scale = 1, tone = 'warm',
}) => {
  const grid = useGridTexture(tone);
  const hook = useMemo(() => new THREE.TubeGeometry(hookCurve, 48, 0.048, 12, false), []);
  const body = <meshStandardMaterial map={grid} roughness={0.62} metalness={0} />;
  const limb = <meshStandardMaterial color={TONES[tone].limb} roughness={0.66} />;
  const ink = <meshStandardMaterial color={C.ink} roughness={0.35} />;
  const lift = (phase: number) => Math.max(0, Math.sin(walk + phase)) * 0.12 * stride;
  const bob = stride * Math.abs(Math.sin(walk)) * 0.05;
  const sy = 1 - squash, sxz = 1 + squash * 0.5;
  const eyeY = 0.1 + lookY * 0.05, eyeX = lookX * 0.06;
  return (
    <group scale={scale} rotation={[0, turn, 0]}>
      {/* 腿：前后两排，走路时交替抬起 */}
      {[[-0.34, 0.22, 0], [0.34, 0.22, Math.PI], [-0.34, -0.22, Math.PI], [0.34, -0.22, 0]].map(([x, z, ph], i) => (
        <RoundedBox key={i} args={[0.22, LEG, 0.24]} radius={0.06} smoothness={4} position={[x, LEG / 2 + lift(ph), z]} castShadow>{limb}</RoundedBox>
      ))}
      <group position={[0, LEG + bob, 0]} scale={[sxz, sy, sxz]}>
        <group rotation={[0, 0, tilt]} position={[0, H / 2, 0]}>
          <RoundedBox args={[W, H, D]} radius={0.16} smoothness={6} castShadow receiveShadow>{body}</RoundedBox>
          {/* 眼睛：墨绿竖方块，眨眼时纵向压缩 */}
          {[-0.27, 0.27].map((x) => (
            <RoundedBox key={x} args={[0.14, 0.27, 0.06]} radius={0.03} position={[x + eyeX, eyeY, D / 2 + 0.01]} scale={[1, Math.max(0.08, 1 - blink), 1]}>{ink}</RoundedBox>
          ))}
          {/* 腮红：很淡的陶土橙 */}
          {[-0.44, 0.44].map((x) => (
            <mesh key={x} position={[x, -0.13, D / 2 + 0.004]}><circleGeometry args={[0.075, 32]} /><meshStandardMaterial color={C.accent} transparent opacity={0.35} roughness={0.8} /></mesh>
          ))}
          {/* 手臂：以肩为轴转动 */}
          {[[-1, armL], [1, armR]].map(([side, a]) => (
            <group key={side} position={[side * (W / 2 + 0.02), 0.08, 0]} rotation={[0, 0, side * (a as number)]}>
              <RoundedBox args={[0.22, 0.34, 0.28]} radius={0.07} position={[side * 0.1, -0.12, 0]} castShadow>{limb}</RoundedBox>
            </group>
          ))}
          {/* 头顶问号：墨绿弯钩 + 陶土橙圆点（对应 App 图标） */}
          <group position={[0, H / 2, 0]} rotation={[0, 0, wiggle]}>
            <mesh position={[0, 0.07, 0]} castShadow><sphereGeometry args={[0.1, 32, 24]} /><meshStandardMaterial color={C.accent} roughness={0.4} /></mesh>
            <mesh geometry={hook} position={[0, 0.06, 0]} castShadow>{ink}</mesh>
            <mesh position={[-0.15, 0.51, 0]}><sphereGeometry args={[0.048, 16, 12]} />{ink}</mesh>
          </group>
        </group>
      </group>
    </group>
  );
};
