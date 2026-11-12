import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { previewSourceErrors } from '../scripts/check-home-previews.mjs';
import data from '../src/data/questions.json';
import { config } from '../src/config';
import { homePreviewFor } from '../src/data/home-previews';
import type { QuestionBank } from '../src/game/questions';

const bank = data as QuestionBank;

test('广东省示例复用省级轮廓', () => {
  const preview = homePreviewFor(bank, 'cities');
  assert.equal(preview.kind, 'outline');
  assert.equal(preview.name, '广东省');
  assert.equal(preview.shape.path, bank.regions.find(region => region.id === '440000')!.path);
  assert.equal(preview.approvalLabel, config.mapApprovalLabel);
});

test('广东轮廓缺失时明确报错，不再将占位状态当作正式首页', () => {
  const withoutGuangdong = { ...bank, regions: bank.regions.filter(region => region.id !== '440000') };
  assert.throws(() => homePreviewFor(withoutGuangdong, 'cities'), /广东省首页示例缺失/);
});

test('国家示例复用意大利题目轮廓，与题面同一审图号，不再使用标准地图原图', () => {
  const preview = homePreviewFor(bank, 'countries');
  assert.equal(preview.kind, 'outline');
  assert.equal(preview.name, '意大利');
  assert.equal(preview.shape.path, bank.countries.find(question => question.id === 'country-ita')!.path);
  assert.equal(preview.approvalLabel, config.mapApprovalLabel);
  assert.equal(existsSync('public/china-standard-map.jpg'), false);
  const metadata = JSON.parse(readFileSync('public/assets/home-preview-sources.json', 'utf8'));
  assert.deepEqual(previewSourceErrors(metadata, bank), []);
  assert.ok(!bank.countries.some(question => question.id === 'country-chn'));
  const withoutItaly = { ...bank, countries: bank.countries.filter(question => question.id !== 'country-ita') };
  assert.throws(() => homePreviewFor(withoutItaly, 'countries'), /意大利首页示例缺失/);
});
