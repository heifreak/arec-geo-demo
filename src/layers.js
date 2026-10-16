import { PLAZAS } from './plazas.js';

export function validateCatalog(catalog) {
  if (catalog?.version !== 1 || !Array.isArray(catalog.layers)) throw new Error('Catálogo no compatible.');
  const ids = new Set();
  for (const layer of catalog.layers) {
    if (!layer.id || ids.has(layer.id)) throw new Error('Identificador de capa ausente o duplicado.');
    ids.add(layer.id);
    if (!Object.hasOwn(PLAZAS, layer.plaza)) throw new Error('Plaza no autorizada.');
    if (!/^V(0[1-9]|1[0-9]|2[0-3])$/.test(layer.variable) || /^V1[5-8]$/.test(layer.variable)) throw new Error('Variable no permitida en la demostración pública.');
    if (layer.publicApproved !== true || !layer.approvalReference?.trim()) throw new Error('Falta revisión de publicación.');
    if (!/^data\/[a-zA-Z0-9_/-]+\.geojson$/.test(layer.url) || layer.url.includes('..')) throw new Error('Ruta GeoJSON no permitida.');
    if (!layer.name?.trim() || !layer.legend?.trim() || !layer.style?.color || !Number.isFinite(layer.style.opacity) || layer.style.opacity < 0 || layer.style.opacity > 1) throw new Error('Faltan nombre, leyenda o estilo aprobado.');
  }
  return catalog;
}

export class LayerManager {
  constructor(viewer, cesium) {
    this.viewer = viewer; this.cesium = cesium;
    this.catalog = { version: 1, layers: [] }; this.loaded = new Map(); this.pending = new Map(); this.epoch = 0;
  }
  setCatalog(catalog) { this.catalog = validateCatalog(catalog); }
  clear() {
    this.epoch++;
    for (const source of this.loaded.values()) this.viewer.dataSources.remove(source, true);
    this.loaded.clear(); this.pending.clear();
  }
  async setVisible(id, visible) {
    const layer = this.catalog.layers.find(item => item.id === id);
    if (!layer) throw new Error('Capa desconocida.');
    if (this.loaded.has(id)) { this.loaded.get(id).show = visible; return; }
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
    if (!color) throw new Error('Color de capa inválido.');
    const source = await C.GeoJsonDataSource.load(layer.url, { stroke: color, fill: color.withAlpha(layer.style.opacity), clampToGround: true });
    if (epoch !== this.epoch) return;
    await this.viewer.dataSources.add(source);
    if (epoch !== this.epoch) { this.viewer.dataSources.remove(source, true); return; }
    this.loaded.set(layer.id, source);
  }
  setOpacity(id, opacity) {
    const layer = this.catalog.layers.find(item => item.id === id);
    if (!layer || !Number.isFinite(opacity) || opacity < 0 || opacity > 1) return;
    const source = this.loaded.get(id);
    if (!source) return;
    const color = this.cesium.Color.fromCssColorString(layer.style.color).withAlpha(opacity);
    for (const entity of source.entities.values) {
      if (entity.polygon) entity.polygon.material = color;
      if (entity.polyline) entity.polyline.material = color;
      if (entity.billboard) entity.billboard.color = color;
      if (entity.point) entity.point.color = color;
    }
  }
}
