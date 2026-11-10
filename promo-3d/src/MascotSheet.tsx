import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {ContactShadows} from '@react-three/drei';
import '@fontsource/noto-sans-sc/500.css';
import '@fontsource/noto-sans-sc/900.css';
import {Mascot, type MascotPose, type MascotTone} from './three/Mascot';
import {StageLights} from './three/Lights';
import {PixelTu} from './overlay/PixelTu';
import {C, FONT} from './design';

// 检查点 1：吉祥物定稿图（正面 / 3/4 / 侧面 / 动作 / 像素版）。
const PW = 540, PH = 900;
const View: React.FC<{label: string; cam: [number, number, number]; pose?: MascotPose; tone: MascotTone}> = ({label, cam, pose, tone}) => (
  <div style={{width: PW, height: PH + 120, position: 'relative'}}>
    <ThreeCanvas width={PW} height={PH} shadows camera={{position: cam, fov: 30}} onCreated={({camera}) => camera.lookAt(0, 0.95, 0)}
      style={{background: 'transparent'}}>
      <StageLights />
      <Mascot {...pose} tone={tone} />
      <ContactShadows position={[0, 0.001, 0]} opacity={0.6} scale={5} blur={2.4} far={2} />
    </ThreeCanvas>
    <div style={{position: 'absolute', bottom: 40, width: '100%', textAlign: 'center', color: C.kraft, fontFamily: FONT, fontSize: 34, fontWeight: 500, opacity: 0.85}}>{label}</div>
  </div>
);

export const MascotSheet: React.FC<{tone: MascotTone}> = ({tone}) => {
  useCurrentFrame();
  return (
    <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 35%, #2a2622 0%, ${C.stage} 70%)`}}>
      <div style={{position: 'absolute', top: 56, left: 80, color: C.kraft, fontFamily: FONT}}>
        <div style={{fontSize: 64, fontWeight: 900, letterSpacing: 6}}>小图 <span style={{color: C.accent}}>/</span> 定稿草图 · {tone === 'kraft' ? 'A 图标原色' : 'B 暖牛皮纸'}</div>
        <div style={{fontSize: 30, opacity: 0.7, marginTop: 8}}>牛皮纸方格身体 · 墨绿方眼 · 头顶问号（陶土橙圆点 = 图标里的橙点）</div>
      </div>
      <div style={{position: 'absolute', top: 210, left: 0, display: 'flex'}}>
        <View label="正面" cam={[0, 1.4, 6.2]} tone={tone} />
        <View label="3/4 侧" cam={[3.6, 1.9, 5]} tone={tone} pose={{lookX: 0.6}} />
        <View label="侧面" cam={[6.2, 1.3, 0]} tone={tone} />
        <View label="动作：招手 + 歪头" cam={[1.6, 1.6, 5.8]} tone={tone} pose={{armR: 2.3, tilt: 0.14, squash: -0.04, wiggle: -0.25, lookX: 0.4, lookY: 0.4}} />
      </div>
      <div style={{position: 'absolute', top: 260, right: 70, width: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28}}>
        <div style={{background: C.surface, borderRadius: 28, padding: 34}}><PixelTu size={200} /></div>
        <div style={{color: C.kraft, fontFamily: FONT, fontSize: 34, fontWeight: 500, opacity: 0.85}}>像素版（聊天屏内）</div>
      </div>
    </AbsoluteFill>
  );
};
