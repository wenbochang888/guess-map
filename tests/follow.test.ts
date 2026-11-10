import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFollowService } from '../src/platform/follow';
let original: PropertyDescriptor | undefined;
beforeEach(()=>{original=Object.getOwnPropertyDescriptor(globalThis,'window');});
afterEach(()=>{if(original)Object.defineProperty(globalThis,'window',original);else Reflect.deleteProperty(globalThis,'window');});
function host(methods: Record<string, any>, version=9510000) {Object.defineProperty(globalThis,'window',{configurable:true,writable:true,value:{xhs:{launchOptions:{miniToolEnv:{buildVersion:version}},miniTool:methods}}});}
function deferred(){let resolve!:(v:unknown)=>void;const promise=new Promise(r=>{resolve=r});return{promise,resolve};}
async function flush(){for(let n=0;n<40;n++)await Promise.resolve();}
for(const status of [-1,0,1,2,42,'1',null])test(`关注查询解析 ${status}，不将失败当未关注`,async()=>{
 host({getFollowStatus:async()=>({follow_status:status}),followAuthor:async()=>({follow_status:1})});
 assert.equal(await createFollowService().refresh(),status===0||status===1||status===2?status:-1);
});
test('缺宿主和低版本不调用，不伪报成功',async()=>{
 host({getFollowStatus:()=>{throw Error('must not call')},followAuthor:()=>{throw Error('must not call')}},9500000);
 const s=createFollowService();assert.equal(await s.refresh(),-1);assert.equal(await s.follow(),'unsupported');assert.equal(s.busy,false);
});
test('已关注和作者本人不再调用原生',async()=>{
 for(const status of [1,2]){let calls=0;host({getFollowStatus:async()=>({follow_status:status}),followAuthor:async()=>{calls++;}});const s=createFollowService();await s.refresh();assert.equal(await s.follow(),status===1?'followed':'self');assert.equal(calls,0);}
});
test('原生超过5秒仍互斥，关闭页内卡/刷新关系不解锁，迟到成功可记录',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const d=deferred();let calls=0;
 host({getFollowStatus:async()=>({follow_status:0}),followAuthor:()=>{calls++;return d.promise;}});
 const s=createFollowService();const result=s.follow();await flush();assert.equal(s.busy,true);
 t.mock.timers.tick(6000);assert.equal(await s.follow(),'pending');await s.refresh();assert.equal(s.busy,true);assert.equal(calls,1);
 d.resolve({follow_status:1});assert.equal(await result,'followed');assert.equal(s.status,1);assert.equal(s.busy,false);
});
for(const [code,outcome] of [[20002,'cancelled'],[15404,'limited'],[10003,'pending'],[2999,'failed']] as const)test(`关注错误${code}精确分类`,async()=>{
 let calls=0;host({getFollowStatus:async()=>({follow_status:0}),followAuthor:async()=>{calls++;throw{errCode:code};}});const s=createFollowService();assert.equal(await s.follow(),outcome);
 if(code===10003){assert.equal(s.busy,true);await s.refresh();assert.equal(await s.follow(),'pending');assert.equal(calls,1);}
 else if(code===15404){assert.equal(s.busy,false);assert.equal(await s.follow(),'limited');assert.equal(calls,1);}
 else assert.equal(s.busy,false);
});
test('resolve业务失败不显示关注成功；resolve内错误码也分类',async()=>{
 host({getFollowStatus:async()=>({follow_status:0}),followAuthor:async()=>({follow_status:-1})});assert.equal(await createFollowService().follow(),'failed');
 host({getFollowStatus:async()=>({follow_status:0}),followAuthor:async()=>({errCode:20002,errMsg:'followAuthor:fail'})});assert.equal(await createFollowService().follow(),'cancelled');
});
test('成功关注后，先发的慢查询不能回退状态',async()=>{
 const d=deferred();host({getFollowStatus:()=>d.promise,followAuthor:async()=>({follow_status:1})});const s=createFollowService();const old=s.refresh();await flush();assert.equal(await s.follow(),'followed');d.resolve({follow_status:0});await old;assert.equal(s.status,1);
});
