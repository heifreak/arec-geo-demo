# Terreno y edificios: conexión opcional

## Implementación

Se utiliza CesiumJS 1.146 y sus API oficiales `createWorldTerrainAsync` y `createOsmBuildingsAsync`. El mapa inicial conserva OpenStreetMap y `EllipsoidTerrainProvider`, con el token de demostración del SDK deshabilitado. El usuario activa los servicios independientemente. Fallos iniciales o eventos de error retornan al elipsoide o retiran edificios, respectivamente; no eliminan el mapa base. Cambiar el token invalida las cargas anteriores. Ningún estado de carga equivale a validación de cobertura real.

Edificios: error máximo de pantalla de 24, caché objetivo de 128 MiB y desbordamiento máximo de 64 MiB; sin cálculo de contornos. Son valores de presentación/rendimiento iniciales, no parámetros territoriales ni un límite total de memoria del navegador. Se mantiene la atribución de Cesium y sus proveedores. La geometría y alturas reales dependen de la cobertura OSM y no pueden prometerse para todas las plazas. No se generan edificios sintéticos para llenar vacíos.

GeoJSON y dibujos se ajustan al terreno mediante las opciones de Cesium; las pruebas con capas AREC reales y distintas elevaciones están pendientes. La resolución de renderizado se limita en pantallas de alta densidad; el modo de render bajo demanda reduce actividad cuando la escena no cambia.

## Requisito exacto pendiente

1. Una cuenta Cesium ion con derecho a usar Cesium World Terrain (activo 1) y Cesium OSM Buildings (activo 96188), y un plan compatible con el uso corporativo previsto. El propietario debe revisar condiciones, cuotas y licencias antes de habilitar el servicio público; no se ha contratado ni aceptado un plan en su nombre.
2. Crear un token por aplicación con **solo `assets:read`**, limitado a esos dos activos y a las URL de la aplicación. No usar el token predeterminado de cuenta ni permisos privados de escritura/administración. Para una futura publicación autorizada, restringir al origen `https://heifreak.github.io`; para desarrollo, usar otro token restringido al origen local que corresponda. La política de referencia de la aplicación es `strict-origin-when-cross-origin`: envía el origen a otros dominios, no la ruta `/arec-geo-demo/`. Por ello no se debe prometer una restricción por subruta sin revisar antes el Referer real. La restricción al origen abarca otras rutas del mismo sitio. Comprobar las restricciones exactas que acepte el panel ion.
3. Introducir el token de visualización en “Conectar Cesium ion” dentro del visor y activar cada servicio. No compartir el token en el chat. Se conserva únicamente en memoria, sin localStorage ni archivos. El campo se vacía al aplicarlo. Recargar elimina la configuración; un token de cliente sigue siendo visible para el navegador, por lo que sus restricciones son esenciales.
4. Permitir HTTPS a `api.cesium.com` y a los destinos de streaming devueltos por los endpoints de los activos. No se ha observado una sesión autenticada, por lo que no se afirma una lista exhaustiva de hosts de streaming ni conectividad real. `cesium.com` y `tile.openstreetmap.org` son las dependencias del mapa actual.

No existe un mecanismo de autenticación corporativa en GitHub Pages. Un futuro backend autorizado deberá servir datos privados con control de acceso; ni el catálogo ni una URL difícil de adivinar protegen archivos públicos. No colocar V15–V18 ni datos internos en el árbol servido.

## Fuentes oficiales consultadas

- [Token scopes, activos y restricciones URL](https://cesium.com/learn/ion/cesium-ion-access-tokens/)
- [API de creación de proveedores](https://cesium.com/learn/cesiumjs/ref-doc/global.html)
- [Rendimiento de 3D Tiles](https://cesium.com/learn/cesiumjs/ref-doc/Cesium3DTileset.html)
- [World Terrain, código 1.146](https://github.com/CesiumGS/cesium/blob/1.146/packages/engine/Source/Core/createWorldTerrainAsync.js)
- [OSM Buildings, código 1.146](https://github.com/CesiumGS/cesium/blob/1.146/packages/engine/Source/Scene/createOsmBuildingsAsync.js)

## Demostración de desarrollo: procedimiento visual reproducible

Sin publicar GitHub Pages ni fusionar el PR, utiliza la rama de desarrollo en tu computadora con Node 24, Python 3 y un navegador compatible con WebGL: `npm ci`, después `npm start`. Abre el servidor local que inicia el comando. No necesita Colab. La cuenta ion debe tener derecho a los activos 1 y 96188 y un plan que permita este uso empresarial; no se asume que una licencia gratuita personal cubra una demostración corporativa. Revisa esto en la cuenta antes de habilitar streaming.

1. Crea un token específico de desarrollo con **solo assets:read**, limitado a activos 1 y 96188. Configura una restricción URL para el origen local usado en la prueba (puerto 8000); verifica el formato que admite el panel ion y que el Referer del navegador no se suprima. No uses un token privado o de administración. Para una futura publicación autorizada habrá otro token restringido al dominio de Pages. Nunca compartir el valor por mensajes.
2. En el visor de la rama, selecciona JRZ y confirma que Home devuelve Juárez. Abre “Conectar Cesium ion”, introduce el token en el formulario de contraseña y aplícalo. Se borra el campo; no se guarda en el disco ni en el repositorio.
3. Activa **solo terreno**. Acércate a una zona con contraste topográfico, inclina la vista y pulsa **Comprobar vista 3D actual**. El control pide tres alturas al proveedor activo en puntos de la vista. Una lista completa de alturas confirma respuestas, no precisión topográfica; alturas idénticas o cero no prueban contraste del relieve. Si está activo el elipsoide, el resultado dice explícitamente “relieve real no validado”. Conserva una captura solo si está autorizada y sin el campo de token visible.
4. Activa **solo edificios** y acércate a escala de barrio hasta ver geometrías. La comprobación requiere teselas con entidades en el último fotograma: que se conecte el proveedor o que termine una promesa no basta. Los recuentos de entidades reportadas por tesela no son un inventario de edificios únicos. Selecciona un edificio para revisar sus propiedades en el inspector. Si no hay evidencia, revisar cobertura, escala de cámara y red; no generar geometrías de relleno.
5. Activa ambos. Comprueba que siguen funcionando cámara, Home, una capa de sesión autorizada y la selección de su celda. La malla debe seguir el terreno; revisar desplazamientos con los datos reales antes de aceptar la integración.
6. Apaga por separado terreno, edificios y mapa base. Comprueba que cada control mantiene los demás. Retira el token enviando el formulario vacío: regresará al respaldo. Un token revocado o un bloqueo de red deben mostrar mensajes de error sin revelar su valor. No alterar activos reales ni provocar gastos adicionales para simular fallos.

Registra para la revisión: navegador/equipo, plaza y escala de vista, evidencia de alturas, geometrías visibles, créditos del proveedor, resultado de selección y errores. No guardar tokens, capturas de red con credenciales ni informes privados en el PR público. En esta ejecución aún no hay token y **no** se ha validado streaming autenticado. Las pruebas automáticas con dobles son una comprobación de la lógica de diagnóstico, no evidencia de relieve/edificios reales.
