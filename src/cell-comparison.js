/** Join original attributes only after exact identifier AND geometry checks. */
function idKey(value) {
  if (typeof value === 'string' && value.trim()) return 'text:' + value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return 'number:' + value;
  throw Error('Identificador ausente o no interoperable.');
}
function indexFeatures(data, field) {
  if (!field || !Array.isArray(data?.features)) throw Error('Falta mapeo de identificador o archivo de entrada.');
  const index = new Map();
  for (const feature of data.features) {
    const key = idKey(feature.properties?.[field]);
    if (index.has(key)) throw Error('Identificadores duplicados: no se cruzan registros.');
    index.set(key,feature);
  }
  return index;
}
function geometryKey(geometry) {
  if (!['Polygon','MultiPolygon'].includes(geometry?.type)) throw Error('Solo se comparan celdas poligonales.');
  return JSON.stringify([geometry.type, geometry.coordinates]);
}
export function compareCell(selection, targets) {
  const field = selection.layer.analysis?.cellIdField;
  const key = idKey(selection.properties?.[field]);
  const selected = indexFeatures(selection.data,field).get(key);
  if (!selected) throw Error('La selección no corresponde al archivo original.');
  const geometry = geometryKey(selected.geometry);
  return targets.filter(target => target.layer.plaza === selection.layer.plaza && target.layer.scope === selection.layer.scope).map(target => {
    const base = { layerId: target.layer.id, name: target.layer.name, variable: target.layer.variable, temporalEvidence: target.layer.temporalEvidence ?? [], reference: target.layer.analysis?.reference ?? target.layer.approvalReference };
    try {
      const match = indexFeatures(target.data,target.layer.analysis?.cellIdField).get(key);
      if (!match) return { ...base, status:'no-record', message:'Sin registro en el archivo cargado; no equivale a cero.' };
      if (geometryKey(match.geometry) !== geometry) return { ...base, status:'geometry-mismatch', message:'Mismo identificador con geometría distinta: cruce rechazado.' };
      return { ...base, status:'matched', message:'Identificador y geometría exacta coinciden. Valores originales, sin recalcular.', attributes: match.properties };
    } catch (error) { return { ...base, status:'invalid', message:error.message }; }
  });
}
export function renderCellComparison(target, comparisons) {
  const document = target.ownerDocument; target.replaceChildren();
  const title = document.createElement('h3'); title.textContent='Comparación de capas visibles por celda'; target.append(title);
  const caveat=document.createElement('p'); caveat.textContent='Sin cruce por cercanía ni relleno de faltantes. Una diferencia que incluye estimaciones no equivale a crecimiento observado.'; target.append(caveat);
  for (const item of comparisons) {
    const section=document.createElement('section'); section.dataset.comparisonStatus=item.status;
    const heading=document.createElement('h4'); heading.textContent=`${item.variable} · ${item.name}`;
    const status=document.createElement('p'); status.textContent=item.message; section.append(heading,status);
    for (const note of item.temporalEvidence) { const p=document.createElement('p'); p.textContent=`Fuente temporal declarada: ${note}`; section.append(p); }
    if (item.attributes) { const pre=document.createElement('pre'); pre.textContent=JSON.stringify(item.attributes,null,2); section.append(pre); }
    const reference=document.createElement('small'); reference.textContent=item.reference ?? 'Referencia no documentada'; section.append(reference); target.append(section);
  }
}
