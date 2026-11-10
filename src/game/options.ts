import type { Mode } from '../platform/types';
export const difficulties = ['easy', 'medium', 'hard'] as const;
export type Difficulty = typeof difficulties[number];
export const difficultyNames: Record<Difficulty, string> = { easy: '简单', medium: '中等', hard: '困难' };
export type GameOptions = Readonly<{ mode: 'countries'; difficulty: Difficulty } | { mode: 'cities'; regionId: string }>;
export type BoardKey = 'country-easy' | 'country-medium' | 'country-hard' | 'china-provinces';
export const boardIds: Record<BoardKey, number> = { 'country-easy': 1, 'country-medium': 2, 'country-hard': 3, 'china-provinces': 5 };
export const boardNames: Record<BoardKey, string> = { 'country-easy': '国家 · 简单', 'country-medium': '国家', 'country-hard': '国家 · 困难', 'china-provinces': '中国大陆 · 省级地区' };
export const RULES_VERSION = '3';
export function defaultOptions(mode: Mode): GameOptions { return mode === 'countries' ? { mode, difficulty: 'medium' } : { mode, regionId: 'all' }; }
export function boardFor(options: GameOptions): BoardKey | null {
  return options.mode === 'countries' ? `country-${options.difficulty}` : options.regionId === 'all' ? 'china-provinces' : null;
}
export function bestKey(options: GameOptions): string { return options.mode === 'countries' ? `countries:${options.difficulty}` : `cities:${options.regionId === 'all' ? 'provinces' : options.regionId}`; }
export function optionsForBoard(board: BoardKey): GameOptions { return board === 'china-provinces' ? { mode: 'cities', regionId: 'all' } : { mode: 'countries', difficulty: board.slice(8) as Difficulty }; }
export function validOptions(value: GameOptions, regionIds: string[]): boolean {
  return value.mode === 'countries' ? difficulties.includes(value.difficulty) : value.mode === 'cities' && (value.regionId === 'all' || regionIds.includes(value.regionId));
}
export function validBestKey(key: string): boolean { return /^countries:(easy|medium|hard)$/.test(key) || /^cities:(all|provinces|\d{6})$/.test(key); }
