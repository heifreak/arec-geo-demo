// Technical reference overlays, not analytical classes or recovered V15 symbols.
export function baseTemplate(entry,{color='#58b3cc'}={}){
  if(!entry.base||entry.kind!=='geojson'||entry.status==='internal-excluded')return null;
  if(!/^#[0-9a-f]{6}$/i.test(color))throw Error('Color técnico BASE inválido.');
  const name=entry.path.split('/').at(-1).replace(/\.(geojson|json)$/i,'');
  let role='reference',label='Geometría de referencia · rol pendiente';
  if(/(?:^|_)(grid|malla|cuadricula)(?:_|$)/i.test(name)){role='grid';label='Malla territorial · dimensiones no certificadas';}
  else if(/ageb/i.test(name)){role='ageb';label='AGEB · ámbito del archivo';}
  else if(/municipio.*central/i.test(name)){role='municipalities';label='Municipio central · no equivale a metrópoli';}
  else if(/municip/i.test(name)){role='municipalities';label='Municipios · no equivale a ciudad';}
  else if(/localidad/i.test(name)){role='localities';label='Localidades';}
  else if(/(?:metropol|metro).*oficial/i.test(name)){role='boundaries';label='Delimitación metropolitana declarada oficial · fuente por verificar';}
  else if(/ambito|extent|extension|limite|metropol/i.test(name)){role='extent';label='Ámbito o extensión de referencia · no equivale a delimitación oficial';}
  return {kind:'base',role,logicalId:'base:'+entry.path,variable:'BASE',variableName:'Capas BASE · simbología técnica',name:label,paths:[entry.path],reference:'Simbología técnica configurable; no es simbología analítica V15',paint:{'fill-color':color,'fill-opacity':0.12,'line-color':color,'line-width':1,'circle-color':color,'circle-radius':4},meta:{source:'Archivo BASE local seleccionado',method:'Superposición de referencia; rol sugerido por ruta/nombre, sin certificar escala, oficialidad ni categorías.',formula:'Sin cálculo ni clasificación',legend:[[color,'Referencia técnica BASE · sin categorías analíticas']]}};
}
export function auxiliaryHint(entry){
  const filename=entry.path.split('/').at(-1);const declared=Object.entries(entry.fields??{}).filter(([field])=>/^(fuente|source|source_name|fuente_datos)$/i.test(field)).flatMap(([,stats])=>(stats.categoryCounts??[]).map(pair=>pair[0])).filter(v=>typeof v==='string').join(' ');
  const name=filename+' '+(entry.rootName??'')+' '+declared;const evidence=declared?'source-attribute-or-name':'filename-only';
  if(/sniiv/i.test(name))return {family:'SNIIV',evidence,status:'pending-definition',reason:'Fuente auxiliar sugerida por el nombre; falta relación documental única entre archivo, subcapa y métricas. No se vincula por similitud.'};
  if(/(?:^|[_-])(rnc)(?:[_\-.]|$)|red.*nacional.*caminos/i.test(name))return {family:'RNC',evidence,status:'pending-definition',reason:'Fuente vial auxiliar sugerida por el nombre; falta definición del subconjunto y correspondencia documental. No equivale automáticamente a vías primarias.'};
  return null;
}
