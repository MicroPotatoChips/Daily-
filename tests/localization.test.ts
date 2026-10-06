import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { en, zh } from '../src/features/translations';
function keys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object') return [prefix];
  return Object.entries(value).flatMap(([key, nested]) =>
    keys(nested, prefix ? `${prefix}.${key}` : key),
  );
}
test('English and Chinese cover the same page strings', () => {
  assert.deepEqual(keys(en).sort(), keys(zh).sort());
});
test('English and Chinese cover the same shared component strings', () => {
  const enBase: unknown = JSON.parse(
    readFileSync(new URL('../src/locales/en.json', import.meta.url), 'utf8'),
  );
  const zhBase: unknown = JSON.parse(
    readFileSync(new URL('../src/locales/zh-CN.json', import.meta.url), 'utf8'),
  );
  assert.deepEqual(keys(enBase).sort(), keys(zhBase).sort());
});
