import {inspectFile,MAX_SCAN_BYTES} from './folder-inventory.js';
export const WINDOW_LIMIT=5000,WINDOW_BYTES=8*1024*1024;
export async function readPointWindow(file,bounds,{signal,onBytes,limit=WINDOW_LIMIT,maxBytes=WINDOW_BYTES}={}){
  if(!Array.isArray(bounds)||bounds.length!==4||bounds.some(n=>!Number.isFinite(n))||Math.abs(bounds[0])>180||Math.abs(bounds[2])>180||bounds[1]<-90||bounds[3]>90||bounds[1]>bounds[3])throw Error('Ventana geográfica WGS84 inválida.');
  if(!Number.isInteger(limit)||limit<1||limit>WINDOW_LIMIT||!Number.isFinite(maxBytes)||maxBytes<=0||maxBytes>WINDOW_BYTES)throw Error('Presupuesto de ventana inválido.');
  if(file.size>MAX_SCAN_BYTES)throw Error('Supera 128 MiB: requiere partición externa, sin aumentar límites.');
  const features=[];let matched=0,bytes=0;const encoder=new TextEncoder();
  const summary=await inspectFile(file,{signal,onBytes,onFeature:feature=>{
    if(feature.geometry?.type!=='Point')throw Error('El modo progresivo solo admite Point; no recorta ni transforma otras geometrías.');
    const [lon,lat]=feature.geometry.coordinates;const [west,south,east,north]=bounds;
    if(lat<south||lat>north||!(west<=east?lon>=west&&lon<=east:lon>=west||lon<=east))return;
    matched++;
    if(features.length>=limit)return;
    const size=encoder.encode(JSON.stringify(feature)).byteLength;
    if(bytes+size>maxBytes)return;
    bytes+=size;features.push(feature);
  }});
  if(!summary.structurallyCompatible)throw Error(summary.reason);
  return {data:{type:'FeatureCollection',features},window:{bounds,sourceFeatures:summary.count,matched,selected:features.length,selectedBytes:bytes,truncated:matched>features.length,limit,maxBytes,method:'Selección en orden original dentro de la vista; sin clustering, simplificación ni alteración de atributos.'}};
}
