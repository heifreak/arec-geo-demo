import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAZAS } from '../src/plazas.js';
import { LayerManager, validateCatalog } from '../src/layers.js';

// Metadata sintética solo para pruebas; no representa ninguna variable AREC GEO.
const entry = () => ({ id: 'test', plaza: 'JRZ', variable: 'V01', name: 'Fixture', url: 'data/test.geojson', publicApproved: true, approvalReference: 'test-only', legend: 'Test', style: { color: '#ffffff', opacity: 1 } });
const catalog = layer => ({ version: 1, layers: [layer] });
test('catálogo oficial conserva exactamente 18 plazas y excluye DEL', () => {
  assert.deepEqual(Object.keys(PLAZAS), ['JRZ','CHH','SLT','TOR','MTY','HMO','OBR','MXL','TIJ','GDL','QRO','VER','LEO','PUE','TOL','CAN','SLP','AGS']);
});
test('rechaza variables confidenciales, plazas inválidas, rutas externas y datos no revisados', () => {
  for (const patch of [{ variable: 'V15' }, { variable: 'V16' }, { variable: 'V17' }, { variable: 'V18' }, { variable: 'V24' }, { plaza: 'DEL' }, { url: 'https://example.org/data.geojson' }, { url: 'data/../private.geojson' }, { publicApproved: false }, { approvalReference: '' }, { style: { color: '#fff', opacity: 2 } }]) {
    assert.throws(() => validateCatalog(catalog({ ...entry(), ...patch })));
  }
  assert.throws(() => validateCatalog({ version: 1, layers: [entry(), entry()] }));
  assert.doesNotThrow(() => validateCatalog(catalog(entry())));
});
function harness(load) {
  const sources = [];
  const viewer = { dataSources: {
    async add(source) { sources.push(source); return source; },
    remove(source) { const i = sources.indexOf(source); if (i >= 0) sources.splice(i, 1); }
  } };
  const color = { withAlpha: alpha => ({ alpha }) };
  const cesium = { Color: { fromCssColorString: () => color }, GeoJsonDataSource: { load } };
  const manager = new LayerManager(viewer, cesium); manager.setCatalog(catalog(entry()));
  return { manager, sources };
}
test('carga solo bajo demanda, reutiliza fuente y libera al cambiar plaza', async () => {
  let calls = 0;
  const source = { show: true, entities: { values: [{ polygon: {} }] } };
  const { manager, sources } = harness(async () => { calls++; return source; });
  assert.equal(calls, 0);
  await manager.setVisible('test', true);
  await manager.setVisible('test', false);
  assert.equal(source.show, false);
  await manager.setVisible('test', true);
  assert.equal(calls, 1);
  manager.setOpacity('test', 0.4);
  assert.equal(source.entities.values[0].polygon.material.alpha, 0.4);
  manager.clear(); assert.equal(sources.length, 0);
});
test('descarta resultados tardíos y evita cargas duplicadas', async () => {
  let resolve; let calls = 0;
  const { manager, sources } = harness(() => { calls++; return new Promise(done => { resolve = done; }); });
  const first = manager.setVisible('test', true);
  const second = manager.setVisible('test', true);
  assert.equal(calls, 1);
  manager.clear(); resolve({});
  await Promise.all([first, second]); assert.equal(sources.length, 0);
});
test('permite reintento tras fallo de carga', async () => {
  let calls = 0;
  const { manager, sources } = harness(async () => { if (++calls === 1) throw new Error('network'); return { entities: { values: [] } }; });
  await assert.rejects(manager.setVisible('test', true), /network/);
  await manager.setVisible('test', true); assert.equal(sources.length, 1);
});
test('desactivar una capa durante la carga respeta la intención más reciente', async () => {
  let resolve;
  const { manager } = harness(() => new Promise(done => { resolve = done; }));
  const loading = manager.setVisible('test', true);
  await manager.setVisible('test', false);
  const source = { show: true, entities: { values: [] } }; resolve(source); await loading;
  assert.equal(source.show, false);
});
