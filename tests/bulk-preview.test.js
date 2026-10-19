import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('Mass preview is the complete standalone viewer, without a divergent importer', async () => {
  const [mass, preview, bundle, entry] = await Promise.all([
    read('../preview-masiva.html'), read('../preview.html'),
    read('../src/viewer.bundle.js'), read('../src/bulk-preview.js')]);
  assert.equal(mass, preview);
  assert.ok(mass.includes(bundle.replace(/<\/script/gi, '<\\/script')));
  assert.ok(!mass.includes('src="./src/viewer.bundle.js"'));
  assert.match(entry, /import '.\/browser-entry.js'/);
});
test('Both previews retain privacy guards and the streaming folder implementation', async () => {
  const [ui, inventory, worker, html] = await Promise.all([
    read('../src/folder-ui.js'), read('../src/folder-inventory.js'),
    read('../src/folder-worker.js'), read('../preview-masiva.html')]);
  assert.match(ui, /webkitdirectory/);
  assert.match(inventory, /internal-excluded/);
  assert.match(worker, /inspectFile/);
  assert.ok(!html.includes('/tmp/arec-geo-private/'));
  assert.ok(!html.includes('FeatureCollection","features":'));
});
