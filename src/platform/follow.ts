import { asRecord, callMiniTool, getMiniTool, getVersion, platformError } from './xhs';
export type FollowStatus = -1 | 0 | 1 | 2;
export type FollowOutcome = 'followed' | 'self' | 'cancelled' | 'limited' | 'pending' | 'failed' | 'unsupported';
export function createFollowService() {
  let status: FollowStatus = -1;
  let busy = false;
  let nativeTask: Promise<FollowOutcome> | undefined;
  let limitedDay = '';
  let revision = 0;
  let query: Promise<FollowStatus> | undefined;
  const day = () => new Date().toLocaleDateString();
  function parse(value: unknown): FollowStatus {
    const s = asRecord(value)?.follow_status;
    return s === 0 || s === 1 || s === 2 ? s : -1;
  }
  async function supported() {
    const version = await getVersion();
    const tool = getMiniTool();
    return tool && !(version > 0 && version < 9510) && typeof tool.getFollowStatus === 'function' && typeof tool.followAuthor === 'function' ? tool : undefined;
  }
  function refresh(): Promise<FollowStatus> {
    if (query) return query;
    const token = revision;
    const task = (async () => {
      try {
        const tool = await supported();
        const result = tool ? parse(await callMiniTool(tool, 'getFollowStatus')) : -1;
        // A slow query issued before a successful follow cannot undo that success.
        if (revision === token) status = result;
      } catch { if (revision === token) status = -1; }
      return status;
    })();
    query = task;
    void task.then(() => { if (query === task) query = undefined; });
    return task;
  }
  function follow(): Promise<FollowOutcome> {
    if (busy) return Promise.resolve('pending');
    if (status === 1) return Promise.resolve('followed');
    if (status === 2) return Promise.resolve('self');
    if (limitedDay === day()) return Promise.resolve('limited');
    // Lock before awaiting version discovery, not just before the native call.
    busy = true;
    const task = (async (): Promise<FollowOutcome> => {
      let keepLocked = false;
      try {
        const tool = await supported();
        if (!tool) return 'unsupported';
        // Keep the raw Promise: a local 5s timeout cannot cancel the native UI.
        const result = await tool.followAuthor!.call(tool);
        const data = asRecord(result);
        if (typeof data?.errCode === 'number' && data.errCode !== 0) throw result;
        if (typeof data?.errMsg === 'string' && /:fail\b/.test(data.errMsg)) throw result;
        status = parse(result); revision++;
        return status === 1 ? 'followed' : status === 2 ? 'self' : 'failed';
      } catch (value) {
        const error = platformError(value);
        if (error.errCode === 10003) { keepLocked = true; return 'pending'; }
        if (error.errCode === 20002) return 'cancelled';
        if (error.errCode === 15404) { limitedDay = day(); return 'limited'; }
        return 'failed';
      } finally { if (!keepLocked) busy = false; }
    })();
    nativeTask = task;
    return task;
  }
  return { get status() { return status; }, get busy() { return busy; }, get nativeTask() { return nativeTask; }, refresh, follow };
}
