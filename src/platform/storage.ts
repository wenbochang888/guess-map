import { validBestKey } from '../game/options';
import { asRecord, callMiniTool, getMiniTool, getVersion } from './xhs';

// 保留历史存储容器；玩法通过记录子键隔离，避免丢失国家和指定地区最佳。
export const BESTS_STORAGE_KEY = 'guess-map:bests:v2:rules2';
type Bests = Record<string, number>;
const empty = (): Bests => ({});
const validScore = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 1_000_000;

// 同一键的所有读/比较/写共用队列，不能让一个晚返回的读取覆盖新高分。
let queue: Promise<void> = Promise.resolve();
function serial<T>(operation: () => Promise<T>): Promise<T> {
  const result = queue.then(operation);
  queue = result.then(() => undefined, () => undefined);
  return result;
}

function parse(raw: unknown): Bests {
  if (raw === null || raw === undefined || raw === '') return empty();
  if (typeof raw !== 'string') throw new Error('getStorage: data must be JSON text');
  const data = asRecord(JSON.parse(raw));
  if (!data) throw new Error('invalid best records');
  const result: Bests = {};
  for (const key of Object.keys(data)) if (validBestKey(key) && validScore(data[key])) result[key] = data[key] as number;
  return result;
}

async function backend(): Promise<{ read(): Promise<unknown>; write(data: string): Promise<void> }> {
  const tool = getMiniTool();
  const version = await getVersion();
  // 明确低版本或没有宿主可降级。未知版本且有宿主仍优先端存储。
  if (tool && (version === 0 || version >= 9460)) {
    return {
      async read() {
        const result = asRecord(await callMiniTool(tool, 'getStorage', { key: BESTS_STORAGE_KEY }));
        if (!result || !('data' in result)) throw new Error('getStorage: invalid response');
        return result.data;
      },
      async write(data) {
        await callMiniTool(tool, 'setStorage', { key: BESTS_STORAGE_KEY, data });
      },
    };
  }
  // 属性访问本身也可能抛 SecurityError，必须在调用方 try/catch 内执行。
  const storage = typeof window !== 'undefined' && window.localStorage
    ? window.localStorage : globalThis.localStorage;
  if (!storage) throw new Error('localStorage unavailable');
  return {
    async read() { return storage.getItem(BESTS_STORAGE_KEY); },
    async write(data) { storage.setItem(BESTS_STORAGE_KEY, data); },
  };
}

export function readBests(): Promise<Bests> {
  return serial(async () => {
    try {
      return parse(await (await backend()).read());
    } catch {
      return empty();
    }
  });
}

export function saveBest(recordKey: string, score: number): Promise<boolean> {
  if (!validBestKey(recordKey) || !validScore(score)) return Promise.resolve(false);
  return serial(async () => {
    try {
      const store = await backend();
      // 读失败不能按 0 覆盖未知旧记录，也不能偷偷换存储后端。
      const bests = parse(await store.read());
      if (score <= (bests[recordKey] || 0)) return true;
      bests[recordKey] = score;
      await store.write(JSON.stringify(bests));
      return true;
    } catch {
      return false;
    }
  });
}
