import { defaultOptions, validOptions, type Difficulty, type GameOptions } from './options';
import type { Mode } from '../platform/types';
export interface Region { id: string; name: string; kind: 'province' | 'autonomous' | 'municipality'; status: 'sample' | 'missing' | 'complete'; path: string; coverageComplete: boolean }
export interface Question {
  id: string; name: string; region: string; difficulty: 1 | 2 | 3; path: string;
  regionId?: string; adminType?: 'city' | 'prefecture' | 'district' | 'county' | 'province-level';
  context?: { regionId: string; highlight: string };
  choices: string[];
  distractors?: Record<Difficulty, string[]>;
}
export interface QuestionBank { notices: { name: string; license: string; attribution: string; licenseUrl: string }[]; version: string; countries: Question[]; cities: Question[]; regions: Region[]; coverage: { complete: boolean; note: string; status: string } }
export type Random = () => number;
export function shuffle<T>(items: readonly T[], random: Random = Math.random): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.max(0, Math.min(0.99999999, random())) * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}
// 复用目录轮廓，不修改原始地图数据或下级题库。
export function provinceQuestions(bank: QuestionBank): Question[] {
  const ids = bank.regions.map(r => `china-province-${r.id}`);
  return bank.regions.map((r, index) => ({
    id: ids[index], name: r.name, region: '中国大陆', adminType: 'province-level',
    difficulty: 2, path: r.path,
    choices: [ids[index], ...ids.filter(id => id !== ids[index]).slice(0, 3)],
  }));
}
export function questionForId(bank: QuestionBank, id: string): Question | undefined {
  return bank.countries.find(q => q.id === id) || bank.cities.find(q => q.id === id)
    || provinceQuestions(bank).find(q => q.id === id);
}
// 局内题面的范围说明：只展示部分领土的国家必须如实标注。
export const countryScopeNotes: Readonly<Record<string, string>> = {
  'country-fra': '欧洲本土及科西嘉岛', 'country-nld': '欧洲本土', 'country-ecu': '不含加拉帕戈斯群岛', 'country-nzl': '本土主要岛屿',
};
// 一局的全部题目：国家为全部国家；中国全部地区为31省级+全部下级题；指定地区为全部下级题（本地区在前）。
export function poolFor(bank: QuestionBank, options: GameOptions): Question[] {
  if (!validOptions(options, bank.regions.map(r => r.id))) throw new Error('无效的题库设置');
  if (options.mode === 'countries') return bank.countries.slice();
  return options.regionId === 'all' ? provinceQuestions(bank).concat(bank.cities) : bank.cities.slice();
}
function orderedPool(bank: QuestionBank, options: GameOptions, random: Random): Question[] {
  if (options.mode === 'countries') {
    // 由易到难分段，每段内部打散。
    return [1, 2, 3].reduce<Question[]>((deck, band) => deck.concat(shuffle(bank.countries.filter(q => q.difficulty === band), random)), []);
  }
  if (options.regionId === 'all') return shuffle(provinceQuestions(bank), random).concat(shuffle(bank.cities, random));
  const local = bank.cities.filter(q => q.regionId === options.regionId);
  return shuffle(local, random).concat(shuffle(bank.cities.filter(q => q.regionId !== options.regionId), random));
}
export function makeDeck(bank: QuestionBank, optionsOrMode: GameOptions | Mode, random: Random = Math.random): Question[] {
  const options = typeof optionsOrMode === 'string' ? defaultOptions(optionsOrMode) : optionsOrMode;
  if (!validOptions(options, bank.regions.map(r => r.id))) throw new Error('无效的题库设置');
  const pool = orderedPool(bank, options, random);
  if (!pool.length) throw new Error('这个地区的边界数据尚未核验，暂时无法开始。');
  const provinceIds = bank.regions.map(r => `china-province-${r.id}`);
  return pool.map(q => {
    const others = options.mode === 'countries' ? q.distractors?.[options.difficulty]
      : q.adminType === 'province-level' ? provinceIds.filter(id => id !== q.id) : q.choices.filter(id => id !== q.id);
    if (!others || new Set(others).size < 3 || others.includes(q.id)) throw new Error(`四选项不足: ${q.id}`);
    return { ...q, choices: shuffle([q.id, ...shuffle(others, random).slice(0, 3)], random) };
  });
}
export function validateBank(bank: QuestionBank): string[] {
  const errors: string[] = []; const ids = new Set<string>();
  const provinces = provinceQuestions(bank); const provinceIds = new Set(provinces.map(q => q.id));
  const all = bank.countries.concat(bank.cities, provinces); const lookup = new Set(all.map(q => q.id));
  if (bank.regions.length !== 31 || new Set(bank.regions.map(r => r.id)).size !== 31) errors.push('大陆31地区目录不完整');
  for (const q of all) {
    if (ids.has(q.id)) errors.push(`重复ID: ${q.id}`); ids.add(q.id);
    if (q.choices.length !== 4 || new Set(q.choices).size !== 4 || !q.choices.includes(q.id) || q.choices.some(id => !lookup.has(id))) errors.push(`选项错误: ${q.id}`);
    if (!q.path || !/^[MLZ0-9.,\s-]+$/i.test(q.path)) errors.push(`轮廓错误: ${q.id}`);
    if (!q.region || ![1, 2, 3].includes(q.difficulty)) errors.push(`元数据错误: ${q.id}`);
    if (!q.name?.trim()) errors.push(`名称缺失: ${q.id}`);
    if (q.adminType === 'province-level') {
      if (q.choices.some(id => !provinceIds.has(id))) errors.push(`省级选项错误: ${q.id}`);
    } else if (q.regionId) {
      const region = bank.regions.find(r => r.id === q.regionId);
      if (!region?.path || q.context?.regionId !== q.regionId || !q.context.highlight) errors.push(`地区位置缺失: ${q.id}`);
    } else for (const level of ['easy', 'medium', 'hard'] as const) {
      const list = q.distractors?.[level];
      if (!list || new Set(list).size < 3 || list.includes(q.id) || list.some(id => !bank.countries.some(x => x.id === id))) errors.push(`干扰项错误: ${q.id}/${level}`);
    }
  }
  if (bank.coverage.complete && bank.regions.some(r => !r.coverageComplete || !bank.cities.some(q => q.regionId === r.id))) errors.push('完整覆盖声明与数据不符');
  return errors;
}
