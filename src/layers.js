import { PLAZAS } from './plazas.js';
import { validateSessionGeoJSON } from './session-data.js';
import { validateAnalysis } from './territorial-summary.js';

export function validateCatalog(catalog, { session = false } = {}) {
  if (catalog?.version !== 1 || !Array.isArray(catalog.layers)) throw new Error('Catálogo no compatible.');
  const ids = new Set();
  for (const layer of catalog.layers) {
    if (!layer.id || ids.has(layer.id)) throw new Error('Identificador de capa ausente o duplicado.');
    ids.add(layer.id);
    if (!Object.hasOwn(PLAZAS, layer.plaza)) throw new Error('Plaza no autorizada.');
    if (!/^V(0[1-9]|1[0-9]|2[0-3])$/.test(layer.variable) || /^V1[5-8]$/.test(layer.variable)) throw new Error('Variable no permitida en la demostración pública.');
    if (!layer.approvalReference?.trim() || (session ? layer.sessionApproved !== true : layer.publicApproved !== true || layer.sessionOnly === true)) throw new Error('Falta revisión de publicación o de sesión.');
    if (layer.analysis) validateAnalysis(layer.analysis);
    if (!/^data\/[a-zA-Z0-9_/-]+\.geojson$/.test(layer.url) || layer.url.includes('..')) throw new Error('Ruta GeoJSON no permitida.');
    if (!layer.name?.trim() || !layer.legend?.trim() || !layer.style?.color || !Number.isFinite(layer.style.opacity) || layer.style.opacity < 0 || layer.style.opacity > 1) throw new Error('Faltan nombre, leyenda o estilo aprobado.');
    if (layer.style.categories !== undefined && layer.style.categoryField === undefined) throw new Error('Las categorías requieren un campo original explícito.');
    if (layer.style.categoryField !== undefined) {
      if (typeof layer.style.categoryField !== 'string' || !layer.style.categoryField.trim() || !layer.style.reference?.trim() || !Array.isArray(layer.style.categories) || !layer.style.categories.length) throw new Error('Falta referencia de simbología categórica.');
      const values = new Set();
      for (const category of layer.style.categories) {
        if (!['string', 'number'].includes(typeof category.value) || !category.color || !category.label || values.has(String(category.value))) throw new Error('Categoría de simbología inválida o duplicada.');
        values.add(String(category.value));
      }
    }
  }
  return catalog;
}

export class LayerManager {
  constructor(viewer, cesium) {
    this.viewer = viewer; this.cesium = cesium;
    this.catalog = { version: 1, layers: [] }; this.loaded = new Map(); this.pending = new Map(); this.desired = new Map(); this.epoch = 0; this.sessionInputs = new Map(); this.originalRows = new Map(); this.opacities = new Map();
  }
  setCatalog(catalog) {
    const validated = validateCatalog(catalog);
    const sessions = this.catalog.layers.filter(layer => layer.sessionOnly);
    if (sessions.some(session => validated.layers.some(layer => layer.id === session.id))) throw new Error('Identificadores de catálogo y sesión en conflicto.');
    this.clear(); this.catalog = { ...validated, layers: [...validated.layers, ...sessions] };
  }
  addSessionLayer(descriptor, geojson) {
    validateSessionGeoJSON(geojson);
    const id = 'session-' + globalThis.crypto.randomUUID();
    const layer = { ...descriptor, id, url: `data/session/${id}.geojson`, sessionOnly: true, publicApproved: false };
    validateCatalog({ version: 1, layers: [layer] }, { session: true });
    this.sessionInputs.set(id, geojson);
    this.catalog = { ...this.catalog, layers: [...this.catalog.layers, layer] };
    return layer;
  }
  removeSessionLayers() {
    for (const layer of this.catalog.layers.filter(layer => layer.sessionOnly)) {
      const source = this.loaded.get(layer.id);
      if (source) this.viewer.dataSources.remove(source, true);
      this.loaded.delete(layer.id); this.pending.delete(layer.id); this.desired.delete(layer.id);
      this.originalRows.delete(layer.id); this.opacities.delete(layer.id);
    }
    this.sessionInputs.clear();
    this.catalog = { ...this.catalog, layers: this.catalog.layers.filter(layer => !layer.sessionOnly) };
    this.viewer.scene?.requestRender();
  }
  clear() {
    this.epoch++;
    for (const source of this.loaded.values()) this.viewer.dataSources.remove(source, true);
    this.loaded.clear(); this.pending.clear(); this.desired.clear(); this.originalRows.clear(); this.opacities.clear();
    this.viewer.scene?.requestRender();
  }
  async setVisible(id, visible) {
    const layer = this.catalog.layers.find(item => item.id === id);
    if (!layer) throw new Error('Capa desconocida.');
    this.desired.set(id, visible);
    if (this.loaded.has(id)) { this.loaded.get(id).show = visible; this.viewer.scene?.requestRender(); return; }
    if (!visible) return;
    if (this.pending.has(id)) return this.pending.get(id);
    const epoch = this.epoch;
    const job = this.load(layer, epoch);
    this.pending.set(id, job);
    try { await job; } finally { if (this.pending.get(id) === job) this.pending.delete(id); }
  }
  async load(layer, epoch) {
    const C = this.cesium;
    const color = C.Color.fromCssColorString(layer.style.color);
    if (!color || layer.style.categories?.some(category => !C.Color.fromCssColorString(category.color))) throw new Error('Color de capa inválido.');
    const local = this.sessionInputs.get(layer.id);
    // Keep original attributes without letting GeoJSON simplestyle/HTML properties issue external requests.
    const input = local ? { type: 'FeatureCollection', features: local.features.map(feature => ({ ...feature, properties: { __arecOriginal: feature.properties } })) } : layer.url;
    const source = await C.GeoJsonDataSource.load(input, { describe: () => '', markerColor: C.Color.WHITE, stroke: color, fill: color.withAlpha(layer.style.opacity), clampToGround: true });
    if (epoch !== this.epoch || !this.catalog.layers.some(item => item.id === layer.id)) return;
    await this.viewer.dataSources.add(source);
    if (epoch !== this.epoch || !this.catalog.layers.some(item => item.id === layer.id)) { this.viewer.dataSources.remove(source, true); return; }
    source.show = this.desired.get(layer.id) === true;
    this.loaded.set(layer.id, source);
    if (this.sessionInputs.has(layer.id)) this.originalRows.set(layer.id, this.sessionInputs.get(layer.id).features.map(feature => feature.properties));
    this.setOpacity(layer.id, this.opacities.get(layer.id) ?? layer.style.opacity);
    this.viewer.scene?.requestRender();
  }
  setOpacity(id, opacity) {
    const layer = this.catalog.layers.find(item => item.id === id);
    if (!layer || !Number.isFinite(opacity) || opacity < 0 || opacity > 1) return;
    this.opacities.set(id, opacity);
    const source = this.loaded.get(id);
    if (!source) return;
    for (const entity of source.entities.values) {
      const properties = entity.properties?.getValue(this.viewer.clock?.currentTime) ?? {};
      const original = layer.sessionOnly ? properties.__arecOriginal ?? {} : properties;
      const category = layer.style.categories?.find(item => String(item.value) === String(original[layer.style.categoryField]));
      const baseColor = this.cesium.Color.fromCssColorString(category?.color ?? layer.style.color);
      if (!baseColor) throw new Error('Color de simbología inválido.');
      const color = baseColor.withAlpha((baseColor.alpha ?? 1) * opacity);
      if (entity.polygon) entity.polygon.material = color;
      if (entity.polyline) entity.polyline.material = color;
      if (entity.billboard) entity.billboard.color = color;
      if (entity.point) entity.point.color = color;
    }
    this.viewer.scene?.requestRender();
  }
}
