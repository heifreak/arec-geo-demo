import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/bulk-preview.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../preview-masiva.html', import.meta.url), 'utf8');

test('La vista de importación masiva está disponible sin modificar preview.html', () => {
  assert.ok(html.includes('<title>AREC GEO | Visor Territorial 3D</title>'));
  assert.ok(html.includes(source));
  assert.match(source, /webkitdirectory/);
  assert.match(source, /new Worker\(/);
  assert.match(source, /evidence_metro/);
  assert.match(source, /metro_analysis/);
});
test('Se bloquean capas corporativas internas y no hay archivos GIS incrustados', () => {
  assert.match(source, /"V15","V16","V17","V18"/);
  assert.ok(!html.includes('CLASE_ZCU_AREC_V14":'));
  assert.ok(!html.includes('FeatureCollection","features":'));
  assert.ok(!html.includes('zcu_arec_v14_jrz.geojson'));
});
test('La restauración nunca activa capas ni transmite archivos automáticamente', () => {
  assert.match(source, /Restaurados/);
  assert.match(source, /No se activaron capas/);
  assert.match(source, /autorización/);
  assert.ok(!source.includes('navigator.sendBeacon'));
  assert.ok(!source.includes('XMLHttpRequest'));
  assert.ok(!source.includes('fetch('));
});
