import React from 'react';
import {C} from '../design';

// 2D 像素版小图：开场时出现在聊天屏里，随后「跳出」变成 3D。
export const PIXEL_ROWS = [
  '....GGGG....',
  '...G....G...',
  '........G...',
  '.......G....',
  '......O.....',
  '..KKKKKKKK..',
  '..KKKKKKKK..',
  '..KGKKKKGK..',
  '.kKGKKKKGKk.',
  '.kKKKKKKKKk.',
  '..KOKKKKOK..',
  '..KKKKKKKK..',
  '..k.k..k.k..',
];
const FILL: Record<string, string> = {G: C.ink, O: C.accent, K: C.kraft, k: C.kraft2};

export const PixelTu: React.FC<{size: number; color?: string}> = ({size, color}) => {
  const cell = size / PIXEL_ROWS[0].length;
  return (
    <svg width={size} height={cell * PIXEL_ROWS.length} shapeRendering="crispEdges">
      {PIXEL_ROWS.flatMap((row, y) => [...row].map((ch, x) => ch === '.' ? null : (
        <rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} fill={color ?? FILL[ch]} />
      )))}
    </svg>
  );
};
