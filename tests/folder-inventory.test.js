import test from 'node:test';import assert from 'node:assert/strict';
import {classifyPath,inspectFile,MAX_SCAN_BYTES,MAX_RENDER_BYTES}from'../src/folder-inventory.js';
import {PLAZAS}from'../src/plazas.js';
const feature=(properties={})=>({type:'Feature',properties,geometry:{type:'Point',coordinates:[0,0]}});
const collection=features=>({type:'FeatureCollection',features});
const file=object=>new Blob([JSON.stringify(object)]);
test('reconoce las 18 plazas, ámbitos y variables, excluye internas y rutas inseguras',()=>{
 for(const plaza of Object.keys(PLAZAS)){const a=classifyPath(`data/${plaza}/evidence/V01/test.geojson`);assert.equal(a.plaza,plaza);assert.equal(a.scope,'city');assert.equal(a.status,'recognized');}
 assert.equal(classifyPath('outer/data/JRZ/evidence_metro/V20/test.json').scope,'metro_analysis');
 for(const id of ['V15','V16','V17','V18'])assert.equal(classifyPath(`data/JRZ/evidence/${id}/private.geojson`).status,'internal-excluded');
 assert.equal(classifyPath('data/DEL/evidence/V01/test.json').status,'unknown-plaza');
 for(const path of ['data/../JRZ/test.json','data//JRZ/test.json','data\\JRZ\\test.json'])assert.equal(classifyPath(path).status,'unsafe-path');
 assert.equal(classifyPath('data/JRZ/evidence/base/grid.json').status,'base-or-metadata');
});
test('inventario conserva tipos, faltantes y originales, sin retener geometrías al inventariar',async()=>{
 const original=collection([feature({a:0,b:null,flag:false}),feature({a:2,unicode:'México'})]);
 const result=await inspectFile(file(original));assert.equal(result.count,2);assert.equal(result.data,undefined);
 assert.equal(result.fields.b.nulls,1);assert.equal(result.fields.b.missing,1);assert.deepEqual(result.fields.flag.types,['boolean']);assert.equal(result.geometries.Point,2);
 assert.deepEqual((await inspectFile(file(original),{collect:true})).data,original);
});
test('lee JSON en bloques, incluidos UTF8 y claves escapadas, y permite cancelación',async()=>{
 const bytes=new TextEncoder().encode(JSON.stringify(collection([feature({name:'Juárez 漢字'})])));let at=0,canceled=false;
 const stream=()=>new ReadableStream({pull(c){if(at===bytes.length)c.close();else{c.enqueue(bytes.slice(at,at+7));at=Math.min(at+7,bytes.length);}},cancel(){canceled=true;}});
 const f={size:bytes.length,stream};const result=await inspectFile(f,{collect:true});assert.equal(result.data.features[0].properties.name,'Juárez 漢字');
 at=0;const controller=new AbortController();await assert.rejects(inspectFile(f,{signal:controller.signal,onBytes:()=>controller.abort()}),{name:'AbortError'});assert.equal(canceled,true);
});
test('distingue JSON auxiliar, errores de sintaxis, CRS y límites de representación',async()=>{
 assert.deepEqual((await inspectFile(file({metadata:1,config:{a:2}}))).rootFields,['metadata','config']);
 await assert.rejects(inspectFile(new Blob(['{"type":"FeatureCollection"}'])));
 await assert.rejects(inspectFile(new Blob(['{"features": [invalid}'])));
 const invalid={...collection([feature()]),crs:{properties:{name:'EPSG:3857'}}};assert.equal((await inspectFile(file(invalid))).renderable,false);
 const tooLarge={size:MAX_SCAN_BYTES+1,stream(){throw Error('must not read');}};assert.equal((await inspectFile(tooLarge)).kind,'size-limit');
 const f=file(collection([feature()]));assert.equal((await inspectFile({size:MAX_RENDER_BYTES+1,stream:()=>f.stream()})).renderable,false);
});
test('no pierde atributos especiales, no acepta claves duplicadas ni números no seguros',async()=>{
 for(const text of ['{"type":"FeatureCollection","features":[],"features":[]}','{"__proto__":1}'])await assert.rejects(inspectFile(new Blob([text])));
 const f=file(collection([feature({large:2**54})]));assert.equal((await inspectFile(f)).renderable,false);await assert.rejects(inspectFile(f,{collect:true}));
 assert.equal({}.polluted,undefined);
});
test('admite BOM UTF8 sin alterar atributos y rechaza bytes UTF8 inválidos',async()=>{
 const sample=collection([feature({text:'México'})]);const blob=new Blob([new Uint8Array([239,187,191]),JSON.stringify(sample)]);
 assert.deepEqual((await inspectFile(blob,{collect:true})).data,sample);
 await assert.rejects(inspectFile(new Blob([new Uint8Array([255])])));
});
