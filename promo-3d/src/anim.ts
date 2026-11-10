export const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
export const ease = {
  linear: (t: number) => t,
  inOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t: number) => 1 - Math.pow(1 - t, 3),
  in: (t: number) => t * t * t,
  /** 快甩：起止极缓、中段极快（4 次方），配合运动模糊做「啪」地切过去 */
  snap: (t: number) => (t < 0.5 ? 8 * t ** 4 : 1 - 8 * (1 - t) ** 4),
  outBack: (t: number) => { const c = 1.70158, u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; },
};
export type Ease = (t: number) => number;
/** 区间 [a,b] 内的 0→1 进度 */
export const ramp = (f: number, a: number, b: number, e: Ease = ease.linear) => e(clamp01((f - a) / (b - a)));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const mixV = (a: readonly number[], b: readonly number[], t: number) => a.map((v, i) => mix(v, b[i], t));
/** 关键帧插值（数字或向量），段内用缓动 */
export function kf<T extends number | readonly number[]>(f: number, keys: readonly (readonly [number, T])[], e: Ease = ease.inOut): T {
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [f1, v1] = keys[i];
    if (f <= f1) {
      const [f0, v0] = keys[i - 1];
      const t = e((f - f0) / (f1 - f0));
      return (typeof v0 === 'number' ? mix(v0, v1 as number, t) : mixV(v0 as readonly number[], v1 as readonly number[], t)) as T;
    }
  }
  return keys[keys.length - 1][1];
}
/** 阻尼弹簧：t 帧后的衰减振荡，用于落地压扁与呆毛回弹 */
export const spring = (t: number, amp: number, k = 0.22, w = 0.55) => (t < 0 ? 0 : amp * Math.exp(-k * t) * Math.cos(w * t));
/** 确定性伪随机 */
export function rng(seed: number) { let x = seed >>> 0; return () => { x = (Math.imul(1664525, x) + 1013904223) >>> 0; return x / 4294967296; }; }
