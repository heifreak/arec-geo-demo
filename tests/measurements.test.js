import test from 'node:test';
import assert from 'node:assert/strict';
import { surfaceDistance, surfaceArea } from '../src/measurements.js';
test('distancia esférica de referencia: un grado en ecuador y simetría', () => {
  const value = surfaceDistance([[0, 0], [1, 0]]);
  assert.ok(Math.abs(value - 111195.0802) < 0.01);
  assert.equal(surfaceDistance([[1, 0], [0, 0]]), value);
  assert.equal(surfaceDistance([[0, 0], [0, 0]]), 0);
});
test('área de referencia esférica, orientación y cruce del antimeridiano', () => {
  const square = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const expected = 6371008.8 ** 2 * Math.PI / 180 * Math.sin(Math.PI / 180);
  assert.ok(Math.abs(surfaceArea(square) - expected) < 0.1);
  assert.ok(Math.abs(surfaceArea(square.toReversed()) - expected) < 0.1);
  const across = [[179.5, 0], [-179.5, 0], [-179.5, 1], [179.5, 1]];
  assert.ok(Math.abs(surfaceArea(across) - expected) < 0.1);
  assert.equal(surfaceArea([[0, 0], [1, 0]]), 0);
});
