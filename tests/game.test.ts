import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../src/data/questions.json';
import countrySnapshot from '../scripts/data/country-snapshot.json';
import { newSession, answer, advance } from '../src/game/session';
import { validateBank, makeDeck, poolFor, provinceQuestions, questionForId, type QuestionBank } from '../src/game/questions';
import { bestKey, boardFor, boardIds, defaultOptions, difficulties } from '../src/game/options';
const bank = data as QuestionBank;
test('题库及31地区完整覆盖，虚假完整声明仍被拒绝', () => {
 assert.deepEqual(validateBank(bank), []); assert.equal(bank.regions.length,31);
 assert.equal(bank.coverage.complete,true);assert.equal(bank.cities.length,418);
 assert.equal(bank.regions.find(r=>r.id==='110000')!.status,'complete');
 const forged=structuredClone(bank);forged.regions[0].coverageComplete=false;assert.ok(validateBank(forged).length>0);
});
test('默认中等/全部，中国任何开局都进board5，记录键仍按开局地区独立',()=>{
 assert.deepEqual(defaultOptions('countries'),{mode:'countries',difficulty:'medium'});
 assert.deepEqual(defaultOptions('cities'),{mode:'cities',regionId:'all'});
 assert.deepEqual(Object.values(boardIds),[1,2,3,5]);
 assert.equal(boardFor({mode:'cities',regionId:'440000'}),'china-provinces');
 assert.equal(boardFor({mode:'cities',regionId:'all'}),'china-provinces');
 assert.notEqual(bestKey({mode:'cities',regionId:'all'}),bestKey({mode:'cities',regionId:'440000'}));
});
for(const difficulty of difficulties) test(`国家${difficulty}使用全部国家、由易到难分段、选项有效、单局不重复`,()=>{
 const options={mode:'countries' as const,difficulty};const pool=poolFor(bank,options);
 assert.equal(pool.length,bank.countries.length);
 for(let i=0;i<20;i++){
  const deck=makeDeck(bank,options);assert.equal(deck.length,pool.length);assert.equal(new Set(deck.map(q=>q.id)).size,pool.length);
  assert.ok(deck.every((q,n)=>n===0||deck[n-1].difficulty<=q.difficulty),'档位单调不减');
  for(const q of deck){assert.equal(q.choices.length,4);assert.equal(new Set(q.choices).size,4);assert.ok(q.choices.includes(q.id));assert.ok(q.choices.filter(id=>id!==q.id).every(id=>q.distractors![difficulty].includes(id)));}
 }
});
test('指定地区先出本地区全部下级题，再接其余全国下级题，选项始终同省',()=>{
 const deck=makeDeck(bank,{mode:'cities',regionId:'440000'});assert.equal(deck.length,418);assert.equal(new Set(deck.map(q=>q.id)).size,418);
 assert.ok(deck.slice(0,21).every(q=>q.regionId==='440000'));assert.ok(deck.slice(21).every(q=>q.regionId!=='440000'));
 assert.ok(deck.every(q=>q.adminType!=='province-level'&&q.choices.every(id=>bank.cities.find(x=>x.id===id)!.regionId===q.regionId)));
 const beijing=newSession(bank,{mode:'cities',regionId:'110000'});assert.equal(beijing.deck.length,418);assert.ok(beijing.deck.slice(0,16).every(q=>q.regionId==='110000'&&q.adminType==='district'));
 assert.equal(beijing.boardKey,'china-provinces');assert.equal(beijing.bestKey,'cities:110000');
 assert.throws(()=>newSession(bank,{mode:'cities',regionId:'invalid'}),/无效/);
});
test('Session冻结选项快照；后续修改原对象不改变榜位或记录归属',()=>{
 const options={mode:'countries' as const,difficulty:'easy' as const};const s=newSession(bank,options);
 assert.ok(Object.isFrozen(s.options));assert.equal(s.boardKey,'country-easy');
 assert.equal(s.bestKey,'countries:easy');assert.equal(s.rulesVersion,'4');assert.equal(s.bankVersion,bank.version);
});
test('按实体ID判分，同名不歧义，每题最多一次，旧题事件无效',()=>{
 const s=newSession(bank,'countries'),q=s.deck[0];
 assert.equal(answer(s,'old','x'),false);assert.equal(answer(s,q.id,q.name),false);
 assert.equal(answer(s,q.id,q.id),true);assert.equal(s.score,1);
 assert.equal(answer(s,q.id,q.id),false);advance(s);assert.equal(answer(s,q.id,q.id),false);
});
test('三错结束保留原得分',()=>{
 const s=newSession(bank,'cities');answer(s,s.deck[0].id,s.deck[0].id);advance(s);
 for(let n=0;n<3;n++){const q=s.deck[s.index];answer(s,q.id,q.choices.find(id=>id!==q.id)!);advance(s);}
 assert.equal(s.score,1);assert.equal(s.mistakes,3);assert.equal(s.phase,'finished');assert.equal(advance(s),false);
});
test('全部答完结束不循环，新局清空',()=>{
 const s=newSession(bank,'countries');for(const q of s.deck){assert.equal(answer(s,q.id,q.id),true);advance(s);}
 assert.equal(s.score,s.deck.length);assert.equal(s.phase,'finished');assert.equal(answer(s,s.deck[0].id,s.deck[0].id),false);
 const b=newSession(bank,'cities');assert.notEqual(b.id,s.id);assert.equal(b.score,0);assert.equal(b.mistakes,0);
});
test('最后一题答错但未到三错，也正常结算',()=>{
 const s=newSession(bank,{mode:'cities',regionId:'460000'});s.deck=s.deck.slice(0,3);
 for(let n=0;n<2;n++){const q=s.deck[s.index];answer(s,q.id,q.id);advance(s);}
 const last=s.deck[s.index];answer(s,last.id,last.choices.find(id=>id!==last.id)!);assert.equal(s.mistakes,1);advance(s);
 assert.equal(s.phase,'finished');assert.equal(s.score,2);
});
test('题库校验拒绝空轮廓、错误选项和丢失背景',()=>{
 const bad=structuredClone(bank);bad.cities[0].context!.regionId='invalid';bad.countries[0].choices=['x','x','x','x'];bad.countries[1].path='';
 assert.ok(validateBank(bad).length>=3);
});

test('全部31地区都可开始，本地区在前，干扰项同地区，目录类型和数量准确',()=>{
 const expected:Record<string,number>={'110000':16,'120000':16,'310000':16,'500000':37,'440000':21,'460000':4};
 for(const region of bank.regions){
  const full=makeDeck(bank,{mode:'cities',regionId:region.id});const local=bank.cities.filter(q=>q.regionId===region.id).length;
  const deck=full.slice(0,local);assert.ok(deck.length>=4);assert.ok(region.coverageComplete);assert.equal(region.status,'complete');
  assert.equal(full.length,418);assert.ok(full.slice(local).every(q=>q.regionId!==region.id));
  if(expected[region.id])assert.equal(deck.length,expected[region.id]);
  assert.equal(new Set(deck.map(q=>q.id)).size,deck.length);
  for(const q of deck){assert.equal(q.regionId,region.id);assert.ok(q.context?.highlight);assert.equal(q.choices.length,4);assert.ok(q.choices.every(id=>bank.cities.find(c=>c.id===id)?.regionId===region.id));assert.ok(region.kind==='municipality'?['district','county'].includes(q.adminType!):['city','prefecture'].includes(q.adminType!));}
 }
 assert.equal(makeDeck(bank,'cities').length,449);
 assert.ok(bank.cities.some(q=>q.name==='两江新区'&&q.regionId==='500000'));
 assert.ok(!bank.cities.some(q=>q.name==='江北区'&&q.regionId==='500000'));
});
test('SVG坐标有限、主图与背景在边框内，国家几何保持原样',()=>{
 for(const q of [...bank.countries,...bank.cities,...bank.regions]){
  const numbers=q.path.match(/-?\d+(?:\.\d+)?/g)!.map(Number);assert.equal(numbers.length%2,0);
  numbers.forEach((v,i)=>assert.ok(Number.isFinite(v)&&v>=0&&v<=(i%2?300:400),q.id));
 }
});

test('所有中国主图、背景、高亮的序列化环保留至少三个不同顶点',()=>{
 for(const q of [...bank.cities,...bank.regions]){
  const paths=[q.path,...('context' in q&&q.context?[q.context.highlight]:[])];
  for(const path of paths)for(const ring of path.split('Z').filter(Boolean)){
   const points=ring.slice(1).split('L');assert.ok(new Set(points).size>=3,`${q.id}: 序列化退化`);
  }
 }
});

test('国家快照与题库一致，原60国保持在前且新增国家排除争议边界',()=>{
 assert.deepEqual(bank.countries,countrySnapshot.countries);assert.equal(bank.countries.length,118);
 const ids=new Set(bank.countries.map(q=>q.id));assert.equal(ids.size,118);
 for(const id of ['country-ind','country-pak','country-srb','country-som','country-isr','country-chn','country-twn','country-fji'])assert.ok(!ids.has(id),id);
 for(const id of ['country-rus','country-nzl','country-nld'])assert.ok(ids.has(id),id);
 for(const q of bank.countries)for(const level of difficulties)assert.ok(q.distractors![level].every(id=>ids.has(id)));
});


test('默认全部地区：先31道省级打散，再接418道下级题打散，无重复', () => {
 for(let run=0;run<5;run++){
  const deck=makeDeck(bank,'cities');assert.equal(deck.length,449);assert.equal(new Set(deck.map(q=>q.id)).size,449);
  assert.ok(deck.slice(0,31).every(q=>q.adminType==='province-level'));assert.ok(deck.slice(31).every(q=>q.adminType!=='province-level'&&q.regionId));
  for(const q of deck.slice(31))assert.ok(q.choices.every(id=>bank.cities.find(c=>c.id===id)?.regionId===q.regionId));
 }
 assert.equal(poolFor(bank,defaultOptions('cities')).length,449);
});
test('默认省级题段31题，同级四选项、正式名称、独立ID且不泄露父地区', () => {
 const original=JSON.stringify(bank);const provinces=provinceQuestions(bank);
 assert.equal(provinces.length,31);assert.equal(new Set(provinces.map(q=>q.id)).size,31);
 const kinds=new Set(bank.regions.map(r=>r.kind));assert.equal(kinds.size,3);
 for(let run=0;run<10;run++){
  const deck=makeDeck(bank,'cities').slice(0,31);assert.equal(new Set(deck.map(q=>q.id)).size,31);
  for(const q of deck){
   const r=bank.regions.find(r=>`china-province-${r.id}`===q.id)!;
   assert.equal(q.adminType,'province-level');assert.equal(q.region,'中国大陆');assert.equal(q.regionId,undefined);assert.equal(q.context,undefined);
   assert.equal(q.name,r.name);assert.equal(q.path,r.path);assert.equal(q.choices.length,4);assert.equal(new Set(q.choices).size,4);assert.ok(q.choices.includes(q.id));
   for(const id of q.choices)assert.equal(questionForId(bank,id)?.adminType,'province-level');
  }
 }
 assert.equal(JSON.stringify(bank),original);
 assert.equal(questionForId(bank,bank.countries[0].id)?.name,bank.countries[0].name);
 assert.equal(questionForId(bank,bank.cities[0].id)?.name,bank.cities[0].name);
 assert.equal(questionForId(bank,'missing'),undefined);
 const bad=structuredClone(bank);bad.regions[0].path='';bad.regions[1].name='';assert.ok(validateBank(bad).length>=2);
});
test('省级31题全对后不结算，直接进入下级题；沿用旧记录键和第5榜位', () => {
 const s=newSession(bank,'cities');assert.equal(s.bestKey,'cities:provinces');assert.equal(s.boardKey,'china-provinces');assert.equal(boardIds[s.boardKey!],5);
 for(const q of s.deck.slice(0,31)){assert.equal(answer(s,q.id,q.id),true);advance(s);}
 assert.equal(s.phase,'question');assert.equal(s.score,31);assert.notEqual(s.deck[s.index].adminType,'province-level');
 assert.equal(makeDeck(bank,{mode:'cities',regionId:'340000'}).slice(0,16).every(q=>q.regionId==='340000'),true);
});

test('统一国家玩法使用全部118国，沿用medium记录键和board2，旧难度纪录键仍有效',()=>{
 const current=defaultOptions('countries');
 assert.equal(poolFor(bank,current).length,118);
 assert.equal(boardFor(current),'country-medium');
 assert.equal(bestKey(current),'countries:medium');
 assert.notEqual(bestKey({mode:'countries',difficulty:'easy'}),bestKey(current));
 assert.notEqual(bestKey({mode:'countries',difficulty:'hard'}),bestKey(current));
});
