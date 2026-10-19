# Verificación de la segunda fase

## Comprobado en esta ejecución

- `npm ci --cache /tmp/arec-npm-cache --no-audit --no-fund`: instalación reproducible con lockfile e integridad npm.
- `npm test`: **14 pruebas ejecutadas y aprobadas**, 0 fallos y 0 omitidas. Incluyen catálogo y privacidad, ciclo de capas, intención de visibilidad durante cargas, proveedores opcionales con fallos iniciales/tardíos, descarte de cargas canceladas, mediciones esféricas y el inventario privado.
- Sintaxis de app, proveedores y mediciones; `git diff --check`: aprobados.
- `AREC_TLS_TRANSPORT=curl npm run test:browser`: aprobado con Chromium real, WebGL por SwiftShader y CesiumJS 1.146 real. Se usó curl para descargar HTTPS con la CA del sistema; **no** se deshabilitó TLS. El transporte conserva User-Agent y Referer del navegador. Se verificaron:
  - 18 plazas, cambio a Monterrey, Home a Juárez y búsqueda sin acentos.
  - GeoJSON sintético exclusivamente interceptado por la prueba: no precarga, carga/ocultamiento/reutilización, control de opacidad y cambio de plaza.
  - Selección de atributos originales del fixture y representación de texto HTML sin ejecución.
  - Activación sin token informa requisito y mantiene el mapa; control independiente de mapa base.
  - Dibujo de línea, resultado aproximado y limpieza.
  - Descarga de CSV con valores no disponibles explícitos.
  - Catálogo de producción vacío sin capa sintética; inspector móvil accesible.
  - Sin errores JavaScript de página durante el recorrido.
- Capturas revisadas en `/tmp/arec-browser-artifacts/`: escritorio y móvil. El mapa base muestra teselas reales de Ciudad Juárez. Una ejecución previa del relay sin encabezados de navegador mostraba imágenes de bloqueo OSM; se corrigió el transporte, sin cambiar de proveedor ni eludir su política.

## No comprobado o pendiente

- Servicios **autenticados** Cesium World Terrain y OSM Buildings: no hay token ion. Las pruebas de proveedores utilizan dobles controlados; no demuestran edificios ni relieve reales. Debe verificarse también pérdida de streaming, precisión y cobertura en una sesión autorizada.
- Las mediciones son aproximaciones esféricas, sin validación catastral, áreas sobre relieve o polígonos autointersectados.
- El botón PDF usa impresión del navegador; no se verificó el diálogo nativo de guardado PDF ni se genera todavía un informe territorial con resultados reales.
- No se probaron capas AREC reales, reglas/simbología V14, resultados por celda ni agregaciones ejecutivas: faltan referencias y datos autorizados.
- Las URL de Drive V15 y las dos exportaciones de Docs devolvieron HTTP 403. No se obtuvo contenido de esos documentos ni de la grabación.
- La API GraphQL de GitHub sigue devolviendo `Forbidden`; no fue posible consultar/editar metadatos del PR #1 desde aquí. Git HTTPS permite actualizar su rama. No se fusionó ni publicó.

El resultado es una base funcional ampliada y probada con datos sintéticos, no el producto territorial completo ni la recuperación validada de V15.

## Fase de entrada privada y piloto JRZ (aún sin archivos originales)

- `node tools/private-intake.mjs init`: directorio temporal `/tmp/arec-geo-private` creado y permisos 0700 comprobados. No contiene referencias originales recibidas; no hay servidor de subida.
- `npm test`: **23 pruebas aprobadas**, 0 fallos/omitidas. Se añaden recepción inerte de HTML, recibos SHA-256/permisos, muestras de sesión, coordenadas/CRS, conservación de atributos y colores categóricos, retiro de muestras durante cargas sin apagar capas públicas, resúmenes con referencias y faltantes, y diagnóstico 3D sin falsos positivos por solo conectar un proveedor.
- `AREC_TLS_TRANSPORT=curl npm run test:browser`: aprobado de nuevo con Chromium/Cesium reales. Se mantienen navegación, las 18 plazas, Home, búsqueda, herramientas, CSV y móvil. Además se verifica una muestra poligonal **sintética** leída mediante File API, selección de sus atributos, agregación de un valor precalculado de prueba, retiro de muestra y diagnóstico sin token. El monitor de solicitudes verifica ausencia de POST/subidas y de solicitudes inducidas por descripciones HTML de la muestra. No se usa esa muestra en el catálogo ni se publica como dato real.
- Una primera ejecución de la prueba nueva tenía una carrera al comprobar el estado antes de terminar `File.text()`. Se corrigió el test para esperar la respuesta de la interfaz; la ejecución final pasó.
- Sintaxis de los módulos añadidos y `git diff --check`: aprobados.
- No se reintentaron enlaces Drive/Docs bloqueados.

**Criterio de entrega del piloto todavía NO cumplido:** falta una capa auténtica autorizada y la referencia V15 para comprobar campos, leyendas, reglas y resultados. No se declara integrada la malla 500 × 500 m ni V13, V14 o V20 por implementar el lector. Los resúmenes reales se habilitarán con sus campos y reglas documentados; hoy solo se validaron con datos de prueba. El streaming ion autenticado sigue pendiente de la cuenta/token del propietario en el formulario de sesión, nunca por chat.

## Fase de adaptación declarativa de referencia privada

El archivo de referencia se recibió mediante el mecanismo privado, con integridad verificada; se analizó como texto y AST. No se ejecutaron HTML ni JavaScript originales, no se siguieron sus enlaces y no se copiaron las definiciones o el análisis detallado al repositorio. Los artefactos privados y sus comprobaciones de compatibilidad quedan en la entrada privada.

- `npm test`: **33 pruebas aprobadas**, sin fallos ni omisiones. Añaden validación del paquete de referencia, intérprete restringido de estilos, geometrías con contornos sobre terreno, símbolos de puntos, preservación de opacidades y aislamiento de ámbitos.
- La prueba Chromium se amplía para leer paquetes de referencia en memoria, elegir una plantilla sin escribir JSON, renderizar una muestra poligonal sintética con simbología declarativa y cambiar de ámbito sin fallback urbano. Mantiene los recorridos anteriores y verifica que no hay subidas.
- El parámetro opcional `PRIVATE_REFERENCE_PATH` permite comprobar un paquete local ya revisado, sin imprimir su contenido ni incluirlo como fixture del repositorio. No se ejecuta el HTML original; las capturas finales se toman después de retirar los metadatos privados.
- Las comprobaciones de reglas visuales no validan las metodologías como modelos aprobados, ni demuestran datos auténticos, equivalencia visual exacta entre motores, disponibilidad de todas las fuentes o autenticación ion. El piloto territorial real sigue pendiente.

El siguiente documento solicitado es exclusivamente la Especificación Técnica Rectora del 14 de octubre. No se reintentan enlaces bloqueados ni se marca el PR como listo.

## Importador masivo y reconciliación del PR (19 de octubre de 2026)

Se preservó el trabajo local antes de integrar `f045d36`. La vista experimental fue sustituida por el importador completo: `preview-masiva.html` y `preview.html` son artefactos idénticos generados junto con `src/viewer.bundle.js`. No contienen las definiciones privadas ni los datos originales.

- 56 pruebas unitarias y 12 espaciales aprobadas; comprobación de sintaxis de fuentes y herramientas y compilación reproducible por SHA-256.
- Chromium sobre el HTML descargable servido sin modificaciones: 1.255 archivos sintéticos, 18 plazas, inventario progresivo, cancelación/reimportación, internos sin leer, carga/liberación bajo demanda, inspector y persistencia con consentimiento, fallo de cuota, cancelación de guardado, restauración y borrado.
- Dos archivos privados reales de Juárez y la referencia local, fuera del checkout: V13/V14 simultáneas, selección del identificador esperado tras el vuelo y preparación de primitivas, comparación exacta de todos los atributos originales y evidencia temporal. Ninguna solicitud de subida; sin capturas de los originales.
- Regresión Chromium de navegación, Home, búsqueda, opacidad, respaldo sin token, herramientas, CSV, inspector móvil y referencias declarativas. Las esperas de selección están acotadas y exigen la entidad esperada; no sustituyen selecciones por resultados simulados.

No equivale a validar los 1.255 archivos corporativos completos, sus metodologías o su cobertura. ZIP pendiente; dibujo limitado a 25 MiB / 50.000 entidades por archivo, seis capas y 64 MiB de archivos activos. Ion autenticado sigue pendiente. `file://` devuelve `ERR_BLOCKED_BY_ADMINISTRATOR` en Chromium administrado: la apertura directa debe confirmarse en Chrome/Edge del usuario. Cesium y mapas base necesitan Internet. No se desplegó GitHub Pages ni se modificó `main`.

## Catálogo operativo global de las 18 plazas

Se amplió el mismo importador, sin crear motores por plaza ni publicar los datos. Los dos HTML descargables y el visor web comparten catálogo, validación de expresiones por entidad, controles de subcapas y diagnóstico global privado.

- 63 pruebas unitarias y 12 espaciales aprobadas. Se incluyen correspondencias para las 18 plazas y dos ámbitos, errores/ambigüedades/exclusiones, campos faltantes, geometrías incompatibles, conservación de entradas y separación de disponibilidad, pintura y certificación. El worker continúa tras un fallo de pintura y rechaza metadatos como capas; no lee internos.
- Lote automatizado Chromium sobre el HTML descargable: inventario de 1.255 archivos sintéticos, 36 catálogos, 684 comprobaciones de pintura, 144 archivos internos sin leer, un error JSON previsto y registrado. Activación/liberación desde el catálogo en cada una de las 18 plazas; descarga y comprobación del informe global único. Se mantienen las pruebas de cancelación/reimportación, memoria, inspector, cuota, restauración y borrado.
- Carpeta privada pequeña: las dos capas reales se vinculan y se validan automáticamente; se mantienen activación simultánea, selección de celda y comparación exacta con los atributos originales. No acredita datos reales de las otras 17 plazas.
- Compilación reproducible de los tres artefactos generados por SHA-256. Revisión de privacidad antes del commit. Los informes privados descargados por el usuario no forman parte del repositorio.

El conjunto corporativo completo continúa exclusivamente en la computadora del usuario: su cobertura efectiva se obtendrá al seleccionar esa carpeta, no se presume a partir de la prueba sintética. Las subcapas de referencia no encontradas se informan sin declararlas requisitos obligatorios. No se certifican resultados ni calidad visual de capas que no se han dibujado. Se mantienen los límites y pendientes de ZIP, apertura `file://` en el navegador del usuario e ion autenticado; sin despliegue ni cambios en `main`.
