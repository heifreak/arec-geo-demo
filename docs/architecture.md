# Arquitectura y estado

Aplicación estática para GitHub Pages, sin backend ni notebooks en ejecución.

- `index.html`: estructura accesible y dependencias CesiumJS 1.146.
- `src/styles.css`: presentación adaptable.
- `src/plazas.js`: catálogo único de 18 plazas, sin DEL.
- `src/app.js`: visor, búsqueda local de plazas, cámara, Home, panel e inspector.
- `src/layers.js`: validación del catálogo, carga GeoJSON bajo demanda, visibilidad, opacidad y limpieza al cambiar de plaza. Una generación invalida cargas antiguas para evitar mostrar datos de otra plaza.
- `src/providers.js`: servicios ion opcionales, generación por proveedor y respaldo ante fallos iniciales o de streaming. El token es solo de sesión.
- `src/measurements.js`: dibujos locales y mediciones esféricas aproximadas; no son análisis de oportunidad ni superficies catastrales.
- `tools/inventory.mjs`: inspección local sin publicar, sin exportar valores de atributos ni asignar significados a subcapas. Rechaza enlaces simbólicos y deja archivos mayores de 64 MiB como no inspeccionados.
- `tools/browser-smoke.mjs`: prueba Chromium con datos sintéticos interceptados y recursos Cesium reales. Incluye la vía curl con TLS verificado cuando el proxy requiere el almacén CA del sistema.
- `data/catalog.json`: catálogo público vacío intencionadamente. No se han recibido datos autorizados.

Cada entrada futura requiere `id`, `plaza`, `variable` (V01–V23 excepto V15–V18), `name`, `url` relativa `data/...geojson`, `publicApproved: true`, `approvalReference`, `legend` y `style: {color, opacity}`. La aprobación es un control editorial: el navegador no protege archivos públicos. No subir datos privados aunque no aparezcan en el catálogo.

El estilo uniforme actual es una infraestructura genérica, no una implementación V14. Las capas que requieren estilos por categoría no deben integrarse hasta disponer del código rector. No se asignan nombres ni subcapas a las 23 variables sin esa referencia.

El procesamiento, validación métrica de cuadrículas y clasificación deben producir datos revisados fuera del visor. El frontend los presentará sin depender de Colab. Antes de elegir GeoJSON completo, simplificación o teselas, medir los tamaños reales de una plaza piloto.

La interfaz tiene barra superior, panel izquierdo de escena/capas/dibujo y panel derecho con inspector de atributos y elementos coincidentes, incluyendo propiedades de 3D Tiles. El resumen es un inventario del catálogo público: no deduce celdas, ZCU, superficies ni porcentajes de avance. Exporta ese estatus como CSV y ofrece impresión/guardado PDF mediante el navegador. No es todavía un reporte ejecutivo territorial con resultados reales.

Pendientes: búsqueda de direcciones con proveedor autorizado, ámbitos central/metropolitano, grupos oficiales de variables, estilos categóricos V14, validación geodésica de precisión, mallas, ZCU, macropolígonos T1/T2/T3, motor multicriterio y Balance de Tierra REC. No hay cálculos territoriales implementados ni resultados simulados.

Se necesitan `index_v15_metropolitano.html`, diccionario rector de las 23 variables/subcapas y reglas V14, y una muestra de una plaza revisada para publicación. El ZIP de 351.41 MB no está disponible y excluir V15–V18 no autoriza automáticamente el resto.
