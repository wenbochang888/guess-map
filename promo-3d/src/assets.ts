import {useEffect, useState} from 'react';
import {continueRender, delayRender, staticFile} from 'remotion';

// 真实界面采集结果（scripts/capture.mjs 写出 public/captures/）。
export type Box = {cls: string; text: string; x: number; y: number; w: number; h: number};
export type Shot = {id: string; boxes: Box[]; question?: string; picked?: string; score?: string};
export type Layout = {seed: number; viewport: {width: number; height: number}; shots: Shot[]};
export const SHOT_IDS = ['home', 'picker', 'q1', 'q1-correct', 'q2', 'q2-wrong', 'result'] as const;
export type ShotId = (typeof SHOT_IDS)[number];
export type Captures = {layout: Layout; img: Record<ShotId | 'q1-map', HTMLImageElement>};

const loadImg = (src: string) => new Promise<HTMLImageElement>((ok, bad) => {
  const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(Error(`load failed: ${src}`)); i.src = src;
});

let cache: Promise<Captures> | null = null;
function loadCaptures() {
  cache ??= (async () => {
    const layout: Layout = await fetch(staticFile('captures/layout.json')).then((r) => r.json());
    const ids = [...SHOT_IDS, 'q1-map'] as const;
    const imgs = await Promise.all(ids.map((id) => loadImg(staticFile(`captures/${id}.png`))));
    return {layout, img: Object.fromEntries(ids.map((id, i) => [id, imgs[i]])) as Captures['img']};
  })();
  return cache;
}

export function useCaptures() {
  const [data, setData] = useState<Captures | null>(null);
  const [handle] = useState(() => delayRender('captures'));
  useEffect(() => { loadCaptures().then((d) => { setData(d); continueRender(handle); }); }, [handle]);
  return data;
}

/** 在某张截图的元素框里按 class（和可选文字）查找 */
export function box(layout: Layout, shot: ShotId, cls: string, text?: string): Box {
  const s = layout.shots.find((x) => x.id === shot);
  const b = s?.boxes.find((x) => x.cls.split(' ').includes(cls) && (text === undefined || x.text.includes(text)));
  if (!b) throw Error(`box not found: ${shot} .${cls} ${text ?? ''}`);
  return b;
}
export const shot = (layout: Layout, id: ShotId) => layout.shots.find((x) => x.id === id)!;

/** 等待字体加载完成再渲染（画布文字与叠加层都依赖它） */
export function useFonts(samples: string) {
  const [handle] = useState(() => delayRender('fonts'));
  useEffect(() => {
    Promise.all(['500', '700', '900'].map((w) => document.fonts.load(`${w} 40px "Noto Sans SC"`, samples)))
      .then(() => continueRender(handle));
  }, [handle, samples]);
}
