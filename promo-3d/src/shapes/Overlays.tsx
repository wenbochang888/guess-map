import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {ramp, ease, mix} from '../anim';
import {STATIONS, TOTAL_PROVINCES, APPROVAL_NOTE, TEXT_TOP, WALL_GRID, SAFE, type Line, type Part, type GansuStation, type WallStation} from './timeline';

// 字幕画风（取样自参考片）：衬线宋体、奶油白 #F2E7D6；关键词蓝 #95C8EE / 朱红 #B95341 + 下划线；
// 叙述行 62px、结论行 104px（1080 宽竖屏）；左上角逐句出现，像旁白字幕。顶部从 y 240 开始（避开状态栏和顶部导航）。
export const SERIF = '"Noto Serif SC", "Songti SC", serif';
const CREAM = '#F2E7D6', BLUE = '#95C8EE', RED = '#C9604C', DIM = 'rgba(242,231,214,0.5)';
const glow = '0 2px 16px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.9)';
const KEY = {blue: BLUE, red: RED} as const;
const IN = 9; // 入场 9 帧（0.3 秒），先快后慢

// 卡点原则：画面的「落点」对准拍点那一帧，而不是在拍点才开始动（f2 实测：结论大字要 0.2 秒才砸到位、下划线晚 0.25–0.5 秒，
// 观众会觉得慢了半拍）。所以入场动画提前开始：结论行提前 4 帧加速砸下、正好在拍点落定；叙述行提前 3 帧浮出。
const LEAD_BIG = 4, LEAD_LINE = 3;
const leadOf = (l: Line) => (l.at <= 0 ? 0 : l.big ? LEAD_BIG : LEAD_LINE);

/** 关键词下划线：结论行在落定前 1 帧开始、4 帧后画完；叙述行跟着字浮出时画出 */
const PartView: React.FC<{p: Part; big?: boolean; u: number}> = ({p, big, u}) => {
  if (typeof p === 'string') return <>{p}</>;
  return (
    <span style={{position: 'relative', color: KEY[p.c], display: 'inline-block'}}>
      {p.k}
      <span style={{position: 'absolute', left: 0, right: 0, bottom: big ? -6 : -4, height: big ? 6 : 4, background: KEY[p.c], transformOrigin: '0 50%', transform: `scaleX(${u})`, borderRadius: 2}} />
    </span>
  );
};

/** 叙述行：从模糊里浮出（9 帧 ease-out，提前 3 帧开始）；
 *  结论行：盖章式从 1.4 倍加速砸下（4 帧 ease-in），在拍点那一帧落定，落定后轻轻一沉再回弹（5 帧） */
const LineView: React.FC<{l: Line; f: number}> = ({l, f}) => {
  let style: React.CSSProperties, u: number;
  if (l.at <= 0) {
    style = l.big ? {fontSize: 104, fontWeight: 900, lineHeight: 1.3, letterSpacing: 6, marginTop: 6} : {fontSize: 62, fontWeight: 700, lineHeight: 1.5, letterSpacing: 2};
    u = 1;
  } else if (l.big) {
    const t = ramp(f, l.at - LEAD_BIG, l.at, ease.in);
    const settle = f >= l.at ? 1 - 0.035 * Math.sin(Math.PI * Math.min(1, (f - l.at) / 5)) : 1;
    style = {fontSize: 104, fontWeight: 900, lineHeight: 1.3, letterSpacing: 6, marginTop: 6,
      transform: `scale(${mix(1.4, 1, t) * settle})`, filter: `blur(${(1 - t) * 6}px)`, opacity: ramp(f, l.at - LEAD_BIG, l.at - LEAD_BIG + 2)};
    u = ramp(f, l.at - 1, l.at + 4, ease.out);
  } else {
    const t = ramp(f, l.at - LEAD_LINE, l.at - LEAD_LINE + IN, ease.out);
    style = {fontSize: 62, fontWeight: 700, lineHeight: 1.5, letterSpacing: 2, transform: `translateY(${(1 - t) * 18}px)`, filter: `blur(${(1 - t) * 10}px)`, opacity: t};
    u = ramp(f, l.at, l.at + 6, ease.out);
  }
  return (
    <div style={{...style, color: CREAM, transformOrigin: '0 70%', textShadow: glow, whiteSpace: 'nowrap'}}>
      {l.parts.map((p, i) => <PartView key={i} p={p} big={l.big} u={u} />)}
    </div>
  );
};

/** 左上角字幕块：本站的句子按拍依次出现并累积；离站前整体上移淡出（6 帧） */
export const Subtitles: React.FC = () => {
  const f = useCurrentFrame();
  return <>{STATIONS.map((s, i) => {
    const last = i === STATIONS.length - 1; // 最后一站（片尾墙）不退场
    if (!s.lines.length || f < s.from - LEAD_LINE || (!last && f >= s.to - 2)) return null;
    const out = last ? 0 : ramp(f, s.to - 8, s.to - 2, ease.in);
    return (
      <div key={i} style={{position: 'absolute', top: TEXT_TOP, left: 72, right: 72, fontFamily: SERIF, opacity: 1 - out, transform: `translateY(${-out * 36}px)`, filter: `blur(${out * 6}px)`}}>
        {s.lines.filter((l) => f >= l.at - leadOf(l)).map((l, j) => <LineView key={j} l={l} f={f} />)}
      </div>
    );
  })}</>;
};

/** 右上角计数器：钩子段 0→31「省区市」（先快后慢）；之后「已画出 N / 31」，数字换时上滚，落定时下方一圈椭圆波纹扩散 */
export const Counter: React.FC = () => {
  const f = useCurrentFrame();
  const first = STATIONS[0].count!.at;
  let label: string, num: number, prev: number, changeAt: number, suffix: string;
  if (f < first - 3) {
    label = '省 区 市'; suffix = '个';
    num = Math.round(TOTAL_PROVINCES * ease.out(Math.min(1, f / 30))); prev = num; changeAt = 30;
  } else {
    const done = STATIONS.filter((s) => s.count && f >= s.count.at - 3);
    const cur = done[done.length - 1].count!;
    label = '已 画 出'; suffix = `/ ${TOTAL_PROVINCES}`;
    num = cur.n; prev = done.length > 1 ? done[done.length - 2].count!.n : 0; changeAt = cur.at;
  }
  const wall = STATIONS.find((x): x is WallStation => x.kind === 'wall');
  const gone = wall ? ramp(f, wall.from, wall.from + 6) : 0; // 片尾墙标题里已经有「剩下 16 个」，计数器让位
  if (gone >= 1) return null;
  const roll = f < first - 3 ? 1 : ramp(f, changeAt - 3, changeAt + 3, ease.out); // 数字在拍点那一帧基本滚到位
  const ring = ramp(f, changeAt, changeAt + 14, ease.out);
  return (
    <div style={{position: 'absolute', top: TEXT_TOP - 6, right: 72, textAlign: 'right', fontFamily: SERIF, color: CREAM, textShadow: glow, opacity: 1 - gone}}>
      <div style={{fontSize: 24, fontWeight: 700, letterSpacing: 4, color: DIM}}>{label}</div>
      <div style={{position: 'relative', display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 12}}>
        <div style={{position: 'relative', height: 120, overflow: 'hidden', fontSize: 108, fontWeight: 700, lineHeight: '120px', minWidth: 64}}>
          <div style={{transform: `translateY(${(1 - roll) * 120}px)`}}>{num}</div>
          {roll < 1 && <div style={{position: 'absolute', top: 0, right: 0, transform: `translateY(${-roll * 120}px)`, opacity: 1 - roll}}>{prev}</div>}
        </div>
        <div style={{fontSize: 36, fontWeight: 700, color: DIM}}>{suffix}</div>
        {ring > 0 && ring < 1 && <div style={{position: 'absolute', right: -10, bottom: -6, width: mix(120, 300, ring), height: mix(26, 64, ring),
          border: '2px solid rgba(242,231,214,0.8)', borderRadius: '50%', opacity: 1 - ring, transform: 'translateX(10%)'}} />}
      </div>
    </div>
  );
};

/** 底部脚注：只留「比喻仅供娱乐」（审图号按用户要求不上画面），放在底栏遮挡区上方；片尾墙那几秒让位给墙 */
export const Footnote: React.FC = () => {
  const f = useCurrentFrame();
  const wall = STATIONS.find((s): s is WallStation => s.kind === 'wall');
  if (wall && f >= wall.from) return null;
  return (
    <div style={{position: 'absolute', top: 1394, left: 72, fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: 'rgba(242,231,214,0.36)', letterSpacing: 2}}>
      {APPROVAL_NOTE}</div>
  );
};

/** 甘肃三选一：A/B/C 胶囊依次弹出（6 帧回弹），当前那个描边变蓝；整站结束前随字幕一起退场 */
export const Chips: React.FC = () => {
  const f = useCurrentFrame();
  const s = STATIONS.find((x): x is GansuStation => x.kind === 'gansu');
  if (!s || f < s.options[0].at || f >= s.to - 2) return null;
  const out = ramp(f, s.to - 8, s.to - 2, ease.in);
  const cur = [...s.options].reverse().find((o) => f >= o.at && f < s.clear);
  return <>{s.options.map((o, i) => {
    if (f < o.at) return null;
    const t = ramp(f, o.at - 3, o.at + 3, ease.outBack); // 胶囊在拍点那一帧弹到位
    const on = cur === o;
    return (
      <div key={o.letter} style={{position: 'absolute', top: 1290, left: 72 + i * 268, width: 250, height: 96, borderRadius: 48, boxSizing: 'border-box',
        border: `3px solid ${on ? BLUE : 'rgba(242,231,214,0.6)'}`, background: on ? 'rgba(149,200,238,0.12)' : 'rgba(13,10,12,0.35)',
        display: 'flex', alignItems: 'center', gap: 18, paddingLeft: 34, fontFamily: SERIF, color: CREAM, textShadow: glow,
        transform: `scale(${mix(0.6, 1, t)})`, opacity: Math.min(1, t * 2) * (1 - out)}}>
        <span style={{fontSize: 52, fontWeight: 900, color: BLUE}}>{o.letter}</span>
        <span style={{fontSize: 46, fontWeight: 700}}>{o.word}</span>
      </div>
    );
  })}</>;
};

/** 片尾墙最后一排空出来的 4 格里：「暂停截图，评论区交答案」（模糊浮出） */
export const WallCta: React.FC = () => {
  const f = useCurrentFrame();
  const s = STATIONS.find((x): x is WallStation => x.kind === 'wall');
  if (!s || f < s.cta) return null;
  const t = ease.out(ramp(f, s.cta, s.cta + IN));
  const {x0, y0, cw, ch} = WALL_GRID;
  return (
    <div style={{position: 'absolute', left: x0 + cw + 24, top: y0 + 6 * ch + ch / 2 - 34, fontFamily: SERIF, fontSize: 46, fontWeight: 700, color: CREAM, textShadow: glow,
      opacity: t, filter: `blur(${(1 - t) * 10}px)`, transform: `translateY(${(1 - t) * 18}px)`, whiteSpace: 'nowrap'}}>
      暂停截图，<span style={{color: BLUE}}>评论区交答案</span></div>
  );
};

/** 暗角：四周压暗，光集中在中间 */
export const Vignette: React.FC = () => (
  <AbsoluteFill style={{background: 'radial-gradient(ellipse 85% 70% at 50% 52%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.25) 70%, rgba(0,0,0,0.6) 100%)', pointerEvents: 'none'}} />
);

/** 胶片颗粒：每帧换一次的极淡噪点 */
export const Grain: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity: 0.06, mixBlendMode: 'overlay',
      backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='${f % 17}'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`}} />
  );
};

/** 检查用：手机遮挡区（红色斜线），只在 *Guides 合成里显示 */
export const SafeZones: React.FC = () => {
  const z: React.CSSProperties = {position: 'absolute', background: 'repeating-linear-gradient(45deg, rgba(255,70,60,0.28) 0 14px, rgba(255,70,60,0.1) 14px 28px)', outline: '3px dashed #ff5a4a', outlineOffset: -3};
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{...z, left: 0, right: 0, top: 0, height: SAFE.top}} />
      <div style={{...z, left: 0, right: 0, top: SAFE.bottom, bottom: 0}} />
      <div style={{...z, left: SAFE.rightX, right: 0, top: SAFE.rightTop, height: SAFE.bottom - SAFE.rightTop}} />
    </AbsoluteFill>
  );
};

export const FONT_SAMPLES = ['省区市已画出个/0123456789·ABC哑铃河马狗骨头暂停截图评论区交答案倒过来看?', APPROVAL_NOTE, '被咬掉的一口',
  ...STATIONS.flatMap((s) => s.lines.flatMap((l) => l.parts.map((p) => (typeof p === 'string' ? p : p.k))))].join('');
