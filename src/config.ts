import { boardIds, RULES_VERSION } from './game/options';
const mapApprovalNumber = 'GS(2026)4921号';
export const config = {
  mapApprovalNumber,
  mapApprovalLabel: `审图号：${mapApprovalNumber}`,
  leaderboardEnabled: true,
  rulesVersion: RULES_VERSION,
  maxMistakes: 3,
  correctDelayMs: 650,
  wrongDelayMs: 3_000,
  boards: boardIds,
} as const;
