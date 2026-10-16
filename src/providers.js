/** Optional ion services never prevent the ellipsoid/OSM viewer from starting. */
export class ProviderController {
  constructor(viewer, cesium, notify = () => {}) {
    this.viewer = viewer; this.C = cesium; this.notify = notify;
    this.generations = { terrain: 0, buildings: 0 };
    this.removeTerrainError = null; this.removeBuildingError = null;
    this.buildings = null; this.token = '';
  }
  setToken(token) {
    // No token persistence, logging, or embedded demo credential.
    this.token = token.trim();
    this.C.Ion.defaultAccessToken = this.token;
    this.setTerrain(false); this.setBuildings(false);
  }
  setBaseMap(visible) {
    for (let i = 0; i < this.viewer.imageryLayers.length; i++) this.viewer.imageryLayers.get(i).show = visible;
    this.viewer.scene.requestRender();
  }
  terrainFallback(message) {
    this.removeTerrainError?.(); this.removeTerrainError = null;
    this.viewer.terrainProvider = new this.C.EllipsoidTerrainProvider();
    this.viewer.scene.globe.depthTestAgainstTerrain = false;
    this.notify('terrain', { state: 'off', message });
    this.viewer.scene.requestRender();
  }
  async setTerrain(enabled) {
    const generation = ++this.generations.terrain;
    if (!enabled) { this.terrainFallback('Elipsoide activo; relieve desactivado.'); return; }
    if (!this.token) { this.terrainFallback('Se requiere un token de visualización Cesium ion.'); return; }
    this.notify('terrain', { state: 'loading', message: 'Cargando Cesium World Terrain…' });
    try {
      const provider = await this.C.createWorldTerrainAsync({ requestVertexNormals: true });
      if (generation !== this.generations.terrain) return;
      this.removeTerrainError?.();
      this.removeTerrainError = provider.errorEvent.addEventListener(() => {
        if (generation !== this.generations.terrain) return;
        ++this.generations.terrain;
        this.terrainFallback('Falló el terreno remoto. Se conserva el mapa sobre el elipsoide.');
      });
      this.viewer.terrainProvider = provider;
      this.viewer.scene.globe.depthTestAgainstTerrain = true;
      this.notify('terrain', { state: 'on', message: 'Relieve activo. Cobertura y precisión dependen del proveedor.' });
      this.viewer.scene.requestRender();
    } catch {
      if (generation === this.generations.terrain) this.terrainFallback('No se pudo cargar el terreno: revisa token, permisos del activo y red. El mapa sigue disponible.');
    }
  }
  removeBuildings() {
    this.removeBuildingError?.(); this.removeBuildingError = null;
    if (this.buildings) this.viewer.scene.primitives.remove(this.buildings);
    this.buildings = null;
  }
  async setBuildings(enabled) {
    const generation = ++this.generations.buildings;
    this.removeBuildings();
    if (!enabled || !this.token) {
      this.notify('buildings', { state: 'off', message: enabled ? 'Se requiere un token de visualización Cesium ion.' : 'Edificios desactivados.' });
      this.viewer.scene.requestRender(); return;
    }
    this.notify('buildings', { state: 'loading', message: 'Cargando Cesium OSM Buildings…' });
    try {
      const tileset = await this.C.createOsmBuildingsAsync({ maximumScreenSpaceError: 24, cacheBytes: 128 * 1024 * 1024, maximumCacheOverflowBytes: 64 * 1024 * 1024, enableShowOutline: false });
      if (generation !== this.generations.buildings) { tileset.destroy(); return; }
      this.buildings = this.viewer.scene.primitives.add(tileset);
      this.removeBuildingError = tileset.tileFailed.addEventListener(() => {
        if (generation !== this.generations.buildings) return;
        ++this.generations.buildings; this.removeBuildings();
        this.notify('buildings', { state: 'off', message: 'Falló la descarga de edificios. El mapa y el terreno siguen disponibles.' });
        this.viewer.scene.requestRender();
      });
      this.notify('buildings', { state: 'on', message: 'Edificios activos; cobertura y alturas según OpenStreetMap/Cesium.' });
      this.viewer.scene.requestRender();
    } catch {
      if (generation === this.generations.buildings) this.notify('buildings', { state: 'off', message: 'No se pudieron cargar edificios: revisa token, permisos del activo y red.' });
    }
  }
}
