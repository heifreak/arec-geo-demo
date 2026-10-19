# Capas BASE y fuentes grandes

El motor de carpeta sigue siendo único para las 18 plazas. El origen web publicado no recibe los datos locales ni se modifica por importar una carpeta.

## Capas BASE

Las rutas `evidence/base` y `evidence/base_metro` identifican superposiciones BASE, sin asignarles artificialmente una variable. `base_metro` se inventaría como ámbito de carga metropolitano, aunque esté bajo `evidence`. El informe conserva la corrección desde la clasificación anterior de ciudad.

El rol técnico se sugiere a partir de la ruta y el nombre: malla, AGEB, municipio central, municipios, localidades, delimitación, extensión u otra referencia. No certifica dimensiones de una malla, oficialidad de un límite ni equivalencia entre ciudad, municipio central, análisis metropolitano y delimitación oficial. No recorta ni sustituye geometrías entre ámbitos. Los nombres de las fuentes y sus atributos permanecen originales.

La paleta BASE es técnica y configurable desde el selector de color: no es la simbología original V15 ni una clasificación territorial. Cambiarla no modifica ni reclasifica las variables analíticas. Las geometrías compatibles se cargan bajo demanda. BASE se cuenta por separado de las subcapas y variables originales; el catálogo conserva la estructura de referencia, marcando las subcapas sin archivos. V15–V18 no son activables ni se incluyen sus definiciones en el paquete público.

## Fuentes auxiliares y equivalencia documental

SNIIV y RNC se pueden identificar como familias sugeridas por nombre o fuente declarada en atributos. Esto no crea una correspondencia analítica. Sin una ruta exacta o alias documental vinculado al mismo identificador de fuente en el HTML, permanecen auxiliares: faltan el contrato de atributos/unidades/ámbito y, en su caso, el subconjunto o procedimiento ETL. Una red vial completa no equivale automáticamente al subconjunto de vías primarias.

El extractor acepta ciertas URL simbólicas hechas de literales, concatenaciones, plantillas y conversión a minúsculas. No ejecuta funciones del HTML ni sigue enlaces. Solo incorpora un alias de variable si el identificador de fuente coincide exactamente con las capas originales de esa subcapa; no utiliza similitud de nombres para deducir indicadores.

Ante una fuente V14 sin vínculo, el diagnóstico contrasta SHA-256 y tamaño de los archivos pequeños del mismo contexto. Las coincidencias binarias se informan sin eliminar archivos. Una huella distinta no decide si se trata de otra versión, una capa complementaria o geometrías equivalentes con diferente serialización. El detalle y las huellas quedan únicamente en el informe local. Archivos que exceden el presupuesto de contraste quedan pendientes.

## GeoJSON Point grandes

Se conserva el límite de carga completa de 25 MiB y 50.000 entidades. Una fuente estructuralmente válida, exclusivamente `Point`, puede utilizar el modo `viewport-stream` si excede ese límite y no supera el límite de lectura de 128 MiB. Otros tipos grandes quedan bloqueados con motivo explícito; no se simplifican ni transforman silenciosamente.

El worker recorre el original por bloques y retiene solo entidades dentro de la ventana de cámara, hasta **5.000 entidades y 8 MiB de GeoJSON retenido**. Una entidad que no cabe se omite de esa ventana y se cuenta en la truncación, sin cortar sus atributos. El inspector conserva íntegramente las propiedades de las entidades representadas. Un punto fuera de la ventana no se interpreta como dato ausente en el original.

Hay un máximo de dos fuentes progresivas, seis capas totales y 64 MiB de archivos/ventanas reservados. Los objetos decodificados, atributos, primitivas y teselas consumen RAM/GPU adicional. No se promete un techo exacto de RAM del navegador.

Al terminar un movimiento de cámara se solicita la nueva ventana, se cancela la anterior y se libera su fuente. Ventanas prácticamente iguales no se releen; las coordenadas y atributos originales no se redondean. Se conserva la opacidad elegida. Ocultar la capa o cambiar de plaza/ámbito cancela lecturas y libera la representación. **Cancelar operación** también detiene las actualizaciones pendientes de ventana; se puede desactivar y volver a activar la capa.

Esta versión hace un recorrido secuencial del archivo por nueva ventana: prioriza memoria acotada y cancelación sobre latencia. No contiene índice persistente por teselas, clustering ni selección por representatividad estadística. Cuando se alcanza un límite se informa selección parcial por orden original y se recomienda acercar la cámara. Las ventanas no se usan como totales territoriales certificados.

La copia local opcional puede conservar también estos originales grandes en IndexedDB, sujeta a cuota y consentimiento. Restaurar vuelve a comprobarlos; no dibuja todas sus entidades ni conserva una ventana como si fuera el archivo completo.

## V14 y V20

Se conservan atributos nulos y faltantes; no se convierten en cero ni se recalculan clases. Las leyendas y pinturas analíticas proceden de la referencia local. El inspector distribuye campos originales en grupos de hasta 100, con límite explícito de 2.000 campos; los excesos se diagnostican sin descartar atributos silenciosamente.

Una leyenda gradual junto a un constructor uniforme sigue siendo una discrepancia documental, aunque las expresiones de pintura sean técnicamente válidas. Sin umbrales y una regla verificable no se inventa una rampa ni se afirma que la pintura uniforme sea intencional. La advertencia acompaña la capa y el diagnóstico.

## Comparativo reproducible

El informe local separa BASE, subcapas analíticas, archivos grandes, auxiliares, correcciones de ámbito, fallos y cargas realizadas en Cesium. Compara el mismo inventario contra las reglas del cargador anterior (rutas originales y carga completa), no contra cifras corporativas incrustadas en el código público. No sustituye un informe histórico ni acredita identidad del corpus por coincidir en número de archivos. Las cifras reales se calculan en el navegador del propietario.

`rendered` significa fuente cargada y pintura aplicada, no revisión visual humana ni certificación territorial. Los análisis certificados permanecen en cero mientras no exista un procedimiento de certificación. Los conteos de entidades de varios archivos no son celdas únicas.
