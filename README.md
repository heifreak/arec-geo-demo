# AREC GEO 3D

Visor territorial estático con CesiumJS y OpenStreetMap, preparado para GitHub Pages.

## Desarrollo

Requiere Python 3 para servir archivos y Node.js 24 para pruebas. La aplicación no requiere compilación. Playwright es una dependencia de desarrollo para pruebas de navegador.

```sh
npm ci
npm start
npm test
```

El servidor utiliza el puerto 8000. Cesium y las teselas requieren acceso HTTPS a `cesium.com` y `tile.openstreetmap.org`. No se necesitan credenciales. Abrir como archivo local no es compatible con los módulos y la carga del catálogo.

Con Chromium instalado: `npm run test:browser`. `CHROMIUM_PATH` permite indicar su ejecutable. Cuando el navegador no reconoce la CA del proxy pero curl sí, `AREC_TLS_TRANSPORT=curl npm run test:browser` entrega a Chromium los mismos recursos externos descargados con TLS verificado por curl. No desactiva la validación TLS. Las pruebas de navegador usan una capa sintética interceptada, nunca publicada en `data/`.

Relieve y edificios son opcionales: ver [configuración ion](docs/cesium-ion.md). El formulario acepta un token de visualización solo para la sesión. Sin token el mapa funciona sobre el elipsoide.

Las capas AREC GEO aún no están incluidas. Véanse [arquitectura](docs/architecture.md), [criterios de aceptación](docs/acceptance.md) y [validación](docs/validation.md). El catálogo vacío no representa una integración terminada. No subir el ZIP original ni archivos confidenciales al repositorio público.

Para inventariar datos recibidos sin publicarlos: `node tools/inventory.mjs /ruta/privada/datos /tmp/inventario-privado.json`. La salida debe estar fuera del checkout y no existir previamente. Las variables/plazas detectadas son candidatos por nombre, no una clasificación validada. El inventario también puede contener nombres sensibles: mantenerlo privado.

Para entregar referencias sin publicarlas, sigue [entrada privada](docs/private-intake.md). La referencia HTML ya se recibió de forma privada. La especificación rectora también se recibió y contrastó en privado. La muestra V14 de Ciudad Juárez también se recibió exclusivamente para revisión privada; no está en el catálogo público. El desarrollador prepara un descriptor privado revisado para cargar la muestra local de Juárez mediante **Muestra privada · solo sesión**. No necesitas escribir JSON. El resumen agrega únicamente campos existentes con reglas documentadas; no extrapola al resto de la plaza.

El árbol y las plantillas originales se leen opcionalmente desde un paquete **privado de sesión** generado por el desarrollador; no se distribuyen en el repositorio. El selector territorial separa ciudad, municipio y ámbitos metropolitanos; no acredita disponibilidad ni calcula recortes. El panel derecho permite consultar leyendas/métodos y controlar la intensidad de las capas cargadas.

Las [primitivas espaciales offline](processing/README.md) comprueban geometría y conservan atributos; sus pruebas sintéticas no certifican todavía el piloto territorial.

El inspector puede organizar campos mediante un descriptor privado, conservando sus nombres y valores originales. Si el descriptor incluye una huella de entrada, se comprueba antes de aplicar su mapeo. Los conteos del resumen se limitan al archivo cargado; no acreditan cobertura completa.

Para revisar tus archivos desde tu computadora sin rutas internas ni servidor, descarga el HTML nuevo del visor de la rama y sigue la [demostración privada local](docs/private-preview.md). El botón de descarga genera el descriptor en tu navegador a partir de tus archivos locales.

La comparación de capas privadas exige identificadores únicos y geometrías exactas en la misma plaza y ámbito. Muestra valores originales y procedencia temporal declarada; una celda sin registro en una subcapa no se interpreta como valor cero.


## Vista previa del importador de carpeta completa (experimental)

La rama del PR incluye [preview-masiva.html](preview-masiva.html), una vista descargable independiente de la página pública. Guarda el archivo HTML **sin procesar** desde GitHub y ábrelo con Chrome o Edge. Requiere Internet para Cesium y las teselas.

En el panel **Carpeta AREC GEO · Importación masiva privada** selecciona la carpeta raíz `data` mediante el selector de directorios (Chromium / `webkitdirectory`) y el HTML V15 original desde tu computadora. Pulsa **Inventariar carpeta**: solo se revisan metadatos de nombre, ruta y tamaño en un Web Worker, sin leer ni subir las geometrías. Navega a una plaza y ámbito, busca una variable y pulsa **Preparar** para enviar ese archivo al formulario **Demostración privada** de la vista previa; allí verifica la subcapa y su simbología antes de activarlo.

Este es un **primer avance del importador**, no una carga automática de las 62 subcapas ni un procesamiento geoespacial completo. La selección de carpeta evita buscar archivos individuales de nuevo, pero cada capa aún requiere asociarse y validarse contra la referencia V15. No se inventan correspondencias. El inventario limita a 10,000 archivos de entrada y solo considera GeoJSON de hasta 25 MiB por archivo. La lectura de capas individuales utiliza los límites del visor existente.

La copia local en IndexedDB es **opcional** y requiere autorización con casilla. Se guarda por generaciones: el manifiesto activo se sustituye solo después de guardar todos los archivos. Los errores de cuota o una cancelación mantienen la versión anterior, aunque la limpieza de copias incompletas es de mejor esfuerzo. No se restaura automáticamente; puedes solicitar restauración o borrar la copia desde la interfaz. El almacenamiento depende de la cuota y las políticas del navegador.

El inventario excluye las variables corporativas V15–V18 y **no publica archivos de ninguna variable**. El conjunto completo sigue sujeto a revisión de confidencialidad; incluso información que parezca pública puede requerir autorización corporativa. Importar no certifica la vigencia, validez o cobertura de los cálculos originales. Los mapas base y Cesium sí necesitan Internet. La apertura mediante `file://` aún debe validarse en el navegador del usuario; Codex no pudo verificarla por políticas de su entorno.
