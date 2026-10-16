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
