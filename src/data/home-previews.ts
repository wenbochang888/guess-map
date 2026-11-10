import { config } from '../config';
import type { Question, QuestionBank } from '../game/questions';
import type { Mode } from '../platform/types';

export type HomePreview = {
  name: string;
  region: string;
  approvalLabel: string;
} & (
  | { kind: 'outline'; shape: Pick<Question, 'name' | 'path'> }
  | { kind: 'image'; imageSrc: string }
);

export function homePreviewFor(bank: QuestionBank, mode: Mode): HomePreview {
  if (mode === 'countries') {
    return {
      name: '中国', region: '亚洲', kind: 'image',
      imageSrc: './china-standard-map.jpg',
      approvalLabel: '审图号：GS(2023)2766号',
    };
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
