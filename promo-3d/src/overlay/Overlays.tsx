import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {C, FONT} from '../design';
import {E, STEPS, SCENE} from '../timeline';
import {ramp, ease, mix} from '../anim';

const shadow = '0 6px 30px rgba(0,0,0,0.45)';
const fadeInOut = (f: number, a: number, b: number, d = 8) => ramp(f, a, a + d) * (1 - ramp(f, b - d, b));

/** 顶部章节进度（参考片底部章节条，竖屏移到顶部避开小红书底栏） */
export const Progress: React.FC = () => {
  const f = useCurrentFrame();
  const vis = fadeInOut(f, SCENE.step1[0] + 4, SCENE.step3[1] - 2, 10);
  if (vis <= 0) return null;
  const cur = STEPS.findIndex((s) => f >= s.range[0] && f < s.range[1]);
  const s = STEPS[Math.max(0, cur)];
  return (
    <div style={{position: 'absolute', top: 132, left: 48, display: 'flex', alignItems: 'center', gap: 18, padding: '12px 26px', borderRadius: 999, background: 'rgba(18,16,14,0.78)', border: '1.5px solid rgba(255,255,255,0.10)', opacity: vis, fontFamily: FONT}}>
      <div style={{display: 'flex', gap: 8}}>
        {STEPS.map((x, i) => {
          const fill = i < cur ? 1 : i === cur ? ramp(f, x.range[0], x.range[1]) : 0;
          return <div key={i} style={{width: 64, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.18)', overflow: 'hidden'}}>
            <div style={{width: `${fill * 100}%`, height: '100%', background: x.color}} /></div>;
        })}
      </div>
      <span style={{color: '#f3ead8', fontSize: 30, fontWeight: 700, letterSpacing: 1}}>{s.n}/3 {s.title}</span>
    </div>
  );
};

/** 编号章节胶囊：① 第一步 · 选范围 + 副标题，整块深色底，叠在亮屏上也清楚。
 * 停留约 2 秒后缩小飞向顶部进度条并消失，操作过程中不遮挡手机屏幕。 */
export const ChapterPill: React.FC = () => {
  const f = useCurrentFrame();
  return <>{STEPS.map((s) => {
    const a = s.range[0], hold = a + 60, out = hold + 10; // 章节第一拍弹出，停一小节后飞走
    if (f < a || f >= out) return null;
    const pop = ramp(f, a, a + 8, ease.outBack);
    const leave = ramp(f, hold, out, ease.in);
    const op = ramp(f, a, a + 3) * (1 - leave);
    const y = mix(330, 140, leave), sc = mix(0.7, 1, pop) * mix(1, 0.4, leave);
    return (
      <div key={s.n} style={{position: 'absolute', top: y, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: op, transform: `scale(${sc})`, transformOrigin: '50% 0', fontFamily: FONT}}>
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '20px 44px 24px', borderRadius: 48, background: 'rgba(18,16,14,0.88)', border: '1.5px solid rgba(255,255,255,0.12)', boxShadow: shadow, backdropFilter: 'blur(8px)'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 22}}>
            <div style={{width: 64, height: 64, borderRadius: 32, background: s.color, color: '#fffcf5', fontSize: 38, fontWeight: 900, display: 'grid', placeItems: 'center'}}>{s.n}</div>
            <div style={{display: 'flex', flexDirection: 'column'}}>
              <span style={{color: s.color, fontSize: 24, fontWeight: 700, letterSpacing: 4, filter: 'brightness(1.35)'}}>{s.kicker}</span>
              <span style={{color: '#fffcf5', fontSize: 52, fontWeight: 900, letterSpacing: 2, lineHeight: 1.15}}>{s.title}</span>
            </div>
          </div>
          <div style={{color: '#e8dcc4', fontSize: 30, fontWeight: 500, letterSpacing: 2, opacity: ramp(f, a + 8, a + 18)}}>{s.sub}</div>
        </div>
      </div>
    );
  })}</>;
};

/** S2 标题卡：仿「OVERLAY / STUDIO」的斜杠拆字 */
export const TitleCard: React.FC = () => {
  const f = useCurrentFrame();
  const v = fadeInOut(f, E.titleIn, E.titleOut, 10);
  if (v <= 0) return null;
  const chars = ['猜', '/', '地', '图'];
  return (
    <div style={{position: 'absolute', top: 1000, left: 0, right: 0, textAlign: 'center', opacity: v, fontFamily: FONT}}>
      <div style={{display: 'flex', justifyContent: 'center', gap: 30}}>
        {chars.map((c, i) => {
          const t = ramp(f, E.titleIn + i * 3, E.titleIn + 14 + i * 3, ease.out);
          return <span key={i} style={{fontSize: 168, fontWeight: 900, color: c === '/' ? C.accent : '#fffcf5', transform: `translateY(${(1 - t) * 60}px)`, opacity: t, textShadow: shadow, display: 'inline-block', letterSpacing: 4}}>{c}</span>;
        })}
      </div>
      <div style={{marginTop: 6, fontSize: 64, fontWeight: 900, color: '#fffcf5', letterSpacing: 16, opacity: ramp(f, E.titleIn + 15, E.titleIn + 20), transform: `scale(${mix(1.25, 1, ramp(f, E.titleIn + 15, E.titleIn + 21, ease.out))})`, textShadow: shadow}}>3 步上手玩</div>
      <div style={{marginTop: 22, fontSize: 32, fontWeight: 500, color: '#e8dcc4', letterSpacing: 6, opacity: ramp(f, E.titleIn + 30, E.titleIn + 36), textShadow: shadow}}>
        看轮廓 <span style={{color: C.accent}}>·</span> 四选一 <span style={{color: C.accent}}>·</span> 不赶时间</div>
    </div>
  );
};

/** S4 答对时的大号反馈 */
export const PlusOne: React.FC = () => {
  const f = useCurrentFrame();
  const v = fadeInOut(f, E.tapRight, E.tapRight + 34, 4);
  if (v <= 0) return null;
  const pop = ramp(f, E.tapRight, E.tapRight + 8, ease.outBack);
  return (
    <div style={{position: 'absolute', top: 1180, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: v, transform: `translateY(${(1 - pop) * 30}px) scale(${mix(0.6, 1, pop)})`, fontFamily: FONT}}>
      <div style={{padding: '14px 36px', borderRadius: 999, background: C.right, color: '#fffcf5', fontSize: 50, fontWeight: 900, boxShadow: shadow, letterSpacing: 2}}>认出来了！<span style={{color: '#ffd48a'}}>+1</span></div>
    </div>
  );
};

/** S6 片尾：字标 + 邀请 */
export const EndCard: React.FC = () => {
  const f = useCurrentFrame();
  if (f < E.endIn) return null;
  const t = (d: number) => ramp(f, E.endIn + d, E.endIn + d + 10, ease.out); // 各行按 8 分音符依次出现
  return (
    <div style={{position: 'absolute', top: 300, left: 0, right: 0, textAlign: 'center', fontFamily: FONT}}>
      <div style={{fontSize: 210, fontWeight: 900, color: '#fffcf5', letterSpacing: 10, opacity: t(0), transform: `translateY(${(1 - t(0)) * 50}px)`, textShadow: shadow}}>猜地图</div>
      <div style={{width: 120, height: 8, borderRadius: 4, background: C.accent, margin: '18px auto 0', transform: `scaleX(${t(8)})`}} />
      <div style={{marginTop: 34, fontSize: 64, fontWeight: 900, color: '#fffcf5', letterSpacing: 6, opacity: t(15), textShadow: shadow}}>换你，亲自试一局？</div>
      <div style={{marginTop: 22, fontSize: 34, fontWeight: 500, color: '#e8dcc4', letterSpacing: 4, opacity: t(23), textShadow: shadow}}>笔记里的小工具，点开就玩</div>
    </div>
  );
};

/** 暗角，模拟镜头收光 */
export const Vignette: React.FC = () => (
  <AbsoluteFill style={{background: 'radial-gradient(ellipse 95% 80% at 50% 45%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.12) 60%, rgba(0,0,0,0.42) 100%)', pointerEvents: 'none'}} />
);

/** 小红书遮挡参考线（仅调试静帧使用，成片不显示） */
export const SafeGuides: React.FC = () => (
  <AbsoluteFill style={{pointerEvents: 'none'}}>
    <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 120, background: 'rgba(255,0,0,0.18)'}} />
    <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 1920 * 0.22, background: 'rgba(255,0,0,0.18)', borderTop: '3px dashed #ff5050'}} />
    <div style={{position: 'absolute', right: 0, bottom: 1920 * 0.22, width: 150, height: 560, background: 'rgba(255,0,0,0.18)', borderLeft: '3px dashed #ff5050'}} />
    <div style={{position: 'absolute', left: 16, bottom: 1920 * 0.22 + 10, color: '#ff8080', fontSize: 26, fontFamily: FONT}}>小红书标题/作者/互动栏遮挡区（估计）</div>
  </AbsoluteFill>
);
