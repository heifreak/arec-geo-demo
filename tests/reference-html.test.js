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
