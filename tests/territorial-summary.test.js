import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeCells, layerSummaryRows } from '../src/territorial-summary.js';
// Entirely synthetic field names and figures, not AREC definitions or results.
const mapping = { reference: 'synthetic-test-reference', scope: 'sample', cellIdField: 'test_id', classField: 'test_class', metrics: [{ id: 'test_metric', label: 'Synthetic metric', field: 'test_value', unit: 'test-unit', aggregation: 'sum', reference: 'synthetic-sum-rule' }] };
test('resume valores originales sin clasificar de nuevo, extrapolar o tratar nulos como cero', () => {
  const rows = [{ test_id: 'a', test_class: 'X', test_value: 7 }, { test_id: 'b', test_class: 'X', test_value: null }, { test_id: 'c', test_class: null, test_value: 0 }, { test_id: 'd', test_class: 'Y', test_value: '99' }];
  const result = summarizeCells(rows, mapping);
  assert.equal(result.cells, 4); assert.deepEqual(result.classes, [['X', 2], ['Y', 1]]);
  assert.equal(result.missingClass, 1); assert.equal(result.metrics[0].value, 7);
  assert.equal(result.metrics[0].valid, 2); assert.equal(result.metrics[0].missing, 2);
  assert.equal(result.scope, 'sample');
});
test('rechaza identificadores repetidos, ausentes y reglas sin referencia', () => {
  assert.throws(() => summarizeCells([{ test_id: 'a' }, { test_id: 'a' }], mapping), /duplicados/);
  assert.throws(() => summarizeCells([{}], mapping), /ausentes/);
  assert.throws(() => summarizeCells([], { ...mapping, reference: '' }), /referencia/);
  assert.throws(() => summarizeCells([], { ...mapping, metrics: [{ ...mapping.metrics[0], aggregation: 'weighted-opportunity' }] }), /documentada/);
});
test('todos los valores ausentes dan no disponible; no un resultado artificial cero', () => {
  const summary = summarizeCells([{ test_id: 'a', test_value: null }], mapping);
  assert.equal(summary.metrics[0].value, null);
  const source = { entities: { values: [{ properties: { getValue: () => ({ test_id: 'a', test_value: null }) } }] } };
  const output = layerSummaryRows({ variable: 'V01', name: 'Synthetic', analysis: mapping }, source);
  assert.ok(output.some(row => row[1] === 'No disponible'));
});
