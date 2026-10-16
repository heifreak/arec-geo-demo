## Problema y resultado
El prototipo tenía un visor monolítico y no disponía de infraestructura para gestionar capas ni servicios 3D opcionales. Esta rama conserva las 18 plazas oficiales (sin DEL), flyToBoundingSphere y Home, separa el código y añade controles de escena, carga GeoJSON bajo demanda, dibujo, mediciones aproximadas, inspector de atributos y estatus exportable.

## Implementación
- AGENTS.md, arquitectura, criterios de aceptación y documentación de requisitos ion.
- Cesium World Terrain y OSM Buildings opcionales mediante token de visualización solo de sesión. Respaldo ante fallos iniciales o de streaming y descarte de respuestas tardías. La operación real autenticada sigue pendiente.
- Barra superior, paneles adaptables, búsqueda de plazas, navegación a coordenadas e inspección de elementos coincidentes/3D Tiles.
- Catálogo público vacío con aprobación editorial obligatoria y exclusión de V15–V18. No se suben archivos originales ni se infieren nombres, colores V14 o análisis.
- Dibujo de puntos/líneas/polígonos y mediciones esféricas expresamente aproximadas.
- Resumen limitado a inventario verificable del catálogo, CSV e impresión para guardado PDF; ningún diagnóstico ni porcentaje inventado.
- Inventario local de datos, fuera del checkout público, sin exportar valores de atributos ni publicar capas automáticamente.

## Validación
14 pruebas Node aprobadas. Prueba Chromium real aprobada para navegación, capa sintética bajo demanda, atributos, opacidad, respaldo sin token, dibujo/medición, CSV y móvil. Recursos externos reales descargados por curl con TLS verificado para resolver la confianza del proxy. Sintaxis y diff sin errores. Véase docs/validation.md para límites y resultados no ejecutados.

## Pendientes y límites
Referencias V15/documentos rectores bloqueados por HTTP 403; no se dispone de archivos originales ni datos públicos autorizados. Terreno y edificios requieren cuenta/plan y token ion restringido, además de validación real. No se han implementado diagnósticos reales, agrupaciones originales, ZCU, mallas AREC, motor multicriterio, T1/T2/T3 ni Balance de Tierra REC.

No fusionar main ni publicar sin aprobación del propietario.
