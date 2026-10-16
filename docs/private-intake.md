# Entrega privada de referencias y muestras

## Única acción solicitada ahora

El HTML de referencia ya se recibió y analizó como texto/AST en el entorno privado, sin ejecutarlo. El siguiente documento necesario es la **Especificación Técnica Rectora del 14 de octubre**. En tu computadora, expórtala desde Google Docs con Archivo → Descargar → PDF o DOCX y usa **Adjuntar archivos / +** en esta conversación. Envíala como archivo individual. El adjunto se entrega a la conversación de Codex, no a GitHub; se aplican las políticas de acceso y conservación de tu cuenta/organización. No se promete cifrado de extremo a extremo ni una retención distinta de la plataforma.

No cambies permisos de Drive ni hagas públicos sus enlaces. No vuelvas a compartir el ZIP completo. No adjuntes credenciales o tokens. El mecanismo de descarga de esta sesión admite hasta 32 MiB por archivo; preferimos menos de 25 MiB.

Para cada nueva entrega, el desarrollador descargará el adjunto mediante el mecanismo de archivos de Codex y ejecutará `node tools/private-intake.mjs import RUTA_DEL_ADJUNTO`. El usuario no necesita ejecutar comandos ni mover archivos al repositorio. El original se copiará a `/tmp/arec-geo-private` con nombre aleatorio, permisos 0600, directorio 0700 y recibo privado con SHA-256 y estado **no autorizado para publicación**. Se leerá como texto; no se ejecutará el HTML original ni se seguirá automáticamente ninguna URL de su contenido.

Esta carpeta no está en `/workspace/arec-geo-demo` ni bajo el servidor `npm start`; no tiene endpoint de subida ni enlace público. Las copias de adjuntos que crea Codex están fuera del checkout. Permisos Unix y separación de rutas no equivalen a un servicio corporativo de almacenamiento ni protegen frente a administradores del entorno. `/tmp` puede perderse al reiniciar; tampoco debe asumirse su exclusión de snapshots. Antes de cualquier publicación del entorno se revisarán y retirarán las copias privadas de trabajo. No se ha publicado ningún entorno como parte de este desarrollo.

## Siguientes entregas, una por vez

1. **HTML V15**: recibido y analizado como referencia privada. Se extrajeron nombres, claves, leyendas, estilos y metodologías para revisión. Sus secretos, URL internas y contenido corporativo no se copiarán a la documentación pública.
2. **Especificación Técnica Rectora del 14 de octubre**: en tu computadora, Google Docs → Archivo → Descargar → PDF o DOCX; adjuntar el archivo individual a la conversación.
3. **Auditoría de Funciones AREC GEO**: mismo procedimiento PDF/DOCX. No hace falta modificar permisos del documento.
4. **Grabación del 8 de octubre**: MP4 o WebM original si es menor de 32 MiB. Si es mayor, exporta desde tu editor un clip menor de 25 MiB con el árbol de capas, la selección de una celda y su inspector. Podemos recibir varios clips sucesivos. No es necesario subirlo a un alojamiento público.
5. **Muestra de Ciudad Juárez**: solo después de revisar autorización y campos. Adjuntar un GeoJSON individual, preferentemente de pocas celdas con atributos originales, más la fecha/fuente y el alcance de la autorización: “solo revisión privada” o “aprobada para demostración pública”. La primera no autoriza commits. Excluir V15–V18 y campos corporativos no autorizados. El nombre del visor V15 no significa que se autorice la variable interna V15.

No se pide entregar los cinco archivos juntos. El HTML V15 ya se recibió; el siguiente archivo necesario es únicamente la Especificación Técnica Rectora del 14 de octubre.

## Vista previa de una muestra sin publicarla

El visor ofrece **Muestra privada · solo sesión**, con dos selectores de archivo: GeoJSON y descriptor revisado. El desarrollador preparará ese descriptor después de leer la referencia y la muestra; el usuario no tendrá que escribir JSON ni adivinar nombres/colores.

Los selectores usan la File API del navegador. No envían los archivos al servidor ni al catálogo público. La muestra se valida como GeoJSON WGS84, se limita a 25 MiB y 50 000 entidades, y solo aparece en la plaza indicada en el descriptor. Debe autorizarse explícitamente la revisión de sesión. Los atributos se presentan como texto, las descripciones HTML/simplestyle no emiten solicitudes a partir de esos atributos y no se usan localStorage ni IndexedDB. El navegador sigue conectándose a Cesium/OpenStreetMap y, si se habilita, ion para los servicios cartográficos.

**Retirar muestras** elimina referencias y entidades de sesión; recargar también elimina ese estado. No garantiza borrado seguro de RAM, de adjuntos conservados por la plataforma o de archivos ya descargados. La exportación CSV/impresión solicita confirmación si hay muestras cargadas; esto es un aviso, no un sistema DLP. El usuario sigue siendo responsable de sus copias locales. No compartir capturas/informes privados como evidencias públicas del PR.

## Paso posterior a una autorización pública

Solo tras una revisión explícita se preparará un derivado con campos/geometrías permitidos, leyenda y metodología verificadas y pruebas. Ese derivado podrá proponerse en el PR en borrador. Nunca se copiará por defecto el original completo ni el HTML de referencia al repositorio.


## Referencia declarativa privada

Las definiciones extraídas del HTML y el análisis detallado permanecen en el directorio privado, sin commits. El visor puede leer un paquete JSON de referencia revisado mediante **Referencia privada · árbol original**. No se carga el HTML original como aplicación. El paquete no sigue rutas de datos, no incorpora una lista alternativa de plazas y no autoriza publicación. Las definiciones internas bloqueadas no generan plantillas de carga.

Después de elegir una subcapa de esa referencia, el formulario de muestra puede aplicar su plantilla sin pedir al usuario que escriba un descriptor. Deben coincidir plaza y ámbito; no hay fallback automático a ciudad. Solo se representa la geometría entregada, no se recorta ni genera una malla por cambiar el selector. Los estilos que aún no soporta el renderer se señalan como pendientes en lugar de sustituirlos.
