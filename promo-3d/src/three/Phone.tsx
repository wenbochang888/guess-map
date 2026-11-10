import React, {useMemo} from 'react';
import * as THREE from 'three';
import {RoundedBox} from '@react-three/drei';
import {useCurrentFrame} from 'remotion';
import {drawScreen, CW, CH} from './screen';
import {SW, SH, PHONE, SCREEN_Y} from './space';
import type {Captures} from '../assets';

// 平躺的手机：石墨色机身 + 自发光屏幕（画布贴图逐帧重绘）。
export const Phone: React.FC<{cap: Captures | null}> = ({cap}) => {
  const f = useCurrentFrame();
  const {canvas, tex} = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = CW; canvas.height = CH;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 16;
    tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
    return {canvas, tex};
  }, []);
  drawScreen(canvas.getContext('2d')!, f, cap);
  tex.needsUpdate = true;
  return (
    <group>
      <RoundedBox args={[PHONE.w, PHONE.h, PHONE.d]} radius={0.05} smoothness={6} position={[0, PHONE.h / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#1b1b1d" roughness={0.32} metalness={0.6} />
      </RoundedBox>
      {/* 屏幕：不受光照影响，暗场中像真的在发光 */}
      <mesh position={[0, SCREEN_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[SW, SH]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      {/* 屏幕光溢出到周围桌面 */}
      <pointLight position={[0, 0.9, 0.2]} intensity={1.1} distance={4.5} color="#fff3dc" />
    </group>
  );
};
