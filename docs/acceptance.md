# Criterios de aceptación

## Base de navegación
- 18 plazas exactas; DEL ausente; búsqueda por nombre/código sin cambiar el catálogo.
- Inicio y Home en JRZ; cambio de plaza mantiene flyToBoundingSphere, rango 55 km, inclinación −55°, duración 2 s.
- Controles originales, pantalla completa y adaptación móvil conservados.

## Capas y datos
- Solicitar solo capas elegidas de la plaza actual, liberar anteriores y descartar cargas tardías.
- Mostrar estados de carga/error, leyenda aprobada, opacidad e inspección segura de atributos.
- Revisión explícita de publicación por archivo; V15–V18 fuera de la demostración pública.
- Validar geometrías, coordenadas, atributos y volumen real antes de declarar integrada una plaza.
- V01–V23 y subcapas deben coincidir con documentos rectores; V14 requiere comparación con la referencia original.

## Producto completo (pendiente)
- Validar 18 plazas con datos autorizados, cuadrículas métricas 500 × 500 m y clasificación ZCU original.
- Medición de distancias y áreas contrastada con referencias geodésicas conocidas.
- Macropolígonos, multicriterio y Balance de Tierra REC solo completos con reglas documentadas, cálculos implementados y pruebas de resultados.
- Pruebas reales en navegador con WebGL, red y equipo representativo; comprobar rendimiento y errores de datos.
- Reproducción con servidor estático y GitHub Pages sin Colab, sin rutas absolutas y sin secretos.
- Revisión de PR y aprobación antes de fusionar o publicar.

## Validación disponible
`npm test` ejecuta pruebas de catálogo y ciclo de carga sin red. No sustituye pruebas visuales de Cesium. Prueba manual: iniciar `npm start`, abrir el servidor local, comprobar inicio, 18 plazas, búsqueda, Home y controles. Con un catálogo autorizado, comprobar carga, opacidad, leyendas, atributos y cambio rápido de plaza durante una carga.

## Alcance entregado en la segunda fase

Controles de escena y respaldo, dibujos, medición esférica aproximada, inspector de coincidencias, inventario de catálogo con exportación CSV/impresión y herramientas de inventario privado. Las pruebas de navegador usan un fixture sintético separado de la publicación. Consultar docs/validation.md para evidencia; la aceptación de terreno/edificios requiere una sesión ion real y la de inteligencia territorial requiere archivos originales autorizados.
