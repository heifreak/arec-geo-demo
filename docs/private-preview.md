# Demostración local, sin publicar datos

El archivo `preview.html` es un visor nuevo generado a partir del código de esta rama. No contiene los originales, las paletas corporativas ni GeoJSON privados. No requiere instalar Node, Python ni un servidor para usarlo.

1. En GitHub abre `preview.html` **en la rama del PR**, pulsa **Download raw file / Descargar archivo sin procesar** y guarda el archivo con extensión `.html`. No uses Guardar página del navegador sobre la página de código de GitHub.
2. Abre el archivo descargado con Chrome o Edge. Requiere Internet para cargar Cesium y el mapa; no es una demostración offline.
3. La selección inicial es Ciudad Juárez, ámbito metropolitano de análisis y V14. En **Demostración privada**, elige tu referencia HTML original y el GeoJSON local, autoriza la revisión y pulsa **Preparar capa privada**.
4. Activa la capa en **Capas territoriales**. Usa **Encuadrar capa**, navega y selecciona una celda. **Leyenda y metodología** muestra los textos recuperados; el inspector conserva atributos y el resumen cuenta clases del archivo.
5. **Descargar mi descriptor privado** guarda el descriptor en tu computadora. Contiene metadatos privados recuperados de tu referencia: consérvalo fuera de Git y del sitio público. No es necesario escribir ni copiar JSON.
6. **Retirar capa y descriptor de sesión** limpia capa, inspector y descriptor generado desde el mismo panel. Al cerrar o recargar el archivo se pierde la sesión; el archivo descargado del descriptor permanece en tu computadora.

El extractor usa Acorn para leer la sintaxis de los scripts como datos, sin ejecutarlos, abrir enlaces originales ni cargar el HTML en un iframe. Solo admite reglas categóricas y leyendas literales con correspondencia inequívoca para las clases de las celdas. Si encuentra ambigüedad, se detiene y requiere revisión. Solo reconstruye un constructor uniforme cuando sus colores proceden de una tabla literal mediante una función de consulta sin otras instrucciones; el resto del código dinámico se rechaza. No recalcula ZCU ni certifica los cálculos originales. Los nulos no se convierten en cero; no se agregan poblaciones o densidades automáticamente.

La referencia y el GeoJSON se leen mediante File API y se mantienen en memoria. Los servicios cartográficos reciben sus solicitudes normales de mapa, no los archivos elegidos. Exportar un descriptor, CSV o PDF es una descarga local solicitada expresamente, y puede contener información privada. El token ion sigue siendo opcional y de sesión; nunca se integra en el HTML descargado ni se pide por chat. Sin token se conserva el globo de respaldo, sin afirmar relieve o edificios reales validados.

## Desarrollo

```sh
npm ci
npm test
npm run build:preview
```

`tools/build-private-preview.mjs` empaqueta el visor y el parser, e inserta el CSS y el aviso MIT de Acorn. CI comprueba que el HTML generado coincide con las fuentes. El HTML se entrega como código en la rama revisable; no se despliega ni se cambia GitHub Pages.

La prueba opcional del navegador admite `PRIVATE_HTML_PATH`, `PRIVATE_SAMPLE_PATH` y `PRIVATE_DESCRIPTOR_PATH` para comprobar el HTML autónomo servido localmente, generación y descarga del descriptor, pintura y leyenda de referencia, selección real y limpieza. Esos archivos de entrada permanecen fuera del checkout y no se capturan en pantallas.

Limitación de esta validación: el Chromium administrado del entorno bloquea `file://` con `ERR_BLOCKED_BY_ADMINISTRATOR`. Se prueba el mismo HTML mediante HTTP interno; no se ha comprobado su apertura por doble clic en una computadora del usuario. Si una política de tu navegador también bloquea archivos locales, esa restricción debe resolverse antes de declarar accesible la demostración. No se ofrece una URL localhost como enlace para el usuario.

## Comparar dos capas por celda

Carga la primera capa con su referencia y conserva su casilla activada. Para agregar otra, elige su variable y el HTML de referencia; selecciona la subcapa por su nombre en el desplegable y luego el GeoJSON correspondiente. Las opciones proceden del catálogo leído como datos, no se incorporan al archivo público del visor. Para la regla categórica de consolidación conserva la opción de detección por campos.

Con ambas capas visibles, selecciona una celda y consulta **Comparación de capas visibles por celda**. El cruce requiere ID original único del mismo tipo, geometría poligonal exactamente igual, plaza y ámbito iguales. No se asigna por centroide, cercanía, nombre municipal ni orden de filas. Una celda sin registro en una subcapa se marca expresamente, sin convertir su ausencia en cero. Geometrías equivalentes con otro orden de coordenadas se rechazan de forma conservadora; requieren revisión, no normalización automática.

La evidencia temporal textual declarada en los atributos se muestra junto a cada capa. Cuando una época es una estimación o proyección, su diferencia temporal no se presenta como cambio observado. Los valores históricos, las unidades y la procedencia requieren sus fuentes y ETL para certificarse. El visor conserva valores y flags precalculados, sin aplicar nuevos umbrales ni sumar poblaciones o densidades.
