## Cambio
Separa el visor estático en módulos manteniendo las 18 plazas, flyToBoundingSphere y Home. Añade búsqueda de plazas, catálogo vacío de capas, carga GeoJSON bajo demanda, control de visibilidad/opacidad e inspector de atributos.

Incluye AGENTS.md, arquitectura, criterios de aceptación, pruebas y CI. El catálogo exige revisión de publicación y rechaza V15–V18. No se incorporan datos originales, simbología V14 inventada ni cálculos analíticos.

## Validación
- 5 pruebas Node aprobadas: catálogo oficial, controles de publicación, carga/descarga, cargas tardías/duplicadas y reintento.
- Sintaxis JavaScript y git diff --check aprobados.
- Prueba real en Chromium intentada, bloqueada por ERR_CERT_AUTHORITY_INVALID al descargar Cesium mediante el proxy. Navegación visual pendiente; las pruebas unitarias no la sustituyen.

## Pendientes
Referencia index_v15_metropolitano.html, documentos rectores V01–V23/V14 y muestra expresamente autorizada para publicación. Mediciones geodésicas, grupos oficiales, estilos categóricos y análisis siguen pendientes. No fusionar ni publicar sin aprobación del propietario.
