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

## Ampliación: recepción privada y preparación del piloto JRZ

Añade un almacén temporal fuera del checkout para adjuntos, carga privada en memoria del navegador con descriptor revisado, simbología categórica por valores originales, encuadre de capa y resúmenes de atributos con referencias, alcance y faltantes. Ningún original ni dato corporativo se incluye en Git. La comprobación de escena exige respuestas de alturas y geometría visible; conectar un servicio no basta. Se documenta la configuración mínima ion y la entrega privada de los cinco archivos, solicitando solo el HTML V15 como siguiente paso.

Validación actual: 23 pruebas unitarias y prueba ampliada Chromium aprobadas. El piloto auténtico sigue bloqueado por archivos originales y muestra autorizada; los datos usados en pruebas son sintéticos. Mantener PR #1 en borrador, sin fusionar ni publicar. No se han reintentado los enlaces bloqueados ni cambiado metadatos de readiness del PR.

## Ampliación: referencias privadas y renderizado declarativo

Permite leer en sesión un paquete de definiciones revisado, consultar el árbol agrupado y aplicar plantillas sin que el usuario escriba descriptores. Añade un intérprete limitado de estilos, contornos sobre terreno, símbolos por geometría, ficha de leyenda/metodología, intensidad y capas activas. El selector separa contextos territoriales sin fallback implícito y conserva las 18 plazas. Los originales, las definiciones extraídas y el análisis detallado no forman parte del cambio público.

33 pruebas unitarias aprobadas; prueba Chromium ampliada y comprobaciones privadas separadas. Continúan pendientes los datos auténticos autorizados, la aceptación de métodos, estilos adicionales y los servicios ion autenticados. Mantener el PR en borrador, sin fusionar ni publicar.
