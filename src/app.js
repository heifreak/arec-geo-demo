import { PLAZAS } from './plazas.js';
import { LayerManager } from './layers.js';


    // ===========================================
    // 1. CONFIGURACIÓN GENERAL
    // ===========================================

    const CONFIG = {
      alturaEnfoque: 55000,
      inclinacion: -55,
      duracionVuelo: 2.0
    };


    // ===========================================
    // 2. CREACIÓN DEL VISOR CESIUM
    // ===========================================

    const viewer = new Cesium.Viewer(
      "cesiumContainer",
      {
        baseLayer: new Cesium.ImageryLayer(
          new Cesium.OpenStreetMapImageryProvider({
            url: "https://tile.openstreetmap.org/",
            maximumLevel: 18
          })
        ),

        terrainProvider:
          new Cesium.EllipsoidTerrainProvider(),

        baseLayerPicker: false,
        geocoder: false,
        animation: false,
        timeline: false,
        navigationHelpButton: true,

        homeButton: true,
        sceneModePicker: true,
        fullscreenButton: true,

        selectionIndicator: true,
        infoBox: true
      }
    );


    // ===========================================
    // 3. CATÁLOGO DE LAS 18 PLAZAS
    // ===========================================

    // Coordenadas de referencia urbana.
    // Formato: [Nombre, Longitud, Latitud]
    // Delicias no se incluye.




    // ===========================================
    // 4. ELEMENTOS DE INTERFAZ
    // ===========================================

    const selector =
      document.getElementById("plaza");

    const estado =
      document.getElementById("estado");


    // ===========================================
    // 5. CREAR SELECTOR AUTOMÁTICAMENTE
    // ===========================================

    for (const [codigo, datos] of
      Object.entries(PLAZAS)) {

      const opcion =
        document.createElement("option");

      opcion.value = codigo;

      opcion.textContent =
        `${datos[0]} (${codigo})`;

      selector.appendChild(opcion);

    }


    // ===========================================
    // 6. CÁMARA CORREGIDA
    // CENTRAR LA CIUDAD EN PANTALLA
    // ===========================================

    function irAPlaza(codigo) {

      const datos = PLAZAS[codigo];

      if (!datos) {
        estado.textContent =
          "No se encontró la plaza.";
        return;
      }

      const nombre = datos[0];
      const longitud = datos[1];
      const latitud = datos[2];

      estado.textContent =
        `Explorando: ${nombre}`;

      // Punto real que la cámara debe mirar.
      const centro = Cesium.Cartesian3.fromDegrees(
        longitud,
        latitud,
        0
      );

      // Esfera centrada en la ciudad.
      const objetivo = new Cesium.BoundingSphere(
        centro,
        1
      );

      // La cámara se coloca respecto del objetivo,
      // no respecto de una altura vertical fija.
      const orientacion = new Cesium.HeadingPitchRange(
        0,
        Cesium.Math.toRadians(
          CONFIG.inclinacion
        ),
        CONFIG.alturaEnfoque
      );

      viewer.camera.flyToBoundingSphere(
        objetivo,
        {
          offset: orientacion,
          duration: CONFIG.duracionVuelo
        }
      );

    }


    // ===========================================
    // 7. CAMBIO DE PLAZA
    // ===========================================

    selector.addEventListener(
      "change",
      function() {
        irAPlaza(selector.value);
      }
    );


    // ===========================================
    // 8. BOTÓN HOME
    // REGRESAR A CIUDAD JUÁREZ
    // ===========================================

    viewer.homeButton.viewModel.command.beforeExecute
      .addEventListener(function(evento) {

        evento.cancel = true;

        selector.value = "JRZ";
        irAPlaza("JRZ");

      });


    // ===========================================
    // 9. ARRANQUE DEL VISOR
    // ===========================================

    selector.value = "JRZ";

    irAPlaza("JRZ");

  
const buscar = document.getElementById('buscar');
buscar.addEventListener('input', () => {
  const texto = buscar.value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  for (const opcion of selector.options) {
    opcion.hidden = !opcion.textContent.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(texto);
  }
});
const layers = new LayerManager(viewer, Cesium);
const panel = document.getElementById('capas');
const atributos = document.getElementById('atributos');
viewer.selectedEntityChanged.addEventListener(entity => {
  atributos.textContent = '';
  if (!entity) { atributos.textContent = 'Selecciona una entidad de una capa cargada.'; return; }
  const props = entity.properties?.getValue(viewer.clock.currentTime) ?? {};
  atributos.textContent = JSON.stringify(props, null, 2);
});
function renderLayers() {
  panel.replaceChildren();
  const disponibles = layers.catalog.layers.filter(layer => layer.plaza === selector.value);
  if (!disponibles.length) { panel.textContent = 'No hay capas autorizadas para esta plaza. Datos AREC GEO pendientes de integración.'; return; }
  for (const layer of disponibles) {
    const group = document.createElement('fieldset');
    const legend = document.createElement('legend'); legend.textContent = layer.variable + ' · ' + layer.name;
    const toggle = document.createElement('input'); toggle.type = 'checkbox';
    const label = document.createElement('label'); label.append(toggle, document.createTextNode(' Mostrar capa'));
    const opacity = document.createElement('input'); opacity.type = 'range'; opacity.min = 0; opacity.max = 1; opacity.step = 0.05; opacity.value = 1; opacity.setAttribute('aria-label', 'Opacidad de ' + layer.name);
    const status = document.createElement('p');
    const symbols = document.createElement('p'); symbols.textContent = layer.legend;
    toggle.addEventListener('change', async () => {
      toggle.disabled = true; status.textContent = 'Cargando…';
      try { await layers.setVisible(layer.id, toggle.checked); layers.setOpacity(layer.id, Number(opacity.value)); status.textContent = toggle.checked ? 'Capa visible' : 'Capa oculta'; }
      catch (error) { toggle.checked = false; status.textContent = error.message; }
      finally { toggle.disabled = false; }
    });
    opacity.addEventListener('input', () => layers.setOpacity(layer.id, Number(opacity.value)));
    group.append(legend, label, opacity, symbols, status); panel.append(group);
  }
}
selector.addEventListener('change', () => { layers.clear(); renderLayers(); });
viewer.homeButton.viewModel.command.beforeExecute.addEventListener(() => { layers.clear(); renderLayers(); });
fetch('./data/catalog.json').then(response => {
  if (!response.ok) throw new Error('No se pudo leer el catálogo de capas.');
  return response.json();
}).then(catalog => { layers.setCatalog(catalog); renderLayers(); }).catch(error => { panel.textContent = error.message; });
