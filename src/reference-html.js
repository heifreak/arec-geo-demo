import { parse } from 'acorn';
import { validateSessionGeoJSON } from './session-data.js';
import { validatePaint } from './style-expressions.js';

// Parse literals only. Never evaluate scripts, template expressions, calls or HTML.
function literal(node) {
  if (node?.type === 'Literal' && !node.regex && typeof node.value !== 'bigint') return node.value;
  if (node?.type === 'ArrayExpression') return node.elements.map(literal);
  if (node?.type === 'ObjectExpression') {
    const result = Object.create(null);
    for (const property of node.properties) {
      if (property.type !== 'Property' || property.computed || property.kind !== 'init' || property.method) throw Error('dynamic');
      result[property.key.name ?? property.key.value] = literal(property.value);
    }
    return result;
  }
  if (node?.type === 'UnaryExpression' && node.operator === '-' && node.argument.type === 'Literal' && typeof node.argument.value === 'number') return -node.argument.value;
  throw Error('dynamic');
}
function walk(root, visit) {
  const pending = [root]; let count = 0;
  while (pending.length) {
    const node = pending.pop(); if (!node?.type) continue;
    if (++count > 200000) throw Error('Referencia demasiado compleja.');
    visit(node);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) { for (const item of value) if (item?.type) pending.push(item); }
      else if (value?.type) pending.push(value);
    }
  }
}
export async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function descriptorFromHTML(html, geoText, { plaza, scope, variable }) {
  if (html.length > 2 * 1024 * 1024 || geoText.length > 25 * 1024 * 1024) throw Error('Referencia: máximo 2 MiB; muestra: máximo 25 MiB.');
  const data = validateSessionGeoJSON(JSON.parse(geoText));
  if (!data.features.length || data.features.some(f => f.geometry?.type !== 'Polygon' && f.geometry?.type !== 'MultiPolygon')) throw Error('Este asistente requiere celdas poligonales.');
  const layers = []; const metadata = [];
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (!match[1].trim()) continue;
    const tree = parse(match[1], { ecmaVersion: 'latest', sourceType: 'module' });
    walk(tree, node => {
      if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && node.callee.property.name === 'addLayer') {
        try { const value = literal(node.arguments[0]); if (value.paint) layers.push(value); } catch { /* Only fully literal layers are supported. */ }
      }
      if (node.type === 'ObjectExpression') {
        try { const value = literal(node); if (Array.isArray(value.legend)) metadata.push(value); } catch { /* No execution fallback. */ }
      }
    });
  }
  const candidates = [];
  for (const layer of layers) {
    const expression = layer.paint['fill-color'];
    if (layer.type !== 'fill' || layer.filter || expression?.[0] !== 'match' || expression[1]?.[0] !== 'get' || typeof expression[1][1] !== 'string') continue;
    const field = expression[1][1]; const labels = new Set();
    for (let i = 2; i < expression.length - 1; i += 2) for (const value of Array.isArray(expression[i]) ? expression[i] : [expression[i]]) labels.add(value);
    if (data.features.every(f => typeof f.properties[field] === 'string' && labels.has(f.properties[field]))) candidates.push({ layer, field });
  }
  if (candidates.length !== 1) throw Error('No hay una única regla categórica literal compatible con todas las celdas. Se requiere descriptor revisado.');
  const { layer, field } = candidates[0];
  const paint = Object.assign({}, ...layers.filter(item => item.source === layer.source && ['fill', 'line'].includes(item.type) && !item.filter).map(item => item.paint));
  validatePaint(paint);
  const colors = new Set(); const expression = paint['fill-color'];
  for (let i = 3; i < expression.length - 1; i += 2) if (typeof expression[i] === 'string') colors.add(expression[i].toLowerCase());
  const matches = metadata.filter(item => item.legend.every(pair => Array.isArray(pair) && pair.length === 2 && pair.every(v => typeof v === 'string')) && [...colors].every(color => item.legend.some(pair => pair[0].toLowerCase() === color)));
  const unique = [...new Map(matches.map(item => [JSON.stringify(item), item])).values()];
  if (unique.length !== 1) throw Error('Leyenda ambigua o incompleta; no se inventan etiquetas.');
  const meta = unique[0];
  // Choose only an actual unique text identifier; never fabricate a business identifier.
  const idFields = Object.keys(data.features[0].properties).filter(key => /(?:^id$|_id$|^id_)/i.test(key) && data.features.every(f => typeof f.properties[key] === 'string' && f.properties[key].trim()) && new Set(data.features.map(f => f.properties[key])).size === data.features.length);
  if (idFields.length !== 1) throw Error('Identificador de celda ambiguo; se requiere descriptor revisado.');
  const hash = await sha256(geoText); const reference = `Referencia HTML local SHA256 ${await sha256(html)}`;
  return { plaza, scope, variable, name: layer.id, source: meta.source ?? 'Referencia local', methodology: meta.method ?? 'Método no documentado', formula: meta.formula ?? 'Sin fórmula adicional', legend: meta.legend.map(pair => pair[1]).join(' · '), legendEntries: meta.legend, approvalReference: reference, style: { color: meta.legend[0][0], opacity: 1, paint, reference }, inputEvidence: { sha256: hash, featureCount: data.features.length }, analysis: { reference: `Clase original del archivo SHA256 ${hash}; sin recalcular`, scope: 'sample', cellIdField: idFields[0], classField: field, metrics: [] }, inspection: { reference, groups: [{ label: 'Campos originales · sin recalcular', fields: [...new Set(data.features.flatMap(f => Object.keys(f.properties)))].map(key => ({ field: key, label: key, note: 'Valor original. No se infieren unidades ni se agregan valores por celda.' })) }] }, warnings: ['Referencia leída como texto/AST, sin ejecutar el HTML.', 'Correspondencia visual, no certificación del cálculo original ni de la cobertura.', 'Se conservan atributos y clases precalculados; no se suman poblaciones ni densidades.'], sessionOnly: true, publicApproved: false };
}
