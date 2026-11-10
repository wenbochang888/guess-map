import { boardIds, type BoardKey } from '../game/options';
import type { LeaderboardService, MyRank, Period, RankEntry, RankResult } from './types';
import { asRecord, callMiniTool, getMiniTool, getVersion, platformError } from './xhs';
import type { MiniTool, PlatformError } from './xhs';

const CACHE_MS = 30_000;
const REFRESH_MS = 1_000;
const BOARDS: Record<BoardKey, number> = boardIds;
const unauthorized = (error: PlatformError): boolean => error.errCode === 1005 || error.errCode === 10003;
const validPlatformScore = (score: unknown): score is number =>
  typeof score === 'number' && Number.isFinite(score) && Math.abs(score) <= 1_000_000;
const invalidResponse = (api: string) => platformError(new Error(`${api}: invalid response`));

function parseMine(value: unknown): MyRank {
  const data = asRecord(value);
  if (!data) throw invalidResponse('getMyRank');
  if (data.status === 'EXACT') {
    if (!Number.isInteger(data.rank) || (data.rank as number) < 1 || (data.rank as number) > 500
      || !validPlatformScore(data.score)) throw invalidResponse('getMyRank');
    return { status: 'EXACT', rank: data.rank as number, score: data.score };
  }
  if ((data.status === 'OVER_LIMIT' || data.status === 'NO_SCORE' || data.status === 'NOT_PARTICIPATING')
    && data.rank === null && data.score === null) {
    return { status: data.status, rank: null, score: null };
  }
  throw invalidResponse('getMyRank');
}

function parseEntries(value: unknown): RankEntry[] {
  const data = asRecord(value)?.data;
  if (!Array.isArray(data) || data.length > 100) throw invalidResponse('getRankList');
  let previousRank = 0;
  let previousScore = Infinity;
  return data.map((value) => {
    const row = asRecord(value);
    if (!row || !Number.isInteger(row.rank) || (row.rank as number) <= previousRank
      || (row.rank as number) > 100 || !validPlatformScore(row.score) || row.score > previousScore
      || (row.nickname !== null && typeof row.nickname !== 'string')) throw invalidResponse('getRankList');
    previousRank = row.rank as number;
    previousScore = row.score;
    return { rank: previousRank, score: row.score, nickname: row.nickname as string | null };
  });
}

function copy(result: RankResult): RankResult {
  return { entries: result.entries.map((entry) => ({ ...entry })), mine: { ...result.mine } };
}

function beijingDay(now: number): string {
  // 只用 UTC 运算，避免设备时区/DST 影响；北京时间日界也覆盖周一的周界。
  return new Date(now + 8 * 60 * 60 * 1_000).toISOString().slice(0, 10);
}

type CacheRecord = {
  boardKey: BoardKey;
  attemptedAt: number;
  data?: RankResult;
  storedAt?: number;
  error?: PlatformError;
  retryAt?: number;
  pending?: Promise<RankResult>;
};

export function createLeaderboard(enabled: boolean): LeaderboardService {
  let availability: LeaderboardService['availability'] = enabled ? 'unknown' : 'unavailable';
  let support: Promise<MiniTool> | undefined;
  let day = beijingDay(Date.now());
  const revision: Record<BoardKey, number> = { 'country-easy': 0, 'country-medium': 0, 'country-hard': 0, 'china-provinces': 0 };
  const cache = new Map<string, CacheRecord>();
  const reads = new Map<string, Promise<unknown>>();
  const submissions = new Map<string, { boardKey: BoardKey; score: number; task: Promise<void> }>();
  let probePending: Promise<void> | undefined;
  let probeRetryAt = 0;
  let readRetryAt = 0;
  let readError: PlatformError | undefined;

  function isUnavailable(): boolean {
    // 异步等待期间其他请求可能撤销授权，不沿用 await 前的状态收窄。
    return availability === 'unavailable';
  }

  function hide(): void {
    availability = 'unavailable';
    cache.clear();
  }

  function rememberFailure(value: unknown): PlatformError {
    const error = platformError(value);
    if (unauthorized(error)) hide();
    return error;
  }

  function ensureReady(): Promise<MiniTool> {
    if (!enabled || availability === 'unavailable') {
      return Promise.reject(platformError(new Error('leaderboard: unavailable')));
    }
    if (!support) {
      support = (async () => {
        const version = await getVersion();
        const tool = getMiniTool();
        if ((version > 0 && version < 9510) || !tool
          || !['getMyRank', 'getRankList', 'submitScore'].every((method) => typeof tool[method] === 'function')) {
          hide();
          throw platformError(new Error('leaderboard: unsupported'));
        }
        return tool;
      })();
    }
    return support;
  }

  function refreshDay(): void {
    const next = beijingDay(Date.now());
    if (day !== next) {
      day = next;
      cache.clear();
    }
  }

  function read(tool: MiniTool, api: 'getRankList' | 'getMyRank', board: number, period: Period): Promise<unknown> {
    // day 入键防止跨北京时间日/周边界复用旧的在途查询。
    const key = `${day}:${api}:${board}:${period}:${revision[(Object.keys(BOARDS) as BoardKey[]).find(key => BOARDS[key] === board)!]}`;
    const pending = reads.get(key);
    if (pending) return pending;
    const task = (async () => {
      for (let attempt = 0; ; attempt++) {
        if (availability === 'unavailable') throw platformError(new Error('leaderboard: unavailable'));
        if (Date.now() < readRetryAt) throw readError;
        try {
          return await callMiniTool(tool, api, { board, period });
        } catch (value) {
          const error = rememberFailure(value);
          if (error.errCode === 2009) {
            readRetryAt = Date.now() + CACHE_MS;
            readError = error;
          }
          if (error.errCode !== 2002 || attempt >= 2) throw error;
          await new Promise<void>((resolve) => setTimeout(resolve, attempt === 0 ? 500 : 1_000));
        }
      }
    })();
    reads.set(key, task);
    const cleanup = () => { if (reads.get(key) === task) reads.delete(key); };
    void task.then(cleanup, cleanup);
    return task;
  }

  function probe(): Promise<void> {
    if (!enabled || availability === 'unavailable') return Promise.resolve();
    if (probePending) return probePending;
    if (Date.now() < Math.max(probeRetryAt, readRetryAt)) return Promise.resolve();
    const task = (async () => {
      try {
        const tool = await ensureReady();
        refreshDay();
        parseMine(await read(tool, 'getMyRank', 1, 'day'));
        if (!isUnavailable()) availability = 'available';
      } catch (error) {
        rememberFailure(error);
        // 暂时失败不作永久关闭；后续显式 probe 可恢复，不设后台轮询。
      }
      probeRetryAt = Date.now() + REFRESH_MS;
    })();
    probePending = task;
    void task.then(() => { if (probePending === task) probePending = undefined; });
    return task;
  }

  async function load(boardKey: BoardKey, period: Period, force = false): Promise<RankResult> {
    if (!Object.prototype.hasOwnProperty.call(BOARDS, boardKey) || !['day', 'week', 'all'].includes(period)) {
      throw platformError({ errMsg: 'leaderboard: invalid boardKey/period', errCode: 10001 });
    }
    const tool = await ensureReady();
    refreshDay();
    const key = `${day}:${boardKey}:${period}:${revision[boardKey]}`;
    const now = Date.now();
    const existing = cache.get(key);
    if (existing?.pending) return copy(await existing.pending);
    if (existing?.data && now - existing.storedAt! < CACHE_MS
      && (!force || now - existing.attemptedAt < REFRESH_MS)) return copy(existing.data);
    if (existing?.error && now < existing.retryAt!) throw platformError(existing.error);
    if (now < readRetryAt) throw platformError(readError);

    const record: CacheRecord = { boardKey, attemptedAt: now };
    const task = (async (): Promise<RankResult> => {
      try {
        const [list, mine] = await Promise.all([
          read(tool, 'getRankList', BOARDS[boardKey], period),
          read(tool, 'getMyRank', BOARDS[boardKey], period),
        ]);
        const result = { entries: parseEntries(list), mine: parseMine(mine) };
        if (!isUnavailable()) availability = 'available';
        // 跨周期、提交后或未授权后不能让迟到查询重新填充旧缓存。
        if (cache.get(key) === record && day === beijingDay(Date.now())) {
          record.data = result;
          record.storedAt = Date.now();
        }
        return result;
      } catch (value) {
        const error = rememberFailure(value);
        record.error = error;
        record.retryAt = Date.now() + (error.errCode === 2009 ? CACHE_MS : REFRESH_MS);
        throw error;
      } finally {
        record.pending = undefined;
      }
    })();
    record.pending = task;
    cache.set(key, record);
    return copy(await task);
  }

  function submit(boardKey: BoardKey, score: number, runId: string): Promise<void> {
    if (!Object.prototype.hasOwnProperty.call(BOARDS, boardKey) || !Number.isInteger(score) || score < 0 || score > 1_000_000
      || typeof runId !== 'string' || !runId.trim()) {
      return Promise.reject(platformError({ errMsg: 'submitScore: invalid score/boardKey/runId', errCode: 10001 }));
    }
    if (!enabled || availability === 'unavailable') return Promise.resolve();
    const previous = submissions.get(runId);
    if (previous) return previous.boardKey === boardKey && previous.score === score ? previous.task : Promise.reject(platformError({ errCode: 10001, errMsg: 'submitScore: runId conflict' }));
    const task = (async () => {
      try {
        const tool = await ensureReady();
        if (isUnavailable()) return;
        // 每局只发一次真实成绩，任何失败（含未知/超时）都不自动重放。
        const response = asRecord(await callMiniTool(tool, 'submitScore', { board: BOARDS[boardKey], score }));
        if (!validPlatformScore(response?.score)) throw invalidResponse('submitScore');
        revision[boardKey]++;
        for (const [key, record] of cache) if (record.boardKey === boardKey) cache.delete(key);
        // 提交成功不证明公开读取权限，不改变 unknown。
      } catch (error) {
        throw rememberFailure(error);
      }
    })();
    submissions.set(runId, { boardKey, score, task });
    return task;
  }

  return { get availability() { return availability; }, probe, load, submit };
}
