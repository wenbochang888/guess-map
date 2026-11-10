type MiniToolMethod = (options?: Record<string, unknown>) => unknown;
export type MiniTool = Record<string, MiniToolMethod | undefined>;
type Data = Record<string, unknown>;

export interface PlatformError extends Error {
  errCode?: number;
  errMsg: string;
}

export function asRecord(value: unknown): Data | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Data)
    : undefined;
}

export function platformError(value: unknown): PlatformError {
  const data = asRecord(value);
  const message = typeof data?.errMsg === 'string'
    ? data.errMsg
    : value instanceof Error ? value.message : '平台调用失败';
  const error = new Error(message) as PlatformError;
  error.errMsg = message;
  if (typeof data?.errCode === 'number' && Number.isInteger(data.errCode)) {
    error.errCode = data.errCode;
  }
  return error;
}

function getHost(): { miniTool?: MiniTool; launchOptions?: unknown } | undefined {
  try {
    if (typeof window === 'undefined') return undefined;
    return (window as unknown as { xhs?: { miniTool?: MiniTool; launchOptions?: unknown } }).xhs;
  } catch {
    return undefined;
  }
}

export function getMiniTool(): MiniTool | undefined {
  return getHost()?.miniTool;
}

// SDK 的 Promise 模式：不传 success/fail/complete。超时只结束本地等待，不能取消端上操作。
export function callMiniTool(
  tool: MiniTool,
  method: string,
  options?: Record<string, unknown>,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(platformError(new Error(`${method}: bridge timeout`))), 5_000);
    const fail = (error: unknown) => {
      clearTimeout(timer);
      reject(platformError(error));
    };
    try {
      const fn = tool[method];
      if (typeof fn !== 'function') throw new Error(`${method}: API unavailable`);
      const result = options === undefined ? fn.call(tool) : fn.call(tool, options);
      Promise.resolve(result).then((value) => {
        clearTimeout(timer);
        const data = asRecord(value);
        if ((typeof data?.errCode === 'number' && data.errCode !== 0)
          || (typeof data?.errMsg === 'string' && /:fail\b/.test(data.errMsg))) {
          fail(value);
        } else {
          resolve(value);
        }
      }, fail);
    } catch (error) {
      fail(error);
    }
  });
}

function versionFrom(options: unknown): number {
  const build = Number(asRecord(asRecord(options)?.miniToolEnv)?.buildVersion);
  return Number.isFinite(build) && build > 0 ? Math.floor(build / 1_000) : 0;
}

// 返回 9510 这样的客户端比较值；0 表示未知，不等于明确的低版本。
export async function getVersion(): Promise<number> {
  const host = getHost();
  const sync = versionFrom(host?.launchOptions);
  if (sync) return sync;
  const tool = host?.miniTool;
  if (typeof tool?.getLaunchOptions !== 'function') return 0;
  try {
    return versionFrom(await callMiniTool(tool, 'getLaunchOptions'));
  } catch {
    return 0;
  }
}

let windowRequest = 0;
export async function updateWindowInsets(): Promise<void> {
  const request = ++windowRequest;
  const root = typeof document !== 'undefined' ? document.documentElement : typeof window !== 'undefined' ? window.document?.documentElement : undefined;
  const tool = getMiniTool();
  if (!root) return;
  if (typeof window !== 'undefined' && window.innerHeight > 0) root.style.setProperty('--app-height', `${window.innerHeight}px`);
  if (tool) root.classList?.add('xhs-host');
  if (typeof tool?.getWindowInfo !== 'function') return;
  const version = await getVersion();
  if (version && version < 9490) return;
  try {
    const info = asRecord(await callMiniTool(tool, 'getWindowInfo'));
    if (!info || request !== windowRequest) return;
    const width = info.windowWidth, height = info.windowHeight;
    if (typeof width !== 'number' || !Number.isFinite(width) || width <= 0
      || typeof height !== 'number' || !Number.isFinite(height) || height <= 0) return;
    const sx = typeof window.innerWidth === 'number' && window.innerWidth > 0 ? window.innerWidth / width : 1;
    const sy = typeof window.innerHeight === 'number' && window.innerHeight > 0 ? window.innerHeight / height : 1;
    const coordinate = (value: unknown, max: number): number | undefined =>
      typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(max, value)) : undefined;
    const safe = asRecord(info.safeArea);
    let safeTop = 0;
    if (safe) {
      const top = coordinate(safe.top, height), bottom = coordinate(safe.bottom, height);
      const left = coordinate(safe.left, width), right = coordinate(safe.right, width);
      if (top === undefined || bottom === undefined || left === undefined || right === undefined || top > bottom || left > right) return;
      safeTop = top * sy;
      for (const [side, value] of Object.entries({ top: safeTop, bottom: (height - bottom) * sy, left: left * sx, right: (width - right) * sx })) {
        root.style.setProperty(`--safe-area-inset-${side}`, `${value}px`);
        root.style.setProperty(`--safe-${side}`, `${value}px`);
      }
      root.style.setProperty('--page-bottom', `${(height - bottom) * sy}px`);
    }
    const menus = asRecord(info.menuButtons);
    let menuBottom = 0;
    for (const rect of Object.values(menus || {})) {
      const r = asRecord(rect);
      if (!r || typeof r.top !== 'number' || r.top >= height || typeof r.bottom !== 'number' || r.bottom <= 0) continue;
      menuBottom = Math.max(menuBottom, Math.min(height, r.bottom) * sy + 4);
    }
    // 菜单矩形与 safeArea 都是容器坐标；只选有效边界，不能再次相加。
    root.style.setProperty('--page-top', `${menuBottom || safeTop}px`);
  } catch {
    // 保留已有安全区和低版本回退值。
  }
}

export function vibrate(): void {
  void (async () => {
    const tool = getMiniTool();
    if (typeof tool?.vibrateShort !== 'function') return;
    const version = await getVersion();
    if (version && version < 9500) return;
    await callMiniTool(tool, 'vibrateShort', { type: 'light' });
  })().catch(() => { /* 触感失败不影响游戏。 */ });
}

export async function canShare(): Promise<boolean> {
  if (typeof getMiniTool()?.share !== 'function') return false;
  const version = await getVersion();
  return version === 0 || version >= 9530;
}

// 由全屏小工具的用户点击触发；不调用 Web Fullscreen，也不伪造宿主场景。
export async function shareCard(): Promise<void> {
  if (!await canShare()) throw platformError(new Error('share: API unavailable'));
  const tool = getMiniTool();
  if (!tool) throw platformError(new Error('share: host unavailable'));
  await callMiniTool(tool, 'share', { type: 'card' });
}
