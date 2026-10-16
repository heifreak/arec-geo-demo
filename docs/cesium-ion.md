# Terreno y edificios: conexión opcional

## Implementación

Se utiliza CesiumJS 1.146 y sus API oficiales `createWorldTerrainAsync` y `createOsmBuildingsAsync`. El mapa inicial conserva OpenStreetMap y `EllipsoidTerrainProvider`, con el token de demostración del SDK deshabilitado. El usuario activa los servicios independientemente. Fallos iniciales o eventos de error retornan al elipsoide o retiran edificios, respectivamente; no eliminan el mapa base. Cambiar el token invalida las cargas anteriores. Ningún estado de carga equivale a validación de cobertura real.

Edificios: error máximo de pantalla de 24, caché objetivo de 128 MiB y desbordamiento máximo de 64 MiB; sin cálculo de contornos. Son valores de presentación/rendimiento iniciales, no parámetros territoriales ni un límite total de memoria del navegador. Se mantiene la atribución de Cesium y sus proveedores. La geometría y alturas reales dependen de la cobertura OSM y no pueden prometerse para todas las plazas. No se generan edificios sintéticos para llenar vacíos.

GeoJSON y dibujos se ajustan al terreno mediante las opciones de Cesium; las pruebas con capas AREC reales y distintas elevaciones están pendientes. La resolución de renderizado se limita en pantallas de alta densidad; el modo de render bajo demanda reduce actividad cuando la escena no cambia.

## Requisito exacto pendiente

1. Una cuenta Cesium ion con derecho a usar Cesium World Terrain (activo 1) y Cesium OSM Buildings (activo 96188), y un plan compatible con el uso corporativo previsto. El propietario debe revisar condiciones, cuotas y licencias antes de habilitar el servicio público; no se ha contratado ni aceptado un plan en su nombre.
2. Crear un token por aplicación con **solo `assets:read`**, limitado a esos dos activos y a las URL de la aplicación. No usar el token predeterminado de cuenta ni permisos privados de escritura/administración. Aplicar restricciones para `https://heifreak.github.io/arec-geo-demo/`; para desarrollo, usar otro token restringido al origen local que corresponda. Comprobar las restricciones exactas que acepte el panel ion.
3. Introducir el token de visualización en “Conectar Cesium ion” dentro del visor y activar cada servicio. No compartir el token en el chat. Se conserva únicamente en memoria, sin localStorage ni archivos. El campo se vacía al aplicarlo. Recargar elimina la configuración; un token de cliente sigue siendo visible para el navegador, por lo que sus restricciones son esenciales.
4. Permitir HTTPS a `api.cesium.com` y a los destinos de streaming devueltos por los endpoints de los activos. No se ha observado una sesión autenticada, por lo que no se afirma una lista exhaustiva de hosts de streaming ni conectividad real. `cesium.com` y `tile.openstreetmap.org` son las dependencias del mapa actual.

No existe un mecanismo de autenticación corporativa en GitHub Pages. Un futuro backend autorizado deberá servir datos privados con control de acceso; ni el catálogo ni una URL difícil de adivinar protegen archivos públicos. No colocar V15–V18 ni datos internos en el árbol servido.

## Fuentes oficiales consultadas

- [Token scopes, activos y restricciones URL](https://cesium.com/learn/ion/cesium-ion-access-tokens/)
- [API de creación de proveedores](https://cesium.com/learn/cesiumjs/ref-doc/global.html)
- [Rendimiento de 3D Tiles](https://cesium.com/learn/cesiumjs/ref-doc/Cesium3DTileset.html)
- [World Terrain, código 1.146](https://github.com/CesiumGS/cesium/blob/1.146/packages/engine/Source/Core/createWorldTerrainAsync.js)
- [OSM Buildings, código 1.146](https://github.com/CesiumGS/cesium/blob/1.146/packages/engine/Source/Scene/createOsmBuildingsAsync.js)
