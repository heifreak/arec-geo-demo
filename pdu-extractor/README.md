# Extractor PDU

Aplicación existente, sin compilación ni backend. Desde la raíz del repositorio:

```sh
python -m http.server 8000 --bind 127.0.0.1
```

Abrir la ruta `/pdu-extractor/` en el navegador. PDF.js y su worker usan la versión 3.11.174 en `cdn.jsdelivr.net`; JSZip está integrado. No se requieren claves ni subir documentos a un servidor.

1. Elegir o confirmar la plaza y cargar el PDF. Los títulos generan candidatos; las páginas con imágenes y poco texto también se proponen para revisión, sin OCR. Se pueden agregar páginas manualmente.
2. Revisar el recorte. Activar transparencia de blancos y ajustar su umbral. Para excluir leyendas, sellos o rótulos, usar **Delimitar territorio**, marcar un contorno simple sin cruces y cerrarlo. La máscara conserva todo su interior, incluidas zonas separadas; no interpreta límites legales. El blanco interior también se elimina: desactivar la limpieza si representa una clase territorial relevante.
3. Revisar **Ver imagen limpia** y descargar el KMZ preliminar. La plaza determina un encuadre aproximado, sin inferir escala, proyección ni coordenadas reales. La selección actual de plaza se conserva al cambiar de mapa. Recorte, máscara, umbral, título, notas y controles se conservan por candidato durante la sesión, también en exportación por lote. No persisten tras recargar la página.
4. Para calibrar, marcar tres puntos no alineados y bien separados e introducir longitud/latitud WGS84. El ajuste afín exporta un `gx:LatLonQuad` en orden inferior izquierda, inferior derecha, superior derecha, superior izquierda. Permite rotación, escala y sesgo, pero no reproyección ni corrección de deformaciones. Tres controles no permiten estimar un error independiente: revisar otros puntos en Google Earth. El KMZ se identifica como pendiente de validación.

Cada KMZ contiene `doc.kml` y `files/plano.png` con transparencia. La exportación por lote produce KMZ de **preubicación**, aunque un candidato tenga controles. Para exportar el ajuste de un candidato, usar su botón de calibración. La digitalización por colores sigue siendo opcional y aproximada; usa los límites rectangulares introducidos, no el ajuste por puntos.

## Pruebas

```sh
python -m unittest discover -s pdu-extractor/tests -v
```

Requiere Python con `playwright`, `Pillow`, `reportlab`, `curl` y Chromium en `/usr/bin/chromium`. Las pruebas sirven el extractor en un puerto temporal y generan PDFs sintéticos. Descargan los artefactos fijados de PDF.js mediante curl con TLS verificado y los entregan al navegador de pruebas, pues Chromium en este entorno no reconoce la CA del proxy. No desactivan la verificación TLS.

Comprueban carga y detección de PDF, candidatos escaneados, limpieza de blancos y periferia, conservación de colores claros, ajustes por candidato, plaza, exportación por lote, estructura/PNG del KMZ y calibración con rechazo de puntos degenerados. La compatibilidad se comprueba sobre la estructura KML; Google Earth de escritorio no se ejecuta en estas pruebas. Para evaluar exactitud territorial se necesita un PDF real con referencias verificadas.
