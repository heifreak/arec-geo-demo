import { JSONParser, TokenType } from '@streamparser/json';
import { PLAZAS } from './plazas.js';
import { validateSessionGeoJSON } from './session-data.js';
export const MAX_SCAN_BYTES=128*1024*1024;
export const MAX_RENDER_BYTES=25*1024*1024;
export function classifyPath(path) {
  if(typeof path!=='string'||path.includes('\\')||path.split('/').some(p=>['..','.',''].includes(p))) return {status:'unsafe-path'};
  const parts=path.split('/'); const root=parts.findIndex(p=>p.toLowerCase()==='data');
  if(root<0||root===parts.length-1)return {status:'unrecognized'};
  const relative=parts.slice(root+1); const plaza=relative[0]?.toUpperCase();
  if(!Object.hasOwn(PLAZAS,plaza))return {status:'unknown-plaza'};
  let scope=relative[1]==='evidence'?'city':relative[1]==='evidence_metro'?'metro_analysis':null;
  const base=['base','base_metro'].includes(relative[2]);
  if(relative[2]==='base_metro')scope='metro_analysis';
  const variable=relative.find(p=>/^V(?:0[1-9]|1[0-9]|2[0-3])$/i.test(p))?.toUpperCase();
  const blocked=variable&&/^V1[5-8]$/.test(variable);
  return {plaza,scope,variable,base,storageScope:relative[1],relative:relative.join('/'),status:blocked?'internal-excluded':!scope?'unrecognized-scope':!variable?'base-or-metadata':'recognized'};
}
export async function inspectFile(file,{signal,onBytes=()=>{},collect=false,onFeature=()=>{}}={}) {
  if(file.size>MAX_SCAN_BYTES) return {kind:'size-limit',renderable:false,reason:'Supera el límite de inventario por archivo (128 MiB); campos no leídos.'};
  let count=0,type,crs; const fields=Object.create(null),geometries=Object.create(null); const features=collect?[]:null;
  let coordinateError=false,unsafeNumbers=false; let rootName;
  const parser=new JSONParser({paths:['$.features.*','$.type','$.crs','$.name'],keepStack:false,stringBufferSize:65536});
  const frames=[];const rootFields=[];let featureArray=false;
  parser.onToken=({token,value})=>{
    const frame=frames.at(-1);let keyToken=false;
    if(token===TokenType.STRING&&frame?.object&&frame.expectKey){
      keyToken=true;if(value==='__proto__')throw Error('Clave JSON __proto__ no compatible con este lector; no se descartan atributos silenciosamente.');
      if(frame.keys.has(value))throw Error('Claves JSON duplicadas; no se combinan ni sobrescriben resultados.');
      frame.keys.add(value);frame.key=value;frame.expectKey=false;if(frames.length===1)rootFields.push(value);
    }
    if(!keyToken&&frames.length===1&&frame?.key==='features'&&token===TokenType.LEFT_BRACKET)featureArray=true;
    if(token===TokenType.NUMBER&&(!Number.isFinite(value)||Number.isInteger(value)&&!Number.isSafeInteger(value)))unsafeNumbers=true;
    if(token===TokenType.LEFT_BRACE)frames.push({object:true,expectKey:true,keys:new Set()});
    if(token===TokenType.LEFT_BRACKET)frames.push({object:false});
    if(token===TokenType.RIGHT_BRACE||token===TokenType.RIGHT_BRACKET)frames.pop();
    if(token===TokenType.COMMA&&frame?.object){frame.expectKey=true;frame.key=null;}
  };
  parser.onValue=({value,key,stack,parent})=>{
    if(stack.length===1) {if(key==='type')type=value;if(key==='crs')crs=value;if(key==='name')rootName=value;return;}
    if(stack.length!==2||stack[1].key!=='features')return;
    if(!Array.isArray(parent))throw Error('features debe ser un array.');
    if(++count>50000&&collect)throw Error('Más de 50 000 entidades: el inventario está disponible, la representación requiere particionar la capa.');
    try {validateSessionGeoJSON({type:'FeatureCollection',features:[value]});} catch {coordinateError=true;}
    const geometry=value?.geometry?.type??'null';geometries[geometry]=(geometries[geometry]??0)+1;
    for(const [field,attribute] of Object.entries(value?.properties??{})) {
      const stats=fields[field]??={present:0,nulls:0,types:[],categoryCounts:[]}; stats.present++;
      const kind=attribute===null?'null':Array.isArray(attribute)?'array':typeof attribute;
      if(attribute!==null&&stats.categoryCounts){
        if(!['string','number','boolean'].includes(typeof attribute)||typeof attribute==='string'&&attribute.length>200)stats.categoryCounts=null;
        else {const bucket=stats.categoryCounts.find(pair=>typeof pair[0]===typeof attribute&&pair[0]===attribute);if(bucket)bucket[1]++;else if(stats.categoryCounts.length<32)stats.categoryCounts.push([attribute,1]);else stats.categoryCounts=null;}
      }
      if(!stats.types.includes(kind))stats.types.push(kind);if(attribute===null)stats.nulls++;
      if(typeof attribute==='number'&&(!Number.isFinite(attribute)||Number.isInteger(attribute)&&!Number.isSafeInteger(attribute)))unsafeNumbers=true;
    }
    onFeature(value);
    if(collect)features.push(value);
  };
  const reader=file.stream().getReader();const decoder=new TextDecoder('utf-8',{fatal:true});let bytes=0;
  try {
    while(true){signal?.throwIfAborted();const {value,done}=await reader.read();if(done)break;const text=decoder.decode(value,{stream:true});if(text)parser.write(text);bytes+=value.byteLength;onBytes(bytes);}
    const tail=decoder.decode();if(tail)parser.write(tail);
    if(!parser.isEnded)parser.end();signal?.throwIfAborted();
  } catch(error){await reader.cancel().catch(()=>{});throw error;} finally{reader.releaseLock();}
  if(type!=='FeatureCollection')return {kind:'metadata-json',renderable:false,rootFields,reason:'JSON de metadatos; no es una capa FeatureCollection.'};
  if(!featureArray)throw Error('FeatureCollection sin array features.');
  const validCRS=!crs||['EPSG:4326','urn:ogc:def:crs:OGC:1.3:CRS84','urn:ogc:def:crs:EPSG::4326'].includes(crs?.properties?.name);
  for(const stats of Object.values(fields))stats.missing=count-stats.present;
  const structurallyCompatible=!coordinateError&&validCRS&&!unsafeNumbers&&count>0;
  const progressiveEligible=structurallyCompatible&&Object.keys(geometries).every(type=>type==='Point')&&(file.size>MAX_RENDER_BYTES||count>50000);
  const renderable=structurallyCompatible&&file.size<=MAX_RENDER_BYTES&&count<=50000;
  const summary={kind:'geojson',count,fields,geometries,crs:crs?.properties?.name??'WGS84 requerido por GeoJSON',rootName,structurallyCompatible,progressiveEligible,renderable,reason:!validCRS?'CRS no compatible; no se reproyecta silenciosamente.':coordinateError?'Geometrías o coordenadas no compatibles.':unsafeNumbers?'Números no representables exactamente: revisión requerida.':file.size>MAX_RENDER_BYTES?'Representación limitada a 25 MiB; inventario disponible.':count>50000?'Representación limitada a 50 000 entidades; inventario disponible.':count===0?'Archivo vacío.':'Atributos disponibles; análisis no certificado.'};
  if(collect){if(!renderable)throw Error(summary.reason);summary.data={type:'FeatureCollection',features,...(crs?{crs}:{})};}
  return summary;
}
