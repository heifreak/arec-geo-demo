import test from 'node:test';import assert from 'node:assert/strict';
import {applyPaint} from '../src/paint-renderer.js';
test('circle conversion removes competing BillboardGraphics and keeps original nullable attributes',()=>{
 const original={nullable:null,value:0};const entity={billboard:{show:true},properties:{getValue:()=>({__arecOriginal:original})}};
 const C={HeightReference:{CLAMP_TO_GROUND:1},PointGraphics:class{constructor(options){Object.assign(this,options);}},Color:{fromCssColorString:()=>({alpha:1,withAlpha(alpha){return {alpha};}})}};
 const source={entities:{values:[entity]}};const layer={sessionOnly:true,style:{paint:{'circle-color':'#123456','circle-radius':5}}};
 applyPaint(source,layer,C,null,0.4);assert.equal(entity.billboard,undefined);assert.equal(entity.point.pixelSize,10);assert.equal(entity.point.heightReference,1);assert.equal(entity.point.color.alpha,0.4);
 applyPaint(source,layer,C,null,0.7);assert.equal(entity.point.color.alpha,0.7);assert.deepEqual(original,{nullable:null,value:0});
});
