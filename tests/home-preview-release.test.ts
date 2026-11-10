import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previewSourceErrors } from '../scripts/check-home-previews.mjs';

const fixture = () => ({
  chinaMainland: { status: 'ready' },
  countries: {
    status: 'ready', approvalNumber: 'GS(2026)0000号', imageFile: 'test-fixture.png',
    sha256: 'a'.repeat(64), sourceUrl: 'https://example.invalid/test-only',
    usageEvidenceUrl: 'https://example.invalid/test-only', modification: 'none',
  },
});

test('最终包拒绝未就绪的中国示例，不再允许占位包冒充完整交付', () => {
  const data = fixture(); data.countries.status = 'pending';
  assert.ok(previewSourceErrors(data).some(error => error.includes('占位')));
  assert.ok(previewSourceErrors(null).length > 0);
});

test('最终包要求独立原图审图号、来源、包内图片和可复核指纹', () => {
  assert.deepEqual(previewSourceErrors(fixture()), []);
  for (const key of ['approvalNumber', 'imageFile', 'sha256', 'sourceUrl', 'usageEvidenceUrl'] as const) {
    const data = fixture(); data.countries[key] = '';
    assert.ok(previewSourceErrors(data).length > 0, key);
  }
  const traversing = fixture(); traversing.countries.imageFile = '../outside.png';
  assert.ok(previewSourceErrors(traversing).length > 0);
});

test('最终包拒绝对标准原图裁剪、描摹或其他内容改动', () => {
  const data = fixture(); data.countries.modification = 'cropped';
  assert.ok(previewSourceErrors(data).some(error => error.includes('不裁剪')));
});
