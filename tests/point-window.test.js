import test from 'node:test';import assert from 'node:assert/strict';
import {readPointWindow} from '../src/point-window.js';
import {inspectFile,classifyPath,MAX_RENDER_BYTES} from '../src/folder-inventory.js';
import {baseTemplate} from '../src/base-layers.js';
import {buildFolderCatalog} from '../src/folder-catalog.js';
const point=(id,coordinates=[0,0])=>({type:'Feature',properties:{id,nullable:null,zero:0,flag:false},geometry:{type:'Point',coordinates}});
const file=features=>new Blob([JSON.stringify({type:'FeatureCollection',features})]);
test('viewport retains only original features in bounds, exposes truncation and byte budgets',async()=>{
 const original=[point('inside'),point('outside',[10,10]),point('second')];const result=await readPointWindow(file(original),[-1,-1,1,1],{limit:1});assert.deepEqual(result.data.features,[original[0]]);assert.equal(result.window.matched,2);assert.equal(result.window.truncated,true);
 const tiny=await readPointWindow(file(original),[-1,-1,1,1],{maxBytes:1});assert.equal(tiny.window.selected,0);assert.equal(tiny.window.matched,2);assert.equal(tiny.window.truncated,true);
 assert.equal((await readPointWindow(file(original),[30,30,40,40])).window.selected,0);
});
test('handles antimeridian, cancellation and rejects geometry conversion',async()=>{
 const r=await readPointWindow(file([point('east',[179,0]),point('west',[-179,0]),point('no')]),[170,-5,-170,5]);assert.equal(r.window.selected,2);
 const c=new AbortController();c.abort();await assert.rejects(readPointWindow(file([point('x')]),[-1,-1,1,1],{signal:c.signal}),{name:'AbortError'});
 await assert.rejects(readPointWindow(file([{...point('bad'),geometry:{type:'LineString',coordinates:[[0,0],[1,1]]}}]),[-1,-1,1,1]),/solo admite Point/);
});
test('large point sources qualify without changing the full drawing limit',async()=>{
 const small=file([point('x')]);const sized={size:MAX_RENDER_BYTES+1,stream:()=>small.stream()};const r=await inspectFile(sized);assert.equal(r.renderable,false);assert.equal(r.progressiveEligible,true);assert.equal(MAX_RENDER_BYTES,25*1024*1024);
});
test('BASE is independent of V01–V23, has explicit technical styles and correct base_metro scope',()=>{
 const path='data/JRZ/evidence/base_metro/grid_synthetic.geojson';const route=classifyPath(path);assert.equal(route.scope,'metro_analysis');assert.equal(route.base,true);assert.equal(route.variable,undefined);
 const e={...route,path,kind:'geojson',renderable:true,geometries:{Polygon:1},count:1,size:200,fields:{}};const b=baseTemplate(e);assert.equal(b.kind,'base');assert.equal(b.variable,'BASE');assert.match(b.reference,/técnica/);
 const r=buildFolderCatalog([e],null);assert.equal(r.totals.baseActivatable,1);assert.equal(r.layers[0].mapping,'unique');assert.equal(r.layers[0].analysisCertification,'not-certified');
 assert.equal(baseTemplate({...e,status:'internal-excluded'}),null);
});
test('all 18 plazas share BASE rules in city and metro without adding an analytical variable',async()=>{
 const {PLAZAS}=await import('../src/plazas.js');const entries=[];
 for(const code of Object.keys(PLAZAS))for(const directory of ['base','base_metro']){const path=`data/${code}/evidence/${directory}/grid_synthetic.geojson`;entries.push({...classifyPath(path),path,kind:'geojson',renderable:true,count:1,size:100,geometries:{Polygon:1},fields:{}});}
 const r=buildFolderCatalog(entries,null);assert.equal(r.totals.baseActivatable,36);assert.equal(r.totals.scopeCorrections,18);assert.equal(r.comparison.baseline.activatableFiles,0);assert.equal(r.comparison.after.availableSublayers,0);assert.ok(r.contexts.every(c=>c.baseActivatable===1&&c.variables.length===0&&c.availableSublayers.length===0));
});
