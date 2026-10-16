/** Private descriptors supply labels and provenance; no analytical rules are inferred. */
export function validateInspection(inspection) {
  if (!inspection?.reference?.trim() || !Array.isArray(inspection.groups) || inspection.groups.length > 20) throw Error('Inspector sin referencia o grupos válidos.');
  const seen = new Set();
  for (const group of inspection.groups) {
    if (typeof group.label !== 'string' || !Array.isArray(group.fields) || group.fields.length > 100) throw Error('Grupo de inspector inválido.');
    for (const entry of group.fields) {
      if (typeof entry.field !== 'string' || !entry.field || seen.has(entry.field) || typeof entry.label !== 'string' || entry.unit !== undefined && typeof entry.unit !== 'string' || entry.note !== undefined && typeof entry.note !== 'string') throw Error('Campo de inspector inválido o duplicado.');
      seen.add(entry.field);
    }
  }
  return inspection;
}
export function inspectCell(attributes, inspection) {
  validateInspection(inspection);
  return { reference: inspection.reference, groups: inspection.groups.map(group => ({ label: group.label, fields: group.fields.map(entry => ({ ...entry, present: Object.hasOwn(attributes, entry.field), value: Object.hasOwn(attributes, entry.field) ? attributes[entry.field] : null })) })) };
}
export function renderCellInspection(target, attributes, inspection) {
  const model = inspectCell(attributes, inspection);
  const document = target.ownerDocument;
  const heading = document.createElement('p'); heading.textContent = `Atributos precalculados · ${model.reference}`; target.replaceChildren(heading);
  for (const group of model.groups) {
    const section = document.createElement('section'); const title = document.createElement('h3'); title.textContent = group.label; section.append(title);
    const list = document.createElement('dl');
    for (const field of group.fields) {
      const term = document.createElement('dt'); term.textContent = `${field.label} · ${field.field}`;
      const value = document.createElement('dd');
      value.textContent = !field.present ? 'Campo ausente' : field.value === null ? 'Sin dato (null)' : `${typeof field.value === 'object' ? JSON.stringify(field.value) : String(field.value)}${field.unit ? ` ${field.unit}` : ''}`;
      list.append(term, value);
      if (field.note) { const note = document.createElement('p'); note.textContent = field.note; value.append(note); }
    }
    section.append(list); target.append(section);
  }
}
export async function verifyInputEvidence(text, data, evidence) {
  if (!evidence) return;
  if (!/^[a-f0-9]{64}$/.test(evidence.sha256) || !Number.isSafeInteger(evidence.featureCount) || evidence.featureCount < 1) throw Error('Huella de entrada inválida.');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  if (hex !== evidence.sha256 || data.features?.length !== evidence.featureCount) throw Error('El archivo no corresponde al descriptor revisado; no se aplica su mapeo.');
}
