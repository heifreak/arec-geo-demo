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
