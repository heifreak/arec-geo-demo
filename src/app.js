import { compareCell, renderCellComparison } from './cell-comparison.js';
import { renderCellInspection, verifyInputEvidence } from './cell-inspector.js';
import { blockedVariable, validateReferencePackage, descriptorFromReference } from './reference-package.js';
import { originalProperties } from './paint-renderer.js';
import { layerSummaryRows } from './territorial-summary.js';
import { PLAZAS } from './plazas.js';
import { LayerManager } from './layers.js';
import { ProviderController } from './providers.js';
import { installDrawing } from './measurements.js';

const $ = id => document.getElementById(id);
const C = globalThis.Cesium;
if (!C) {
  $('estado').textContent = 'No se pudo cargar CesiumJS. Revisa la conexión o los certificados de red y recarga la página.';
  throw new Error('CesiumJS no disponible');
}
C.Ion.defaultAccessToken = '';
const imageryProvider = new C.OpenStreetMapImageryProvider({ url: 'https://tile.openstreetmap.org/', maximumLevel: 18 });
const viewer = new C.Viewer('cesiumContainer', {
  baseLayer: new C.ImageryLayer(imageryProvider),
  terrainProvider: new C.EllipsoidTerrainProvider(),
  baseLayerPicker: false, geocoder: false, animation: false, timeline: false,
  navigationHelpButton: true, homeButton: true, sceneModePicker: true, fullscreenButton: true,
  selectionIndicator: true, infoBox: true,
  requestRenderMode: true, maximumRenderTimeChange: Infinity
});
viewer.resolutionScale = Math.min(1, 1.5 / (window.devicePixelRatio || 1));
viewer.scene.globe.maximumScreenSpaceError = 3;
imageryProvider.errorEvent.addEventListener(() => {
  $('base-map-status').textContent = 'No se pudieron cargar teselas del mapa base. La navegación y las capas disponibles se conservan; revisa conexión y política del proveedor.';
});
const layers = new LayerManager(viewer, C);
$('toggle-inspector').addEventListener('click', () => {
  const open = document.body.classList.toggle('inspector-open');
  $('toggle-inspector').setAttribute('aria-expanded', String(open));
});
const selector = $('plaza');
let privateReference = null; let selectedLogicalId = null; let selectedLayerId = null;
const scope = () => $('scope').value;
const inContext = layer => layer.plaza === selector.value && (layer.scope ?? 'city') === scope();
for (const [code, [name]] of Object.entries(PLAZAS)) {
  const option = document.createElement('option'); option.value = code; option.textContent = `${name} (${code})`; selector.append(option);
}
function focusPlaza(code) {
  const data = PLAZAS[code];
  if (!data) { $('estado').textContent = 'No se encontró la plaza.'; return; }
  $('estado').textContent = `Explorando: ${data[0]}`;
  viewer.camera.flyToBoundingSphere(new C.BoundingSphere(C.Cartesian3.fromDegrees(data[1], data[2], 0), 1), {
    offset: new C.HeadingPitchRange(0, C.Math.toRadians(-55), 55000), duration: 2
  });
}
function changePlaza() {
  layers.setContext(selector.value, scope()); drawing.clear(); $('cell-comparison').replaceChildren(); $('cell-inspection').replaceChildren(); $('atributos').textContent = 'Selecciona una entidad de una capa cargada.'; $('coincidentes').replaceChildren(); $('selected-layer').textContent = 'Ninguna'; $('layer-method').textContent = ''; $('layer-legend').replaceChildren();
  selectedLayerId = null; $('selected-opacity').disabled = true;
  focusPlaza(selector.value); renderLayers(); renderSummary(); renderReferenceTree();
  if (privateReference && selectedLogicalId) {
    const template = privateReference.templates.find(template => template.logicalId === selectedLogicalId);
    if (template) selectLayerMetadata(template);
    $('reference-status').textContent = `Contexto actualizado: ${selector.value} · ${scope()}. Se conserva la selección de referencia, sin cargar ni sustituir datos.`;
  }
}
selector.addEventListener('change', changePlaza);
$('scope').addEventListener('change', changePlaza);
viewer.homeButton.viewModel.command.beforeExecute.addEventListener(event => {
  event.cancel = true; selector.value = 'JRZ'; changePlaza();
});
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
$('buscar').addEventListener('input', () => {
  const text = normalize($('buscar').value);
  const matches = Array.from(selector.options).filter(option => normalize(option.textContent).includes(text));
  $('resultados-busqueda').textContent = matches.length ? `${matches.length} plazas encontradas` : 'Sin coincidencias';
  for (const option of selector.options) option.hidden = !matches.includes(option);
});
$('ir-coordenadas').addEventListener('submit', event => {
  event.preventDefault();
  const lon = Number($('longitud').value); const lat = Number($('latitud').value);
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || lon < -180 || lon > 180 || lat < -90 || lat > 90) return;
  viewer.camera.flyToBoundingSphere(new C.BoundingSphere(C.Cartesian3.fromDegrees(lon, lat), 1), { offset: new C.HeadingPitchRange(0, C.Math.toRadians(-55), 1500), duration: 2 });
});
let sceneRevision = 0;
function invalidateEvidence() { sceneRevision++; $('verify-3d-status').textContent = 'La vista o el proveedor cambió. Repite la comprobación 3D.'; }
viewer.camera.moveStart.addEventListener(invalidateEvidence);
const providers = new ProviderController(viewer, C, (kind, result) => {
  invalidateEvidence();
  const input = $(kind); input.checked = result.state === 'on' || result.state === 'loading';
  $(`${kind}-status`).textContent = result.message;
});
$('ion-form').addEventListener('submit', event => {
  event.preventDefault(); providers.setToken($('ion-token').value); $('ion-token').value = '';
  $('ion-status').textContent = providers.token ? 'Token aplicado a esta sesión. Activa terreno o edificios para comprobar el acceso.' : 'Token retirado; mapa de respaldo activo.';
});
$('terrain').addEventListener('change', () => providers.setTerrain($('terrain').checked));
$('buildings').addEventListener('change', () => providers.setBuildings($('buildings').checked));
$('base-map').addEventListener('change', () => providers.setBaseMap($('base-map').checked));
$('view-world').addEventListener('click', () => viewer.camera.flyTo({ destination: C.Rectangle.MAX_VALUE, duration: 2 }));
$('view-plazas').addEventListener('click', () => viewer.camera.flyToBoundingSphere(C.BoundingSphere.fromPoints(Object.values(PLAZAS).map(([, lon, lat]) => C.Cartesian3.fromDegrees(lon, lat))), { offset: new C.HeadingPitchRange(0, C.Math.toRadians(-55), 0), duration: 2 }));
$('verify-3d').addEventListener('click', async () => {
  const button = $('verify-3d'); button.disabled = true;
  const revision = sceneRevision;
  $('verify-3d-status').textContent = 'Comprobando la vista actual; no se guardan datos ni credenciales…';
  try {
    const result = await providers.inspect3D();
    $('verify-3d-status').textContent = revision === sceneRevision ? JSON.stringify({ checkedAt: new Date().toISOString(), ...result }, null, 2) : 'La vista o el proveedor cambió durante la comprobación. Repite la prueba.';
  }
  catch { $('verify-3d-status').textContent = 'No se pudo completar la comprobación de esta vista.'; }
  finally { button.disabled = false; }
});
const drawing = installDrawing(viewer, C, message => { $('drawing-status').textContent = message; });
for (const mode of ['point', 'line', 'polygon']) $(`draw-${mode}`).addEventListener('click', () => drawing.start(mode));
$('draw-finish').addEventListener('click', drawing.finish);
$('draw-clear').addEventListener('click', drawing.clear);

function describeEntity(entity) {
  entity = entity._arecParent ?? entity;
  const layer = layers.catalog.layers.find(layer => layers.loaded.get(layer.id)?.entities.contains(entity));
  const fields = originalProperties(entity, layer ?? {}, viewer.clock.currentTime);
  if (layer) selectLayerMetadata(layer);
  $('cell-comparison').replaceChildren(); $('cell-inspection').replaceChildren();
  if (layer?.inspection) renderCellInspection($('cell-inspection'), fields, layer.inspection);
  if (layer?.analysis && layers.sessionInputs.has(layer.id)) {
    try {
      const targets = layers.catalog.layers.filter(item => layers.loaded.get(item.id)?.show && layers.sessionInputs.has(item.id)).map(item => ({ layer: item, data: layers.sessionInputs.get(item.id) }));
      renderCellComparison($('cell-comparison'), compareCell({ layer, properties: fields, data: layers.sessionInputs.get(layer.id) }, targets));
    } catch (error) { $('cell-comparison').textContent = `Comparación no disponible: ${error.message}`; }
  }
  $('atributos').textContent = JSON.stringify({ elemento: entity.name || entity.id, capa: layer?.name ?? 'Elemento sin capa catalogada', fuente: layer?.source ?? 'No documentada', metodologia: layer?.methodology ?? 'No documentada', fechaCorte: layer?.updatedAt ?? 'No documentada', atributos: fields }, null, 2);
}
viewer.selectedEntityChanged.addEventListener(entity => {
  if (entity) describeEntity(entity);
  else { $('cell-comparison').replaceChildren(); $('cell-inspection').replaceChildren(); $('atributos').textContent = 'Selecciona una entidad de una capa cargada.'; }
});
// Independent handler: preserves Cesium's native selection and supports coincident layers/3D Tiles.
const inspect = new C.ScreenSpaceEventHandler(viewer.scene.canvas);
inspect.setInputAction(event => {
  const hits = viewer.scene.drillPick(event.position, 20);
  const choices = $('coincidentes'); choices.replaceChildren();
  const seen = new Set();
  for (const hit of hits) {
    const entity = hit.id?._arecParent ?? hit.id;
    if (entity?.properties && !seen.has(entity)) {
      seen.add(entity);
      const button = document.createElement('button'); button.textContent = entity.name || String(entity.id);
      button.addEventListener('click', () => describeEntity(entity)); choices.append(button);
    } else if (typeof hit.getPropertyIds === 'function') {
      const attributes = Object.create(null);
      for (const key of hit.getPropertyIds()) attributes[key] = hit.getProperty(key);
      const snapshot = JSON.stringify(attributes, null, 2);
      const button = document.createElement('button'); button.textContent = 'Edificio / 3D Tiles';
      button.addEventListener('click', () => {
        $('cell-comparison').replaceChildren(); $('cell-inspection').replaceChildren(); $('atributos').textContent = snapshot;
      }); choices.append(button);
    }
  }
}, C.ScreenSpaceEventType.LEFT_CLICK);

function renderLayers() {
  const panel = $('capas'); panel.replaceChildren();
  const available = layers.catalog.layers.filter(inContext);
  if (!available.length) { panel.textContent = 'Sin capas territoriales autorizadas. V01–V23 y sus subcapas requieren el catálogo rector y los archivos originales.'; return; }
  for (const layer of available) {
    const group = document.createElement('fieldset'); group.dataset.layerId = layer.id;
    const legend = document.createElement('legend'); legend.textContent = `${layer.variable} · ${layer.name}${layer.sessionOnly ? ' · SOLO SESIÓN' : ''}`;
    const toggle = document.createElement('input'); toggle.type = 'checkbox'; toggle.checked = layers.loaded.get(layer.id)?.show === true;
    const label = document.createElement('label'); label.append(toggle, document.createTextNode(' Mostrar capa'));
    const opacity = document.createElement('input'); opacity.type = 'range'; opacity.min = 0; opacity.max = 1; opacity.step = 0.05; opacity.value = layers.opacities.get(layer.id) ?? layer.style.opacity; opacity.setAttribute('aria-label', `Opacidad de ${layer.name}`);
    const metadata = document.createElement('button'); metadata.textContent = 'Leyenda y metodología'; metadata.type = 'button'; metadata.addEventListener('click', () => selectLayerMetadata(layer));
    const status = document.createElement('p'); status.textContent = layers.loaded.has(layer.id) ? (toggle.checked ? 'Capa visible' : 'Capa oculta') : 'Preparada; actívala para cargar.'; const symbols = document.createElement('p'); symbols.textContent = layer.legend;
    const frame = document.createElement('button'); frame.type = 'button'; frame.textContent = 'Encuadrar capa'; frame.disabled = !toggle.checked;
    frame.addEventListener('click', async () => {
      const source = layers.loaded.get(layer.id);
      if (!source) return;
      try { const success = await viewer.flyTo(source, { duration: 2, offset: new C.HeadingPitchRange(0, C.Math.toRadians(-55), 0) }); if (!success) status.textContent = 'Encuadre cancelado o geometría no disponible.'; }
      catch { status.textContent = 'No se pudo encuadrar esta geometría.'; }
    });
    toggle.addEventListener('change', async () => {
      toggle.disabled = true; status.textContent = 'Cargando…';
      try { await layers.setVisible(layer.id, toggle.checked); layers.setOpacity(layer.id, Number(opacity.value)); status.textContent = toggle.checked ? 'Capa visible' : 'Capa oculta'; }
      catch { toggle.checked = false; status.textContent = 'No se pudo cargar la capa. Revisa el archivo y la conexión.'; }
      finally { toggle.disabled = false; frame.disabled = !toggle.checked; renderSummary(); renderReferenceTree(); if (viewer.selectedEntity) describeEntity(viewer.selectedEntity); }
    });
    opacity.addEventListener('input', () => { layers.setOpacity(layer.id, Number(opacity.value)); if (selectedLayerId === layer.id) $('selected-opacity').value = opacity.value; });
    if (layer.style.paint) { opacity.setAttribute('aria-label', `Intensidad sobre simbología original de ${layer.name}`); }
    group.append(legend, label, opacity, symbols, metadata, frame, status);
    for (const category of layer.style.categories ?? []) {
      const item = document.createElement('p'); const swatch = document.createElement('span'); swatch.className = 'legend-swatch'; swatch.style.backgroundColor = category.color;
      item.append(swatch, document.createTextNode(category.label)); group.append(item);
    }
    panel.append(group);
  }
}
function summary() {
  const entries = layers.catalog.layers.filter(inContext);
  const rows = [
    ['Plaza', PLAZAS[selector.value][0]], ['Ámbito declarado', $('scope').selectedOptions[0].textContent], ['Capas públicas autorizadas en catálogo', entries.filter(layer => !layer.sessionOnly).length], ['Muestras privadas de sesión', entries.filter(layer => layer.sessionOnly).length],
    ['Variables con capas disponibles (catálogo/sesión)', new Set(entries.filter(layer => layer.kind !== 'base').map(layer => layer.variable)).size],
    ['Celdas analizadas (plaza completa)', 'No disponible'], ['Distribución ZCU', 'No disponible'],
    ['Superficies y expansión', 'No disponible'], ['Puntaje de oportunidad / REC', 'Pendiente de reglas y validación'],
    ['Última actualización territorial', 'No verificada'],
    ['Limitación', 'Disponibilidad de archivos no equivale a variables calculadas ni a cobertura territorial completa.']
  ];
  const dataRows = [];
  for (const layer of entries) {
    const source = layers.loaded.get(layer.id);
    if (source) dataRows.push(...layerSummaryRows(layer, source, viewer.clock.currentTime, layers.originalRows.get(layer.id)));
  }
  return [...rows.slice(0, 3), ...dataRows, ...rows.slice(3)];
}
function renderSummary() {
  const target = $('summary'); target.replaceChildren();
  for (const [key, value] of summary()) {
    const term = document.createElement('dt'); term.textContent = key;
    const definition = document.createElement('dd'); definition.textContent = String(value); target.append(term, definition);
  }
  const active = $('active-layers'); active.replaceChildren();
  for (const layer of layers.catalog.layers.filter(layer => inContext(layer) && layers.loaded.get(layer.id)?.show)) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = layer.name;
    button.addEventListener('click', () => selectLayerMetadata(layer)); active.append(button);
  }
  if (selectedLayerId && !layers.loaded.has(selectedLayerId)) $('selected-opacity').disabled = true;
}
$('export-csv').addEventListener('click', () => {
  if (hasSessionData() && !window.confirm('El CSV puede contener resultados de la muestra privada. ¿Guardar una copia local bajo tu responsabilidad?')) return;
  // Prevent spreadsheet formula interpretation in all exported text cells.
  const quote = value => '"' + String(value).replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""') + '"';
  const blob = new Blob(['\ufeffIndicador,Valor\r\n' + summary().map(row => row.map(quote).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `AREC-GEO-estatus-${selector.value}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
let reportWasOpen = true;
window.addEventListener('beforeprint', () => { const report = document.querySelector('.report'); reportWasOpen = report.open; report.open = true; });
window.addEventListener('afterprint', () => { document.querySelector('.report').open = reportWasOpen; });
$('print-report').addEventListener('click', () => { if (!hasSessionData() || window.confirm('El informe puede contener resultados de la muestra privada. ¿Continuar con la impresión local?')) window.print(); });
(document.documentElement.dataset.localPreview === 'true' ? Promise.resolve({ version: 1, layers: [] }) : fetch('./data/catalog.json').then(response => {
  if (!response.ok) throw new Error('No se pudo leer el catálogo de capas.');
  return response.json();
})).then(catalog => { layers.setCatalog(catalog); renderLayers(); renderSummary(); }).catch(() => { $('capas').textContent = 'Catálogo no disponible o inválido. El mapa sigue disponible.'; });
selector.value = 'JRZ'; layers.setContext('JRZ', scope()); focusPlaza('JRZ'); renderSummary();

function hasSessionData() { return layers.catalog.layers.some(layer => layer.sessionOnly && layers.loaded.has(layer.id)); }
$('session-form').addEventListener('submit', async event => {
  event.preventDefault();
  const status = $('session-status');
  const geoFile = $('session-geojson').files[0]; const descriptorFile = $('session-descriptor').files[0];
  if (!geoFile || !$('session-consent').checked) return;
  if (!descriptorFile && (!privateReference || !selectedLogicalId)) { status.textContent = 'Selecciona una subcapa del paquete privado o un descriptor revisado.'; return; }
  if (geoFile.size > 25 * 1024 * 1024 || (descriptorFile?.size ?? 0) > 1024 * 1024) { status.textContent = 'Límite de muestra: 25 MiB; descriptor: 1 MiB.'; return; }
  try {
    const descriptor = descriptorFile ? JSON.parse(await descriptorFile.text()) : descriptorFromReference(privateReference, selectedLogicalId, selector.value, scope());
    if (descriptor.plaza !== selector.value || (descriptor.scope ?? 'city') !== scope()) throw Error('El descriptor debe corresponder a la plaza y ámbito seleccionados; no hay sustitución silenciosa por ciudad.');
    const text = await geoFile.text();
    const data = JSON.parse(text);
    await verifyInputEvidence(text, data, descriptor.inputEvidence);
    if (descriptor.plaza !== selector.value || (descriptor.scope ?? 'city') !== scope()) throw Error('El contexto cambió durante la revisión del archivo; vuelve a prepararlo.');
    layers.addSessionLayer({ ...descriptor, sessionApproved: true, publicApproved: false }, data);
    renderLayers(); renderSummary(); renderReferenceTree();
    status.textContent = 'Muestra preparada SOLO EN MEMORIA. Actívala en Capas territoriales. No se ha subido a GitHub ni a un servidor.';
    $('session-geojson').value = ''; $('session-descriptor').value = ''; $('session-consent').checked = false;
  } catch (error) { status.textContent = `Muestra no cargada: ${error.message}`; }
});
$('session-clear').addEventListener('click', () => {
  layers.removeSessionLayers(); viewer.selectedEntity = undefined; $('coincidentes').replaceChildren();
  selectedLayerId = null; $('selected-opacity').disabled = true; $('selected-layer').textContent = 'Ninguna'; $('layer-method').textContent = ''; $('layer-legend').replaceChildren();
  $('cell-comparison').replaceChildren(); $('cell-inspection').replaceChildren(); $('atributos').textContent = 'Selecciona una entidad de una capa cargada.';
  renderLayers(); renderSummary(); renderReferenceTree(); $('session-status').textContent = 'Referencias a muestras retiradas de la sesión. No implica borrado seguro de memoria ni de copias descargadas.';
});

function selectLayerMetadata(layer) {
  const target = layers.catalog.layers.find(item => inContext(item) && (item.id === layer.id || layer.logicalId && item.logicalId === layer.logicalId));
  selectedLayerId = target?.id ?? null; $('selected-opacity').disabled = !target || !layers.loaded.has(target.id);
  $('selected-opacity').value = target ? layers.opacities.get(target.id) ?? target.style.opacity : 1;
  $('selected-layer').textContent = layer.name;
  $('layer-method').textContent = [layer.source ? `Fuente: ${layer.source}` : 'Fuente no documentada', layer.methodology ? `Método: ${layer.methodology}` : 'Método no documentado', layer.formula ? `Regla declarada: ${layer.formula}` : 'Sin regla adicional documentada', `Ámbito: ${scope()}`, ...(layer.temporalEvidence ?? []).map(value => `Fuente temporal declarada: ${value}`), ...(layer.warnings ?? [])].join('\n\n');
  const legend = $('layer-legend'); legend.replaceChildren();
  const entries = layer.legendEntries ?? layer.style?.categories?.map(item => [item.color, item.label]) ?? [];
  for (const [color, text] of entries) {
    const line = document.createElement('p'); const swatch = document.createElement('span'); swatch.className = 'legend-swatch'; swatch.style.backgroundColor = color;
    line.append(swatch, document.createTextNode(text)); legend.append(line);
  }
  if (!entries.length) legend.textContent = layer.legend ?? 'Sin leyenda documentada.';
}
$('selected-opacity').addEventListener('input', () => {
  if (!selectedLayerId) return;
  const value = Number($('selected-opacity').value); layers.setOpacity(selectedLayerId, value);
  for (const group of document.querySelectorAll('#capas fieldset')) if (group.dataset.layerId === selectedLayerId) group.querySelector('input[type=range]').value = value;
});
function renderReferenceTree() {
  const root = $('reference-tree'); root.replaceChildren();
  if (!privateReference) { root.textContent = 'Sin paquete privado de referencia cargado. Las definiciones originales no se incluyen en el sitio público.'; return; }
  const query = normalize($('layer-search').value);
  if (privateReference.baseLayers?.length) {
    const section = document.createElement('details'); section.open = true; const title = document.createElement('summary'); title.textContent = 'Base territorial de referencia'; section.append(title);
    for (const base of privateReference.baseLayers) {
      if (!normalize(base.name).includes(query)) continue;
      const button = document.createElement('button'); button.type = 'button'; button.className = 'reference-choice'; button.textContent = `${base.name} · geometrías pendientes`;
      button.addEventListener('click', () => { selectedLogicalId = base.id; const template = privateReference.templates.find(template => template.logicalId === base.id); selectLayerMetadata(template ?? { ...base, methodology: base.methodology ?? 'Simbología pendiente de soporte; no se sustituyen sus reglas.' }); $('reference-status').textContent = `Seleccionada: ${base.name}. Ámbito ${scope()}. Sin descarga automática.`; }); section.append(button);
    }
    root.append(section);
  }
  for (const group of privateReference.groups) {
    const section = document.createElement('details'); section.open = true;
    const title = document.createElement('summary'); title.textContent = group.name; section.append(title);
    for (const id of group.variables) {
      const variable = privateReference.variables.find(variable => variable.id === id);
      if (blockedVariable(id)) { const locked = document.createElement('p'); locked.textContent = `${id} · Interna no habilitada`; section.append(locked); continue; }
      const matching = variable.sublayers.filter(layer => normalize(`${id} ${variable.name} ${layer.name}`).includes(query));
      if (!matching.length) continue;
      const container = document.createElement('details'); container.open = Boolean(query); container.dataset.variable = id;
      const name = document.createElement('summary'); name.textContent = `${id} · ${variable.name}`; container.append(name);
      for (const layer of matching) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'reference-choice';
        const available = layers.catalog.layers.some(entry => inContext(entry) && entry.logicalId === layer.id);
        button.textContent = `${layer.name} · ${available ? 'muestra recibida' : 'documentada; datos no recibidos'}`;
        button.addEventListener('click', () => {
          selectedLogicalId = layer.id;
          const template = privateReference.templates.find(template => template.logicalId === layer.id);
          selectLayerMetadata(template ?? { name: layer.name, source: layer.source, methodology: 'Simbología o método pendiente de soporte/revisión; no se asignan sustitutos.' });
          $('reference-status').textContent = `Seleccionada: ${layer.name}. Ámbito ${scope()}. No se ha descargado ninguna capa.`;
        });
        container.append(button);
      }
      section.append(container);
    }
    root.append(section);
  }
}
$('reference-form').addEventListener('submit', async event => {
  event.preventDefault(); const file = $('reference-file').files[0];
  if (!file || !$('reference-consent').checked) return;
  if (file.size > 2 * 1024 * 1024) { $('reference-status').textContent = 'Paquete de referencia limitado a 2 MiB.'; return; }
  try {
    privateReference = validateReferencePackage(JSON.parse(await file.text())); selectedLogicalId = null;
    renderReferenceTree(); $('reference-status').textContent = 'Referencia privada cargada en memoria. El árbol documentado no acredita disponibilidad de datos ni resultados.';
    $('reference-file').value = ''; $('reference-consent').checked = false;
  } catch { $('reference-status').textContent = 'Paquete de referencia inválido. No se ejecuta código ni se siguen sus enlaces.'; }
});
$('reference-clear').addEventListener('click', () => { privateReference = null; selectedLogicalId = null; renderReferenceTree(); $('selected-layer').textContent = 'Ninguna'; $('layer-method').textContent = ''; $('layer-legend').replaceChildren(); $('reference-status').textContent = 'Referencia retirada de la memoria de sesión. No se eliminan muestras ya cargadas; usa Retirar muestras para ello.'; });
$('layer-search').addEventListener('input', renderReferenceTree);
renderReferenceTree();
