import test from 'node:test';
import assert from 'node:assert/strict';
import {compareCell} from '../src/cell-comparison.js';
const geometry={type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,0]]]};
const feature=(id,extra={},g=geometry)=>({type:'Feature',properties:{test_id:id,...extra},geometry:g});
const data=(...features)=>({type:'FeatureCollection',features});
const layer=(id,extra={})=>({id,name:id,plaza:'JRZ',scope:'metro_analysis',analysis:{cellIdField:'test_id'},...extra});
const selected={layer:layer('a'),properties:{test_id:'one'},data:data(feature('one',{test_known:0}))};
test('cruza por identificador y geometría exacta conservando atributos y evidencia temporal',()=>{
 const attrs={test_value:12,test_null:null,test_false:false};
 const target={layer:layer('b',{temporalEvidence:['Synthetic estimated epoch']}),data:data(feature('one',attrs))};
 const result=compareCell(selected,[target])[0];
 assert.equal(result.status,'matched'); assert.deepEqual(result.attributes,{test_id:'one',...attrs});
 assert.deepEqual(result.temporalEvidence,['Synthetic estimated epoch']);
});
test('ausencia de registro no se convierte en crecimiento cero',()=>{
 const result=compareCell(selected,[{layer:layer('b'),data:data(feature('other'))}])[0];
 assert.equal(result.status,'no-record'); assert.equal(result.attributes,undefined);
});
test('rechaza mismo ID con otra geometría y duplicados; no cruza plazas o ámbitos',()=>{
 const mismatch=compareCell(selected,[{layer:layer('b'),data:data(feature('one',{}, {type:'Polygon',coordinates:[[[2,0],[3,0],[3,1],[2,0]]]}))}])[0];
 assert.equal(mismatch.status,'geometry-mismatch'); assert.equal(mismatch.attributes,undefined);
 assert.equal(compareCell(selected,[{layer:layer('b'),data:data(feature('one'),feature('one'))}])[0].status,'invalid');
 assert.deepEqual(compareCell(selected,[{layer:layer('b',{plaza:'MTY'}),data:data(feature('one'))},{layer:layer('c',{scope:'city'}),data:data(feature('one'))}]),[]);
});
test('no equipara automáticamente IDs numéricos y textuales ni usa cercanía',()=>{
 const selection={...selected,properties:{test_id:1},data:data(feature(1))};
 assert.equal(compareCell(selection,[{layer:layer('b'),data:data(feature('1'))}])[0].status,'no-record');
});
