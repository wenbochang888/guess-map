import type { BoardKey } from '../game/options';
export type Mode = 'countries' | 'cities';
export type Period = 'day' | 'week' | 'all';

export interface RankEntry {
  rank: number;
  score: number;
  nickname: string | null;
}

export type MyRank =
  | { status: 'EXACT'; rank: number; score: number }
  | {
      status: 'OVER_LIMIT' | 'NO_SCORE' | 'NOT_PARTICIPATING';
      rank: null;
      score: null;
    };

export interface RankResult {
  entries: RankEntry[];
  mine: MyRank;
}

export interface LeaderboardService {
  readonly availability: 'unknown' | 'available' | 'unavailable';
  probe(): Promise<void>;
  load(board: BoardKey, period: Period, force?: boolean): Promise<RankResult>;
  submit(board: BoardKey, score: number, runId: string): Promise<void>;
}
