import { provinceQuestions, type QuestionBank } from '../../src/game/questions';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { config } from '../../src/config';
const bank = JSON.parse(readFileSync(new URL('../../src/data/questions.json',import.meta.url),'utf8')) as QuestionBank;
async function currentQuestion(page:Page){const path=await page.locator('.question-map .outline-map>path').getAttribute('d');const q=bank.countries.concat(bank.cities, provinceQuestions(bank as QuestionBank)).find(q=>q.path===path);expect(q).toBeTruthy();return q!;}
async function correct(page:Page){const q=await currentQuestion(page);await page.getByRole('button',{name:new RegExp('^[ABCD]\\s*'+q.name+'$')}).click();}
async function wrong(page:Page){const q=await currentQuestion(page);const buttons=page.locator('.answer-button');for(let i=0;i<4;i++){if(!(await buttons.nth(i).innerText()).includes(q.name)){await buttons.nth(i).click();return;}}throw Error('no wrong answer');}
async function finish(page:Page){for(let i=0;i<3;i++){await wrong(page);await page.locator('.next-button').click();}await expect(page.locator('.result-number')).toBeVisible();}
async function host(page:Page,scenario:'ok'|'unauthorized'|'temporary'='ok',followStatus=1){
 await page.addInitScript(({scenario,followStatus})=>{
  const calls:any[]=[];(window as any).__calls=calls;(window as any).__followStatus=followStatus;
  (window as any).xhs={launchOptions:{miniToolEnv:{buildVersion:9530000}},miniTool:{
   getWindowInfo:async()=>({windowWidth:390,windowHeight:844,safeArea:{top:0,left:0,right:390,bottom:824},menuButtons:{back:{left:12,top:12,right:48,bottom:48,width:36,height:36},share:{left:342,top:12,right:378,bottom:48,width:36,height:36}}}),
   getStorage:async()=>({data:localStorage.getItem('fake-bests')}),setStorage:async(o:any)=>{localStorage.setItem('fake-bests',o.data);return{};},
   getMyRank:async(o:any)=>{calls.push(['mine',o]);if(scenario==='unauthorized')throw{errCode:1005};if(scenario==='temporary')throw{errCode:2999};return{status:'OVER_LIMIT',rank:null,score:null};},
   getRankList:async(o:any)=>{calls.push(['list',o]);return{data:Array.from({length:12},(_,i)=>({rank:i+1,score:30-i,nickname:i===0?'好奇心很长很长很长很长很长很长很长很长的地图同好':i===1?null:`地图同好${i+1}`}))};},
   submitScore:async(o:any)=>{calls.push(['submit',o]);return{score:o.score};},
   getFollowStatus:async()=>({follow_status:(window as any).__followStatus}),
   followAuthor:async()=>{calls.push(['follow']);(window as any).__followStatus=1;return{follow_status:1};},
   vibrateShort:async()=>({}),share:async()=>({}),
  }};
 },{scenario,followStatus});
}
async function setup(page:Page){await expect(page.locator('.region-trigger')).toBeVisible();}
async function begin(page:Page){await page.getByRole('button',{name:'开始猜',exact:true}).click();await expect(page.locator('.answers')).toBeVisible();}
async function beginCountry(page:Page){await page.getByRole('button',{name:'猜国家',exact:true}).click();await begin(page);}
async function noDifficulty(page:Page){await expect(page.getByRole('group',{name:'国家难度'})).toHaveCount(0);for(const name of ['简单','中等','困难'])await expect(page.getByRole('button',{name,exact:true})).toHaveCount(0);await expect(page.locator('body')).not.toContainText(/简单|中等|困难|本档最佳/);}
async function selectRegion(page:Page,name:string){await setup(page);await page.locator('.region-trigger').click();await expect(page.getByRole('dialog',{name:'选择地区'})).toBeVisible();await page.getByRole('button',{name:new RegExp('^'+name)}).click();await expect(page.getByRole('dialog')).toHaveCount(0);}

test('首次首页默认中国全部地区，模式顺序正确，广东示例与中国标准地图均正常显示且不混题库',async({page})=>{
 await host(page);await page.goto('/');const china=page.getByRole('button',{name:'猜中国大陆地区',exact:true}),country=page.getByRole('button',{name:'猜国家',exact:true});
 await expect(china).toHaveAttribute('aria-pressed','true');await expect(country).toHaveAttribute('aria-pressed','false');
 const modes=page.getByRole('group',{name:'选择题库'}).getByRole('button');await expect(modes.nth(0)).toHaveAccessibleName('猜中国大陆地区');await expect(modes.nth(1)).toHaveAccessibleName('猜国家');
 await expect(page.locator('.atlas-caption')).toContainText('广东省');await expect(page.locator('.atlas-count')).toHaveText(/^31\s*道轮廓题$/);await expect(page.locator('.map-approval')).toHaveText(config.mapApprovalLabel);await noDifficulty(page);
 await expect(page.locator('section.home-ranks h2')).toHaveText('中国大陆地区 · 今日排行榜');await expect(page.locator('.home-secondary').getByRole('button',{name:'排行榜',exact:true})).toHaveCount(0);
 await setup(page);await expect(page.locator('.region-trigger')).toContainText('全部地区');await expect(page.locator('.region-trigger')).toContainText('31 道轮廓');await expect(page.getByRole('dialog')).toHaveCount(0);
 await country.click();await expect(page.locator('section.home-ranks h2')).toHaveText('国家 · 今日排行榜');const image=page.getByRole('img',{name:'中国地图示例',exact:true});await expect(image).toBeVisible();await expect.poll(()=>image.evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth===1279&&img.naturalHeight===904)).toBe(true);await expect(page.locator('.preview-empty')).toHaveCount(0);await expect(page.locator('body')).not.toContainText('待核验');
 await expect(page.locator('.map-approval')).toHaveText('审图号：GS(2023)2766号');await expect(page.locator('.atlas-caption')).not.toContainText('意大利');await expect(page.locator('.atlas-count')).toHaveText(/^46\s*道轮廓题$/);await noDifficulty(page);
 await china.click();await expect(page.locator('.preview-empty')).toHaveCount(0);await expect(page.locator('.atlas-caption')).toContainText('广东省');await setup(page);await expect(page.locator('.region-trigger')).toContainText('全部地区');
});

test('首页仅展示降序前10，完整榜复用100条缓存展示12名并兼容长昵称与空昵称',async({page})=>{
 await host(page);await page.goto('/');const home=page.locator('section.home-ranks'),rows=home.locator('table.rank-table tbody tr');await expect(rows).toHaveCount(10);
 for(let i=0;i<10;i++){await expect(rows.nth(i).getByRole('cell').first()).toHaveText(String(i+1).padStart(2,'0'));await expect(rows.nth(i).getByRole('cell').last()).toHaveText(new RegExp('^'+(30-i)+'\\s*分$'));}
 await expect(rows.first()).toContainText('好奇心很长很长很长很长很长很长很长很长的地图同好');expect((await rows.nth(1).getByRole('cell').nth(1).innerText()).trim()).not.toBe('');await expect(rows.nth(1)).not.toContainText(/null|undefined/);
 await expect(home).not.toContainText('地图同好11');await expect(home).not.toContainText('地图同好12');await expect(home.getByRole('button',{name:'查看完整排行榜',exact:true})).toBeVisible();
 const initial=await page.evaluate(()=>(window as any).__calls.filter((c:any)=>c[0]==='list').map((c:any)=>c[1]));expect(initial).toEqual([{board:5,period:'day'}]);
 await page.getByRole('button',{name:'查看完整排行榜',exact:true}).click();const full=page.locator('table.rank-table tbody tr');await expect(full).toHaveCount(12);
 for(let i=0;i<12;i++){await expect(full.nth(i).getByRole('cell').first()).toHaveText(String(i+1).padStart(2,'0'));await expect(full.nth(i).getByRole('cell').last()).toHaveText(new RegExp('^'+(30-i)+'\\s*分$'));}
 expect(await page.evaluate(()=>(window as any).__calls.filter((c:any)=>c[0]==='list').map((c:any)=>c[1]))).toEqual(initial);await expect(page.locator('.my-rank')).toBeVisible();await expect(page.locator('.period-tabs')).toBeVisible();await noDifficulty(page);
 await page.getByRole('button',{name:'返回',exact:true}).click();await expect(page.locator('.home-ranks h2')).toHaveText('中国大陆地区 · 今日排行榜');await expect(rows).toHaveCount(10);
});

test('榜单能力尚未知时保留首页榜区和加载提示，不伪装空榜',async({page})=>{
 await host(page);await page.addInitScript(()=>{(window as any).xhs.miniTool.getMyRank=()=>new Promise(()=>{});});await page.goto('/');
 await expect(page.locator('section.home-ranks')).toBeVisible();await expect(page.locator('.home-ranks h2')).toHaveText('中国大陆地区 · 今日排行榜');await expect(page.locator('.home-ranks')).toContainText('正在展开榜单…');await expect(page.getByText('这一期，还没有人留下成绩。')).toHaveCount(0);
});

test('首页榜请求故障保留重试提示，重试成功后恢复真实榜单',async({page})=>{
 await freezeTime(page);await host(page);await page.addInitScript(()=>{const tool=(window as any).xhs.miniTool,read=tool.getRankList;(window as any).__failHomeRanks=true;tool.getRankList=async(o:any)=>{if((window as any).__failHomeRanks){(window as any).__calls.push(['list',o]);throw{errCode:2999};}return read(o);};});await page.goto('/');
 const home=page.locator('section.home-ranks');await expect(home).toBeVisible();await expect(home).toContainText('榜单暂时没连上，请稍后重试。');await expect(page.getByText('这一期，还没有人留下成绩。')).toHaveCount(0);
 const before=await page.evaluate(()=>(window as any).__calls.filter((c:any)=>c[0]==='list').length);await page.evaluate(()=>{(window as any).__failHomeRanks=false;});await page.clock.runFor(1001);await home.getByRole('button',{name:/重试/}).click();await expect.poll(()=>page.evaluate(()=>(window as any).__calls.filter((c:any)=>c[0]==='list').length)).toBeGreaterThan(before);await expect(home.locator('table.rank-table tbody tr')).toHaveCount(10);await expect(home).not.toContainText('榜单暂时没连上，请稍后重试。');
});

test('首页快速切模式时迟到的中国榜不能覆盖当前国家榜，切回仍展示中国今日榜',async({page})=>{
 await host(page);await page.addInitScript(()=>{(window as any).__pendingRanks={};(window as any).xhs.miniTool.getRankList=(o:any)=>{(window as any).__calls.push(['list',o]);return new Promise(resolve=>{(window as any).__pendingRanks[o.board]=resolve;});};});await page.goto('/');
 await expect.poll(()=>page.evaluate(()=>Boolean((window as any).__pendingRanks[5]))).toBe(true);await page.getByRole('button',{name:'猜国家',exact:true}).click();await expect.poll(()=>page.evaluate(()=>Boolean((window as any).__pendingRanks[2]))).toBe(true);
 await page.evaluate(()=>(window as any).__pendingRanks[2]({data:[{rank:1,score:20,nickname:'国家新榜'}]}));await expect(page.locator('.home-ranks')).toContainText('国家新榜');
 await page.evaluate(()=>(window as any).__pendingRanks[5]({data:[{rank:1,score:19,nickname:'大陆迟到榜'}]}));await expect(page.locator('.home-ranks h2')).toHaveText('国家 · 今日排行榜');await expect(page.locator('.home-ranks')).toContainText('国家新榜');await expect(page.locator('.home-ranks')).not.toContainText('大陆迟到榜');
 await page.getByRole('button',{name:'猜中国大陆地区',exact:true}).click();await expect(page.locator('.home-ranks h2')).toHaveText('中国大陆地区 · 今日排行榜');await expect(page.locator('.home-ranks')).toContainText('大陆迟到榜');await expect(page.locator('.home-ranks')).not.toContainText('国家新榜');
});

test('结算提交尚未返回时可回首页，提交完成后刷新当前模式今日榜',async({page})=>{
 await host(page);await page.addInitScript(()=>{const tool=(window as any).xhs.miniTool;tool.getRankList=async(o:any)=>{(window as any).__calls.push(['list',o]);return{data:[{rank:1,score:20,nickname:(window as any).__submitted?'提交后新榜':'提交前旧榜'}]};};tool.submitScore=(o:any)=>{(window as any).__calls.push(['submit',o]);return new Promise(resolve=>{(window as any).__completeSubmit=()=>{(window as any).__submitted=true;resolve({score:o.score});};});};});await page.goto('/');await beginCountry(page);await finish(page);
 await expect.poll(()=>page.evaluate(()=>typeof(window as any).__completeSubmit)).toBe('function');await page.getByRole('button',{name:'返回首页',exact:true}).click();await expect(page.locator('.home-ranks h2')).toHaveText('国家 · 今日排行榜');await expect(page.locator('.home-ranks')).toContainText('提交前旧榜');
 const before=await page.evaluate(()=>(window as any).__calls.filter((c:any)=>c[0]==='list'&&c[1].board===2&&c[1].period==='day').length);await page.evaluate(()=>(window as any).__completeSubmit());
 await expect(page.locator('.home-ranks')).toContainText('提交后新榜');await expect(page.locator('.home-ranks')).not.toContainText('提交前旧榜');await expect.poll(()=>page.evaluate(()=>(window as any).__calls.filter((c:any)=>c[0]==='list'&&c[1].board===2&&c[1].period==='day').length)).toBeGreaterThan(before);
 expect(await page.evaluate(()=>(window as any).__calls.filter((c:any)=>c[0]==='submit').map((c:any)=>c[1]))).toEqual([{board:2,score:0}]);
});

for(const native of [false,true])test(`国家个人最佳仅读取medium，旧easy和hard记录保留但不混入（${native?'宿主':'本地'}存储）`,async({page})=>{
 if(native)await host(page);await page.addInitScript(()=>{const records={'countries:easy':20,'countries:medium':5,'countries:hard':50,'cities:provinces':3};localStorage.setItem('guess-map:bests:v2:rules2',JSON.stringify(records));localStorage.setItem('fake-bests',JSON.stringify(records));});await page.goto('/');
 await expect(page.locator('.home-secondary strong')).toHaveText('3');await page.getByRole('button',{name:'猜国家',exact:true}).click();await expect(page.locator('.home-secondary')).toContainText('国家');await expect(page.locator('.home-secondary strong')).toHaveText('5');await noDifficulty(page);await begin(page);await finish(page);
 await expect(page.locator('.best-record')).toContainText('5');await expect(page.locator('.best-record')).toContainText('个人最佳');await expect(page.locator('.result-config')).toHaveText('国家');await noDifficulty(page);await page.getByRole('button',{name:'返回首页',exact:true}).click();await expect(page.locator('.home-secondary strong')).toHaveText('5');
 const stored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),native?'fake-bests':'guess-map:bests:v2:rules2');expect(stored['countries:easy']).toBe(20);expect(stored['countries:medium']).toBe(5);expect(stored['countries:hard']).toBe(50);
});

test('审图号在预览和两类题面可读，窄屏位置小图不重叠',async({page},info)=>{
 await page.goto('/');
 async function check(){
  await expect(page.locator('.map-approval')).toHaveCount(1);await expect(page.locator('.map-approval')).toHaveText(config.mapApprovalLabel);
  const a=(await page.locator('.map-approval').boundingBox())!,m=(await page.locator('.map-scene').boundingBox())!;
  expect(a.x).toBeGreaterThanOrEqual(m.x);expect(a.x+a.width).toBeLessThanOrEqual(m.x+m.width);expect(a.height).toBeLessThan(20);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 for(const width of [320,390,1024]){await page.setViewportSize({width,height:650});await check();}
 await page.getByRole('button',{name:'玩法与地图说明'}).click();await expect(page.getByRole('dialog')).toContainText('地图'+config.mapApprovalLabel);await expect(page.getByRole('dialog')).toContainText('不用于导航、测绘或界线认定');await page.keyboard.press('Escape');
 await beginCountry(page);await check();await page.screenshot({path:`artifacts/approval-country-${info.project.name}.png`});
 await page.getByRole('button',{name:'退出本局'}).click();await page.getByRole('button',{name:'返回首页',exact:true}).click();await page.getByRole('button',{name:'猜中国大陆地区',exact:true}).click();await selectRegion(page,'北京市');await begin(page);
 for(const width of [320,390,1024]){await page.setViewportSize({width,height:650});await check();const a=(await page.locator('.map-approval').boundingBox())!,i=(await page.locator('.location-inset').boundingBox())!;expect(a.x+a.width).toBeLessThanOrEqual(i.x);}
 await page.setViewportSize({width:390,height:650});await page.screenshot({path:`artifacts/approval-city-${info.project.name}.png`});
});
test('每局仅查询一次关注状态，返回榜单和前台不弹窗',async({page})=>{
 await host(page,'ok',0);await page.addInitScript(()=>{const tool=(window as any).xhs.miniTool,query=tool.getFollowStatus;tool.getFollowStatus=()=>{(window as any).__calls.push(['followQuery']);return query();};});
 await page.goto('/');await beginCountry(page);await finish(page);await page.waitForTimeout(900);await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.result-actions').getByRole('button',{name:'关注作者',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'排行榜',exact:true}).click();await page.getByRole('button',{name:'返回',exact:true}).click();await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 expect(await page.evaluate(()=>(window as any).__calls.filter((c:any)=>c[0]==='followQuery').length)).toBe(1);
});

test('国家直接开局且不展示难度，正常计分、防连点、三错结算、顶部回首页',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await noDifficulty(page);
 await page.getByRole('button',{name:'猜国家',exact:true}).click();await expect(page.locator('.atlas-count')).toContainText('46');await noDifficulty(page);await begin(page);
 await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.question-context')).toContainText('国家');await noDifficulty(page);
 const q=await currentQuestion(page);await page.getByRole('button',{name:new RegExp('^[ABCD]\\s*'+q.name+'$')}).dblclick({delay:10});await expect(page.locator('.score strong')).toHaveText('1');
 await expect(page.locator('.feedback-line')).toContainText('不用着急');await finish(page);
 await expect(page.locator('.result-number')).toContainText('1');await expect(page.locator('.result-config')).toHaveText('国家');await expect(page.locator('.best-record')).toContainText('个人最佳');await noDifficulty(page);
 await page.getByRole('button',{name:'返回首页',exact:true}).click();await expect(page.getByRole('button',{name:'开始猜',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'猜国家',exact:true})).toHaveAttribute('aria-pressed','true');expect(errors).toEqual([]);
});
test('国家所有公开入口统一46题，完整题池无重复，重玩不恢复旧难度',async({page})=>{
 await freezeTime(page);await host(page);await page.goto('/');await beginCountry(page);const seen=new Set<string>();
 for(let i=0;i<46;i++){const q=await currentQuestion(page);expect(seen.has(q.id)).toBe(false);seen.add(q.id);expect(q.difficulty).toBeLessThanOrEqual(2);await correct(page);await page.clock.runFor(650);}
 await expect(page.locator('.result-number')).toContainText('46');await expect(page.locator('.result-config')).toHaveText('国家');await expect(page.getByText('这一组，全部认完了')).toBeVisible();await noDifficulty(page);
 await expect.poll(()=>page.evaluate(()=>(window as any).__calls.filter((c:any)=>c[0]==='submit').length)).toBe(1);expect(await page.evaluate(()=>(window as any).__calls.find((c:any)=>c[0]==='submit')[1])).toEqual({board:2,score:46});
 await page.getByRole('button',{name:'再猜一次',exact:true}).click();await expect(page.locator('.question-context')).toContainText('国家');await noDifficulty(page);await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByRole('button',{name:'退出本局'}).click();await page.getByRole('button',{name:'返回首页',exact:true}).click();await beginCountry(page);await expect(page.locator('.question-context')).toContainText('国家');
 expect(await page.evaluate(()=>(window as any).__calls.some((c:any)=>[1,3].includes(c[1]?.board)))).toBe(false);
});
test('中国默认全部、地区搜索选广东后只出广东，个人纪录不混全域',async({page})=>{
 await host(page);await page.goto('/');await expect(page.locator('.region-trigger')).toBeVisible();await page.getByRole('button',{name:'猜国家',exact:true}).click();await expect(page.locator('.region-trigger')).toHaveCount(0);await page.getByRole('button',{name:'猜中国大陆地区',exact:true}).click();await setup(page);await expect(page.locator('.region-trigger')).toContainText('全部地区');await expect(page.locator('.region-trigger')).toContainText('31 道轮廓');
 await page.locator('.region-trigger').click();await page.getByRole('searchbox',{name:'查找地区'}).fill('广东');await page.getByRole('button',{name:/^广东省/}).click();
 await expect(page.locator('.region-trigger')).toContainText('广东省');await begin(page);
 expect((await currentQuestion(page)).regionId).toBe('440000');await expect(page.locator('.location-inset')).toContainText('省内位置');await finish(page);
 await expect(page.locator('.result-config')).toContainText('广东省');await expect(page.getByText('本地区游玩只记个人最佳，不计入省级地区榜。')).toBeVisible();
 expect(await page.evaluate(()=>(window as any).__calls.filter((c:any)=>c[0]==='submit'))).toEqual([]);
 await page.getByRole('button',{name:'再猜一次',exact:true}).click();expect((await currentQuestion(page)).regionId).toBe('440000');
});
test('北京完整16区可玩，区县题面与市内位置正确',async({page},info)=>{
 await page.goto('/');await page.getByRole('button',{name:'猜中国大陆地区',exact:true}).click();await selectRegion(page,'北京市');
 await expect(page.locator('.region-trigger')).toContainText('16 道轮廓');await begin(page);expect((await currentQuestion(page)).regionId).toBe('110000');await expect(page.locator('.location-inset')).toContainText('市内位置');await expect(page.locator('.question-heading h1')).toContainText('区县');await page.screenshot({path:`artifacts/beijing-${info.project.name}.png`,animations:'disabled',fullPage:true});
});
test('地区面板Escape和焦点恢复，退出确认不误结算',async({page})=>{
await page.goto('/');await page.getByRole('button',{name:'猜中国大陆地区',exact:true}).click();await setup(page);await page.locator('.region-trigger').click();await page.keyboard.press('Tab');await page.keyboard.press('Escape');await expect(page.locator('.region-trigger')).toBeFocused();await expect(page.getByRole('dialog')).toHaveCount(0);
 await begin(page);await page.getByRole('button',{name:'退出本局'}).click();await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'退出本局'})).toBeFocused();
 await page.getByRole('button',{name:'退出本局'}).click();await page.getByRole('button',{name:'返回首页',exact:true}).click();await expect(page.locator('.home-secondary strong')).toHaveText('0');
});
test('完整榜仅省级和国家，切模式恢复今日且不改变首页与重玩配置，零分仅提交board2',async({page},info)=>{
 await host(page);await page.goto('/');await page.getByRole('button',{name:'查看完整排行榜',exact:true}).click();await expect(page.locator('.my-rank')).toContainText('500+');await noDifficulty(page);
 const province=page.getByRole('button',{name:'省级地区榜',exact:true}),country=page.getByRole('button',{name:'国家榜',exact:true});
 expect((await page.getByRole('button').allTextContents()).map(t=>t.trim()).filter(t=>['省级地区榜','国家榜'].includes(t))).toEqual(['省级地区榜','国家榜']);
 await expect(province).toHaveAttribute('aria-pressed','true');await expect(page.locator('.period-tabs').getByRole('button',{name:'今日',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'本周',exact:true}).click();await expect(page.locator('.rank-table')).toContainText('地图同好');await country.click();await expect(page.locator('.board-caption')).toContainText('国家');await expect(page.getByRole('button',{name:'今日',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'总榜',exact:true}).click();await province.click();await expect(page.getByRole('button',{name:'今日',exact:true})).toHaveAttribute('aria-pressed','true');await noDifficulty(page);
 await page.screenshot({path:`artifacts/rank-mock-${info.project.name}.png`,fullPage:true,animations:'disabled'});await page.getByRole('button',{name:'返回',exact:true}).click();
 await expect(page.locator('.home-ranks h2')).toHaveText('中国大陆地区 · 今日排行榜');await beginCountry(page);await finish(page);
 await expect.poll(()=>page.evaluate(()=>(window as any).__calls.filter((c:any)=>c[0]==='submit').length)).toBe(1);expect(await page.evaluate(()=>(window as any).__calls.find((c:any)=>c[0]==='submit')[1])).toEqual({board:2,score:0});await expect(page.locator('.result-number')).toContainText('0');
 await page.getByRole('button',{name:'排行榜',exact:true}).click();await expect(country).toHaveAttribute('aria-pressed','true');await expect(page.getByRole('button',{name:'今日',exact:true})).toHaveAttribute('aria-pressed','true');await province.click();await page.getByRole('button',{name:'返回',exact:true}).click();await page.getByRole('button',{name:'再猜一次',exact:true}).click();await expect(page.locator('.question-context')).toContainText('国家');await noDifficulty(page);
});
test('每局仅主动点击显示关注卡，关注成功后下局隐藏入口',async({page},info)=>{
 await host(page,'ok',0);await page.goto('/');await beginCountry(page);await finish(page);await expect(page.locator('.result-number')).toBeVisible();
 await expect(page.getByRole('dialog',{name:'关注作者'})).toHaveCount(0);await page.locator('.result-actions').getByRole('button',{name:'关注作者',exact:true}).click();await expect(page.getByRole('dialog',{name:'关注作者'})).toBeVisible();await page.screenshot({path:`artifacts/follow-${info.project.name}.png`,fullPage:true,animations:'disabled'});
 expect(await page.evaluate(()=>(window as any).__calls.filter((c:any)=>c[0]==='follow').length)).toBe(0);
 await page.getByRole('dialog').getByRole('button',{name:'关注作者',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByText('已关注，感谢你的喜欢。')).toBeVisible();
 await page.getByRole('button',{name:'再猜一次',exact:true}).click();await finish(page);await page.waitForTimeout(900);await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('暂时不用不会封锁下局手动入口，返回同一结算不重弹，中途退出不弹',async({page})=>{
 await host(page,'ok',0);await page.goto('/');await beginCountry(page);await finish(page);await expect(page.getByRole('dialog',{name:'关注作者'})).toHaveCount(0);await page.locator('.result-actions').getByRole('button',{name:'关注作者',exact:true}).click();await expect(page.getByRole('dialog',{name:'关注作者'})).toBeVisible();await page.getByRole('button',{name:'暂时不用'}).click();
 await page.getByRole('button',{name:'排行榜',exact:true}).click();await page.getByRole('button',{name:'返回',exact:true}).click();await page.waitForTimeout(800);await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByRole('button',{name:'再猜一次',exact:true}).click();await finish(page);await expect(page.getByRole('dialog',{name:'关注作者'})).toHaveCount(0);await page.locator('.result-actions').getByRole('button',{name:'关注作者',exact:true}).click();await expect(page.getByRole('dialog',{name:'关注作者'})).toBeVisible();await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'再猜一次',exact:true}).click();await page.getByRole('button',{name:'退出本局'}).click();await page.getByRole('button',{name:'返回首页',exact:true}).click();await page.waitForTimeout(800);await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('关注原生等待超过5秒：关闭卡片、再玩都不能重复唤起',async({page})=>{
 await host(page,'ok',0);await page.goto('/');await page.evaluate(()=>{(window as any).xhs.miniTool.followAuthor=()=>{(window as any).__calls.push(['follow']);return new Promise(resolve=>{(window as any).__finishFollow=resolve;});};});
 await beginCountry(page);await finish(page);await page.locator('.result-actions').getByRole('button',{name:'关注作者',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'关注作者',exact:true}).click();await expect(page.getByText('仍在等待小红书确认，可以关闭此提示继续玩。')).toBeVisible({timeout:7000});
 await page.getByRole('button',{name:'暂时不用'}).click();await page.getByRole('button',{name:'再猜一次',exact:true}).click();await finish(page);await expect(page.getByRole('dialog',{name:'关注作者'})).toHaveCount(0);await page.locator('.result-actions').getByRole('button',{name:'关注作者',exact:true}).click();await expect(page.getByRole('dialog',{name:'关注作者'})).toBeVisible();await expect(page.getByRole('button',{name:'等待小红书确认…'})).toBeDisabled();
 expect(await page.evaluate(()=>(window as any).__calls.filter((c:any)=>c[0]==='follow').length)).toBe(1);await page.keyboard.press('Escape');await page.evaluate(()=>(window as any).__finishFollow({follow_status:1}));await page.waitForTimeout(100);await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('快速返回首页取消未出现的关注卡，但不取消已完成局的延迟授权提交',async({page})=>{
 await host(page,'temporary',0);await page.goto('/');await page.evaluate(()=>{(window as any).xhs.miniTool.getMyRank=()=>new Promise(resolve=>setTimeout(()=>resolve({status:'NO_SCORE',rank:null,score:null}),1200));});await page.waitForTimeout(1100);
 await beginCountry(page);await finish(page);await page.getByRole('button',{name:'返回首页',exact:true}).click();await page.waitForTimeout(1600);await expect(page.getByRole('dialog')).toHaveCount(0);expect(await page.evaluate(()=>(window as any).__calls.filter((c:any)=>c[0]==='submit').length)).toBe(1);
});
test('未授权、空榜和故障不混淆，不提交探测分',async({page})=>{
 await host(page,'unauthorized');await page.goto('/');await page.waitForTimeout(200);await expect(page.locator('.home-ranks')).toHaveCount(0);await expect(page.getByRole('button',{name:'查看完整排行榜',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'排行榜',exact:true})).toHaveCount(0);await beginCountry(page);await expect(page.locator('.answers')).toBeVisible();expect(await page.evaluate(()=>(window as any).__calls.some((c:any)=>c[0]==='submit'))).toBe(false);
});
test('真实空榜在首页与完整页一致，临时失败不伪装成空榜',async({page})=>{
 await host(page);await page.addInitScript(()=>{(window as any).xhs.miniTool.getRankList=async(o:any)=>{(window as any).__calls.push(['list',o]);if((window as any).__failRanks)throw{errCode:2009};return{data:[]};};});await page.goto('/');
 await expect(page.locator('.home-ranks')).toContainText('这一期，还没有人留下成绩。');await page.getByRole('button',{name:'查看完整排行榜',exact:true}).click();await expect(page.getByText('这一期，还没有人留下成绩。')).toBeVisible();
 await page.evaluate(()=>{(window as any).__failRanks=true;});await page.getByRole('button',{name:'本周',exact:true}).click();await expect(page.getByText('榜单暂时没连上，请稍后重试。')).toBeVisible();await expect(page.getByText('这一期，还没有人留下成绩。')).toHaveCount(0);
});
test('存储不可用仍可玩并显示未保存，未知关注关系不自动弹窗',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw Error('blocked');}});});await page.goto('/');await beginCountry(page);await correct(page);await expect(page.locator('.feedback-line')).toContainText('不用着急');await finish(page);await expect(page.getByText('本次记录暂未保存，退出后可能丢失。')).toBeVisible();await page.waitForTimeout(900);await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.result-actions').getByRole('button',{name:'关注作者',exact:true})).toHaveCount(0);
});
test('海南四市全部认完正常结算，提供手动关注；作者本人不弹',async({page})=>{
 await host(page,'ok',0);await page.goto('/');await page.getByRole('button',{name:'猜中国大陆地区',exact:true}).click();await selectRegion(page,'海南省');await begin(page);
 for(let i=0;i<4;i++){if((await currentQuestion(page)).name==='三沙市')await page.screenshot({path:'artifacts/sansha-stroke.png',animations:'disabled'});await correct(page);if(i<3)await expect(page.locator('.feedback-line')).toContainText('不用着急');}
 await expect(page.locator('.result-number')).toContainText('4');await expect(page.getByText('这一组，全部认完了')).toBeVisible();await expect(page.getByRole('dialog',{name:'关注作者'})).toHaveCount(0);await page.locator('.result-actions').getByRole('button',{name:'关注作者',exact:true}).click();await expect(page.getByRole('dialog',{name:'关注作者'})).toBeVisible();await page.keyboard.press('Escape');
 await page.evaluate(()=>{(window as any).__followStatus=2;});await page.getByRole('button',{name:'再猜一次',exact:true}).click();await finish(page);await page.waitForTimeout(900);await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('多视口无横向溢出，短屏主按钮可见，资源离线完整',async({page},info)=>{
 const external:string[]=[];page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4187/'))external.push(r.url());});await page.goto('/');
 for(const width of [320,360,390,430,1024]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await page.setViewportSize({width:390,height:650});await page.getByRole('button',{name:'猜国家',exact:true}).click();const box=await page.getByRole('button',{name:'开始猜',exact:true}).boundingBox();expect(box!.y+box!.height).toBeLessThanOrEqual(650);await page.screenshot({path:`artifacts/home-short-${info.project.name}.png`,fullPage:true,animations:'disabled'});
 await page.getByRole('button',{name:'猜中国大陆地区',exact:true}).click();const city=await page.getByRole('button',{name:'开始猜',exact:true}).boundingBox();expect(city!.y+city!.height).toBeLessThanOrEqual(650);await page.screenshot({path:`artifacts/home-city-short-${info.project.name}.png`,fullPage:true,animations:'disabled'});
 await setup(page);await page.screenshot({path:`artifacts/setup-city-${info.project.name}.png`,fullPage:true,animations:'disabled'});await page.locator('.region-trigger').click();await page.screenshot({path:`artifacts/regions-${info.project.name}.png`,fullPage:true,animations:'disabled'});await page.keyboard.press('Escape');await begin(page);await page.screenshot({path:`artifacts/city-${info.project.name}.png`,fullPage:true,animations:'disabled'});expect(external).toEqual([]);
});

test('首页地区入口选择即应用，不结算，开局沿用该范围，省级范围独立提交board5',async({page},info)=>{
 await host(page);await page.goto('/');await setup(page);await expect(page.locator('.region-trigger')).toContainText('全部地区');await noDifficulty(page);await page.screenshot({path:`artifacts/home-mainland-${info.project.name}.png`,animations:'disabled'});await expect(page.getByRole('button',{name:'开始猜',exact:true})).toBeVisible();
 await selectRegion(page,'重庆市');await expect(page.locator('.region-trigger')).toContainText('37 道轮廓');await expect(page.locator('.home-secondary')).toContainText('重庆市');await selectRegion(page,'全部地区');await expect(page.locator('.region-trigger')).toContainText('全部地区');await expect(page.locator('.region-trigger')).toContainText('31 道轮廓');expect(await page.evaluate(()=>(window as any).__calls.filter((c:any)=>c[0]==='submit'))).toEqual([]);
 await begin(page);await expect(page.locator('.question-context')).toHaveText('中国大陆 · 省级地区');await finish(page);await expect.poll(()=>page.evaluate(()=>(window as any).__calls.filter((c:any)=>c[0]==='submit').length)).toBe(1);expect(await page.evaluate(()=>(window as any).__calls.find((c:any)=>c[0]==='submit')[1])).toEqual({board:5,score:0});
});
test('31地区都能在地区面板选中并开局，四直辖市区县不串题',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'猜中国大陆地区',exact:true}).click();
 for(const region of bank.regions){await selectRegion(page,region.name);await expect(page.locator('.region-trigger')).toContainText(`${bank.cities.filter(q=>q.regionId===region.id).length} 道轮廓`);await begin(page);expect((await currentQuestion(page)).regionId).toBe(region.id);await page.getByRole('button',{name:'退出本局'}).click();await page.getByRole('button',{name:'返回首页',exact:true}).click();}
});

test('地区面板断点、短横屏滚动与焦点环，位置图不遮挡主图',async({page},info)=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
 for(const viewport of [{width:320,height:568},{width:844,height:390},{width:1200,height:800}]){
  await page.setViewportSize(viewport);await page.locator('.region-trigger').click();const dialog=page.getByRole('dialog');const box=await dialog.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.y+box!.height).toBeLessThanOrEqual(viewport.height+1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(viewport.width<=600)expect(Math.abs(box!.y+box!.height-viewport.height)).toBeLessThan(1);else expect(Math.abs(box!.x+box!.width/2-viewport.width/2)).toBeLessThan(1);
  for(const key of ['Tab','Shift+Tab'])for(let i=0;i<8;i++){await page.keyboard.press(key);expect(await dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true);}
  await page.screenshot({path:`artifacts/regions-sheet-${viewport.width}-${info.project.name}.png`,animations:'disabled'});await page.keyboard.press('Escape');
 }
 await page.setViewportSize({width:390,height:650});await page.getByRole('button',{name:'猜中国大陆地区',exact:true}).click();await selectRegion(page,'北京市');await begin(page);const main=await page.locator('.question-map>.map-scene').boundingBox(),inset=await page.locator('.location-inset').boundingBox();expect(main!.x+main!.width).toBeLessThanOrEqual(inset!.x);await page.screenshot({path:`artifacts/city-separated-${info.project.name}.png`,animations:'disabled'});
});

async function freezeTime(page:Page){const now=Date.now();await page.clock.install({time:now});await page.clock.pauseAt(now+1000);}

test('国家玩法每题上下文行都含“国家”，法国同时标注欧洲本土及科西嘉岛',async({page})=>{
 await freezeTime(page);await host(page);await page.goto('/');await beginCountry(page);
 let sawFrance=false;
 for(let i=0;i<46;i++){
  const q=await currentQuestion(page);const line=await page.locator('.question-context').innerText();expect(line).toContain('国家');
  if(q.id==='country-fra'){sawFrance=true;expect(line).toContain('欧洲本土及科西嘉岛');}
  await correct(page);await page.clock.runFor(700);if(await page.locator('.result-number').count())break;
 }
 expect(sawFrance).toBe(true);
});
async function questionPath(page:Page){return page.locator('.question-map .outline-map>path').getAttribute('d');}
test('答错完整停留3秒再切题；手动提前继续不会遗留旧计时器，第三错自动结算只提交一次',async({page},info)=>{
 await freezeTime(page);await host(page);await page.goto('/');await beginCountry(page);
 const first=await questionPath(page);await wrong(page);await expect(page.locator('.auto-advance-note')).toContainText('3 秒后自动继续');
 await page.clock.runFor(2999);expect(await questionPath(page)).toBe(first);await expect(page.locator('.wrong-message')).toBeVisible();const note=await page.locator('.auto-advance-note').boundingBox();expect(note!.y+note!.height).toBeLessThanOrEqual(page.viewportSize()!.height);await expect(page.locator('.auto-advance-note')).toHaveText('3 秒后自动继续');await page.screenshot({path:`artifacts/wrong-auto-${info.project.name}.png`,animations:'disabled'});
 await page.clock.runFor(1);expect(await questionPath(page)).not.toBe(first);await expect(page.locator('.next-button')).toHaveCount(0);
 await wrong(page);await page.clock.runFor(1000);await page.locator('.next-button').click();const third=await questionPath(page);await wrong(page);await expect(page.locator('.auto-advance-note')).toContainText('3 秒后自动结算');
 await page.clock.runFor(2000);expect(await questionPath(page)).toBe(third);await expect(page.locator('.result-number')).toHaveCount(0);
 await page.clock.runFor(999);await expect(page.locator('.wrong-message')).toBeVisible();await page.clock.runFor(1);await expect(page.locator('.result-number')).toContainText('0');
 await expect.poll(()=>page.evaluate(()=>(window as any).__calls.filter((c:any)=>c[0]==='submit').length)).toBe(1);await page.clock.runFor(5000);expect(await page.evaluate(()=>(window as any).__calls.filter((c:any)=>c[0]==='submit').length)).toBe(1);
});
test('答错时打开退出确认暂停推进，取消后重新留足3秒',async({page})=>{
 await freezeTime(page);await page.goto('/');await beginCountry(page);const original=await questionPath(page);await wrong(page);await page.clock.runFor(1000);await page.getByRole('button',{name:'退出本局'}).click();await page.clock.runFor(6000);
 await expect(page.getByRole('dialog',{name:'退出本局'})).toBeVisible();expect(await questionPath(page)).toBe(original);await page.keyboard.press('Escape');await page.clock.runFor(2999);expect(await questionPath(page)).toBe(original);await page.clock.runFor(1);expect(await questionPath(page)).not.toBe(original);
});
test('答错后进入后台不切题，恢复前台重新留足3秒；退出及新局不受旧计时器影响',async({page})=>{
 await freezeTime(page);await page.goto('/');await beginCountry(page);const original=await questionPath(page);await wrong(page);await page.clock.runFor(1000);
 const visibility=async(hidden:boolean)=>page.evaluate(hidden=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>hidden});document.dispatchEvent(new Event('visibilitychange'));},hidden);
 await visibility(true);await page.clock.runFor(10000);expect(await questionPath(page)).toBe(original);await visibility(false);await page.clock.runFor(2999);expect(await questionPath(page)).toBe(original);await page.clock.runFor(1);expect(await questionPath(page)).not.toBe(original);
 await wrong(page);await page.clock.runFor(1000);await page.getByRole('button',{name:'退出本局'}).click();await page.getByRole('button',{name:'返回首页',exact:true}).click();await beginCountry(page);const restarted=await questionPath(page);await wrong(page);await page.clock.runFor(2999);expect(await questionPath(page)).toBe(restarted);await page.clock.runFor(1);expect(await questionPath(page)).not.toBe(restarted);await expect(page.locator('.score strong')).toHaveText('0');
});
test('最后一道答错但未到三错，也在展示3秒后自动结算',async({page})=>{
 await freezeTime(page);await page.goto('/');await page.getByRole('button',{name:'猜中国大陆地区',exact:true}).click();await selectRegion(page,'海南省');await begin(page);
 for(let i=0;i<3;i++){await correct(page);await page.clock.runFor(650);await expect(page.locator('.next-button')).toHaveCount(0);}
 const last=await questionPath(page);await wrong(page);await expect(page.locator('.auto-advance-note')).toContainText('3 秒后自动结算');await page.clock.runFor(2999);expect(await questionPath(page)).toBe(last);await page.clock.runFor(1);await expect(page.locator('.result-number')).toContainText('3');await expect(page.locator('.result-layout>.eyebrow')).toContainText('全部认完');
});


test('省级首页与准备一致，题面同级无答案提示，31题全对提交board5',async({page},info)=>{
 await page.setViewportSize({width:320,height:568});await freezeTime(page);await host(page);await page.goto('/');await page.getByRole('button',{name:'猜中国大陆地区',exact:true}).click();
 await expect(page.locator('.atlas-caption')).toContainText('广东省');await expect(page.locator('.atlas-count')).toContainText('31');
 await setup(page);await expect(page.locator('.region-trigger')).toContainText('31 道轮廓');await expect(page.locator('.region-trigger')).toContainText('省级行政区');await begin(page);
 const names=bank.regions.map(r=>r.name),seen=new Set<string>();
 for(let i=0;i<31;i++){
  const q=await currentQuestion(page);expect(seen.has(q.id)).toBe(false);seen.add(q.id);
  await expect(page.locator('.question-heading h1')).toHaveText('这是哪个省级行政区？');await expect(page.locator('.question-heading>.eyebrow')).toHaveText('中国大陆 · 省级地区');await expect(page.locator('.location-inset')).toHaveCount(0);
  const answers=await page.locator('.answer-button>span:nth-child(2)').allTextContents();expect(answers.every(n=>names.includes(n))).toBe(true);expect(new Set(answers).size).toBe(4);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await page.locator('.answer-button>span:nth-child(2)').evaluateAll(els=>els.every(el=>el.scrollWidth<=el.clientWidth))).toBe(true);
  if(q.name==='新疆维吾尔自治区')await page.screenshot({path:`artifacts/province-long-${info.project.name}.png`,fullPage:true,animations:'disabled'});
  if(i===0)await page.screenshot({path:`artifacts/province-${info.project.name}.png`,fullPage:true,animations:'disabled'});
  await correct(page);await page.clock.runFor(650);
 }
 await expect(page.locator('.result-number')).toContainText('31');await expect(page.getByText('这一组，全部认完了')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>(window as any).__calls.filter((c:any)=>c[0]==='submit').length)).toBe(1);
 expect(await page.evaluate(()=>(window as any).__calls.find((c:any)=>c[0]==='submit')[1])).toEqual({board:5,score:31});
 expect(await page.evaluate(()=>(window as any).__calls.some((c:any)=>c[1]?.board===4))).toBe(false);
});
test('安徽重玩沿用16市，返回首页恢复省级范围与最佳',async({page})=>{
 await host(page);await page.goto('/');await page.getByRole('button',{name:'猜中国大陆地区',exact:true}).click();await selectRegion(page,'安徽省');await expect(page.locator('.region-trigger')).toContainText('16 道轮廓');await begin(page);await correct(page);await expect(page.locator('.feedback-line')).toContainText('不用着急');await finish(page);
 await page.getByRole('button',{name:'查看省级榜',exact:true}).click();await expect(page.locator('.board-caption')).toContainText('省级地区');await page.getByRole('button',{name:'返回',exact:true}).click();await page.getByRole('button',{name:'再猜一次',exact:true}).click();expect((await currentQuestion(page)).regionId).toBe('340000');
 await page.getByRole('button',{name:'退出本局'}).click();await page.getByRole('button',{name:'返回首页',exact:true}).click();await expect(page.locator('.home-secondary')).toContainText('省级地区');await expect(page.locator('.home-secondary strong')).toHaveText('0');await setup(page);await expect(page.locator('.region-trigger')).toContainText('全部地区');await expect(page.locator('.region-trigger')).toContainText('31 道轮廓');
});
