import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previewSourceErrors } from '../scripts/check-home-previews.mjs';

const fixture = () => ({
  chinaMainland: { status: 'ready', geometryChanged: false } as Record<string, unknown>,
  countries: { status: 'ready', geometryChanged: false } as Record<string, unknown>,
});

test('最终包拒绝未就绪的首页示例，不允许占位包冒充完整交付', () => {
  const data = fixture(); data.countries.status = 'pending';
  assert.ok(previewSourceErrors(data).some(error => error.includes('占位')));
  assert.ok(previewSourceErrors(null).length > 0);
  assert.deepEqual(previewSourceErrors(fixture()), []);
});

test('首页示例必须复用题库轮廓，不得改动几何或重新引入外部地图图片', () => {
  const changed = fixture(); changed.countries.geometryChanged = true;
  assert.ok(previewSourceErrors(changed).some(error => error.includes('复用题库轮廓')));
  const image = fixture(); image.countries.imageFile = 'china-standard-map.jpg';
  assert.ok(previewSourceErrors(image).some(error => error.includes('外部地图图片')));
});

test('题库缺少广东或意大利轮廓时拒绝打包', () => {
  assert.equal(previewSourceErrors(fixture(), { regions: [], countries: [] }).length, 2);
});
