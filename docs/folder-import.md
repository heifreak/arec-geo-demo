# Importación local de carpeta completa

Abre la versión de esta rama del visor y usa **Carpeta AREC GEO · importación masiva privada**. Selecciona una vez la carpeta `data` extraída. No elijas cientos de archivos por separado. La selección autoriza su lectura local; el importador no envía originales a servidores, mapas ni GitHub.

El código funciona desde un origen web normal: el servidor entrega solo el visor, mientras File API entrega los archivos elegidos al navegador. No hay que copiar los datos al directorio público del servidor. Esta rama incluye además `preview.html` y su alias idéntico `preview-masiva.html`, que se descarga con **Download raw file** desde GitHub. No se ha desplegado la rama en GitHub Pages. La apertura `file://` sigue sin poder probarse en el Chromium administrado de Codex; las pruebas usan HTTP interno. Se recomienda un origen HTTPS para las APIs del navegador.

## Flujo

1. Elige `data` y espera el inventario progresivo. Puedes cancelar; un inventario parcial queda identificado como tal.
2. El importador busca una referencia HTML compatible dentro de la selección y la analiza como texto/AST, sin ejecutarla. **Si la carpeta solo contiene GeoJSON/JSON y carece de las definiciones privadas, elige el V15 una sola vez en Referencia local**. No se pide cada GeoJSON. No se han incrustado las definiciones privadas en el código público para evitar este paso.
3. Selecciona plaza y ámbito. Busca por variable o nombre y abre una fila para ver campos, tipos, nulos, faltantes, geometrías, tamaño, motivo de exclusión y correspondencia con la referencia. El inventario completo es paginado, no una lista truncada.
4. Pulsa **Activar capa** en las filas deseadas. La lectura y representación son bajo demanda. Las capas se pueden mostrar simultáneamente, encuadrar y consultar en el inspector existente. Los cruces por celda conservan la comprobación de ID, geometría y contexto.
5. **Descargar capa de memoria** o desmarcar una capa masiva libera su fuente y atributos. Cambiar de plaza/ámbito libera las capas masivas y conserva el inventario y las referencias a archivos, para no volver a elegir `data`.
6. **Retirar carpeta y capas** libera el inventario y las referencias de sesión. No borra una copia local guardada voluntariamente.

## Disponibilidad y análisis

Se reconocen únicamente las 18 plazas oficiales y los ámbitos `evidence` y `evidence_metro`, sin sustituir un ámbito por otro ni agregar DEL. Se reconocen V01–V23 mediante las rutas. Los archivos internos V15–V18 identificados por su directorio se contabilizan, pero su contenido no se lee, dibuja ni copia a IndexedDB. Los archivos desconocidos o con mapeo ambiguo se muestran sin activación automática.

La vinculación respeta nombres originales de archivo y aliases de la referencia, no presupone que el identificador lógico coincide con el nombre físico. Las capas base sin directorio de variable solo se vinculan si la referencia establece una correspondencia única. La geometría debe ser una FeatureCollection compatible y estar en WGS84. El inventario comprueba estructura/coordenadas, no validez topológica ni metodología territorial.

Los campos se inventarían sin reinterpretar unidades, redondear deliberadamente, reparar geometrías ni ejecutar atributos HTML/simplestyle. Se detiene ante claves JSON duplicadas, claves especiales incompatibles, UTF8 inválido o números fuera del rango interoperable seguro. El estatus muestra conteos de clases originales cuando su campo está documentado por el estilo. No suma poblaciones repetidas, densidades o superficies superpuestas, ni convierte ausencia en cero. Los conteos son por archivo y ámbito; no prueban cobertura completa ni certifican ZCU, oportunidad o macropolígonos.

El histograma de cada campo está limitado a 32 valores escalares distintos y etiquetas de 200 caracteres; por encima queda sin histograma, conservando nombres, tipos y conteos de presencia. No se fabrican categorías agrupadas. El visor conserva la evidencia temporal textual GHSL disponible; estimaciones/proyecciones no se presentan como crecimiento observado.

## Memoria, errores y cancelación

El inventario usa un worker y JSON por bloques, con un archivo a la vez. Devuelve estadísticas, no todas las geometrías al hilo de interfaz. Se conserva como máximo una entidad en construcción por archivo, además de estadísticas y estructura del parser. Los archivos se mantienen como referencias File hasta activarlos.

- Inventario: hasta 128 MiB por archivo. Los mayores quedan reportados con tamaño y motivo, sin campos inventados.
- Representación: hasta 25 MiB y 50 000 entidades por archivo; máximo 6 capas y 64 MiB de archivos activos o en carga. Estos límites no son una medición exacta de RAM/GPU; Cesium y las estructuras decodificadas consumen memoria adicional.
- Cancelar termina el worker de lectura. Una conversión Cesium ya iniciada puede terminar después: se descarta su resultado para evitar reactivar una capa cancelada. Los archivos grandes que exceden los límites requieren una futura estrategia de partición/teselas, no se declaran integrados.
- El progreso de bytes contabiliza tamaños de archivos, incluidos los excluidos que no se leen. Los errores por archivo no detienen todo el inventario. No hay procesamiento ZIP en esta fase: se utiliza la carpeta extraída.

## Copia local opcional

Sin consentimiento solo hay memoria de sesión. Con **Autorizo guardar esta copia privada en este navegador**, **Guardar copia local** conserva en IndexedDB el inventario, las definiciones compiladas y los archivos geográficos compatibles reconocidos. No guarda el token ion, no copia los internos identificados ni archivos no reconocidos, ni solicita almacenamiento en nube.

Se estima la cuota disponible y se escribe por archivo. Una cancelación o fallo antes de completar la nueva copia conserva la copia anterior. La copia queda ligada al navegador/origen y puede ser eliminada por políticas de almacenamiento, modo privado, limpieza o falta de cuota. No se garantiza durabilidad ni cifrado; no es una bóveda para un dispositivo compartido. Un inventario parcial conserva esa condición al restaurarse.

Tras recargar, **Restaurar copia local** recupera el catálogo sin volver a seleccionar cientos de archivos y sin dibujar capas automáticamente. **Borrar copia local guardada** elimina los registros de este origen; no promete borrado forense de soportes ni de exportaciones descargadas.

## Validación reproducible

`npm test` cubre rutas, streaming UTF8/BOM, esquema, cancelación, límites, claves especiales, identificadores y liberación de fuentes pendientes. `npm run build:preview` genera tanto `src/viewer.bundle.js` para el origen web normal como `preview.html` / `preview-masiva.html` autónomos y su worker. CI comprueba que los tres archivos generados coincidan con las fuentes.

La prueba de navegador usa `FOLDER_ONLY=1`, `FOLDER_TEST_PATH` para una carpeta sintética de 1.255 archivos y `FOLDER_ACTUAL_PATH` / `FOLDER_ACTUAL_PLAN_PATH` para una carpeta privada pequeña autorizada. `FOLDER_ENTRY=/preview-masiva.html` repite la comprobación sobre el HTML descargable servido sin modificaciones. No incorpora esas carpetas al checkout ni captura pantallas de los datos privados. La validación de una carpeta sintética y dos capas reales no equivale a haber probado el corpus corporativo completo de 1.255 originales.

## Catálogo y diagnóstico global multiplaza

Tras inventariar la carpeta y leer la referencia local una sola vez, el mismo motor vincula automáticamente todos los archivos de las 18 plazas. **Catálogo operativo** muestra las variables y subcapas del ámbito actual con casillas de activación, sin configurar un descriptor ni buscar cada archivo. Cambiar de plaza actualiza el catálogo y limpia filtros de la plaza anterior; conserva carpeta y referencia. Se mantienen los límites de memoria y la carga bajo demanda.

Un segundo recorrido automático en worker evalúa las expresiones originales de pintura contra **cada entidad** de los archivos compatibles vinculados. No retiene todas sus geometrías ni altera atributos. Un fallo se registra por archivo y no detiene los demás. Solo quedan activables los archivos que pasan esa comprobación; los no vinculados, ambiguos, incompatibles o pendientes permanecen en el diagnóstico. Se puede cancelar y usar **Repetir validación por lotes** sin volver a elegir `data`. Restaurar una copia vuelve a comprobar sus archivos, sin activar capas automáticamente. La referencia elegida antes de la carpeta también se conserva.

**Diagnóstico global · 18 plazas** contiene 36 resúmenes (ciudad y metrópoli por plaza), incluso para contextos sin archivos. Incluye archivos, tamaños, entidades por archivo, tipos de geometría, variables inventariadas, subcapas vinculadas/activables, errores de lectura y pintura, ambigüedades, campos de estilo ausentes/nulos y subcapas de referencia no encontradas. Estas últimas no se declaran obligatorias: no existe una matriz documental de cobertura exigible para todas las plazas. Las ausencias no se convierten en cero territorial. Los archivos sin plaza/ámbito también quedan en el informe global.

**Descargar informe técnico privado** genera un único JSON local con los 36 resúmenes y el detalle de todos los archivos, incluidos problemas y esquema de campos. No contiene geometrías ni valores de atributos, pero sus nombres y rutas pueden ser confidenciales: no publicarlo sin autorización. No se transmite a servidores. La copia descargada no se borra al retirar la carpeta del visor.

El informe distingue: disponibilidad, evaluación técnica de expresiones, carga de la capa en Cesium y certificación territorial. `rendered` acredita carga y aplicación de pintura en Cesium, no revisión visual humana ni certificación metodológica. Las capas que no se activaron permanecen sin comprobación de representación. Los conteos de entidades se suman por archivo; no son celdas únicas de una plaza.

La prueba automatizada recorre las 18 plazas, comprueba los 36 catálogos sintéticos y activa/libera capas desde sus casillas. Descarga y verifica el informe único de los 1.255 archivos, además de mantener las comprobaciones privadas V13/V14. No sustituye la ejecución del diagnóstico sobre el corpus corporativo completo del usuario.
