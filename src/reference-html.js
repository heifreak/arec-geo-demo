import { parse } from 'acorn';
import { validateSessionGeoJSON } from './session-data.js';
import { validatePaint } from './style-expressions.js';

// Parse literals only. Never evaluate scripts, template expressions, calls or HTML.
function literal(node, bindings = {}) {
  if (node?.type === 'Identifier' && Object.hasOwn(bindings,node.name)) return bindings[node.name];
  if (node?.type === 'Literal' && !node.regex && typeof node.value !== 'bigint') return node.value;
  if (node?.type === 'ArrayExpression') return node.elements.map(item => literal(item,bindings));
  if (node?.type === 'ObjectExpression') {
    const result = Object.create(null);
    for (const property of node.properties) {
      if (property.type !== 'Property' || property.computed || property.kind !== 'init' || property.method) throw Error('dynamic');
      result[property.key.name ?? property.key.value] = literal(property.value,bindings);
    }
    return result;
  }
  if (node?.type === 'UnaryExpression' && node.operator === '-' && node.argument.type === 'Literal' && typeof node.argument.value === 'number') return -node.argument.value;
  throw Error('dynamic');
}
function walk(root, visit) {
  const pending = [{node:root, owner:null}]; let count = 0;
  while (pending.length) {
    const frame = pending.pop(); const node=frame.node; if (!node?.type) continue;
    const owner = /^(FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(node.type) ? node : frame.owner;
    if (++count > 200000) throw Error('Referencia demasiado compleja.');
    visit(node,owner);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) { for (const item of value) if (item?.type) pending.push({node:item,owner}); }
      else if (value?.type) pending.push({node:value,owner});
    }
  }
}
export async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
function extractHTML(html) {
  if (html.length > 2*1024*1024) throw Error('Referencia demasiado grande.');
  const layers = []; const metadata = []; const objects = []; const dynamicLayers = []; const declarations = []; const functions = new Map();
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (!match[1].trim()) continue;
    const tree = parse(match[1], { ecmaVersion: 'latest', sourceType: 'module' });
    walk(tree, (node,owner) => {
      if (node.type === 'VariableDeclarator') declarations.push(node);
      if (node.type === 'FunctionDeclaration') functions.set(node.id?.name,node);
      if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && node.callee.property.name === 'addLayer') {
        try { const value = literal(node.arguments[0]); if (value.paint) layers.push(value); } catch { if (node.arguments[0]?.type === 'ObjectExpression') dynamicLayers.push({node:node.arguments[0],owner}); }
      }
      if (node.type === 'ObjectExpression') {
        try { const value = literal(node); objects.push(value); if (Array.isArray(value.legend)) metadata.push(value); } catch { /* No execution fallback. */ }
      }
    });
  }
  return { layers, metadata, objects, dynamicLayers, declarations, functions };
}

function property(node,key) { return node.properties?.find(p => !p.computed && (p.key?.name ?? p.key?.value) === key)?.value; }
export function referenceLayerOptions(html, variable) {
  const {objects} = extractHTML(html); const result = new Map();
  for (const object of objects) for (const item of object.variables ?? []) {
    if ('V'+String(item.id).padStart(2,'0') !== variable) continue;
    for (const sub of item.subcapas ?? []) if (typeof sub.id === 'string' && typeof sub.nombre === 'string') result.set(sub.id,{id:sub.id,name:sub.nombre});
  }
  return [...result.values()];
}
// Limited static substitution: a literal palette lookup and literal paint values only.
// Reference functions and network/DOM statements are never executed.
function comparablePaint(paint) {
  return JSON.stringify(Object.fromEntries(Object.entries(paint).map(([key,value]) => [
    key,
    key.endsWith('-color') && typeof value==='string'
      ? value.toLowerCase().replace(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/, '#$1$1$2$2$3$3')
      : value
  ])));
}
function uniformStyle(extracted, logicalId) {
  const metas = extracted.objects.flatMap(object => Object.entries(object).filter(([key,value]) => key === logicalId && Array.isArray(value?.legend)).map(([,value])=>value));
  const uniqueMeta=[...new Map(metas.map(meta=>[JSON.stringify(meta),meta])).values()];
  if (uniqueMeta.length !== 1) throw Error('No hay metadatos únicos para esa subcapa.');
  const paints=[]; const owners=new Set();
  for (const {node,owner} of extracted.dynamicLayers) {
    const localDeclarations=[]; if (owner) walk(owner,item=>{if(item.type==='VariableDeclarator')localDeclarations.push(item);});
    const type=property(node,'type'); if (!['fill','line','circle'].includes(type?.value)) continue;
    const paintNode=property(node,'paint'); if (paintNode?.type !== 'ObjectExpression') continue;
    const bindings={}; let resolved=false;
    for (const entry of paintNode.properties) {
      if (!String(entry.key?.value ?? entry.key?.name).endsWith('-color') || entry.value.type !== 'Identifier') continue;
      const name=entry.value.name;
      const colors=new Set();
      for (const declaration of localDeclarations.filter(d=>d.id.name===name && d.init?.type==='CallExpression' && d.init.callee.type==='Identifier' && d.init.arguments.length===1 && d.init.arguments[0].type==='Identifier' && owner?.params.some(p=>p.name===d.init.arguments[0].name))) {
        const fn=extracted.functions.get(declaration.init.callee.name);
        if (fn?.params.length!==1 || fn.body.body.length!==2) continue;
        const [statement,returned]=fn.body.body;
        if (statement.type!=='VariableDeclaration' || statement.declarations.length!==1 || returned.type!=='ReturnStatement') continue;
        const table=statement.declarations[0]; const access=returned.argument?.type==='LogicalExpression' && returned.argument.operator==='||' ? returned.argument.left : returned.argument;
        if (access?.type!=='MemberExpression' || !access.computed || access.object.name!==table.id.name || access.property.name!==fn.params[0].name) continue;
        try { const color=literal(table.init)[logicalId]; if (typeof color==='string') colors.add(color); } catch { /* Not a literal lookup. */ }
      }
      if (colors.size!==1) continue;
      bindings[name]=[...colors][0]; resolved=true;
    }
    if (resolved) { owners.add(owner); try { paints.push({type:type.value,paint:literal(paintNode,bindings)}); } catch { throw Error('Pintura dinámica no soportada.'); } }
  }
  if (!owners.size) throw Error('No hay constructor uniforme verificable.');
  for (const type of ['fill','line','circle']) if (new Set(paints.filter(p=>p.type===type).map(p=>comparablePaint(p.paint))).size>1) throw Error('Pinturas uniformes contradictorias.');
  if (!paints.some(p=>p.type==='fill') || !paints.some(p=>p.type==='line')) throw Error('No se encontró pintura uniforme completa verificable.');
  const paint=Object.assign({},...paints.map(p=>p.paint)); validatePaint(paint);
  const meta=uniqueMeta[0];
  if (!meta.legend.every(pair=>Array.isArray(pair) && pair.length===2 && pair.every(value=>typeof value==='string'))) throw Error('Leyenda uniforme inválida.');
  if (!meta.legend.some(pair=>pair[0]?.toLowerCase()===paint['fill-color']?.toLowerCase())) throw Error('La leyenda no corresponde al color original.');
  return {layer:{id:logicalId},paint,meta};
}
export async function descriptorFromHTML(html, geoText, { plaza, scope, variable, logicalId }) {
  if (geoText.length > 25 * 1024 * 1024) throw Error('Muestra: máximo 25 MiB.');
  const data = validateSessionGeoJSON(JSON.parse(geoText));
  if (!data.features.length || data.features.some(f => f.geometry?.type !== 'Polygon' && f.geometry?.type !== 'MultiPolygon')) throw Error('Este asistente requiere celdas poligonales.');
  const extracted=extractHTML(html); const {layers, metadata}=extracted;
  const candidates = [];
  for (const layer of layers) {
    const expression = layer.paint['fill-color'];
    if (layer.type !== 'fill' || layer.filter || expression?.[0] !== 'match' || expression[1]?.[0] !== 'get' || typeof expression[1][1] !== 'string') continue;
    const field = expression[1][1]; const labels = new Set();
    for (let i = 2; i < expression.length - 1; i += 2) for (const value of Array.isArray(expression[i]) ? expression[i] : [expression[i]]) labels.add(value);
    if (data.features.every(f => typeof f.properties[field] === 'string' && labels.has(f.properties[field]))) candidates.push({ layer, field });
  }
  if (!logicalId && candidates.length !== 1) throw Error('No hay una única regla categórica literal compatible con todas las celdas. Se requiere descriptor revisado.');
  let layer, field, paint, meta;
  if (logicalId) {
    if (!referenceLayerOptions(html,variable).some(option=>option.id===logicalId)) throw Error('Subcapa no pertenece a la variable elegida.');
    ({layer,paint,meta}=uniformStyle(extracted,logicalId));
  } else {
    ({ layer, field } = candidates[0]);
    paint = Object.assign({}, ...layers.filter(item => item.source === layer.source && ['fill', 'line'].includes(item.type) && !item.filter).map(item => item.paint));
  validatePaint(paint);
  const colors = new Set(); const expression = paint['fill-color'];
  for (let i = 3; i < expression.length - 1; i += 2) if (typeof expression[i] === 'string') colors.add(expression[i].toLowerCase());
  const matches = metadata.filter(item => item.legend.every(pair => Array.isArray(pair) && pair.length === 2 && pair.every(v => typeof v === 'string')) && [...colors].every(color => item.legend.some(pair => pair[0].toLowerCase() === color)));
  const unique = [...new Map(matches.map(item => [JSON.stringify(item), item])).values()];
  if (unique.length !== 1) throw Error('Leyenda ambigua o incompleta; no se inventan etiquetas.');
    meta = unique[0];
  }
  // Choose only an actual unique text identifier; never fabricate a business identifier.
  const idFields = Object.keys(data.features[0].properties).filter(key => /(?:^id$|_id$|^id_)/i.test(key) && data.features.every(f => typeof f.properties[key] === 'string' && f.properties[key].trim()) && new Set(data.features.map(f => f.properties[key])).size === data.features.length);
  if (idFields.length !== 1) throw Error('Identificador de celda ambiguo; se requiere descriptor revisado.');
  const hash = await sha256(geoText); const reference = `Referencia HTML local SHA256 ${await sha256(html)}`;
  const temporalEvidence=[...new Set(data.features.flatMap(feature=>Object.values(feature.properties).filter(value=>typeof value==='string' && /GHSL/i.test(value))))];
  return { temporalEvidence, plaza, scope, variable, name: layer.id, source: meta.source ?? 'Referencia local', methodology: meta.method ?? 'Método no documentado', formula: meta.formula ?? 'Sin fórmula adicional', legend: meta.legend.map(pair => pair[1]).join(' · '), legendEntries: meta.legend, approvalReference: reference, style: { color: meta.legend[0][0], opacity: 1, paint, reference }, inputEvidence: { sha256: hash, featureCount: data.features.length }, analysis: { reference: `Atributos originales del archivo SHA256 ${hash}; sin recalcular`, scope: 'sample', cellIdField: idFields[0], classField: field, metrics: [] }, inspection: { reference, groups: [{ label: 'Campos originales · sin recalcular', fields: [...new Set(data.features.flatMap(f => Object.keys(f.properties)))].map(key => ({ field: key, label: key, note: 'Valor original. No se infieren unidades ni se agregan valores por celda.' })) }] }, warnings: ['Referencia leída como texto/AST, sin ejecutar el HTML.', 'Correspondencia visual, no certificación del cálculo original ni de la cobertura.', 'Se conservan atributos y clases precalculados; no se suman poblaciones ni densidades.'], sessionOnly: true, publicApproved: false };
}
