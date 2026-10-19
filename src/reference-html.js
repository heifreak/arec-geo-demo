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
  const trees=[]; const layers = []; const metadata = []; const objects = []; const dynamicLayers = []; const declarations = []; const functions = new Map();
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (!match[1].trim()) continue;
    const tree = parse(match[1], { ecmaVersion: 'latest', sourceType: 'module' });
    trees.push(tree);
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
  return { trees,layers, metadata, objects, dynamicLayers, declarations, functions };
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
function uniformStyle(extracted, logicalId, fallbackMeta, allowLegendMismatch=false) {
  const metas = extracted.objects.flatMap(object => Object.entries(object).filter(([key,value]) => key === logicalId && Array.isArray(value?.legend)).map(([,value])=>value));
  const uniqueMeta=[...new Map(metas.map(meta=>[JSON.stringify(meta),meta])).values()];
  if (uniqueMeta.length>1 || !uniqueMeta.length&&!fallbackMeta) throw Error('No hay metadatos únicos para esa subcapa.');
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
        try { const color=literal(table.init)[logicalId] || (returned.argument.type==='LogicalExpression'?literal(returned.argument.right):undefined); if (typeof color==='string') colors.add(color); } catch { /* Not a literal lookup. */ }
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
  let meta=uniqueMeta[0];
  if(!meta){
    const legends=[];
    for(const fn of extracted.functions.values())walk(fn,node=>{
      if(node.type!=='ObjectExpression')return;const legend=property(node,'legend');
      if(legend?.type!=='ArrayExpression'||legend.elements.length!==1)return;
      const pair=legend.elements[0];if(pair?.type!=='ArrayExpression'||pair.elements[0]?.type!=='Identifier')return;
      try {const entries=literal(legend,{[pair.elements[0].name]:paint['fill-color']});const formula=literal(property(node,'formula'));legends.push({entries,formula});}catch{}
    });
    const defaults=[...new Map(legends.map(value=>[JSON.stringify(value),value])).values()];
    if(defaults.length!==1)throw Error('Leyenda de respaldo original ambigua o ausente.');
    meta={...fallbackMeta,legend:defaults[0].entries,formula:defaults[0].formula};
  }
  if (!meta.legend.every(pair=>Array.isArray(pair) && pair.length===2 && pair.every(value=>typeof value==='string'))) throw Error('Leyenda uniforme inválida.');
  if (!allowLegendMismatch && !meta.legend.some(pair=>pair[0]?.toLowerCase()===paint['fill-color']?.toLowerCase())) throw Error('La leyenda no corresponde al color original.');
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

/** Compile private definitions at runtime; never store this result in public assets. */
// Inert symbolic URL extraction: concatenation/templates and .toLowerCase only.
// Never invokes reference functions, fetch, DOM, arbitrary calls or JavaScript evaluation.
function documentedURLAliases(extracted){
  const bindings=Object.create(null);const aliases=[];
  function value(node,depth=0){
    if(depth>12)throw Error('URL compleja');
    if(node?.type==='Literal'&&typeof node.value==='string')return node.value;
    if(node?.type==='Identifier'){
      if(Object.hasOwn(bindings,node.name))return bindings[node.name];
      if(/^(code|codigo)$/i.test(node.name))return '{CODE}';
      throw Error('Identificador no resuelto');
    }
    if(node?.type==='TemplateLiteral')return node.quasis.map((q,i)=>q.value.cooked+(i<node.expressions.length?value(node.expressions[i],depth+1):'')).join('');
    if(node?.type==='BinaryExpression'&&node.operator==='+')return value(node.left,depth+1)+value(node.right,depth+1);
    if(node?.type==='CallExpression'&&node.arguments.length===0&&node.callee.type==='MemberExpression'&&!node.callee.computed&&node.callee.property.name==='toLowerCase')return value(node.callee.object,depth+1).replaceAll('{CODE}','{code}').toLowerCase();
    throw Error('Expresión de URL no estática');
  }
  const declarations=extracted.declarations.filter(d=>d.id?.type==='Identifier');
  for(let pass=0;pass<3;pass++)for(const d of declarations){try{const text=value(d.init);if(typeof text==='string'&&text.length<2048)bindings[d.id.name]=text;}catch{}}
  for(const tree of extracted.trees)walk(tree,node=>{
    if(node.type!=='ObjectExpression')return;
    try{const source=literal(property(node,'source'));const path=value(property(node,'url'));if(typeof source==='string'&&/^\.\.\/data\/\{CODE\}\//.test(path)&&/\.geojson$/i.test(path))aliases.push({source,path});}catch{}
  });
  return aliases;
}
export async function compileReferenceHTML(html) {
  const extracted=extractHTML(html);
  const catalogs=extracted.objects.filter(o=>Array.isArray(o.variables)&&o.variables.length===23&&o.variables.every(v=>Number.isInteger(v.id)&&Array.isArray(v.subcapas)));
  const catalog=[...new Map(catalogs.map(c=>[JSON.stringify(c),c])).values()];
  if(catalog.length!==1)throw Error('No hay un catálogo único de 23 variables en la referencia.');
  const reference=`Referencia local SHA256 ${await sha256(html)}`; const templates=[];const documentedAliases=documentedURLAliases(extracted);
  for(const variable of catalog[0].variables){
    const variableId='V'+String(variable.id).padStart(2,'0');if(/^V1[5-8]$/.test(variableId))continue;
    for(const sub of variable.subcapas){
      const paths=[...new Set(extracted.objects.flatMap(object=>{
        const value=object[sub.id];return(typeof value==='string'?[value]:Array.isArray(value)?value:[]).filter(item=>typeof item==='string'&&/\.geojson$/i.test(item));
      }))];
      const legacyPaths=[...paths];
      const template={legacyPaths,logicalId:sub.id,variable:variableId,variableName:variable.nombre,name:sub.nombre,paths,reference};
      try {
        const metaValues=extracted.objects.flatMap(object=>object[sub.id]?.legend?[object[sub.id]]:[]);
        const meta=[...new Map(metaValues.map(m=>[JSON.stringify(m),m])).values()];
        if(meta.length>1)throw Error('Metadatos o leyenda ambiguos.');
        const sets=extracted.objects.flatMap(object=>Array.isArray(object[sub.id])?[object[sub.id]]:[]).filter(ids=>ids.length&&ids.every(id=>typeof id==='string'&&extracted.layers.some(layer=>layer.id===id)));
        const unique=[...new Map(sets.map(ids=>[JSON.stringify(ids),ids])).values()];
        let paint;
        if(unique.length===1&&!meta.length)throw Error('Metadatos de estilo específico ausentes.');
        if(unique.length===1){const sources=new Set(extracted.layers.filter(layer=>unique[0].includes(layer.id)).map(layer=>layer.source));for(const alias of documentedAliases)if(sources.has(alias.source)&&!paths.includes(alias.path))paths.push(alias.path);}
        if(unique.length===1)paint=Object.assign({},...extracted.layers.filter(layer=>unique[0].includes(layer.id)).map(layer=>layer.paint));
        else if(unique.length>1)throw Error('Identificadores de pintura ambiguos.');
        else { const recovered=uniformStyle(extracted,sub.id,{source:sub.fuente??variable.fuente_base,method:JSON.stringify({geometria:sub.geometria,funcion_espacial:sub.funcion_espacial,efecto:sub.efecto})},true);paint=recovered.paint;if(!meta.length)meta.push(recovered.meta); }
        validatePaint(paint);Object.assign(template,{paint,meta:meta[0]});
        if(typeof paint['fill-color']==='string'&&!template.meta.legend.some(pair=>pair[0].toLowerCase()===paint['fill-color'].toLowerCase()))template.visualWarning='La referencia dibuja un color uniforme que no coincide con su leyenda gradual. Se conserva lo implementado, sin inventar umbrales.';
      } catch(error){template.unsupported=error.message;}
      templates.push(template);
    }
  }
  return {reference,templates,structure:catalog[0].variables.map(v=>{const id='V'+String(v.id).padStart(2,'0');return /^V1[5-8]$/.test(id)?{id,excluded:true}:{id,name:v.nombre,excluded:false};})};
}
export function matchReferencePath(path,route,bundle) {
  if(!['recognized','base-or-metadata'].includes(route.status)||!route.scope||!bundle)return [];
  const filename=path.split('/').at(-1).toLowerCase();
  return bundle.templates.filter(t=>(!route.variable||t.variable===route.variable)&&t.paths.some(pattern=>pattern.split('/').at(-1).replaceAll('{CODE}',route.plaza).replaceAll('{code}',route.plaza.toLowerCase()).toLowerCase()===filename));
}
export function descriptorForInventory(template,data,route) {
  if(!template?.paint||template.unsupported)throw Error('Simbología pendiente de referencia compatible.');
  const fields=[...new Set(data.features.flatMap(f=>Object.keys(f.properties)))];
  const ids=fields.filter(field=>/(?:cell|celda|grid).*id|id.*(?:cell|celda|grid)/i.test(field)&&data.features.every(f=>typeof f.properties[field]==='string'&&f.properties[field].trim())&&new Set(data.features.map(f=>f.properties[field])).size===data.features.length);
  const expression=template.paint['fill-color'];
  const classField=Array.isArray(expression)&&expression[0]==='match'&&expression[1]?.[0]==='get'?expression[1][1]:undefined;
  const temporalEvidence=[...new Set(data.features.flatMap(f=>Object.values(f.properties).filter(v=>typeof v==='string'&&/GHSL/i.test(v))))].slice(0,100);
  const descriptor={...(template.kind==='base'?{kind:'base',role:template.role}:{}),plaza:route.plaza,scope:route.scope,variable:template.variable,logicalId:template.logicalId,name:template.name,source:template.meta.source??'Referencia local',methodology:template.meta.method??'Método pendiente de documentación',formula:template.meta.formula??'Sin regla adicional',legendEntries:template.meta.legend,legend:template.meta.legend.map(pair=>pair[1]).join(' · '),approvalReference:template.reference,style:{color:template.meta.legend[0][0],opacity:1,paint:template.paint,reference:template.reference},inspection:{reference:template.reference,groups:Array.from({length:Math.max(1,Math.ceil(fields.length/100))},(_,i)=>({label:'Atributos originales del archivo · '+(i+1),fields:fields.slice(i*100,(i+1)*100).map(field=>({field,label:field,note:'Valor precalculado; unidades y método no se infieren del nombre.'}))}))},temporalEvidence,bulkLocal:true,warnings:[...(template.visualWarning?[template.visualWarning]:[]),'Archivo privado seleccionado por el usuario; no autorizado para publicación.','Disponibilidad de atributos no certifica su cálculo ni cobertura. Se conserva la simbología implementada en la referencia, sin nuevas clases.']};
  if(ids.length===1&&data.features.every(f=>['Polygon','MultiPolygon'].includes(f.geometry?.type)))descriptor.analysis={cellIdField:ids[0],classField,metrics:[],scope:'sample',reference:`Atributos originales · ${template.reference}; sin recalcular`};
  return descriptor;
}
