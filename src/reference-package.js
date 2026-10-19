import { validatePaint } from './style-expressions.js';
import { validateCatalog } from './layers.js';
export const SCOPES = ['city', 'municipality', 'metro_analysis', 'metro_official'];
export const blockedVariable = id => /^V1[5-8]$/.test(id);
export function validateReferencePackage(bundle) {
  if (bundle?.version !== 1 || bundle.kind !== 'private-reference' || !bundle.reference?.trim()) throw Error('Paquete de referencia privado inválido.');
  if (!Array.isArray(bundle.variables) || bundle.variables.length !== 23) throw Error('Se requieren las 23 variables de referencia.');
  const ids = new Set(); const layerIds = new Set();
  for (const variable of bundle.variables) {
    if (!/^V(0[1-9]|1[0-9]|2[0-3])$/.test(variable.id) || ids.has(variable.id) || typeof variable.name !== 'string' || !Array.isArray(variable.sublayers)) throw Error('Variable de referencia inválida o duplicada.');
    ids.add(variable.id);
    for (const layer of variable.sublayers) {
      if (typeof layer.id !== 'string' || !layer.id || layerIds.has(layer.id) || typeof layer.name !== 'string') throw Error('Subcapa de referencia inválida o duplicada.');
      layerIds.add(layer.id);
    }
  }
  if (!Array.isArray(bundle.groups) || !bundle.groups.length || bundle.groups.length > 10 || !Array.isArray(bundle.templates) || bundle.templates.length > 200 || bundle.variables.reduce((sum, variable) => sum + variable.sublayers.length, 0) > 200) throw Error('Faltan grupos o plantillas o se excede el límite.');
  if (bundle.baseLayers !== undefined && (!Array.isArray(bundle.baseLayers) || bundle.baseLayers.length > 20)) throw Error('Bases territoriales inválidas.');
  const baseIds = new Set();
  for (const base of bundle.baseLayers ?? []) {
    if (!base.id || layerIds.has(base.id) || baseIds.has(base.id) || typeof base.name !== 'string') throw Error('Base territorial inválida o duplicada.');
    baseIds.add(base.id);
  }
  const grouped = new Set(); const groupIds = new Set();
  for (const group of bundle.groups) {
    if (!group.id || groupIds.has(group.id) || typeof group.name !== 'string' || !Array.isArray(group.variables)) throw Error('Grupo inválido.');
    groupIds.add(group.id);
    for (const id of group.variables) { if (!ids.has(id) || grouped.has(id)) throw Error('Agrupación incoherente.'); grouped.add(id); }
  }
  if (grouped.size !== 23) throw Error('Agrupación incompleta.');
  const templateIds = new Set();
  for (const template of bundle.templates) {
    const variable = bundle.variables.find(variable => variable.id === template.variable);
    const validBase = template.kind === 'base' && template.variable === 'BASE' && ['grid', 'ageb', 'extent', 'municipalities'].includes(template.role) && baseIds.has(template.logicalId);
    if ((!validBase && (!variable || blockedVariable(variable.id) || !variable.sublayers.some(layer => layer.id === template.logicalId))) || templateIds.has(template.logicalId)) throw Error('Plantilla no autorizada o incoherente.');
    if (!template.approvalReference || !template.style?.reference) throw Error('Falta trazabilidad de la plantilla.');
    if (template.style.paint) validatePaint(template.style.paint);
    if (template.warnings !== undefined && (!Array.isArray(template.warnings) || template.warnings.some(value => typeof value !== 'string'))) throw Error('Advertencias de referencia inválidas.');
    if (template.legendEntries !== undefined && (!Array.isArray(template.legendEntries) || template.legendEntries.some(entry => !Array.isArray(entry) || entry.length !== 2 || entry.some(value => typeof value !== 'string')))) throw Error('Leyenda de referencia inválida.');
    validateCatalog({ version: 1, layers: [{ ...template, id: 'reference-template', plaza: 'JRZ', url: 'data/reference-template.geojson', sessionOnly: true, sessionApproved: true, publicApproved: false }] }, { session: true });
    templateIds.add(template.logicalId);
  }
  return bundle;
}
export function descriptorFromReference(bundle, logicalId, plaza, scope) {
  if (!SCOPES.includes(scope)) throw Error('Ámbito no soportado.');
  const template = bundle.templates.find(template => template.logicalId === logicalId);
  if (!template || blockedVariable(template.variable)) throw Error('No hay plantilla de simbología soportada para esa subcapa.');
  return { ...structuredClone(template), plaza, scope, sessionOnly: true, publicApproved: false };
}
