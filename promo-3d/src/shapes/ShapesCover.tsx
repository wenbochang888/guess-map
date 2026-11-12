import React, {useEffect, useState} from 'react';
import * as THREE from 'three';
import {AbsoluteFill, continueRender, delayRender} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useFrame} from '@react-three/fiber';
import '@fontsource/noto-serif-sc/700.css';
import '@fontsource/noto-serif-sc/900.css';
import {Slab} from './Slab';
import {Lights, GridFloor, LightPool, Stars} from './World';
import {applyCam} from './camera';
import {SERIF, Vignette, Grain} from './Overlays';

// 封面三种比例（小红书 3:4 主图 / 4:3 / 16:9），画风与成片一致：深夜暗场 + 聚光 + 纸色厚片 + 衬线大字。
// 主体：甘肃（红色「?」，对应标题「这个省出乎你的意料」），两侧是天鹅（黑龙江）、兔子（青海），一眼看懂「省像东西」。
// 标题：竖版三行「中国各省 / 分别像什么？ / 这个省出乎你的意料！！！」，横版两行。

export type CoverVariant = '34' | '43' | '169';
type Piece = {name: string; art?: string; pos: [number, number, number]; scale: number; spin: number};
type Layout = {
  w: number; h: number;
  pose: number[];             // 机位 [目标x,y,z, 距离, 仰角°, 方位角°, fov]
  pieces: Piece[];            // 三块厚片：天鹅（黑龙江）、甘肃「?」、兔子（青海）
  top: number; lines: 2 | 3; big: number; small: number;
};
// c2：三张都改成「字在上居中、地图在下居中」（c1 横版左字右图把视线分成两半，竖版天鹅压在甘肃上）。
// 坐标按投影估算：平面上每世界单位 ≈ (高/2)/(距离·tan17°) 像素；天鹅轮廓中心在视框 x≈155，所以往右补 0.25 左右。
const SWAN = (pos: [number, number, number], scale: number): Piece => ({name: '黑龙江', pos, scale, spin: 0.18});
const RABBIT = (pos: [number, number, number], scale: number): Piece => ({name: '青海', pos, scale, spin: -0.18});
const GANSU = (pos: [number, number, number], scale: number): Piece => ({name: '甘肃', art: '甘肃Q', pos, scale, spin: -0.06});
const L: Record<CoverVariant, Layout> = {
  // 竖版：三行字居中；上排天鹅、兔子并排，下排甘肃单独放大
  '34': {w: 1080, h: 1440, pose: [0, 4.6, 0, 18, 10, 0, 34], top: 92, lines: 3, big: 150, small: 72,
    pieces: [SWAN([-1.57, 4.1, -2], 0.55), RABBIT([1.82, 4.1, -2], 0.55), GANSU([0, 1.5, 0.8], 0.95)]},
  // 横版：两行字居中；下面一排三块，甘肃在正中最大
  '43': {w: 1440, h: 1080, pose: [0, 2.87, 0, 14, 10, 0, 34], top: 96, lines: 2, big: 112, small: 62,
    pieces: [SWAN([-3.17 + 0.3, 1.6, -0.3], 0.65), GANSU([0, 1.6, 0], 0.9), RABBIT([3.17, 1.6, -0.3], 0.65)]},
  '169': {w: 1920, h: 1080, pose: [0, 2.92, 0, 13, 10, 0, 34], top: 96, lines: 2, big: 120, small: 66,
    pieces: [SWAN([-3.4 + 0.34, 1.6, -0.3], 0.75), GANSU([0, 1.6, 0], 0.95), RABBIT([3.4, 1.6, -0.3], 0.75)]},
};
export const COVER_SIZES = Object.fromEntries(Object.entries(L).map(([k, v]) => [k, {w: v.w, h: v.h}])) as Record<CoverVariant, {w: number; h: number}>;

const CREAM = '#F2E7D6', BLUE = '#95C8EE', RED = '#C9604C';
const glow = '0 3px 22px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.9)';
const TILT = 1.22;

const Cam: React.FC<{pose: number[]}> = ({pose}) => {
  useFrame(({camera}) => applyCam(camera as THREE.PerspectiveCamera, pose));
  return null;
};

const Scene: React.FC<{l: Layout}> = ({l}) => (
  <>
    <color attach="background" args={['#0b0a0d']} />
    <fog attach="fog" args={['#0b0a0d', 26, 60]} />
    <Cam pose={l.pose} />
    {/* 片尾墙那套布光：光圈更大、环境光更足，左右两块不会偏暗 */}
    <Lights x={0} dim={0} wall />
    <Stars x={0} />
    <GridFloor />
    <LightPool x={0} />
    {l.pieces.map((p) => <Slab key={p.name} name={p.name} art={p.art} doodle={1} position={p.pos} tilt={TILT} spin={p.spin} scale={p.scale} />)}
  </>
);

/** 字体加载完再画 3D：甘肃的「?」是画在画布上的字，字体没到会用错字形 */
function useFontsReady(samples: string) {
  const [handle] = useState(() => delayRender('cover-fonts'));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    Promise.all(['700', '900'].map((w) => document.fonts.load(`${w} 40px "Noto Serif SC"`, samples))).then(() => { setReady(true); continueRender(handle); });
  }, [handle, samples]);
  return ready;
}

export const ShapesCover: React.FC<{v: CoverVariant}> = ({v}) => {
  const l = L[v];
  const ready = useFontsReady('中国各省分别像什么？这个省出乎你的意料！?');
  const key = <span style={{color: RED, textDecoration: 'underline', textDecorationThickness: Math.round(l.big / 18), textUnderlineOffset: Math.round(l.big / 7)}}>像什么</span>;
  const line: React.CSSProperties = {fontSize: l.big, fontWeight: 900, lineHeight: 1.22, letterSpacing: 4, whiteSpace: 'nowrap'};
  return (
    <AbsoluteFill style={{background: '#0b0a0d'}}>
      {ready && (
        <ThreeCanvas width={l.w} height={l.h} dpr={1} gl={{antialias: true, preserveDrawingBuffer: true}} camera={{fov: 34, position: [0, 4, 16]}} shadows>
          <Scene l={l} />
        </ThreeCanvas>
      )}
      <Vignette />
      <Grain />
      <div style={{position: 'absolute', left: 0, right: 0, top: l.top, textAlign: 'center', fontFamily: SERIF, color: CREAM, textShadow: glow}}>
        {l.lines === 3 ? <>
          <div style={line}>中国各省</div>
          <div style={line}>分别{key}？</div>
        </> : <div style={line}>中国各省分别{key}？</div>}
        <div style={{fontSize: l.small, fontWeight: 900, lineHeight: 1.5, letterSpacing: 3, marginTop: Math.round(l.big / 8), whiteSpace: 'nowrap'}}>
          <span style={{color: BLUE}}>这个省</span>出乎你的意料<span style={{color: RED}}>！！！</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
