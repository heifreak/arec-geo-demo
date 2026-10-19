import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { inspectCell, validateInspection, verifyInputEvidence } from '../src/cell-inspector.js';
const inspection = { reference: 'synthetic-only', groups: [{ label: 'Synthetic group', fields: [{ field: 'test_id', label: 'ID' }, { field: 'test_false', label: 'Condition' }, { field: 'test_null', label: 'Unknown' }, { field: 'test_absent', label: 'Absent' }, { field: 'test_zero', label: 'Zero' }] }] };
test('inspector conserva false, cero, null y ausencia sin recalcular atributos', () => {
 const values={test_id:'synthetic',test_false:false,test_null:null,test_zero:0};
 const fields=inspectCell(values,inspection).groups[0].fields;
 assert.equal(fields[1].value,false); assert.equal(fields[2].present,true); assert.equal(fields[2].value,null);
 assert.equal(fields[3].present,false); assert.equal(fields[4].value,0);
 assert.deepEqual(values,{test_id:'synthetic',test_false:false,test_null:null,test_zero:0});
});
test('inspector exige referencia y campos únicos', () => {
 assert.throws(()=>validateInspection({...inspection,reference:''}));
 assert.throws(()=>validateInspection({...inspection,groups:[...inspection.groups,...inspection.groups]}));
});
test('huella privada vincula descriptor con bytes y cantidad del archivo revisado', async () => {
 const text='{"features":[{}]}'; const data=JSON.parse(text);
 const evidence={sha256:createHash('sha256').update(text).digest('hex'),featureCount:1};
 await verifyInputEvidence(text,data,evidence);
 await assert.rejects(verifyInputEvidence(text+' ',data,evidence),/no corresponde/);
 await assert.rejects(verifyInputEvidence(text,data,{...evidence,featureCount:2}),/no corresponde/);
});
