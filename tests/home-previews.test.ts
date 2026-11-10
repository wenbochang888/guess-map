import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import data from '../src/data/questions.json';
import { config } from '../src/config';
import { homePreviewFor } from '../src/data/home-previews';
import { defaultOptions } from '../src/game/options';
import { poolFor, type QuestionBank } from '../src/game/questions';

const bank = data as QuestionBank;

test('广东省示例复用省级轮廓，不改变默认31题范围', () => {
  const preview = homePreviewFor(bank, 'cities');
  assert.equal(preview.kind, 'outline');
  if (preview.kind !== 'outline') throw new Error('应为省级轮廓');
  assert.equal(preview.name, '广东省');
  assert.equal(preview.shape.path, bank.regions.find(region => region.id === '440000')!.path);
  assert.equal(preview.approvalLabel, config.mapApprovalLabel);
  assert.equal(poolFor(bank, defaultOptions('cities')).length, 31);
});

test('广东轮廓缺失时明确报错，不再将占位状态当作正式首页', () => {
  const withoutGuangdong = { ...bank, regions: bank.regions.filter(region => region.id !== '440000') };
  assert.throws(() => homePreviewFor(withoutGuangdong, 'cities'), /广东省首页示例缺失/);
});

test('中国示例使用完整包内标准原图及独立审图号，不改变正式国家题库', () => {
  const preview = homePreviewFor(bank, 'countries');
  assert.equal(preview.kind, 'image');
  if (preview.kind !== 'image') throw new Error('应为标准地图原图');
  assert.equal(preview.name, '中国');
  assert.equal(preview.imageSrc, './china-standard-map.jpg');
  const metadata = JSON.parse(readFileSync('public/assets/home-preview-sources.json', 'utf8')).countries;
  assert.equal(metadata.status, 'ready');
  assert.equal(preview.approvalLabel, `审图号：${metadata.approvalNumber}`);
  assert.notEqual(preview.approvalLabel, config.mapApprovalLabel);
  const image = readFileSync('public/' + metadata.imageFile);
  assert.equal(createHash('sha256').update(image).digest('hex'), metadata.sha256);
  assert.equal(metadata.modification, 'none');
  assert.equal(image.length, metadata.bytes);
  assert.equal(bank.countries.length, 60);
  assert.ok(!bank.countries.some(question => question.id === 'country-chn'));
});
