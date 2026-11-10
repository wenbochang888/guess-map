import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { createLeaderboard } from '../src/platform/leaderboard';
import { BESTS_STORAGE_KEY, readBests, saveBest } from '../src/platform/storage';
import { canShare, getVersion, shareCard, updateWindowInsets, vibrate } from '../src/platform/xhs';
import type { MyRank, Period } from '../src/platform/types';

type Method = (options?: Record<string, unknown>) => unknown;
type Tool = Record<string, Method | undefined>;
const exact: MyRank = { status: 'EXACT', rank: 1, score: 42 };
const rows = [{ rank: 1, score: 42, nickname: '玩家' }];
const descriptors = new Map<string, PropertyDescriptor | undefined>();
beforeEach(() => {
  for (const key of ['window', 'localStorage']) descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
});
afterEach(() => {
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

function setGlobal(key: string, value: unknown): void {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}
function host(tool: Tool, buildVersion: number | undefined = 9510000): Record<string, any> {
  const win = { xhs: { miniTool: tool, launchOptions: { miniToolEnv: { buildVersion } } } };
  setGlobal('window', win);
  return win;
}
function fixture(overrides: Tool = {}, version = 9510000) {
  const calls: { method: string; options?: Record<string, unknown> }[] = [];
  const defaults: Tool = {
    getMyRank: async () => ({ ...exact }),
    getRankList: async () => ({ data: rows.map((row) => ({ ...row })) }),
    submitScore: async (options) => ({ score: options!.score }),
    ...overrides,
  };
  const tool: Tool = {};
  for (const [method, fn] of Object.entries(defaults)) {
    tool[method] = fn && ((options) => {
      calls.push({ method, options });
      assert.ok(!options || !['success', 'fail', 'complete'].some((key) => key in options));
      return fn(options);
    });
  }
  const win = host(tool, version);
  return { calls, tool, win, service: createLeaderboard(true) };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
async function flush(): Promise<void> {
  for (let i = 0; i < 40; i++) await Promise.resolve();
}
function code(expected: number) {
  return (error: unknown) => error instanceof Error && (error as Error & { errCode?: number }).errCode === expected;
}
function browserStorage(initial: string | null = null) {
  let data = initial;
  let writes = 0;
  const storage = {
    getItem(key: string) { assert.equal(key, BESTS_STORAGE_KEY); return data; },
    setItem(key: string, value: string) { assert.equal(key, BESTS_STORAGE_KEY); writes++; data = value; },
  };
  return { storage, get data() { return data; }, get writes() { return writes; } };
}

test('版本同步优先、异步回退、去掉构建尾三位；无宿主/失败为未知', async () => {
  let calls = 0;
  const win = host({ getLaunchOptions: async () => { calls++; return { miniToolEnv: { buildVersion: 9532004 } }; } }, 9462004);
  assert.equal(await getVersion(), 9462);
  assert.equal(calls, 0);
  win.xhs.launchOptions = {};
  assert.equal(await getVersion(), 9532);
  win.xhs.miniTool.getLaunchOptions = async () => { throw new Error('offline'); };
  assert.equal(await getVersion(), 0);
  setGlobal('window', undefined);
  assert.equal(await getVersion(), 0);
});

test('窗口安全区按逻辑像素转换为边距，不除以 DPR，非法值不覆盖 CSS', async () => {
  const styles = new Map<string, string>();
  const win = host({ getWindowInfo: async () => ({
    windowWidth: 390, windowHeight: 844, pixelRatio: 3,
    safeArea: { top: 24, bottom: 810, left: -5, right: 500 },
  }) }, 9490000);
  win.document = { documentElement: { style: { setProperty: (key: string, value: string) => styles.set(key, value) } } };
  await updateWindowInsets();
  assert.equal(styles.get('--safe-area-inset-top'), '24px');
  assert.equal(styles.get('--safe-area-inset-bottom'), '34px');
  assert.equal(styles.get('--safe-top'), '24px');
  assert.equal(styles.get('--safe-right'), '0px');
  win.xhs.miniTool.getWindowInfo = async () => ({ windowWidth: 390, windowHeight: 844, safeArea: { top: NaN } });
  await updateWindowInsets();
  assert.equal(styles.get('--safe-top'), '24px');
});

test('震动 light、分享 card，明确低版本不调用，错误不会产生未处理震动拒绝', async () => {
  const calls: unknown[] = [];
  const win = host({
    vibrateShort: async (options) => { calls.push(options); throw new Error('no haptics'); },
    share: async (options) => { calls.push(options); },
  }, 9530000);
  assert.equal(vibrate(), undefined);
  await flush();
  assert.equal(await canShare(), true);
  await shareCard();
  assert.deepEqual(calls, [{ type: 'light' }, { type: 'card' }]);
  win.xhs.launchOptions.miniToolEnv.buildVersion = 9480000;
  vibrate();
  await flush();
  assert.equal(await canShare(), false);
  await assert.rejects(shareCard(), /unavailable/);
  assert.equal(calls.length, 2);
});

test('配置 false 零 API 调用；明确低版本和缺方法隐藏', async () => {
  const { calls } = fixture({ getLaunchOptions: async () => { throw new Error('must not call'); } });
  const disabled = createLeaderboard(false);
  await disabled.probe();
  await disabled.submit('country-medium', 0, 'disabled');
  await assert.rejects(disabled.load('country-medium', 'day'), /unavailable/);
  assert.equal(disabled.availability, 'unavailable');
  assert.deepEqual(calls, []);
  const low = fixture({}, 9509999);
  await low.service.probe();
  assert.equal(low.service.availability, 'unavailable');
  assert.deepEqual(low.calls, []);
  const missing = fixture({ submitScore: undefined }, 0);
  await missing.service.probe();
  assert.equal(missing.service.availability, 'unavailable');
  assert.deepEqual(missing.calls, []);
});

test('未知版本方法齐全可尝试；probe 只读 board1/day 并去重，不提交假分', async () => {
  const pending = deferred<unknown>();
  const { service, calls } = fixture({ getMyRank: () => pending.promise }, 0);
  assert.equal(service.availability, 'unknown');
  const first = service.probe();
  const second = service.probe();
  assert.equal(first, second);
  await flush();
  assert.deepEqual(calls, [{ method: 'getMyRank', options: { board: 1, period: 'day' } }]);
  assert.equal(service.availability, 'unknown');
  pending.resolve({ status: 'NOT_PARTICIPATING', rank: null, score: null });
  await first;
  assert.equal(service.availability, 'available');
});

test('probe 暂时失败保留 unknown，稍后显式 probe 可恢复且没有隐式重试', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_800_000_000_000 });
  let failed = true;
  const { service, calls } = fixture({ getMyRank: async () => {
    if (failed) throw { errMsg: 'getMyRank:fail unavailable', errCode: 2008 };
    return exact;
  } });
  await service.probe();
  assert.equal(service.availability, 'unknown');
  await service.probe();
  assert.equal(calls.length, 1);
  failed = false;
  t.mock.timers.tick(1_000);
  await service.probe();
  assert.equal(service.availability, 'available');
  assert.equal(calls.length, 2);
});

for (const errCode of [1005, 10003]) {
  test(`未授权 ${errCode}：probe/load/submit 均隐藏，load 抛标准 Error 并保留 errCode`, async () => {
    for (const method of ['probe', 'load', 'submit'] as const) {
      const failure = async () => { throw { errMsg: 'denied', errCode }; };
      const { service, calls } = fixture({ getMyRank: failure, getRankList: failure, submitScore: failure });
      if (method === 'probe') await service.probe();
      else if (method === 'load') await assert.rejects(service.load('china-provinces', 'week'), code(errCode));
      else await assert.rejects(service.submit('china-provinces', 0, 'auth'), code(errCode));
      assert.equal(service.availability, 'unavailable');
      const count = calls.length;
      await service.probe();
      await service.submit('country-medium', 10, 'later');
      await assert.rejects(service.load('country-medium', 'all'));
      assert.equal(calls.length, count);
    }
  });
}

test('load board 映射、周期透传、30 秒缓存、同请求去重和缓存防外部修改', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_800_000_000_000 });
  const { service, calls } = fixture();
  const [a, b] = await Promise.all([service.load('country-medium', 'day'), service.load('country-medium', 'day')]);
  assert.equal(calls.length, 2);
  assert.deepEqual(a, { entries: rows, mine: exact });
  a.entries[0]!.nickname = '修改';
  a.mine.rank = 50;
  assert.equal(b.entries[0]!.nickname, '玩家');
  assert.equal((await service.load('country-medium', 'day')).mine.rank, 1);
  await service.load('country-medium', 'day', true);
  assert.equal(calls.length, 2);
  t.mock.timers.tick(1_000);
  await service.load('country-medium', 'day', true);
  assert.equal(calls.length, 4);
  t.mock.timers.tick(29_999);
  await service.load('country-medium', 'day');
  assert.equal(calls.length, 4);
  t.mock.timers.tick(1);
  await service.load('country-medium', 'day');
  assert.equal(calls.length, 6);
  await service.load('china-provinces', 'week');
  await service.load('china-provinces', 'all');
  assert.deepEqual(calls.slice(6).map((call) => call.options), [
    { board: 5, period: 'week' }, { board: 5, period: 'week' },
    { board: 5, period: 'all' }, { board: 5, period: 'all' },
  ]);
});

test('北京时间周一零点清缓存（不等设备本地零点、不等 TTL）', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.UTC(2026, 10, 1, 15, 59, 59, 900) });
  const { service, calls } = fixture();
  await service.load('country-medium', 'day');
  await service.load('china-provinces', 'week');
  t.mock.timers.tick(200);
  await service.load('country-medium', 'day');
  await service.load('china-provinces', 'week');
  assert.equal(calls.length, 8);
});

test('跨北京时间日界的旧在途结果不会成为新周期缓存', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.UTC(2026, 10, 1, 15, 59, 59, 900) });
  const pending = deferred<unknown>();
  let count = 0;
  const { service } = fixture({ getRankList: () => ++count === 1 ? pending.promise : Promise.resolve({ data: [] }) });
  const old = service.load('country-medium', 'day');
  await flush();
  t.mock.timers.tick(200);
  const current = await service.load('country-medium', 'day');
  pending.resolve({ data: rows });
  await old;
  assert.deepEqual(current.entries, []);
  assert.deepEqual((await service.load('country-medium', 'day')).entries, []);
  assert.equal(count, 2);
});

for (const status of ['EXACT', 'OVER_LIMIT', 'NO_SCORE', 'NOT_PARTICIPATING'] as const) {
  test(`本人状态 ${status} 精确保留，不把榜外/未参与伪装为零分`, async () => {
    const mine = status === 'EXACT' ? { status, rank: 500, score: 0 } : { status, rank: null, score: null };
    const { service } = fixture({ getMyRank: async () => mine, getRankList: async () => ({ data: [] }) });
    assert.deepEqual(await service.load('country-medium', 'all'), { entries: [], mine });
    assert.equal(service.availability, 'available');
  });
}

for (const invalid of [undefined, {}, { data: null }, { data: {} }, { data: [null] },
  { data: [{ rank: 1, score: NaN, nickname: null }] },
  { data: [{ rank: 0, score: 0, nickname: null }] },
  { data: [{ rank: 1, score: 0 }] },
  { data: [{ rank: 1, score: 0, nickname: 2 }] },
  { data: [rows[0], rows[0]] }]) {
  test(`非法 getRankList 响应必须抛错而不是空榜：${JSON.stringify(invalid)}`, async () => {
    const { service } = fixture({ getRankList: async () => invalid });
    await assert.rejects(service.load('country-medium', 'day'), /getRankList: invalid response/);
    assert.equal(service.availability, 'unknown');
  });
}

test('非法本人状态/空值不默默归类；字符串错误码不当作授权码', async () => {
  for (const mine of [{ status: 'UNKNOWN', rank: null, score: null },
    { status: 'OVER_LIMIT', rank: 501, score: 10 }, { status: 'EXACT', rank: 0, score: 0 }]) {
    const { service } = fixture({ getMyRank: async () => mine });
    await assert.rejects(service.load('country-medium', 'day'), /invalid response/);
  }
  const { service } = fixture({ getMyRank: async () => { throw { errMsg: 'fail', errCode: '1005' }; } });
  await service.probe();
  assert.equal(service.availability, 'unknown');
});

test('读取 2002 仅以 500ms/1s 退避两次，之后成功', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_800_000_000_000 });
  let attempts = 0;
  const { service } = fixture({ getRankList: async () => {
    if (++attempts < 3) throw { errMsg: 'not ready', errCode: 2002 };
    return { data: rows };
  } });
  const result = service.load('country-medium', 'day');
  await flush();
  assert.equal(attempts, 1);
  t.mock.timers.tick(499);
  await flush();
  assert.equal(attempts, 1);
  t.mock.timers.tick(1);
  await flush();
  assert.equal(attempts, 2);
  t.mock.timers.tick(999);
  await flush();
  assert.equal(attempts, 2);
  t.mock.timers.tick(1);
  assert.deepEqual((await result).entries, rows);
  assert.equal(attempts, 3);
});

test('2002 耗尽仍抛原码且 force 不能立刻再触发重试', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_800_000_000_000 });
  let attempts = 0;
  const { service } = fixture({ getRankList: async () => { attempts++; throw { errMsg: 'not ready', errCode: 2002 }; } });
  const checked = assert.rejects(service.load('country-medium', 'day'), code(2002));
  await flush();
  t.mock.timers.tick(500);
  await flush();
  t.mock.timers.tick(1_000);
  await checked;
  await assert.rejects(service.load('country-medium', 'day', true), code(2002));
  assert.equal(attempts, 3);
  assert.equal(service.availability, 'unknown');
});

test('2009 限频不永久关闭，force/切模式/probe 不能绕过 30 秒冷却', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_800_000_000_000 });
  let limited = true;
  const { service, calls } = fixture({ getRankList: async () => {
    if (limited) return { errMsg: 'getRankList:fail rate limit', errCode: 2009 };
    return { data: [] };
  } });
  await assert.rejects(service.load('country-medium', 'day'), code(2009));
  const count = calls.length;
  for (let i = 0; i < 5; i++) await assert.rejects(service.load('china-provinces', 'week', true), code(2009));
  await service.probe();
  assert.equal(calls.length, count);
  assert.equal(service.availability, 'unknown');
  limited = false;
  t.mock.timers.tick(30_000);
  await service.load('country-medium', 'day');
  assert.equal(service.availability, 'available');
});

test('读桥接 5 秒超时，不重试无 code 错误，迟到响应不填缓存', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_800_000_000_000 });
  const pending = deferred<unknown>();
  const { service, calls } = fixture({ getRankList: () => pending.promise });
  const checked = assert.rejects(service.load('country-medium', 'day'), (error: unknown) =>
    error instanceof Error && /timeout/.test(error.message) && !('errCode' in error));
  await flush();
  t.mock.timers.tick(5_000);
  await checked;
  assert.equal(calls.filter((call) => call.method === 'getRankList').length, 1);
  pending.resolve({ data: rows });
  await flush();
  await assert.rejects(service.load('country-medium', 'day', true), /timeout/);
});

test('submit 每 runId 一次，真实 0 原值提交，提交成功不等于读取权限可用', async () => {
  const { service, calls } = fixture();
  const first = service.submit('china-provinces', 0, 'run-zero');
  assert.equal(first, service.submit('china-provinces', 0, 'run-zero'));
  await first;
  await service.submit('china-provinces', 0, 'run-zero');
  assert.equal(service.availability, 'unknown');
  assert.deepEqual(calls, [{ method: 'submitScore', options: { board: 5, score: 0 } }]);
  for (const score of [-1, 0.5, NaN, Infinity, 1_000_001]) {
    await assert.rejects(service.submit('country-medium', score, `invalid-${score}`), code(10001));
  }
  await assert.rejects(service.submit('country-medium', 10, ''), code(10001));
  assert.equal(calls.length, 1);
});

for (const errCode of [undefined, 2002, 2004, 2009, 2999]) {
  test(`提交失败 ${errCode ?? '无 code'} 不自动重发，同 runId 不重放`, async () => {
    const { service, calls } = fixture({ submitScore: async () => { throw { errMsg: 'unknown result', errCode }; } });
    const first = service.submit('country-medium', 123, 'once');
    await assert.rejects(first, /unknown result/);
    assert.equal(service.submit('country-medium', 123, 'once'), first);
    await assert.rejects(service.submit('country-medium', 999, 'once'));
    assert.equal(calls.length, 1);
    assert.equal(service.availability, 'unknown');
  });
}

test('提交 5 秒超时不重发旧成绩，即使之后收到成功响应', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_800_000_000_000 });
  const pending = deferred<unknown>();
  const { service, calls } = fixture({ submitScore: () => pending.promise });
  const checked = assert.rejects(service.submit('country-medium', 7, 'timeout'), /timeout/);
  await flush();
  t.mock.timers.tick(5_000);
  await checked;
  pending.resolve({ score: 7 });
  await flush();
  await assert.rejects(service.submit('country-medium', 7, 'timeout'), /timeout/);
  assert.equal(calls.length, 1);
});

test('提交成功清本模式全部周期缓存，保留另一模式缓存', async () => {
  const { service, calls } = fixture();
  for (const period of ['day', 'week', 'all'] as Period[]) await service.load('country-medium', period);
  await service.load('china-provinces', 'day');
  await service.submit('country-medium', 100, 'new');
  await service.load('china-provinces', 'day');
  assert.equal(calls.length, 9);
  for (const period of ['day', 'week', 'all'] as Period[]) await service.load('country-medium', period);
  assert.equal(calls.length, 15);
});

test('提交后旧在途读取不重新污染缓存，也不被新 load 去重复用', async () => {
  const pending = deferred<unknown>();
  let lists = 0;
  const { service } = fixture({ getRankList: () => ++lists === 1 ? pending.promise : Promise.resolve({ data: [] }) });
  const old = service.load('country-medium', 'day');
  await flush();
  await service.submit('country-medium', 100, 'new');
  const fresh = await service.load('country-medium', 'day');
  pending.resolve({ data: rows });
  await old;
  assert.deepEqual(fresh.entries, []);
  assert.deepEqual((await service.load('country-medium', 'day')).entries, []);
  assert.equal(lists, 2);
});

test('本地存储 9.46+ 优先，延迟读取与多模式高分更新共用单队列', async () => {
  const firstRead = deferred<unknown>();
  let data = JSON.stringify({ 'countries:medium': 10, 'cities:all': 5 });
  let reads = 0;
  const keys = new Set<unknown>();
  host({
    getStorage: async (options) => {
      keys.add(options!.key);
      if (++reads === 1) return firstRead.promise;
      return { data };
    },
    setStorage: async (options) => { keys.add(options!.key); data = options!.data as string; },
  }, 9460000);
  const browser = browserStorage();
  setGlobal('localStorage', browser.storage);
  const stale = readBests();
  const high = saveBest('countries:medium', 100);
  const lower = saveBest('countries:medium', 50);
  const city = saveBest('cities:all', 30);
  await flush();
  assert.equal(reads, 1);
  firstRead.resolve({ data });
  assert.deepEqual(await stale, { 'countries:medium': 10, 'cities:all': 5 });
  assert.deepEqual(await Promise.all([high, lower, city]), [true, true, true]);
  assert.deepEqual(await readBests(), { 'countries:medium': 100, 'cities:all': 30 });
  assert.deepEqual([...keys], [BESTS_STORAGE_KEY]);
  assert.equal(browser.writes, 0);
  assert.equal(browser.data, null);
});

test('无宿主/低版本浏览器 fallback；低分不覆盖高分，数据损坏和禁用存储安全处理', async () => {
  const browser = browserStorage(JSON.stringify({ 'countries:medium': 40, 'cities:all': 0 }));
  setGlobal('window', { localStorage: browser.storage });
  assert.equal(await saveBest('countries:medium', 10), true);
  assert.equal(browser.writes, 0);
  assert.equal(await saveBest('cities:all', 25), true);
  assert.deepEqual(await readBests(), { 'countries:medium': 40, 'cities:all': 25 });
  const win = host({ getStorage: async () => { throw new Error('must not call'); } }, 9459000);
  win.localStorage = browser.storage;
  assert.equal(await saveBest('countries:medium', 50), true);
  assert.equal(browser.writes, 2);
  setGlobal('window', { localStorage: { getItem: () => '{invalid', setItem: () => { throw new Error('denied'); } } });
  assert.deepEqual(await readBests(), {});
  assert.equal(await saveBest('countries:medium', 99), false);
  setGlobal('window', {});
  Object.defineProperty((globalThis as any).window, 'localStorage', { get() { throw new Error('SecurityError'); } });
  assert.equal(await saveBest('countries:medium', 99), false);
  assert.deepEqual(await readBests(), {});
});

test('平台读/写失败不偷偷 fallback，读失败不覆写；队列失败不阻塞后续操作', async () => {
  const browser = browserStorage(JSON.stringify({ 'countries:medium': 900, 'cities:all': 0 }));
  setGlobal('localStorage', browser.storage);
  let readsFail = true;
  let writesFail = true;
  let writes = 0;
  let data = JSON.stringify({ 'countries:medium': 100, 'cities:all': 0 });
  host({
    getStorage: async () => {
      if (readsFail) throw { errMsg: 'read failed', errCode: 2001 };
      return { data };
    },
    setStorage: async (options) => {
      writes++;
      if (writesFail) throw new Error('write failed');
      data = options!.data as string;
    },
  });
  assert.deepEqual(await readBests(), {});
  assert.equal(await saveBest('countries:medium', 200), false);
  assert.equal(writes, 0);
  readsFail = false;
  assert.equal(await saveBest('countries:medium', 200), false);
  writesFail = false;
  assert.equal(await saveBest('countries:medium', 300), true);
  assert.deepEqual(await readBests(), { 'countries:medium': 300, 'cities:all': 0 });
  assert.equal(browser.writes, 0);
  assert.equal(browser.data, JSON.stringify({ 'countries:medium': 900, 'cities:all': 0 }));
});

test('未知版本有宿主仍使用端存储，非法本地分数不调用平台', async () => {
  let count = 0;
  host({
    getStorage: async () => { count++; return { data: null }; },
    setStorage: async () => { count++; },
  }, 0);
  assert.equal(await saveBest('cities:all', 1), true);
  assert.equal(count, 2);
  for (const score of [-1, NaN, Infinity, 1.5, 1_000_001]) assert.equal(await saveBest('countries:medium', score), false);
  assert.equal(await saveBest('bad' as import('../src/game/options').BoardKey, 1), false);
  assert.equal(count, 2);
});


test('窗口避让可见菜单，逻辑尺寸归一化一次，不重复加状态栏', async () => {
 const styles = new Map<string,string>();
 const win = host({getWindowInfo:async()=>({windowWidth:390,windowHeight:844,pixelRatio:3,statusBarHeight:24,safeArea:{top:60,left:0,right:390,bottom:824},menuButtons:{back:{top:12,bottom:48},me:null,share:{top:12,bottom:48}}})},9490000);
 win.innerWidth=780;win.innerHeight=1688;
 win.document={documentElement:{style:{setProperty:(key:string,value:string)=>styles.set(key,value)}}};
 await updateWindowInsets();
 assert.equal(styles.get('--page-top'),'100px');
 assert.equal(styles.get('--page-bottom'),'40px');
 assert.equal(styles.get('--safe-area-inset-top'),'120px');
});

test('四榜各自缓存和revision，清简单榜不影响中等/困难/中国；runId不能换榜换分', async () => {
 const {service,calls}=fixture();
 const boards=['country-easy','country-medium','country-hard','china-provinces'] as const;
 for(const b of boards)await service.load(b,'day');
 assert.deepEqual(calls.filter(c=>c.method==='getRankList').map(c=>c.options!.board),[1,2,3,5]);
 const count=calls.length;await service.submit('country-easy',2,'four-boards');
 await assert.rejects(service.submit('country-medium',2,'four-boards'),code(10001));
 await assert.rejects(service.submit('country-easy',3,'four-boards'),code(10001));
 for(const b of boards)await service.load(b,'day');
 assert.equal(calls.length,count+3);
});
test('新版记录不把旧mode字段迁入新口径；各难度和地区最佳隔离', async () => {
 setGlobal('window',undefined);const store=browserStorage(JSON.stringify({countries:90,cities:20}));setGlobal('localStorage',store.storage);
 assert.deepEqual(await readBests(),{});
 await saveBest('countries:easy',7);await saveBest('countries:hard',2);await saveBest('cities:all',5);await saveBest('cities:440000',4);await saveBest('cities:110000',1);
 assert.deepEqual(await readBests(),{'countries:easy':7,'countries:hard':2,'cities:all':5,'cities:440000':4,'cities:110000':1});
});


test('省级最佳从零起步，写入保留旧混合、国家和地区成绩', async () => {
 setGlobal('window',undefined);
 const legacy={'cities:all':200,'countries:medium':40,'cities:340000':12};
 const store=browserStorage(JSON.stringify(legacy));setGlobal('localStorage',store.storage);
 assert.equal((await readBests())['cities:provinces'],undefined);
 assert.equal(await saveBest('cities:provinces',21),true);
 assert.deepEqual(await readBests(),{...legacy,'cities:provinces':21});
});
