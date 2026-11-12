import React, {useEffect, useState} from 'react';
import {AbsoluteFill, Audio, Sequence, continueRender, delayRender, staticFile, useVideoConfig, interpolate} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import '@fontsource/noto-serif-sc/700.css';
import '@fontsource/noto-serif-sc/900.css';
import {WIDTH, HEIGHT, STATIONS, TOTAL_PROVINCES, MUSIC_TRIM} from './timeline';
import {ease} from '../anim';
import {World} from './World';
import {Subtitles, Counter, Footnote, Chips, WallCta, SafeZones, Vignette, Grain, FONT_SAMPLES} from './Overlays';

export function useFonts(samples: string) {
  const [handle] = useState(() => delayRender('fonts'));
  useEffect(() => {
    Promise.all(['700', '900'].map((w) => document.fonts.load(`${w} 40px "Noto Serif SC"`, samples))).then(() => continueRender(handle));
  }, [handle, samples]);
}

// 音效时间表（每个画面动作都有声音，但都压在配乐之下，配乐是主角）：
//   快甩呼声峰值对准到站拍点；厚片翻起落定一声闷响；画涂鸦沙沙；结论行盖章一记重击；
//   每句字幕轻「嗒」；计数器跳动滴答（钩子段 0→31 跟着数字滚动连续滴答，前密后疏）。
type Cue = [frame: number, src: string, volume?: number];
const SFX = (n: string) => `audio/shapes/${n}.wav`;
const hookTicks = (() => {
  const out: number[] = []; let last = -1, lastF = -9;
  for (let f = 0; f <= 30; f++) {
    const n = Math.round(TOTAL_PROVINCES * ease.out(f / 30));
    if (n !== last && f - lastF >= 2) { out.push(f); lastF = f; }
    last = n;
  }
  return out;
})();
const CUES: Cue[] = [
  ...hookTicks.map((f): Cue => [f, SFX('count'), 0.2]),
  ...STATIONS.flatMap((s, i): Cue[] => {
    const out: Cue[] = [];
    if (i > 0 && !s.cut) out.push([s.from - 7, 'audio/sfx/whoosh.wav', 0.3], [s.from, SFX('land'), 0.4]);
    if (s.kind === 'show' || s.kind === 'pair') out.push([s.draw[0], SFX('scribble'), 0.4]);
    if (s.kind === 'show' && s.dark) out.push([s.meta, SFX('reveal'), 0.45]); // 重军鼓亮灯
    if (s.kind === 'gansu') s.options.forEach((o, j) => out.push([o.at, SFX(`pop${j + 1}`), 0.45]));
    if (s.kind === 'wall') { // 31 块砸下来：一声闷响 + 一串错落的轻响
      out.push([s.drop, SFX('land'), 0.5]);
      [3, 6, 9, 12, 15].forEach((d, j) => out.push([s.drop + d, SFX('tock'), 0.22 - j * 0.03]));
    }
    s.lines.forEach((l) => { if (l.at > 0) out.push(l.big ? [l.at, SFX('hit'), 0.3] : [l.at, SFX('tock'), 0.25]); });
    if (s.kind === 'wall') out.push([s.cta, SFX('tock'), 0.25]);
    if (s.count) out.push([s.count.at, SFX('count'), 0.22]);
    return out;
  }),
];

/** 配乐：资料/musi.mp3 从 66.382 秒起（乐句重音）截取；结尾 15 帧淡出。原曲母带很响，0.5 倍让成片落在约 -14 LUFS、峰值不削顶 */
const Music: React.FC = () => {
  const {durationInFrames: d} = useVideoConfig();
  return <Audio src={staticFile('audio/shapes/musi.mp3')} trimBefore={MUSIC_TRIM}
    volume={(f) => 0.5 * interpolate(f, [d - 15, d - 1], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})} />;
};

export type ShapesProps = {guides?: boolean; audio?: boolean};

export const ShapesFilm: React.FC<ShapesProps> = ({guides = false, audio = true}) => {
  useFonts(FONT_SAMPLES);
  return (
    <AbsoluteFill style={{background: '#0b0a0d'}}>
      <ThreeCanvas width={WIDTH} height={HEIGHT} dpr={1} gl={{antialias: true, preserveDrawingBuffer: true}} camera={{fov: 34, position: [0, 4, 16]}} shadows>
        <World />
      </ThreeCanvas>
      <Vignette />
      <Grain />
      <Subtitles />
      <Counter />
      <Footnote />
      <Chips />
      <WallCta />
      {guides && <SafeZones />}
      {audio && <>
        <Music />
        {CUES.map(([f, src, v = 1], i) => (
          <Sequence key={i} from={f} durationInFrames={60}><Audio src={staticFile(src)} volume={v} /></Sequence>
        ))}
      </>}
    </AbsoluteFill>
  );
};
