import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Worker } from 'node:worker_threads';
import test from 'node:test';
import { parseQuickAddRequest } from '../src/utils/deepLink';

test('deep-link quick add is an explicit, bounded proposal with a separate operation namespace', () => {
  assert.deepEqual(
    parseQuickAddRequest({ id: 'task_123', quickAdd: '1', operationId: 'widget-ios-abc-123' }),
    {
      taskId: 'task_123',
      operationId: 'confirmed-link:widget-ios-abc-123',
    },
  );
  for (const quickAdd of ['0', 'false', true, ['1'], undefined]) {
    assert.equal(parseQuickAddRequest({ id: 'task_123', quickAdd, operationId: 'abc' }), null);
  }
  for (const operationId of [
    undefined,
    '',
    ['abc'],
    'x'.repeat(161),
    'timer:existing:2026-10-02',
    'x\n',
  ]) {
    assert.equal(parseQuickAddRequest({ id: 'task_123', quickAdd: '1', operationId }), null);
  }
  for (const id of [null, ['task'], '../settings', 'x'.repeat(121)]) {
    assert.equal(parseQuickAddRequest({ id, quickAdd: '1', operationId: 'abc' }), null);
  }
});

test('patched router query parser preserves Unicode and duplicate parameter semantics', () => {
  const require = createRequire(import.meta.url);
  const routerRequire = createRequire(require.resolve('expo-router/package.json'));
  const query = routerRequire('query-string') as {
    parse(value: string): Record<string, unknown>;
    stringify(value: Record<string, unknown>): string;
  };
  assert.deepEqual(
    { ...query.parse('name=%E5%96%9D%E6%B0%B4&quickAdd=1&quickAdd=0') },
    {
      name: '喝水',
      quickAdd: ['1', '0'],
    },
  );
  assert.deepEqual(
    { ...query.parse(query.stringify({ name: '喝水 + water', value: 1 })) },
    { name: '喝水 + water', value: '1' },
  );
});

test('malformed percent-encoded routes complete without unbounded decoder recursion', async () => {
  const require = createRequire(import.meta.url);
  const routerRequire = createRequire(require.resolve('expo-router/package.json'));
  const path = routerRequire.resolve('query-string');
  // A separate worker and timeout make a regression fail without hanging the suite.
  const worker = new Worker(
    `const {parentPort, workerData} = require('node:worker_threads');
    const query = require(workerData);
    const result = query.parse('x=' + '%E0%A4%FF'.repeat(4000));
    parentPort.postMessage(typeof result.x);`,
    { eval: true, workerData: path },
  );
  try {
    const result = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('URI decoder exceeded 3 seconds')), 3000);
      worker.once('message', (value) => {
        clearTimeout(timeout);
        resolve(value);
      });
      worker.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
    assert.equal(result, 'string');
  } finally {
    await worker.terminate();
  }
});
