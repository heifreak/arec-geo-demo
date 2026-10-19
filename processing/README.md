# Primitivas espaciales offline

Este módulo Python está separado del visor estático. No descarga fuentes ni genera resultados territoriales definitivos. Los perfiles, originales y resultados privados deben mantenerse fuera del checkout y del servidor web.

```sh
python3 -m venv /tmp/arec-spatial-venv
/tmp/arec-spatial-venv/bin/python -m pip install --only-binary=:all: -r processing/requirements.txt
/tmp/arec-spatial-venv/bin/python -m unittest discover -s processing/tests -v
```

`processing.spatial` expone:

- `project_features`: CRS de origen y UTM métrico explícitos, atributos conservados, sin reparar geometrías silenciosamente.
- `grid_facts`: área geométrica y comprobación de cuadrados con lado y tolerancias explícitos. Una celda recortada conserva su área real; no se sustituye por el área nominal.
- `direct_attributes`: conserva valores precalculados y distingue campos ausentes de valores nulos.
- `TargetIndex`: distancia euclidiana desde el centroide, conteos con radio explícito y área de intersección mediante unión para evitar doble conteo. Una fuente vacía significa cobertura sin comprobar, no cero.
- `overlap_percent`: requiere denominador explícito, sin decidir la política para celdas recortadas.
- `queen_components`: agrupa polígonos que comparten borde o vértice; informa área de unión y rechaza solapamientos superiores a la tolerancia indicada.

Las geometrías que se entregan directamente a los operadores deben estar ya en el mismo CRS UTM validado. No se implementan isócronas de red, reparto dasimétrico, pesos, vetos, clasificación ZCU ni tipologías de macropolígonos. Queen no equivale a DBSCAN. Los operadores no certifican completitud de las fuentes ni calibración del modelo. Las pruebas usan geometrías sintéticas; falta contrastar una muestra territorial autorizada antes de conectar resultados al resumen y al inspector.

## Pipeline V13 preparado, condicionado a método verificado

`python -m processing.expansion PLAN_PRIVADO REPORTE_PRIVADO` realiza auditoría técnica por lote, sin exportar superficies nuevas. `--execute` está bloqueado salvo que el perfil declare revisión documental, revisor, documento local cuyo SHA-256 coincida y aprobación de las huellas exactas de ambas entradas. Los originales, planes, informes y salidas deben estar fuera del checkout. La herramienta no descarga GHSL ni presume acceso a Drive.

Hay un solo método implementado: diferencia de superficie construida **por las mismas celdas**, con áreas originales en m². No equivale a diferencia geométrica entre dos huellas poligonales. No genera ni deduce superficies construidas a partir de polígonos sin sus datos y ETL originales. El corte mínimo se suministra en un perfil verificado; no hay valores analíticos por defecto. Las pruebas sintéticas comprueban el corte inclusivo equivalente a dos hectáreas, sin establecer un perfil corporativo aprobado.

El plan puede tener `shared_profile` y `jobs`, o un `input_root`, `output_root` e `input_patterns` para ambos años, con `{CODE}` / `{code}`. El segundo modo expande automáticamente las 18 plazas con el mismo perfil; no requiere 18 implementaciones. Un fallo queda registrado y el lote continúa; el proceso termina con código 2 si hay plazas bloqueadas.

El perfil debe identificar método, campos de ID y superficie, unidades, CRS de origen, CRS métrico, producto/versión y naturaleza temporal para cada época, evidencia de alineación de malla y comparabilidad. `metric_crs: auto-utm` propone una zona por la extensión conjunta, y comprueba que todas las geometrías estén en su ámbito de uso; no utiliza el CRS de Juárez para todas las plazas ni un fallback silencioso. Casos que cruzan zonas o hemisferios requieren una proyección revisada.

Se validan geometrías, IDs únicos con tipos consistentes, igualdad de celdas entre épocas, unidades y superficies no negativas ni superiores al soporte geométrico. Un registro ausente o nulo no se convierte en cero. Los periodos deben usar productos/versiones comparables; 2025 no se admite como observación certificada en este pipeline. La auditoría no devuelve deltas ni conteos territoriales nuevos. La ejecución aprobada exporta GeoJSON WGS84 de deltas positivos y del umbral, con atributos originales de ambos años anidados, resultados derivados separados y procedencia. Las salidas no se declaran certificadas.

**Dependencias pendientes para las plazas sin expansión:** notebook/ETL original, producto y versión GHSL, tratamiento temporal de 2025, definición de superficie construida y unidades, máscaras/cortes, resolución y remuestreo, alineación y tratamiento de bordes/nulos, campos de entrada y regla exacta del filtro. Una descripción en HTML no reemplaza esos parámetros. No se ejecutan cálculos corporativos nuevos hasta su verificación. No se incluyen perfiles de producción ni datos privados en el repositorio.
