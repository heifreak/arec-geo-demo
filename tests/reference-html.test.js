import test from 'node:test';
import assert from 'node:assert/strict';
import { descriptorFromHTML } from '../src/reference-html.js';
const paint = {'fill-color':['match',['get','test_class'],'X','#123456','Y','#abcdef','#999999'],'fill-opacity':0.45};
const layer = {id:'synthetic-layer',source:'synthetic-source',type:'fill',paint};
const meta = {source:'Synthetic source',method:'Synthetic method',formula:'No calculation',legend:[['#123456','Synthetic X'],['#abcdef','Synthetic Y']]};
const html = `<script>globalThis.__referenceExecuted=true; const meta=${JSON.stringify(meta)}; map.addLayer(${JSON.stringify(layer)}); map.addLayer(${JSON.stringify({id:'synthetic-line',source:'synthetic-source',type:'line',paint:{'line-color':'#ffffff','line-width':1}})});</script>`;
const data = {type:'FeatureCollection',features:[{type:'Feature',properties:{test_id:'a',test_class:'X',test_null:null,test_false:false},geometry:{type:'Polygon',coordinates:[[[0,0],[.001,0],[.001,.001],[0,0]]]}}]};
const context={plaza:'JRZ',scope:'metro_analysis',variable:'V14'};
test('extrae pintura y leyenda literales sin ejecutar el HTML ni recalcular campos',async()=>{
 const descriptor=await descriptorFromHTML(html,JSON.stringify(data),context);
 assert.equal(globalThis.__referenceExecuted,undefined);
 assert.deepEqual(JSON.parse(JSON.stringify(descriptor.style.paint)),{...paint,'line-color':'#ffffff','line-width':1});
 assert.deepEqual(descriptor.legendEntries.map(p=>[...p]),meta.legend);
 assert.equal(descriptor.analysis.cellIdField,'test_id'); assert.equal(descriptor.analysis.classField,'test_class');
 assert.equal(descriptor.publicApproved,false); assert.equal(descriptor.inputEvidence.featureCount,1);
});
test('rechaza clases desconocidas, ambigüedad de capas y leyenda incompleta',async()=>{
 const invalid=structuredClone(data);invalid.features[0].properties.test_class='UNKNOWN';
 await assert.rejects(descriptorFromHTML(html,JSON.stringify(invalid),context),/única/);
 await assert.rejects(descriptorFromHTML(html+`<script>map.addLayer(${JSON.stringify({...layer,id:'another'})})</script>`,JSON.stringify(data),context),/única/);
 await assert.rejects(descriptorFromHTML(html.replace('#abcdef","Synthetic Y','#000000","Synthetic Y'),JSON.stringify(data),context),/Leyenda/);
});
test('no evalúa llamadas dinámicas para conseguir una pintura',async()=>{
 const dynamic='<script>map.addLayer(secretFunction());</script>';
 await assert.rejects(descriptorFromHTML(dynamic,JSON.stringify(data),context),/única/);
});
const uniformHTML=`<script>
const registry={variables:[{id:1,subcapas:[{id:'synthetic_uniform',nombre:'Synthetic uniform'}]}]};
const methods={synthetic_uniform:${JSON.stringify(meta)}};
function colorFor(id){const colors={synthetic_uniform:'#123456'};return colors[id]||'#000000';}
function loadLayer(id){const c=colorFor(id);
map.addLayer({id:'fill',source:'uniform',type:'fill',paint:{'fill-color':c,'fill-opacity':0.4}});
map.addLayer({id:'line',source:'uniform',type:'line',paint:{'line-color':c,'line-width':1}});}
globalThis.__uniformExecuted=true;</script>`;
test('recupera constructor uniforme literal y procedencia sin ejecutar funciones',async()=>{
 const sample=structuredClone(data);sample.features[0].properties.test_temporal='GHSL synthetic estimated epoch';
 const d=await descriptorFromHTML(uniformHTML,JSON.stringify(sample),{...context,variable:'V01',logicalId:'synthetic_uniform'});
 assert.equal(d.style.paint['fill-color'],'#123456');assert.equal(d.style.paint['line-width'],1);
 assert.equal(globalThis.__uniformExecuted,undefined);assert.equal(d.analysis.classField,undefined);
 assert.deepEqual(d.temporalEvidence,['GHSL synthetic estimated epoch']);
});
test('rechaza lookup con efectos y pinturas uniformes contradictorias',async()=>{
 await assert.rejects(descriptorFromHTML(uniformHTML.replace("return colors[id]", "danger();return colors[id]"),JSON.stringify(data),{...context,variable:'V01',logicalId:'synthetic_uniform'}));
 const conflicting=uniformHTML.replace("'line-width':1", "'line-width':1").replace("globalThis.__uniformExecuted=true;", "function another(id){const c=colorFor(id);map.addLayer({id:'other',source:'uniform',type:'fill',paint:{'fill-color':c,'fill-opacity':0.9}});}");
 await assert.rejects(descriptorFromHTML(conflicting,JSON.stringify(data),{...context,variable:'V01',logicalId:'synthetic_uniform'}),/contradictorias/);
});

test('compila catálogo privado sin incluir variables internas y vincula nombres originales de archivo',async()=>{
 const {compileReferenceHTML,matchReferencePath,descriptorForInventory}=await import('../src/reference-html.js');
 const {classifyPath}=await import('../src/folder-inventory.js');
 const variables=Array.from({length:23},(_,i)=>({id:i+1,nombre:'Synthetic '+(i+1),subcapas:i===0?[{id:'synthetic_uniform',nombre:'Synthetic original name'}]:[]}));
 const catalog=uniformHTML.replace('const registry={variables:[{id:1,subcapas:[{id:\'synthetic_uniform\',nombre:\'Synthetic uniform\'}]}]};',`const registry=${JSON.stringify({variables})};const routes={synthetic_uniform:'../data/{CODE}/evidence/V01/actual_name_{code}.geojson'};`);
 const compiled=await compileReferenceHTML(catalog);assert.equal(compiled.templates.length,1);assert.equal(compiled.templates[0].name,'Synthetic original name');
 const path='data/JRZ/evidence_metro/V01/actual_name_jrz.geojson';const matches=matchReferencePath(path,classifyPath(path),compiled);assert.equal(matches.length,1);
 assert.equal(matchReferencePath('data/JRZ/evidence/V02/actual_name_jrz.geojson',classifyPath('data/JRZ/evidence/V02/actual_name_jrz.geojson'),compiled).length,0);
 const descriptor=descriptorForInventory(matches[0],data,{plaza:'JRZ',scope:'metro_analysis'});assert.equal(descriptor.bulkLocal,true);assert.equal(descriptor.analysis,undefined,'Un ID genérico no certifica que sea una malla de celdas');
});
test('recovers only documented dynamic URL aliases through exact original source IDs',async()=>{
 const {compileReferenceHTML,matchReferencePath}=await import('../src/reference-html.js');const {classifyPath}=await import('../src/folder-inventory.js');
 const variables=Array.from({length:23},(_,i)=>({id:i+1,nombre:'Synthetic',subcapas:i===13?[{id:'synthetic_water',nombre:'Synthetic water'}]:[]}));
 const text=html+`<script>const catalog=${JSON.stringify({variables})};const methods={synthetic_water:${JSON.stringify(meta)}};const ids={synthetic_water:['synthetic-layer','synthetic-line']};const routes={synthetic_water:'../data/{CODE}/evidence/V14/old_{code}.geojson'};const codigoMinuscula=codigo.toLowerCase();const base=\`../data/\${codigo}\`;const sources={extra:{source:'synthetic-source',url:base+'/evidence/V14/'+'water_'+codigoMinuscula+'_v02.geojson'}};globalThis.__aliasExecuted=true;</script>`;
 const compiled=await compileReferenceHTML(text);assert.equal(compiled.templates[0].paths.length,2);assert.equal(compiled.templates[0].legacyPaths.length,1);const path='data/MTY/evidence_metro/V14/water_mty_v02.geojson';assert.equal(matchReferencePath(path,classifyPath(path),compiled).length,1);assert.equal(globalThis.__aliasExecuted,undefined);
});
test('inventory descriptors retain more than 100 original fields in bounded inspector groups',async()=>{
 const {descriptorForInventory}=await import('../src/reference-html.js');const {validateInspection}=await import('../src/cell-inspector.js');
 const properties=Object.fromEntries(Array.from({length:230},(_,i)=>['synthetic_'+i,i===0?null:i]));const original={type:'FeatureCollection',features:[{...data.features[0],properties}]};const descriptor=descriptorForInventory({variable:'V01',logicalId:'synthetic',name:'Synthetic',reference:'synthetic',paint:{'fill-color':'#123456'},meta},{...original},{plaza:'JRZ',scope:'city'});
 assert.equal(descriptor.inspection.groups.length,3);assert.equal(descriptor.inspection.groups.flatMap(g=>g.fields).length,230);validateInspection(descriptor.inspection);assert.equal(original.features[0].properties.synthetic_0,null);
});
