import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFolderCatalog} from '../src/folder-catalog.js';
import {PLAZAS} from '../src/plazas.js';
const template={logicalId:'synthetic',variable:'V01',variableName:'Synthetic variable',name:'Synthetic sublayer',paths:['data/{CODE}/evidence/V01/test_{code}.geojson'],paint:{'fill-color':['match',['get','category'],'X','#123456','#ffffff']},meta:{legend:[['#123456','Synthetic']]}};
const reference={reference:'synthetic-reference',templates:[template]};
const row=(plaza='JRZ',scope='city')=>({path:`data/${plaza}/${scope==='city'?'evidence':'evidence_metro'}/V01/test_${plaza.toLowerCase()}.geojson`,plaza,scope,variable:'V01',status:'recognized',kind:'geojson',renderable:true,count:2,size:123,geometries:{Polygon:2},fields:{category:{types:['string'],present:2,nulls:0,missing:0,categoryCounts:[['X',2]]}}});
test('one global engine binds all 18 plazas and both scopes without altering the input',()=>{
 const entries=Object.keys(PLAZAS).flatMap(p=>[row(p),row(p,'metro_analysis')]);const before=JSON.stringify(entries);const r=buildFolderCatalog(entries,reference,{complete:true});
 assert.equal(r.contexts.length,36);assert.equal(r.totals.activatableFiles,36);assert.equal(r.layers.length,36);
 for(const c of r.contexts){assert.equal(c.activatableFiles,1);assert.deepEqual(c.availableSublayers,['synthetic']);assert.equal(c.entities,2);assert.equal(c.analysisCertification,'not-certified');assert.equal(c.visualizationChecked,0);}
 assert.equal(JSON.stringify(entries),before);assert.ok(!JSON.stringify(r.layers).includes('categoryCounts'));
});
test('diagnoses ambiguity, broken JSON, missing contexts, internal data and missing reference independently',()=>{
 const entries=[row(),{...row('MTY'),kind:'error',renderable:false,reason:'Invalid JSON'},{...row('TOR'),status:'internal-excluded',variable:'V15',kind:'excluded',renderable:false},{path:'data/unknown.json',kind:'metadata-json'}];
 const r=buildFolderCatalog(entries,{...reference,templates:[template,{...template,logicalId:'duplicate'}]},{totalFiles:9});
 assert.equal(r.totals.errors,1);assert.equal(r.totals.excluded,1);assert.equal(r.totals.ambiguous,2);assert.equal(r.totals.withoutContext,1);assert.equal(r.totals.activatableFiles,0);assert.equal(r.inventory.unprocessedFiles,5);assert.equal(r.inventory.complete,false);assert.equal(r.layers[2].mapping,'excluded');
 const pending=buildFolderCatalog([row()],null);assert.equal(pending.layers[0].mapping,'pending');assert.equal(pending.contexts[0].referencedNotFound,null);
});
test('reports missing fields and geometry incompatibility without inventing replacement styles',()=>{
 const missing={...row(),fields:{},geometries:{Point:2}};const r=buildFolderCatalog([missing],reference);
 assert.deepEqual(r.layers[0].absentStyleFields,['category']);assert.equal(r.layers[0].activatable,false);assert.equal(r.contexts[0].filesWithMissingStyleFields,1);
 const absent=r.contexts.find(c=>c.plaza==='MTY'&&c.scope==='city');assert.equal(absent.referencedNotFound.length,1);assert.equal(absent.files,0);
 assert.match(r.notes.join(' '),/no equivalen a datos obligatorios/);
});
test('visual success or failure is recorded separately from data availability and certification',()=>{
 const e=row();const runtime=new Map([[e.path,{status:'error',reason:'GPU unavailable'}]]);const r=buildFolderCatalog([e],reference,{runtime});assert.equal(r.layers[0].activatable,true);assert.equal(r.contexts[0].visualizationErrors,1);assert.equal(r.contexts[0].analysisCertification,'not-certified');
 runtime.set(e.path,{status:'rendered'});assert.equal(buildFolderCatalog([e],reference,{runtime}).contexts[0].visualizationChecked,1);
});
test('style checks gate activation independently and failed files remain diagnosed',()=>{
 const e=row(),styleChecks=new Map();assert.equal(buildFolderCatalog([e],reference,{styleChecks,requireStyleValidation:true}).layers[0].activatable,false);
 styleChecks.set(e.path,{status:'failed',checked:2,failed:1,reason:'Invalid numeric input'});
 const failed=buildFolderCatalog([e],reference,{styleChecks,requireStyleValidation:true});assert.equal(failed.layers[0].candidate,true);assert.equal(failed.layers[0].activatable,false);assert.equal(failed.contexts[0].styleValidationFailed,1);
 styleChecks.set(e.path,{status:'passed',checked:2,failed:0});assert.equal(buildFolderCatalog([e],reference,{styleChecks,requireStyleValidation:true}).layers[0].activatable,true);
});
