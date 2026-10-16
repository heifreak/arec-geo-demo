import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPaint } from '../src/paint-renderer.js';
test('contornos sobre terreno y agujeros conservan vínculo de inspección sin duplicarse al cambiar opacidad', () => {
  const feature = { properties: { getValue: () => ({ test_class: 'X' }) }, polygon: { hierarchy: { getValue: () => ({ positions: [1, 2, 3], holes: [{ positions: [4, 5, 6] }] }) } } };
  const values = [feature]; const source = { entities: { values, add(entity) { values.push(entity); return entity; } } };
  const C = { Color: { fromCssColorString: css => ({ alpha: 1, withAlpha: alpha => ({ css, alpha }) }) } };
  const layer = { style: { paint: { 'fill-color': ['match', ['get', 'test_class'], 'X', '#112233', '#445566'], 'fill-opacity': 0.6, 'line-color': '#778899', 'line-opacity': 0.8, 'line-width': 2 } } };
  applyPaint(source, layer, C, 0, 1);
  assert.equal(values.length, 3); assert.equal(feature.polygon.outline, false); assert.equal(values[1]._arecParent, feature); assert.equal(values[2].polyline.clampToGround, true);
  applyPaint(source, layer, C, 0, 0.5);
  assert.equal(values.length, 3); assert.equal(feature.polygon.material.alpha, 0.3); assert.equal(values[1].polyline.material.alpha, 0.4);
});
test('no introduce relleno en una capa que solo define líneas', () => {
  const feature = { polygon: { hierarchy: { getValue: () => ({ positions: [1, 2, 3] }) } } };
  const values = [feature]; const source = { entities: { values, add(entity) { values.push(entity); return entity; } } };
  const C = { Color: { fromCssColorString: () => ({ withAlpha: () => ({}) }) } };
  applyPaint(source, { style: { paint: { 'line-color': '#112233' } } }, C, 0, 1);
  assert.equal(feature.polygon.fill, false);
});
test('los puntos usan círculos con radio y borde documentados, sin conservar un pin de otra simbología', () => {
  const entity = { billboard: { show: true } };
  const source = { entities: { values: [entity] } };
  const C = { HeightReference: { CLAMP_TO_GROUND: 'ground' }, PointGraphics: class { constructor(options) { Object.assign(this, options); } }, Color: { fromCssColorString: css => ({ alpha: 1, withAlpha: alpha => ({ css, alpha }) }) } };
  applyPaint(source, { style: { paint: { 'circle-color': '#112233', 'circle-radius': 3, 'circle-opacity': 0.8, 'circle-stroke-color': '#445566', 'circle-stroke-width': 1 } } }, C, 0, 0.5);
  assert.equal(entity.billboard.show, false); assert.equal(entity.point.pixelSize, 6); assert.equal(entity.point.color.alpha, 0.4); assert.equal(entity.point.outlineColor.css, '#445566'); assert.equal(entity.point.heightReference, 'ground');
});
test('rechaza geometrías sin símbolo correspondiente antes de mostrar una representación inventada', () => {
  const entity = { billboard: { show: true } };
  const C = { Color: { fromCssColorString: () => ({}) } };
  assert.throws(() => applyPaint({ entities: { values: [entity] } }, { style: { paint: { 'fill-color': '#112233' } } }, C, 0, 1), /no define simbología/);
  assert.equal(entity.billboard.show, true);
});
