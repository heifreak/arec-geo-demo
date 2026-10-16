import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReferencePackage, descriptorFromReference } from '../src/reference-package.js';
function fixture() {
  const variables = Array.from({ length: 23 }, (_, index) => ({ id: `V${String(index + 1).padStart(2, '0')}`, name: `Synthetic variable ${index + 1}`, sublayers: [{ id: `test-${index + 1}`, name: `Synthetic layer ${index + 1}` }] }));
  return { version: 1, kind: 'private-reference', reference: 'synthetic-reference', variables, groups: [{ id: 'test-group', name: 'Synthetic group', variables: variables.map(variable => variable.id) }], templates: [{ variable: 'V01', logicalId: 'test-1', name: 'Synthetic test', legend: 'Synthetic legend', approvalReference: 'synthetic-reference', style: { color: '#112233', opacity: 1, reference: 'synthetic-reference', paint: { 'fill-color': '#112233' } } }] };
}
test('paquete privado preserva estructura y genera descriptor sin autorizar publicación ni cambiar plaza/ámbito', () => {
  const bundle = validateReferencePackage(fixture());
  const descriptor = descriptorFromReference(bundle, 'test-1', 'JRZ', 'metro_analysis');
  assert.equal(descriptor.scope, 'metro_analysis'); assert.equal(descriptor.plaza, 'JRZ'); assert.equal(descriptor.publicApproved, false);
  descriptor.style.paint['fill-color'] = '#445566'; assert.equal(bundle.templates[0].style.paint['fill-color'], '#112233');
});
test('rechaza plantillas internas, agrupaciones incoherentes y paquetes con código en vez de datos', () => {
  const bundle = fixture(); bundle.templates[0].variable = 'V15'; bundle.templates[0].logicalId = 'test-15';
  assert.throws(() => validateReferencePackage(bundle), /no autorizada/);
  const bad = fixture(); bad.groups[0].variables.pop(); assert.throws(() => validateReferencePackage(bad), /incompleta/);
  assert.throws(() => validateReferencePackage('<script>throw Error()</script>'), /inválido/);
});
