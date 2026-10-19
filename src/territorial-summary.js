/** Aggregates only existing attributes through an explicitly documented mapping. */
export function validateAnalysis(analysis) {
  if (!analysis || typeof analysis.reference !== 'string' || !analysis.reference.trim()) throw Error('Falta referencia del mapeo analítico.');
  if (!['sample', 'plaza'].includes(analysis.scope)) throw Error('Debe declararse el alcance de la muestra o plaza.');
  if (typeof analysis.cellIdField !== 'string' || !analysis.cellIdField.trim()) throw Error('Falta el campo identificador de celda.');
  if (analysis.classField !== undefined && typeof analysis.classField !== 'string') throw Error('Campo de clase inválido.');
  const ids = new Set();
  if (!Array.isArray(analysis.metrics ?? [])) throw Error('Métricas inválidas.');
  for (const metric of analysis.metrics ?? []) {
    if (!metric.id || ids.has(metric.id) || !metric.field || !metric.label || typeof metric.unit !== 'string' || !metric.reference?.trim() || !['sum', 'mean'].includes(metric.aggregation)) throw Error('Métrica sin campo, unidad o regla documentada.');
    ids.add(metric.id);
  }
  return analysis;
}
export function summarizeCells(rows, analysis) {
  validateAnalysis(analysis);
  const seen = new Set(); const classes = new Map(); let missingClass = 0;
  for (const row of rows) {
    const id = row[analysis.cellIdField];
    if (!['string', 'number'].includes(typeof id) || id === '' || (typeof id === 'number' && !Number.isFinite(id)) || seen.has(String(id))) throw Error('No se resume la malla: identificadores ausentes o duplicados.');
    seen.add(String(id));
    if (analysis.classField) {
      const category = row[analysis.classField];
      if (category === null || category === undefined || category === '') missingClass++;
      else if (['string', 'number'].includes(typeof category)) classes.set(String(category), (classes.get(String(category)) ?? 0) + 1);
      else throw Error('Clase no escalar.');
    }
  }
  const metrics = (analysis.metrics ?? []).map(metric => {
    const values = rows.map(row => row[metric.field]).filter(value => typeof value === 'number' && Number.isFinite(value));
    const sum = values.reduce((result, value) => result + value, 0);
    const value = values.length ? (metric.aggregation === 'sum' ? sum : sum / values.length) : null;
    if (value !== null && !Number.isFinite(value)) throw Error('Resultado numérico fuera de rango.');
    return { ...metric, value, valid: values.length, missing: rows.length - values.length };
  });
  return { cells: seen.size, scope: analysis.scope, reference: analysis.reference, classes: [...classes], missingClass, metrics };
}

export function layerSummaryRows(layer, source, time, originalRows) {
  const prefix = `${layer.variable} · ${layer.name}`;
  const features = source.entities.values.filter(entity => !entity._arecParent);
  const rows = originalRows ?? features.map(entity => entity.properties?.getValue(time) ?? {});
  const result = [[`${prefix} · entidades cargadas`, features.length], [`${prefix} · visibilidad`, source.show === false ? 'Oculta; atributos siguen cargados' : 'Visible'], [`${prefix} · alcance`, layer.analysis?.scope === 'plaza' ? 'Plaza declarada; cobertura requiere revisión' : 'Muestra / alcance no completo'], [`${prefix} · fecha de corte`, layer.updatedAt || 'No documentada']];
  if (!layer.analysis) { result.push([`${prefix} · resultados por celda`, 'Sin mapeo rector: no se infieren campos ni cálculos']); return result; }
  try {
    const summary = summarizeCells(rows, layer.analysis);
    result.push([`${prefix} · celdas únicas en archivo cargado`, summary.cells], [`${prefix} · referencia de campos`, summary.reference]);
    for (const [label, count] of summary.classes) result.push([`${prefix} · clase original ${label}`, count]);
    if (layer.analysis.classField) result.push([`${prefix} · celdas sin clase`, summary.missingClass]);
    for (const metric of summary.metrics) {
      result.push([`${prefix} · ${metric.label} (${metric.unit}; ${metric.aggregation})`, metric.value ?? 'No disponible'], [`${prefix} · ${metric.label}: registros válidos / faltantes`, `${metric.valid} / ${metric.missing}`], [`${prefix} · ${metric.label}: regla`, metric.reference]);
    }
    result.push([`${prefix} · limitación`, 'Se resumen atributos precalculados del archivo cargado. Sin extrapolar al resto de la plaza ni recalcular ZCU. Las métricas con faltantes son parciales.']);
  } catch (error) { result.push([`${prefix} · validación del resumen`, error.message]); }
  return result;
}
