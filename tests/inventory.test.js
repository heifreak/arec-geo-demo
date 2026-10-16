import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inventory } from '../tools/inventory.mjs';
test('inventario privado distingue candidatos sin exportar valores ni aprobar datos', async () => {
  const root = await mkdtemp(join(tmpdir(), 'arec-inventory-test-'));
  try {
    await mkdir(join(root, 'JRZ'));
    await writeFile(join(root, 'JRZ', 'V13_fixture.geojson'), JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { cell_id: 'synthetic-secret-value' }, geometry: null }] }));
    await writeFile(join(root, 'JRZ', 'V15_fixture.json'), '{"type":"FeatureCollection","features":[]}');
    await writeFile(join(root, 'bad.json'), 'broken');
    const report = await inventory(root);
    assert.equal(report.files.length, 3);
    const real = report.files.find(file => file.file.endsWith('V13_fixture.geojson'));
    assert.deepEqual(real.fields, ['cell_id']); assert.equal(real.features, 1);
    assert.deepEqual(real.candidateVariables, ['V13']); assert.deepEqual(real.candidatePlazas, ['JRZ']);
    assert.equal(report.files.find(file => file.file.endsWith('V15_fixture.json')).internalCandidate, true);
    assert.equal(report.files.every(file => file.publicApproved === false), true);
    assert.equal(JSON.stringify(report).includes('synthetic-secret-value'), false);
    assert.equal(report.files.find(file => file.file === 'bad.json').status, 'invalid-json-or-features');
    const limited = await inventory(root, { maxBytes: 1 });
    assert.equal(limited.files.every(file => file.status === 'too-large-to-inspect'), true);
    await symlink(join(root, 'JRZ'), join(root, 'linked'));
    await assert.rejects(inventory(root), /enlaces simbólicos/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
