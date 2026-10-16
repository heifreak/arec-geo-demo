import test from 'node:test';
import assert from 'node:assert/strict';
import { ProviderController } from '../src/providers.js';

function event() {
  const handlers = new Set();
  return { addEventListener(handler) { handlers.add(handler); return () => handlers.delete(handler); }, raise(...args) { for (const handler of [...handlers]) handler(...args); } };
}
function harness(overrides = {}) {
  const notices = [];
  class EllipsoidTerrainProvider {}
  const primitives = [];
  const imagery = { show: true };
  const viewer = { imageryLayers: { length: 1, get: () => imagery }, scene: {
    requestRender() {}, globe: {}, primitives: {
      add(item) { primitives.push(item); return item; },
      remove(item) { const index = primitives.indexOf(item); if (index >= 0) primitives.splice(index, 1); item.destroy(); }
    }
  } };
  const terrain = { errorEvent: event() };
  const tiles = { tileFailed: event(), destroyed: false, destroy() { this.destroyed = true; } };
  const C = { Ion: {}, EllipsoidTerrainProvider, createWorldTerrainAsync: async () => terrain, createOsmBuildingsAsync: async () => tiles, ...overrides };
  const controller = new ProviderController(viewer, C, (kind, state) => notices.push({ kind, ...state }));
  return { controller, viewer, C, terrain, tiles, notices, primitives, imagery };
}
test('sin token no solicita ion y conserva mapa y elipsoide', async () => {
  const h = harness({ createWorldTerrainAsync() { throw Error('No debe invocarse'); } });
  await h.controller.setTerrain(true); await h.controller.setBuildings(true);
  assert.ok(h.viewer.terrainProvider instanceof h.C.EllipsoidTerrainProvider);
  assert.equal(h.primitives.length, 0); assert.equal(h.imagery.show, true);
  assert.equal(h.notices.at(-1).state, 'off');
});
test('terreno y edificios son independientes y fallan a respaldo sin filtrar errores del proveedor', async () => {
  const h = harness(); h.controller.setToken('test-only');
  await h.controller.setTerrain(true); await h.controller.setBuildings(true);
  assert.equal(h.viewer.terrainProvider, h.terrain); assert.equal(h.primitives.length, 1);
  h.terrain.errorEvent.raise();
  assert.ok(h.viewer.terrainProvider instanceof h.C.EllipsoidTerrainProvider);
  assert.equal(h.primitives.length, 1);
  h.tiles.tileFailed.raise(); assert.equal(h.primitives.length, 0);
  assert.equal(h.imagery.show, true);
});
test('rechazo inicial mantiene el mapa funcional y no revela error con token', async () => {
  const h = harness({ createWorldTerrainAsync: async () => { throw Error('private-token'); }, createOsmBuildingsAsync: async () => { throw Error('private-token'); } });
  h.controller.setToken('test-only'); await h.controller.setTerrain(true); await h.controller.setBuildings(true);
  assert.equal(h.imagery.show, true); assert.ok(h.viewer.terrainProvider instanceof h.C.EllipsoidTerrainProvider);
  assert.equal(JSON.stringify(h.notices).includes('private-token'), false);
});
test('descarta terreno tardío y destruye edificios tras desactivarlos durante carga', async () => {
  let resolveTerrain; let resolveBuildings;
  const h = harness({ createWorldTerrainAsync: () => new Promise(resolve => { resolveTerrain = resolve; }), createOsmBuildingsAsync: () => new Promise(resolve => { resolveBuildings = resolve; }) });
  h.controller.setToken('test-only');
  const terrainLoad = h.controller.setTerrain(true); const buildingLoad = h.controller.setBuildings(true);
  await h.controller.setTerrain(false); await h.controller.setBuildings(false);
  resolveTerrain(h.terrain); resolveBuildings(h.tiles); await Promise.all([terrainLoad, buildingLoad]);
  assert.ok(h.viewer.terrainProvider instanceof h.C.EllipsoidTerrainProvider);
  assert.equal(h.primitives.length, 0); assert.equal(h.tiles.destroyed, true);
});
test('ocultar mapa base no altera terreno ni edificios', async () => {
  const h = harness(); h.controller.setToken('test-only'); await h.controller.setTerrain(true);
  h.controller.setBaseMap(false); assert.equal(h.imagery.show, false); assert.equal(h.viewer.terrainProvider, h.terrain);
});
test('diagnóstico sin token no confunde el elipsoide con relieve validado', async () => {
  const h = harness(); h.controller.setToken('');
  const result = await h.controller.inspect3D();
  assert.match(result.terrain, /no validado/); assert.deepEqual(result.sampledHeightsMeters, []);
  assert.match(result.buildings, /Sin geometría/);
});
test('diagnóstico exige evidencia visible y alturas; conectarse a ion no basta', async () => {
  const h = harness(); h.viewer.scene.preRender = event(); h.tiles.tileVisible = event();
  h.viewer.scene.canvas = { clientWidth: 100, clientHeight: 100 };
  h.viewer.camera = { getPickRay: point => point };
  h.viewer.scene.globe.pick = ray => ray;
  h.C.Cartesian2 = class { constructor(x, y) { this.x = x; this.y = y; } };
  h.C.Cartographic = { fromCartesian: point => point };
  h.C.sampleTerrainMostDetailed = async (provider, points) => points.map(point => ({ ...point, height: 123 })); // Synthetic test elevations only.
  h.controller.setToken('test-only'); await h.controller.setTerrain(true); await h.controller.setBuildings(true);
  assert.match((await h.controller.inspect3D()).buildings, /sin entidades visibles/);
  h.viewer.scene.preRender.raise(); h.tiles.tileVisible.raise({ content: { featuresLength: 2 } });
  const evidence = await h.controller.inspect3D(); assert.match(evidence.buildings, /2 entidades/);
  assert.deepEqual(evidence.sampledHeightsMeters, [123, 123, 123]);
  h.viewer.scene.preRender.raise(); assert.match((await h.controller.inspect3D()).buildings, /sin entidades visibles/);
});
