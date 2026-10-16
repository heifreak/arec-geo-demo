import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateStyle, validateExpression, validatePaint } from '../src/style-expressions.js';
// Synthetic thresholds, fields, palettes. Original definitions remain private.
const colors = ['#112233', '#445566', '#778899'];
test('step: igualdad en el umbral y faltantes solo si la referencia define coalesce', () => {
  const expression = ['step', ['coalesce', ['get', 'test_value'], 0], colors[0], 3, colors[1], 8, colors[2]];
  for (const [value, color] of [[2.9, colors[0]], [3, colors[1]], [7.9, colors[1]], [8, colors[2]]]) assert.equal(evaluateStyle(expression, { test_value: value }), color);
  assert.equal(evaluateStyle(expression, {}), colors[0]);
  assert.throws(() => evaluateStyle(['step', ['get', 'test_value'], colors[0], 3, colors[1]], {}), /numérico/);
  assert.throws(() => evaluateStyle(expression, { test_value: '3' }), /numérico/);
});
test('match y case mantienen etiquetas, límites estrictos y null sin clasificaciones nuevas', () => {
  assert.equal(evaluateStyle(['match', ['get', 'test_class'], 'X', colors[0], 'Y', colors[1], colors[2]], { test_class: 'Y' }), colors[1]);
  assert.equal(evaluateStyle(['match', ['get', 'test_class'], ['X', 'Y'], colors[0], colors[1]], { test_class: 'Y' }), colors[0]);
  const expression = ['case', ['==', ['get', 'test_value'], null], colors[2], ['all', ['>', ['get', 'test_value'], 3], ['<', ['get', 'test_value'], 8]], colors[0], colors[1]];
  assert.equal(evaluateStyle(expression, {}), colors[2]); assert.equal(evaluateStyle(expression, { test_value: 3 }), colors[1]); assert.equal(evaluateStyle(expression, { test_value: 4 }), colors[0]);
});
test('rechaza ejecución, operadores no soportados y estilos sin soporte en lugar de sustituirlos', () => {
  assert.throws(() => validateExpression(['eval', 'alert(1)']), /no soportado/);
  assert.throws(() => validateExpression(['step', ['get', 'x'], 'x', 8, 'y', 3, 'z']), /crecientes/);
  assert.throws(() => validatePaint({ 'line-dasharray': [3, 2] }), /pendiente/);
  assert.equal(evaluateStyle(['get', 'constructor'], {}), null);
  let expression = ['get', 'x']; for (let i = 0; i < 25; i++) expression = ['coalesce', expression, 0];
  assert.throws(() => validateExpression(expression), /compleja/);
});
