import { config } from '../config';
import type { Question, QuestionBank } from '../game/questions';
import type { Mode } from '../platform/types';

export type HomePreview = {
  name: string;
  region: string;
  approvalLabel: string;
  kind: 'outline';
  shape: Pick<Question, 'name' | 'path'>;
};

// 两种模式都复用题库里的轮廓，与题目同一种墨绿轮廓样式。
export function homePreviewFor(bank: QuestionBank, mode: Mode): HomePreview {
  if (mode === 'countries') {
    const italy = bank.countries.find(question => question.id === 'country-ita');
    if (!italy?.path) throw new Error('意大利首页示例缺失，请核对国家题库。');
    return { name: italy.name, region: italy.region, kind: 'outline', shape: { name: italy.name, path: italy.path }, approvalLabel: config.mapApprovalLabel };
  }
  const guangdong = bank.regions.find(region => region.id === '440000');
  if (!guangdong?.path) throw new Error('广东省首页示例缺失，请核对完整题库。');
  return {
    name: guangdong.name,
    region: '中国大陆',
    kind: 'outline',
    shape: { name: guangdong.name, path: guangdong.path },
    approvalLabel: config.mapApprovalLabel,
  };
}
