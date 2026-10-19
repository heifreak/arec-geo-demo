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

El HTML original se recibió y se analizó únicamente en privado. Faltan la Especificación Técnica Rectora, la validación de reglas y una muestra de una plaza revisada para el uso autorizado. El ZIP de 351.41 MB no está disponible y excluir V15–V18 no autoriza automáticamente el resto.

## Entrada privada y muestras de sesión

`tools/private-intake.mjs` recibe adjuntos ya descargados por Codex y los conserva fuera del checkout, bajo `/tmp/arec-geo-private`, con recibos privados de integridad y aprobación pública falsa. Véase docs/private-intake.md; no existe un endpoint público de recepción. El HTML de referencia nunca se ejecuta como parte de esta entrada.

El visor admite muestras GeoJSON y descriptores revisados mediante File API, exclusivamente en memoria. El catálogo de sesión está separado por `sessionOnly` y no supera el control del catálogo público, aunque alguien intente reutilizarlo. Las muestras no se solicitan por URL ni se suben al servidor; V15–V18 siguen excluidas. Se preservan atributos originales en una propiedad encapsulada de representación para evitar que descripciones HTML/simplestyle emitan solicitudes externas. El inspector los presenta sin transformaciones analíticas.

`src/session-data.js` comprueba estructura, límites y rango de coordenadas WGS84. No valida topología exhaustiva, dimensiones métricas de malla ni que una geometría pertenezca realmente a JRZ; eso requiere revisar los archivos auténticos.

`src/territorial-summary.js` resume atributos existentes solo con un mapeo explícito. Rechaza identificadores duplicados/ausentes, mantiene faltantes separados de cero, declara muestra/plaza y nunca combina capas para dar un total único de celdas sin una regla validada. Las capas ocultas pero cargadas siguen presentes en el resumen con ese estado explícito. No calcula ZCU, NDVI, calor ni oportunidad desde geometrías.

Un descriptor de sesión requiere los metadatos de capa (plaza, variable, nombre, referencia de revisión y leyenda), `style.color` y `style.opacity`. Para color por clase requiere `style.categoryField`, `style.reference` y `style.categories` con valor original/color/etiqueta. Es una búsqueda por valor preexistente, sin umbrales inventados; iconos, patrones o reglas adicionales de V15 aún requieren la referencia. El formulario concede revisión de sesión, nunca publicación.

El bloque opcional `analysis` requiere `reference`, `scope` (`sample`/`plaza`) y `cellIdField`, y admite `classField` y `metrics`. Cada métrica exige id, campo original, etiqueta, unidad, agregación `sum` o `mean` y referencia de esa regla. No existe un mapeo AREC predeterminado. El desarrollador creará el descriptor a partir de documentos/datos revisados, no el usuario manualmente.

La comprobación 3D usa alturas devueltas por el proveedor remoto y evidencia de entidades de teselas visibles; muestra ausencia de evidencia cuando falta. Cambiar vista o proveedor invalida la comprobación. Sus recuentos no son un inventario de edificios únicos ni prueban cobertura completa.


## Portabilidad de referencias sin distribuir sus definiciones

- `reference-package.js`: valida un paquete JSON privado, con jerarquía y plantillas. No interpreta HTML/JavaScript, no sigue rutas y bloquea plantillas de variables internas. Leer el árbol no supone disponer de archivos geográficos.
- `style-expressions.js`: intérprete restringido de expresiones declarativas; permite campos, coalesce, escalones, coincidencias y condiciones, sin eval ni ejecución de código. Operadores y propiedades no soportados fallan de forma explícita. Las definiciones concretas se suministran como datos privados, no como constantes de la aplicación pública.
- `paint-renderer.js`: aplica esos símbolos a polígonos, líneas y círculos Cesium. Genera contornos clamped sobre terreno, incluidos huecos, vinculados al elemento original para inspección y sin sumarlos como registros analíticos. La intensidad multiplica las opacidades originales de cada tipo de geometría. No se certifica identidad píxel a píxel entre motores.
- El contexto plaza/ámbito se valida en el administrador de capas. Cambiarlo invalida cargas y retira entidades; no sustituye datos metropolitanos por datos urbanos, no recorta polígonos ni calcula resultados. Los controles globales usan las 18 plazas existentes.
- El inspector incluye referencia, leyenda, método, regla declarada, intensidad y accesos a capas activas. Todo texto se inserta sin ejecutar HTML recibido.

El catálogo público sigue sin incluir datos originales. El análisis, inventario de definiciones y pruebas con valores de la referencia se conservan fuera del checkout. Los estilos discontinuos y formatos vectoriales adicionales permanecen pendientes; no se reemplazan con símbolos aproximados sin revisión.
