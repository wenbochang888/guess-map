import React from 'react';
import {Audio, Sequence, staticFile} from 'remotion';
import {E, CHAT_Q} from './timeline';
import {SHOTS} from './three/Props';

// 配乐：scripts/make-music.mjs 生成的原创曲，120BPM，鼓点、撤鼓、重拍都按 timeline 的拍点写好，从第 0 帧整段播放。
const MUSIC_VOLUME = 0.7;

type Cue = [frame: number, name: string, volume?: number];
const step = (E.typeEnd - E.typeStart) / CHAT_Q.length;
const ticks: Cue[] = Array.from({length: CHAT_Q.length}, (_, i) => [Math.round(E.typeStart + (i + 1) * step), 'tick', 0.5]);
// 奔跑：每 8 分音符一步
const steps: Cue[] = Array.from({length: 8}, (_, i) => [Math.round(E.runStart + i * 7.5), 'step', 0.55]);
// 快甩镜头：呼声峰值（音效约 0.22 秒处）对准到位的拍点
const whooshes: Cue[] = SHOTS.filter((s) => !s.glide && (s.whip ?? 9) >= 8).map((s) => [s.at - 7, 'whoosh', 0.45]);
const pops: Cue[] = [...E.q1Pops, ...E.q2Pops].map((f) => [f, 'tick', 0.7]);
export const CUES: Cue[] = [
  ...ticks,
  [E.send, 'send'], [E.dots, 'msg', 0.6], [E.reply, 'msg'],
  [E.spritePop, 'pop'], [E.emerge, 'whoosh', 0.7], [E.landDesk, 'thud'],
  [E.tapChip, 'tap'], [E.tapAll, 'tap'], [E.tapStart, 'tap'],
  ...pops, [E.cardUp[0], 'whoosh', 0.6], ...E.cardSpin.map((f): Cue => [f, 'tap', 0.35]),
  [E.tapRight, 'tap'], [E.tapRight, 'correct'],
  [E.tapWrong, 'tap', 0.5], [E.tapWrong, 'wrong'], [E.scorePop, 'pop', 0.7],
  ...whooshes, ...steps, [E.endIn, 'sparkle'],
];

export const SoundTrack: React.FC = () => (
  <>
    <Audio src={staticFile('audio/music-3d.wav')} volume={MUSIC_VOLUME} />
    {CUES.map(([f, name, v = 1], i) => (
      <Sequence key={i} from={f} durationInFrames={45} name={name}>
        <Audio src={staticFile(`audio/sfx/${name}.wav`)} volume={v} />
      </Sequence>
    ))}
  </>
);
