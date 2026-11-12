import React, {useMemo} from 'react';
import * as THREE from 'three';
import {useCurrentFrame} from 'remotion';
import {ramp, ease, spring, mix, rng} from '../anim';
import {STATIONS, WALL_X, WALL_GRID, WALL_ORDER, SHOWN, type Station, type ShowStation, type PairStation, type GansuStation, type WallStation} from './timeline';
import {camPose, whipAmount, WALL_PPU} from './camera';
import {Slab, DEPTH, UNIT} from './Slab';
import {ShapesMotionBlur} from './MotionBlur';

// 画风：深夜暗场。光只打在主体上（一束暖色聚光 + 地面光池），四周压暗；
// 地面是很淡的经纬网格，远处渐隐进夜色；天上零星几颗星，光里有浮尘。
const BG = '#0b0a0d';

/** 灯光整体跟随当前站点：暖色聚光从右前上方打下来，冷色逆光勾边 */
export const Lights: React.FC<{x: number; dim: number; wall?: boolean}> = ({x, dim, wall = false}) => {
  const {spot, rim} = useMemo(() => {
    const spot = new THREE.SpotLight('#ffd9a8', 260, 0, 0.42, 0.85, 2);
    spot.position.set(2.2, 9, 6.5); spot.target.position.set(0, 1.2, 0);
    spot.castShadow = true; spot.shadow.mapSize.set(2048, 2048); spot.shadow.bias = -0.0003; spot.shadow.radius = 6;
    const rim = new THREE.DirectionalLight('#8fb0c8', 1.1);
    rim.position.set(-3, 4, -7);
    return {spot, rim};
  }, []);
  spot.intensity = 260 * (1 - 0.6 * dim); // 快甩途中、暗剪影阶段聚光收暗，到站 / 亮灯再亮起（像舞台换景）
  spot.angle = wall ? 0.62 : 0.42; // 片尾墙俯视：光圈放大到罩住整面墙
  spot.target.position.set(0, wall ? 0 : 1.2, 0);
  return (
    <group position={[x, 0, 0]}>
      <ambientLight intensity={wall ? 0.35 : 0.12} />
      <hemisphereLight args={['#3a3f55', '#120d0a', 0.25]} />
      <primitive object={spot} /><primitive object={spot.target} />
      <primitive object={rim} />
      <pointLight position={[-2.5, 2, 4]} intensity={6} color="#ffb47a" distance={12} />
    </group>
  );
};

/** 经纬网格地面：小格靠漫反射只在光池里显出来，主网格线弱自发光、暗处也隐约可见；雾把远处吞进夜色 */
export const GridFloor: React.FC = () => {
  const {tex, lines} = useMemo(() => {
    const mk = (draw: (g: CanvasRenderingContext2D, s: number) => void, srgb: boolean) => {
      const s = 512, cv = document.createElement('canvas'); cv.width = cv.height = s;
      draw(cv.getContext('2d')!, s);
      const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(110, 45); t.anisotropy = 16;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    return {
      tex: mk((g, s) => {
        g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s);
        g.strokeStyle = 'rgba(0,0,0,0.10)'; g.lineWidth = 2;
        for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(i * s / 4, 0); g.lineTo(i * s / 4, s); g.moveTo(0, i * s / 4); g.lineTo(s, i * s / 4); g.stroke(); }
      }, true),
      lines: mk((g, s) => { g.fillStyle = '#000'; g.fillRect(0, 0, s, s); g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(0, 0, s, s); }, false),
    };
  }, []);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[35, 0, 0]} receiveShadow>
      <planeGeometry args={[220, 90]} />
      <meshStandardMaterial color="#2a2520" map={tex} roughness={0.92} metalness={0} emissive="#c9a77a" emissiveMap={lines} emissiveIntensity={0.07} />
    </mesh>
  );
};

function radialTexture(stops: [number, string][]) {
  const s = 256, cv = document.createElement('canvas'); cv.width = cv.height = s;
  const g = cv.getContext('2d')!, gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  stops.forEach(([o, c]) => gr.addColorStop(o, c));
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** 地面暖色光池（叠加），跟随站点 */
export const LightPool: React.FC<{x: number; wall?: boolean}> = ({x, wall = false}) => {
  const tex = useMemo(() => radialTexture([[0, 'rgba(255,190,120,0.55)'], [0.45, 'rgba(255,170,100,0.18)'], [1, 'rgba(0,0,0,0)']]), []);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x + 0.3, 0.01, 0.6]} scale={wall ? 0.9 : 1}>
      <planeGeometry args={[9, 6]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
  );
};

/** 光里的浮尘：细小暖色光点缓慢上飘、明灭 */
export const Dust: React.FC<{x: number}> = ({x}) => {
  const f = useCurrentFrame();
  const {items, tex} = useMemo(() => {
    const r = rng(41);
    return {
      tex: radialTexture([[0, 'rgba(255,230,190,1)'], [0.4, 'rgba(255,210,150,0.5)'], [1, 'rgba(0,0,0,0)']]),
      items: Array.from({length: 70}, () => ({p: [mix(-3.2, 3.2, r()), mix(0.2, 4.2, r()), mix(-1.5, 2.5, r())], s: mix(0.025, 0.07, r()), ph: r() * 6.28, v: mix(0.004, 0.012, r())})),
    };
  }, []);
  return (
    <group position={[x, 0, 0]}>
      {items.map((d, i) => (
        <sprite key={i} position={[d.p[0] + Math.sin(f * 0.02 + d.ph) * 0.25, ((d.p[1] + f * d.v) % 4.4) + 0.1, d.p[2] + Math.cos(f * 0.017 + d.ph) * 0.2]} scale={d.s}>
          <spriteMaterial map={tex} transparent opacity={0.35 + 0.35 * Math.sin(f * 0.11 + d.ph)} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} fog={false} />
        </sprite>
      ))}
    </group>
  );
};

/** 远处天幕上的星点（不受雾影响），极轻微闪烁 */
export const Stars: React.FC<{x: number}> = ({x}) => {
  const f = useCurrentFrame();
  const geo = useMemo(() => {
    const r = rng(5), n = 160, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = mix(-55, 55, r()); pos[i * 3 + 1] = mix(5, 30, r()); pos[i * 3 + 2] = -62 + r() * 6; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); return g;
  }, []);
  return (
    <points geometry={geo} position={[x * 0.92, 0, 0]}>
      <pointsMaterial color="#f3e6cf" size={2.2} sizeAttenuation={false} transparent opacity={0.45 + 0.1 * Math.sin(f * 0.13)} fog={false} depthWrite={false} />
    </points>
  );
};

// 平躺：中心高度 = 半个厚度；立起：翻起约 70° 悬浮在地面上方（南北边缘都不穿地面），正对低机位
const FLAT_Y = (DEPTH / 2) * UNIT, STAND_TILT = 1.22, STAND_Y = 1.6;

/** 厚片翻起悬浮的通用动作：镜头到位时从地面「啪」地翻起来，轻轻左右摆露出厚度；alive 那一拍活过来（弹一下 + 晃） */
function standPose(f: number, from: number, alive: number, x: number, hook = false) {
  const stand = hook ? 1 : ramp(f, from - 8, from + 6, ease.outBack);
  const hover = Math.sin(f * 0.09 + x) * 0.05 * stand;
  return {
    y: mix(FLAT_Y, STAND_Y, stand) + hover, tilt: STAND_TILT * stand, spin: Math.sin(f * 0.055 + x) * 0.22 * stand,
    roll: spring(f - alive, 0.07, 0.16, 0.75), squash: spring(f - alive, 0.14, 0.25, 0.9), scale: mix(0.9, 1, Math.min(1, Math.max(0, stand))),
  };
}

/** 回落段暗剪影站的「暗度」：到站前后是暗的，meta（重军鼓）那一拍 6 帧亮起 */
const darkOf = (f: number, s: ShowStation) => (s.dark ? 1 - ramp(f, s.meta - 2, s.meta + 3, ease.out) : 0); // 亮灯在拍点那一帧基本到位

const ShowSlab: React.FC<{s: ShowStation}> = ({s}) => {
  const f = useCurrentFrame();
  const k = standPose(f, s.from, s.meta, s.x, s.hook);
  return (
    <Slab name={s.p.name} reveal={1 - darkOf(f, s)}
      doodle={ramp(f, s.draw[0], s.draw[1], ease.inOut)}
      position={[s.x + (s.p.dx ?? 0), k.y, 0]} tilt={k.tilt} spin={k.spin} roll={k.roll} squash={k.squash} scale={k.scale * (s.p.scale ?? 1)} />
  );
};

/** 湖南 + 江西：两块一起翻起、一起画，各自轻摆（相位错开） */
const PairSlabs: React.FC<{s: PairStation}> = ({s}) => {
  const f = useCurrentFrame();
  return <>{s.ps.map((p, j) => {
    const k = standPose(f, s.from, s.meta, s.x + j * 2.3);
    return <Slab key={p.name} name={p.name} doodle={ramp(f, s.draw[0], s.draw[1], ease.inOut)}
      position={[s.x + p.ox, k.y, 0]} tilt={k.tilt} spin={k.spin * 0.6} roll={k.roll} squash={k.squash} scale={k.scale * (p.scale ?? 1)} />;
  })}</>;
};

/** 甘肃：每个选项弹出那一拍，涂鸦换成对应的说法（6 帧画完），厚片弹一下；clear 之后清空，静音段只剩慢慢转 */
const GansuSlab: React.FC<{s: GansuStation}> = ({s}) => {
  const f = useCurrentFrame();
  const cur = [...s.options].reverse().find((o) => f >= o.at && f < s.clear);
  const lastPop = [...s.options].reverse().find((o) => f >= o.at)?.at ?? s.from;
  const k = standPose(f, s.from, lastPop, s.x);
  return (
    <Slab name={s.p.name} art={cur?.art} doodle={cur ? ramp(f, cur.at, cur.at + 6, ease.out) : 0}
      position={[s.x + (s.p.dx ?? 0), k.y, 0]} tilt={k.tilt} spin={k.spin} roll={k.roll} squash={k.squash} scale={k.scale * (s.p.scale ?? 1)} />
  );
};

/** 片尾墙：31 块小厚片平铺在地面上。b68 从镜头方向错落砸下来；b71 暗剪影的轮廓光从左上到右下扫一遍。
 *  世界坐标由屏幕网格反算（俯视下平面上是线性映射），保证和 2D 的 CTA 文字对齐。 */
const WallTiles: React.FC<{s: WallStation}> = ({s}) => {
  const f = useCurrentFrame();
  const {cols, x0, y0, cw, ch, box} = WALL_GRID;
  const sc = box / WALL_PPU / 4; // 视框 400 宽 → box 像素
  return <>{WALL_ORDER.map((name, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    const X = WALL_X + (x0 + c * cw + cw / 2 - 540) / WALL_PPU, Z = (y0 + r * ch + ch / 2 - 960) / WALL_PPU;
    const land = ramp(f, s.drop + i * 0.6, s.drop + i * 0.6 + 10, ease.out); // 不用回弹：回弹会让小厚片穿进地面
    const lit = SHOWN.has(name) || name === '甘肃';
    const wave = Math.max(0, 1 - Math.abs(f - (s.wave + (c + r) * 1.6)) / 5);
    return <Slab key={name} small name={name} reveal={lit ? 1 : 0} doodle={lit ? 1 : 0} art={name === '甘肃' ? '甘肃Q' : undefined}
      rim={lit ? 0.4 : 0.5 + 1.6 * wave} position={[X, FLAT_Y * sc + (1 - land) * 4, Z]} scale={sc} />;
  })}</>;
};

/** 结论盖章那一拍：厚片下方地面一圈暖光椭圆波纹扩散（0.6 秒，先快后慢），和右上角计数波纹同拍 */
const FloorRipple: React.FC<{x: number; at: number}> = ({x, at}) => {
  const f = useCurrentFrame();
  const t = ramp(f, at, at + 18, ease.out);
  if (f < at || t >= 1) return null;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.02, 0.4]} scale={[mix(1, 4.2, t), mix(0.7, 2.6, t), 1]}>
      <ringGeometry args={[0.92, 1, 96]} />
      <meshBasicMaterial color="#ffd9a8" transparent opacity={0.7 * (1 - t)} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
  );
};

const StationView: React.FC<{s: Station}> = ({s}) => {
  switch (s.kind) {
    case 'show': return <><ShowSlab s={s} /><FloorRipple x={s.x} at={s.meta} /></>;
    case 'pair': return <><PairSlabs s={s} /><FloorRipple x={s.x} at={s.meta} /></>;
    case 'gansu': return <><GansuSlab s={s} /><FloorRipple x={s.x} at={s.clear} /></>;
    case 'wall': return <WallTiles s={s} />;
  }
};

/** 当前帧的整体暗度：快甩途中、回落段暗剪影亮灯之前 */
function dimAt(f: number) {
  let d = whipAmount(f);
  for (const s of STATIONS) if (s.kind === 'show' && s.dark && f >= s.from - 8 && f < s.to) d = Math.max(d, 0.75 * darkOf(f, s));
  return d;
}

export const World: React.FC = () => {
  const f = useCurrentFrame();
  const camX = camPose(f)[0];
  const wall = Math.abs(camX - WALL_X) < 1;
  return (
    <>
      <color attach="background" args={[BG]} />
      <fog attach="fog" args={[BG, 18, 48]} />
      <ShapesMotionBlur />
      <Lights x={camX} dim={dimAt(f)} wall={wall} />
      {!wall && <Stars x={camX} />}
      <GridFloor />
      <LightPool x={camX} wall={wall} />
      {!wall && <Dust x={camX} />}
      {STATIONS.map((s, i) => (Math.abs(s.x - camX) < 12 ? <StationView key={i} s={s} /> : null))}
    </>
  );
};
