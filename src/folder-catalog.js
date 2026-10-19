import {PLAZAS} from './plazas.js';
import {matchReferencePath} from './reference-html.js';
const internal=e=>e.status==='internal-excluded'||/^V1[5-8]$/.test(e.variable??'');
function styleFields(value,result=new Set()){
  if(!Array.isArray(value))return result;
  if(value[0]==='literal')return result;
  if(value[0]==='get')result.add(value[1]);
  else for(const item of value.slice(1))styleFields(item,result);
  return result;
}
export function buildFolderCatalog(entries,reference,{complete=false,totalFiles=entries.length,match=e=>matchReferencePath(e.path,e,reference),runtime=new Map(),styleChecks=new Map(),requireStyleValidation=false}={}){
  const layers=entries.map(e=>{
    const excluded=internal(e);const candidates=excluded?[]:match(e);const template=candidates.length===1?candidates[0]:null;
    const issues=[];
    if(excluded)issues.push('Contenido interno excluido; no leído ni activable.');
    else {
      if(e.kind==='error'||!e.renderable)issues.push(e.reason??'Archivo no representable.');
      if(!e.plaza||!e.scope)issues.push('Plaza o ámbito sin reconocer.');
      if(!reference)issues.push('Referencia local pendiente.');
      else if(!candidates.length)issues.push('Sin correspondencia con la referencia.');
      else if(candidates.length>1)issues.push('Correspondencia ambigua.');
      if(template?.unsupported)issues.push(template.unsupported);
      if(template?.visualWarning)issues.push(template.visualWarning);
    }
    const referencedFields=[...new Set(Object.values(template?.paint??{}).flatMap(expression=>[...styleFields(expression)]))];
    const absentStyleFields=referencedFields.filter(field=>!e.fields?.[field]);
    const incompleteStyleFields=referencedFields.filter(field=>e.fields?.[field]&&(e.fields[field].missing>0||e.fields[field].nulls>0));
    if(absentStyleFields.length)issues.push('Campos de estilo ausentes; revisar valores de respaldo de la referencia.');
    if(incompleteStyleFields.length)issues.push('Campos de estilo con valores nulos o faltantes.');
    const geometryNames=Object.keys(e.geometries??{});
    const geometryStyleCompatible=geometryNames.length>0&&geometryNames.every(type=>/Polygon/.test(type)?Boolean(template?.paint?.['fill-color']||template?.paint?.['line-color']):/LineString/.test(type)?Boolean(template?.paint?.['line-color']):/Point/.test(type)?Boolean(template?.paint?.['circle-color']):false);
    if(e.kind==='geojson'&&template?.paint&&!geometryStyleCompatible)issues.push('La pintura original no cubre todas las geometrías recibidas.');
    const candidate=!excluded&&Boolean(e.renderable&&e.plaza&&e.scope&&template?.paint&&!template.unsupported&&geometryStyleCompatible);
    const styleValidation=styleChecks.get(e.path)??{status:'not-tested'};
    if(styleValidation.status==='failed')issues.push('Evaluación de simbología fallida: '+styleValidation.reason);
    const activatable=candidate&&(!requireStyleValidation||styleValidation.status==='passed');
    return {path:e.path,plaza:e.plaza??null,scope:e.scope??null,variable:template?.variable??e.variable??null,logicalId:template?.logicalId??null,name:template?.name??null,variableName:template?.variableName??null,size:e.size??0,kind:e.kind??null,crs:e.crs??null,rootFields:e.rootFields??null,excluded,entities:e.count??null,geometries:e.geometries??{},fields:e.fields?Object.fromEntries(Object.entries(e.fields).map(([k,s])=>[k,{types:s.types,present:s.present,nulls:s.nulls,missing:s.missing}])):null,candidate,styleValidation,mapping:excluded?'excluded':!reference?'pending':candidates.length===1?'unique':candidates.length?'ambiguous':'unmatched',candidates:candidates.map(t=>t.logicalId),activatable,absentStyleFields,incompleteStyleFields,issues,visualization:runtime.get(e.path)??{status:'not-tested'},analysisCertification:'not-certified'};
  });
  const contexts=[];
  for(const [plaza,[name]] of Object.entries(PLAZAS))for(const scope of ['city','metro_analysis']){
    const rows=layers.filter(e=>e.plaza===plaza&&e.scope===scope),eligible=rows.filter(e=>!e.excluded);
    const mapped=eligible.filter(e=>e.mapping==='unique');const present=new Set(mapped.map(e=>e.logicalId));
    const referencedNotFound=reference?reference.templates.filter(t=>!/^V1[5-8]$/.test(t.variable)&&!present.has(t.logicalId)).map(t=>({variable:t.variable,logicalId:t.logicalId,name:t.name,hasOriginalRoute:Boolean(t.paths.length)})):null;
    contexts.push({plaza,name,scope,files:rows.length,bytes:rows.reduce((n,e)=>n+e.size,0),excluded:rows.filter(e=>e.excluded).length,geographicFiles:eligible.filter(e=>e.kind==='geojson').length,entities:eligible.reduce((n,e)=>n+(e.entities??0),0),geometries:eligible.reduce((out,e)=>{for(const [k,n]of Object.entries(e.geometries))out[k]=(out[k]??0)+n;return out;},{}),variables:[...new Set(eligible.map(e=>e.variable).filter(Boolean))].sort(),mappedSublayers:[...present].sort(),availableSublayers:[...new Set(eligible.filter(e=>e.activatable).map(e=>e.logicalId))].sort(),activatableFiles:eligible.filter(e=>e.activatable).length,styleValidationPassed:eligible.filter(e=>e.styleValidation.status==='passed').length,styleValidationFailed:eligible.filter(e=>e.styleValidation.status==='failed').length,errors:eligible.filter(e=>e.kind==='error').length,ambiguous:eligible.filter(e=>e.mapping==='ambiguous').length,unmatched:eligible.filter(e=>e.mapping==='unmatched').length,filesWithMissingStyleFields:eligible.filter(e=>e.absentStyleFields.length||e.incompleteStyleFields.length).length,visualizationChecked:eligible.filter(e=>e.visualization.status==='rendered').length,visualizationErrors:eligible.filter(e=>e.visualization.status==='error').length,referencedNotFound,analysisCertification:'not-certified'});
  }
  return {version:1,inventory:{complete,totalFiles,processedFiles:entries.length,unprocessedFiles:Math.max(0,totalFiles-entries.length)},reference:reference?.reference??null,notes:['Informe privado generado localmente; no enviar ni publicar sin autorización.','Los conteos de entidades son por archivo: no representan celdas territoriales únicas entre capas.','Subcapas de referencia no encontradas no equivalen a datos obligatorios faltantes: no se dispone de una matriz de cobertura exigible.','Visualización rendered indica carga y simbología aplicadas en Cesium; su revisión visual humana permanece pendiente.',
'La comprobación técnica por lotes no certifica metodología, cobertura territorial ni corrección visual de capas que no se han dibujado.'],totals:{files:layers.length,activatableFiles:layers.filter(e=>e.activatable).length,excluded:layers.filter(e=>e.excluded).length,styleValidationFailed:layers.filter(e=>e.styleValidation.status==='failed').length,errors:layers.filter(e=>e.kind==='error').length,ambiguous:layers.filter(e=>e.mapping==='ambiguous').length,unmatched:layers.filter(e=>e.mapping==='unmatched').length,withoutContext:layers.filter(e=>!e.plaza||!e.scope).length},contexts,layers};
}
