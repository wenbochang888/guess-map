import React, {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import '@fontsource/noto-sans-sc/500.css';
import '@fontsource/noto-sans-sc/700.css';
import '@fontsource/noto-sans-sc/900.css';
import {WIDTH, HEIGHT, CHAT_Q, CHAT_A, STEPS} from './timeline';
import {useCaptures, useFonts} from './assets';
import {Mascot} from './three/Mascot';
import {StageLights} from './three/Lights';
import {Phone} from './three/Phone';
import {Desk, Bokeh, BlobShadow, LiftedMapCard, CardStrip, CameraRig} from './three/Props';
import {MotionBlur} from './three/MotionBlur';
import {buildPath, mascotState} from './three/mascotRig';
import {MASCOT_SCALE} from './three/space';
import {Progress, ChapterPill, TitleCard, PlusOne, EndCard, Vignette, SafeGuides} from './overlay/Overlays';
import {SoundTrack} from './SoundTrack';
import cards from './data/cards.json';

const FONT_SAMPLES = [CHAT_Q, CHAT_A, '10:24 小图 在线 · 猜地图向导 说点什么… 今天', ...STEPS.flatMap((s) => [s.kicker, s.title, s.sub, `${s.n}/3`]),
  '猜/地图 3 步上手玩 看轮廓 · 四选一 · 不赶时间 认出来了！+1 猜地图 换你，亲自试一局？ 笔记里的小工具，点开就玩',
  ...cards.cards.map((c) => c.name), cards.approval, '小红书标题/作者/互动栏遮挡区（估计）'].join('');

export type FilmProps = {guides?: boolean; audio?: boolean};

const World: React.FC<{cap: NonNullable<ReturnType<typeof useCaptures>>}> = ({cap}) => {
  const f = useCurrentFrame();
  const path = useMemo(() => buildPath(cap.layout), [cap]);
  const m = mascotState(f, path);
  const s = MASCOT_SCALE * m.grow;
  return (
    <>
      <color attach="background" args={['#0c0b0a']} />
      <fog attach="fog" args={['#0c0b0a', 14, 42]} />
      <CameraRig />
      <MotionBlur />
      <StageLights />
      <Bokeh />
      <Desk />
      <Phone cap={cap} />
      <LiftedMapCard cap={cap} />
      <CardStrip runnerX={m.pos[0]} />
      {s > 0.001 && <>
        <group position={m.pos}><Mascot {...m.pose} scale={s} /></group>
        <BlobShadow x={m.pos[0]} z={m.pos[2]} ground={m.ground} height={m.pos[1] - m.ground} scale={s * 1.6} />
      </>}
    </>
  );
};

export const Film: React.FC<FilmProps> = ({guides = false, audio = true}) => {
  useFonts(FONT_SAMPLES);
  const cap = useCaptures();
  return (
    <AbsoluteFill style={{background: '#0c0b0a'}}>
      {/* 素材就绪后才挂载画布，让 ThreeCanvas 自己的初始化等待覆盖首帧，避免并发渲染时首帧黑屏 */}
      {cap && <ThreeCanvas width={WIDTH} height={HEIGHT} dpr={1} gl={{antialias: true, preserveDrawingBuffer: true}} camera={{fov: 38, position: [0, 4, 4]}}>
        <World cap={cap} />
      </ThreeCanvas>}
      <Vignette />
      <Progress />
      <ChapterPill />
      <TitleCard />
      <PlusOne />
      <EndCard />
      {guides && <SafeGuides />}
      {audio && <SoundTrack />}
    </AbsoluteFill>
  );
};
