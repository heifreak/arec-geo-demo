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

Para entregar referencias sin publicarlas, sigue [entrada privada](docs/private-intake.md). El único archivo solicitado ahora es `index_v15_metropolitano.html` como adjunto a la conversación. Después el desarrollador preparará un descriptor revisado para cargar la muestra local de Juárez mediante **Muestra privada · solo sesión**. No necesitas escribir JSON. El resumen agrega únicamente campos existentes con reglas documentadas; no extrapola al resto de la plaza.
