# AREC GEO 3D

Visor territorial estático con CesiumJS y OpenStreetMap, preparado para GitHub Pages.

## Desarrollo

Requiere Python 3 para servir archivos y Node.js 20+ para pruebas; no hay paquetes externos que instalar.

```sh
npm start
npm test
```

El servidor utiliza el puerto 8000. Cesium y las teselas requieren acceso HTTPS a `cesium.com` y `tile.openstreetmap.org`. No se necesitan credenciales. Abrir como archivo local no es compatible con los módulos y la carga del catálogo.

Las capas AREC GEO aún no están incluidas. Véanse [arquitectura](docs/architecture.md) y [criterios de aceptación](docs/acceptance.md). El catálogo vacío no representa una integración terminada. No subir el ZIP original ni archivos confidenciales al repositorio público.
