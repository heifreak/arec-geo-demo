import test from 'node:test';
import assert from 'node:assert/strict';
test('batch checks every original feature, continues after style failure and never reads internals',async()=>{
 const messages=[];globalThis.self={postMessage:message=>messages.push(message)};
 await import('../src/folder-worker.js');
 const file=value=>new Blob([JSON.stringify({type:'FeatureCollection',features:[{type:'Feature',properties:{value},geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,0]]]}}]})]);
 const paint={'fill-color':['step',['get','value'],'#ffffff',1,'#123456']};
 await self.onmessage({data:{mode:'validate-styles',files:[{path:'data/JRZ/evidence/V01/bad.json',file:file('unknown'),paint},{path:'data/MTY/evidence/V01/good.json',file:file(2),paint},{path:'data/JRZ/evidence/V15/internal.json',file:{stream(){throw Error('Must never be read');}},paint},{path:'data/JRZ/evidence/V01/metadata.json',file:new Blob(['{"metadata":true}']),paint}]}});
 assert.equal(messages[0].validation.status,'failed');assert.equal(messages[0].validation.checked,1);
 assert.equal(messages[1].validation.status,'passed');assert.equal(messages[1].validation.checked,1);
 assert.equal(messages[2].validation.checked,0);assert.match(messages[2].validation.reason,/interna excluida/);
 assert.equal(messages[3].validation.status,'failed');assert.equal(messages[3].validation.checked,0);
 assert.equal(messages[4].kind,'done');assert.equal(messages[4].completed,4);assert.ok(!JSON.stringify(messages).includes('coordinates'));
 delete globalThis.self;
});
