# Verificación de esta fase

- `npm test`: 5 pruebas ejecutadas y aprobadas, 0 fallos y 0 omitidas.
- `node --check src/app.js` y `node --check src/layers.js`: aprobados.
- `git diff --check`: aprobado.
- La prueba de navegador real no pudo validar el visor: Chromium rechaza el certificado del proxy al descargar Cesium (`net::ERR_CERT_AUTHORITY_INVALID`), con `Cesium is not defined` como consecuencia. No se deshabilitó la verificación TLS. Curl sí puede descargar Cesium utilizando el almacén de confianza del sistema.
- No se probaron capas reales, simbología V14 ni cálculos analíticos: no están disponibles o implementados.
- La API de GitHub devuelve Forbidden en este entorno; Git por HTTPS sí permite subir la rama. El cuerpo del PR queda preparado en `docs/pull-request.md`.

Antes de aprobar esta fase: ejecutar las comprobaciones manuales de docs/acceptance.md en un navegador con WebGL y confianza válida en la red. El producto completo no está terminado.
