import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import assert from 'node:assert/strict';
const root = resolve(import.meta.dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };
const server = createServer(async (request, response) => {
  try {
    const path = resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://local').pathname).replace(/\/$/, '/index.html'));
    if (!path.startsWith(root + sep)) throw Error('outside root');
    response.setHeader('Content-Type', mime[extname(path)] || 'application/octet-stream'); response.end(await readFile(path));
  } catch { response.writeHead(404); response.end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    env: { ...process.env, XDG_CACHE_HOME: '/tmp/arec-browser-cache', XDG_CONFIG_HOME: '/tmp/arec-browser-config' } });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  if (process.env.AREC_TLS_TRANSPORT === 'curl') {
    // Same HTTPS resources; curl verifies the platform CA. No ignore-certificate flags.
    const run = promisify(execFile);
    await page.route('https://**/*', async route => {
      try {
        const { stdout } = await run('curl', ['--fail', '--silent', '--show-error', '--location', '--max-time', '30', '--user-agent', route.request().headers()['user-agent'] || 'AREC-GEO-3D (https://github.com/heifreak/arec-geo-demo)', '--referer', route.request().headers()['referer'] || '', '--write-out', '\n%{content_type}', route.request().url()], { encoding: 'buffer', maxBuffer: 20 * 1024 * 1024 });
        const split = stdout.lastIndexOf(10);
        await route.fulfill({ status: 200, contentType: stdout.subarray(split + 1).toString(), body: stdout.subarray(0, split) });
      } catch { await route.abort('failed'); }
    });
  }
  const errors = []; const requests = []; page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push({ method: request.method(), url: request.url() }));
  // Synthetic test data only. Never written to the public data catalog.
  const fixture = { id: 'synthetic-test', plaza: 'JRZ', variable: 'V01', name: 'Fixture sintética de prueba', url: 'data/synthetic-test.geojson', publicApproved: true, approvalReference: 'test-only', legend: 'Símbolo de prueba, no V14', style: { color: '#ffffff', opacity: 1 } };
  let useFixture = true;
  await page.route('**/data/catalog.json', route => route.fulfill({ json: { version: 1, layers: useFixture ? [fixture] : [] } }));
  let layerRequests = 0;
  await page.route('**/data/synthetic-test.geojson', route => {
    layerRequests++;
    return route.fulfill({ json: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { name: 'Muestra sintética', cell_id: 'TEST-ONLY', literal: '<script>no ejecutar</script>' }, geometry: { type: 'Point', coordinates: [-106.4245, 31.6904] } }] } });
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle', timeout: 60000 });
  if (!process.env.PREVIEW_ONLY) {
  assert.equal(await page.locator('#plaza option').count(), 18);
  assert.equal(layerRequests, 0, 'No precargar GeoJSON');
  await page.locator('#capas input[type=checkbox]').check();
  await page.getByText('Capa visible', { exact: true }).waitFor();
  assert.equal(layerRequests, 1);
  // Wait for the documented 2-second flight, then inspect the fixture at the focus point.
  await page.waitForTimeout(2200);
  await page.mouse.click(720, 480);
  await page.waitForFunction(() => document.getElementById('atributos').textContent.includes('TEST-ONLY'));
  assert.match(await page.locator('#atributos').textContent(), /<script>no ejecutar<\/script>/);
  assert.equal(await page.locator('#atributos script').count(), 0);
  await page.locator('#capas input[type=checkbox]').uncheck();
  await page.locator('#capas input[type=checkbox]').check();
  assert.equal(layerRequests, 1, 'Reutilizar la capa cargada');
  await page.locator('#capas input[type=range]').fill('0.5');
  await page.selectOption('#plaza', 'MTY');
  assert.equal(await page.locator('#estado').textContent(), 'Explorando: Monterrey');
  assert.match(await page.locator('#capas').textContent(), /Sin capas/);
  await page.locator('.cesium-home-button').click();
  assert.equal(await page.locator('#plaza').inputValue(), 'JRZ');
  await page.waitForTimeout(2200); // Complete the documented flight before checking view evidence.
  await page.fill('#buscar', 'queretaro');
  assert.equal(await page.locator('#plaza option:not([hidden])').count(), 1);
  await page.fill('#buscar', '');
  await page.locator('#terrain').click();
  assert.match(await page.locator('#terrain-status').textContent(), /requiere un token/);
  assert.equal(await page.locator('#terrain').isChecked(), false);
  await page.locator('#verify-3d').click();
  assert.match(await page.locator('#verify-3d-status').textContent(), /relieve real no validado/);
  await page.locator('#buildings').click();
  assert.equal(await page.locator('#buildings').isChecked(), false);
  await page.locator('#base-map').uncheck(); await page.locator('#base-map').check();
  await page.locator('#draw-line').click();
  await page.mouse.click(700, 450); await page.mouse.click(780, 530);
  await page.locator('#draw-finish').click();
  assert.match(await page.locator('#drawing-status').textContent(), /Distancia superficial aproximada/);
  await page.locator('#draw-clear').click();
  assert.equal(await page.locator('#drawing-status').textContent(), 'Dibujos eliminados.');
  await page.locator('#export-csv').scrollIntoViewIfNeeded();
  const downloaded = page.waitForEvent('download'); await page.locator('#export-csv').click();
  const download = await downloaded; assert.match(download.suggestedFilename(), /JRZ\.csv$/);
  const text = await readFile(await download.path(), 'utf8');
  assert.match(text, /No disponible/); assert.doesNotMatch(text, /100%/);
  // Private-session flow uses synthetic attributes only; no AREC field names or colors inferred.
  await page.locator('details').filter({ has: page.locator('#session-form') }).locator('summary').click();
  const descriptor = { plaza: 'JRZ', variable: 'V01', name: 'Synthetic private cell', approvalReference: 'synthetic-only', legend: 'Synthetic, not V14', style: { color: '#ffffff', opacity: 1, categoryField: 'test_class', reference: 'synthetic-only', categories: [{ value: 'X', label: 'Synthetic X', color: '#112233' }] }, analysis: { reference: 'synthetic-only', scope: 'sample', cellIdField: 'test_id', classField: 'test_class', metrics: [{ id: 'test_metric', field: 'test_value', label: 'Synthetic total', unit: 'test-units', aggregation: 'sum', reference: 'synthetic-only' }] } };
  const privateData = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { test_id: 'TEST-PRIVATE-1', test_class: 'X', test_value: 7, description: '<img src="https://example.invalid/do-not-request">' }, geometry: { type: 'Polygon', coordinates: [[[-106.4345,31.6804],[-106.4145,31.6804],[-106.4145,31.7004],[-106.4345,31.7004],[-106.4345,31.6804]]] } }] };
  await page.locator('#session-geojson').setInputFiles({ name: 'private-session.geojson', mimeType: 'application/geo+json', buffer: Buffer.from(JSON.stringify(privateData)) });
  await page.locator('#session-descriptor').setInputFiles({ name: 'descriptor.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(descriptor)) });
  await page.locator('#session-consent').check();
  await page.locator('#session-form button[type=submit]').click();
  await page.waitForFunction(() => /SOLO EN MEMORIA|Muestra no cargada/.test(document.getElementById('session-status').textContent));
  assert.match(await page.locator('#session-status').textContent(), /SOLO EN MEMORIA/);
  await page.locator('#capas fieldset').filter({ hasText: 'Synthetic private cell' }).locator('input[type=checkbox]').check();
  await page.getByText('Capa visible', { exact: true }).waitFor();
  assert.match(await page.locator('#summary').textContent(), /celdas únicas en archivo cargado1/);
  assert.match(await page.locator('#summary').textContent(), /Synthetic total \(test-units; sum\)7/);
  await page.waitForTimeout(1500); await page.mouse.click(720, 500);
  await page.waitForFunction(() => document.getElementById('atributos').textContent.includes('TEST-PRIVATE-1'));
  assert.equal(requests.some(request => !['GET', 'HEAD'].includes(request.method)), false, 'Sin subidas de archivos');
  assert.equal(requests.some(request => /private-session|do-not-request/.test(request.url)), false, 'Sin filtrar contenido a solicitudes externas');
  await page.locator('#session-clear').click();
  assert.doesNotMatch(await page.locator('#capas').textContent(), /Synthetic private cell/);
  assert.doesNotMatch(await page.locator('#summary').textContent(), /Synthetic total/);
  // Recovered-definition workflow is tested with synthetic metadata; no original values in Git.
  await page.locator('details').filter({ has: page.locator('#reference-form') }).locator('summary').click();
  const variables = Array.from({ length: 23 }, (_, i) => ({ id: `V${String(i + 1).padStart(2, '0')}`, name: `Synthetic variable ${i + 1}`, sublayers: [{ id: `synthetic-sub-${i + 1}`, name: `Synthetic sublayer ${i + 1}` }] }));
  const reference = { version: 1, kind: 'private-reference', reference: 'synthetic-only', variables, groups: [{ id: 'synthetic', name: 'Synthetic group', variables: variables.map(v => v.id) }], templates: [{ ...descriptor, logicalId: 'synthetic-sub-1', name: 'Synthetic recovered layer', methodology: 'Synthetic method from metadata', legendEntries: [['#112233', 'Synthetic low'], ['#445566', 'Synthetic high']], style: { color: '#ffffff', opacity: 1, reference: 'synthetic-only', paint: { 'fill-color': ['step', ['get', 'test_value'], '#112233', 3, '#445566'], 'fill-opacity': 0.6, 'line-color': '#778899', 'line-width': 2, 'line-opacity': 0.8 } } }] };
  await page.locator('#reference-file').setInputFiles({ name: 'synthetic-reference.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(reference)) });
  await page.locator('#reference-consent').check(); await page.locator('#reference-form button[type=submit]').click();
  await page.waitForFunction(() => document.getElementById('reference-status').textContent.includes('cargada en memoria'));
  assert.doesNotMatch(await page.locator('#reference-tree').textContent(), /Synthetic variable 15/);
  await page.locator('#reference-tree [data-variable="V01"] > summary').click();
  await page.locator('#reference-tree .reference-choice').filter({ hasText: /^Synthetic sublayer 1 ·/ }).click();
  assert.match(await page.locator('#layer-method').textContent(), /Synthetic method from metadata/);
  await page.selectOption('#scope', 'metro_analysis');
  assert.match(await page.locator('#capas').textContent(), /Sin capas/);
  await page.locator('#session-geojson').setInputFiles({ name: 'synthetic-metro.geojson', mimeType: 'application/geo+json', buffer: Buffer.from(JSON.stringify(privateData)) });
  await page.locator('#session-consent').check(); await page.locator('#session-form button[type=submit]').click();
  await page.waitForFunction(() => document.getElementById('session-status').textContent.includes('SOLO EN MEMORIA'));
  await page.locator('#capas fieldset').filter({ hasText: 'Synthetic recovered layer' }).locator('input[type=checkbox]').check();
  await page.getByText('Capa visible', { exact: true }).waitFor();
  await page.locator('#capas input[type=range]').fill('0.5');
  assert.match(await page.locator('#summary').textContent(), /Synthetic total \(test-units; sum\)7/);
  await page.selectOption('#scope', 'city');
  assert.doesNotMatch(await page.locator('#capas').textContent(), /Synthetic recovered layer/);
  assert.doesNotMatch(await page.locator('#summary').textContent(), /Synthetic total/);
  await page.locator('#session-clear').click(); await page.locator('#reference-clear').click();
  if (process.env.PRIVATE_REFERENCE_PATH) {
    // Optional local metadata audit: no screenshots/logged content or original HTML execution.
    await page.locator('#reference-file').setInputFiles({ name: 'private-reference.json', mimeType: 'application/json', buffer: await readFile(process.env.PRIVATE_REFERENCE_PATH) });
    await page.locator('#reference-consent').check(); await page.locator('#reference-form button[type=submit]').click();
    await page.waitForFunction(() => document.getElementById('reference-status').textContent.includes('cargada en memoria'));
    assert.equal(await page.locator('#reference-tree [data-variable]').count(), 19);
    await page.locator('#reference-tree [data-variable="V14"] > summary').click();
    await page.locator('#reference-tree [data-variable="V14"] button').first().click();
    assert.ok((await page.locator('#layer-method').textContent()).length > 20);
    await page.locator('#reference-clear').click();
  }
  if (process.env.PRIVATE_SAMPLE_PATH && process.env.PRIVATE_DESCRIPTOR_PATH) {
    // Authorized local-only review. Never log attributes or capture screenshots of private data.
    const raw = await readFile(process.env.PRIVATE_SAMPLE_PATH);
    const data = JSON.parse(raw); const descriptorRaw = await readFile(process.env.PRIVATE_DESCRIPTOR_PATH);
    const descriptor = JSON.parse(descriptorRaw);
    await page.selectOption('#plaza', descriptor.plaza); await page.selectOption('#scope', descriptor.scope);
    await page.locator('#session-geojson').setInputFiles({ name: 'private.geojson', mimeType: 'application/geo+json', buffer: raw });
    await page.locator('#session-descriptor').setInputFiles({ name: 'private-descriptor.json', mimeType: 'application/json', buffer: descriptorRaw });
    await page.locator('#session-consent').check(); await page.locator('#session-form button[type=submit]').click();
    await page.waitForFunction(() => document.getElementById('session-status').textContent.includes('SOLO EN MEMORIA'));
    await page.locator('#capas input[type=checkbox]').check();
    await page.getByText('Capa visible', { exact: true }).waitFor({ timeout: 120000 });
    const summary = await page.locator('#summary').textContent();
    assert.ok(summary.includes(String(data.features.length)));
    for (const value of new Set(data.features.map(f => f.properties[descriptor.analysis.classField]))) assert.ok(summary.includes(String(value)));
    // Fly to an interior point of the first regular grid polygon; pick the rendered cell.
    const ring = data.features[0].geometry.coordinates[0];
    const lon = ring.slice(0,-1).reduce((a,p)=>a+p[0],0)/(ring.length-1);
    const lat = ring.slice(0,-1).reduce((a,p)=>a+p[1],0)/(ring.length-1);
    await page.locator('details').filter({ has: page.locator('#ir-coordenadas') }).evaluate(element => { element.open = true; });
    await page.fill('#longitud',String(lon)); await page.fill('#latitud',String(lat));
    await page.locator('#ir-coordenadas button[type=submit]').click(); await page.waitForTimeout(3500);
    await page.mouse.click(720,480);
    await page.waitForFunction(() => document.getElementById('cell-inspection').querySelectorAll('dd').length > 0, { timeout: 30000 });
    const actual = await page.locator('#atributos').textContent();
    const expectedId = data.features[0].properties[descriptor.analysis.cellIdField];
    assert.ok(actual.includes(String(expectedId)), 'Picked original private cell');
    assert.deepEqual(JSON.parse(actual).atributos, data.features[0].properties, 'Inspector preserves every original value');
    assert.equal(await page.locator('#cell-inspection dd').count(), descriptor.inspection.groups.reduce((n,g)=>n+g.fields.length,0));
    await page.locator('#session-clear').click();
    assert.equal(await page.locator('#cell-inspection dd').count(),0);
    assert.equal(await page.locator('#layer-method').textContent(),'');
    assert.equal(await page.locator('#layer-legend').textContent(),'');
    const stored = await page.evaluate(() => ({ ...localStorage }));
    for (const value of Object.values(stored)) {
      assert.ok(!value.includes(String(expectedId)));
      assert.ok(!value.includes(descriptor.analysis.classField));
    }
    console.log('PASS revisión privada: archivo íntegro, capa real renderizada, resumen por clases y selección de celda con campos originales. Sin certificar metodología ni cobertura.');
  }
  assert.equal(requests.some(request => !['GET', 'HEAD'].includes(request.method)), false);
  const artifacts = process.env.ARTIFACT_DIR || '/tmp/arec-browser-artifacts'; await mkdir(artifacts, { recursive: true });
  if (!process.env.PRIVATE_SAMPLE_PATH) await page.screenshot({ path: resolve(artifacts, 'synthetic-test.png') });
  useFixture = false; await page.reload({ waitUntil: 'networkidle' });
  assert.match(await page.locator('#capas').textContent(), /Sin capas/);
  await page.screenshot({ path: resolve(artifacts, 'desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#toggle-inspector').click(); assert.equal(await page.locator('.right-panel').isVisible(), true);
  const brandBox = await page.locator('.brand').boundingBox(); const contextBox = await page.locator('.context').boundingBox();
  assert.ok(brandBox.y >= 0 && contextBox.y >= 0 && contextBox.y + contextBox.height <= 145, 'Cabecera móvil completa sin recortes ni solapamiento');
  for (const id of ['plaza', 'buscar', 'scope']) { const box = await page.locator('#' + id).boundingBox(); assert.ok(box && box.width >= 90 && box.x >= 0 && box.x + box.width <= 390, 'Controles de cabecera utilizables en móvil'); }
  await page.screenshot({ path: resolve(artifacts, 'mobile-inspector.png') });
  assert.deepEqual(errors, []);
  }
  if (process.env.PREVIEW_ONLY && (!process.env.PRIVATE_HTML_PATH || !process.env.PRIVATE_SAMPLE_PATH || !process.env.PRIVATE_DESCRIPTOR_PATH)) throw Error('Preview-only requiere los tres archivos privados de prueba.');
  if (process.env.PRIVATE_HTML_PATH && process.env.PRIVATE_SAMPLE_PATH) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    // Managed Chromium blocks file:// navigation. Serve the identical self-contained file for runtime validation.
    await page.goto(`http://127.0.0.1:${server.address().port}/preview.html`, { waitUntil: 'networkidle', timeout: 60000 });
    assert.equal(await page.locator('#scope').inputValue(),'metro_analysis');
    assert.match(await page.locator('#capas').textContent(),/Sin capas/);
    await page.locator('#local-reference').setInputFiles(process.env.PRIVATE_HTML_PATH);
    await page.locator('#local-cells').setInputFiles(process.env.PRIVATE_SAMPLE_PATH);
    await page.locator('#local-consent').check();
    await page.locator('#local-pilot-form button[type=submit]').click();
    await page.waitForFunction(()=>document.getElementById('session-status').textContent.includes('SOLO EN MEMORIA'));
    const descriptorDownload = page.waitForEvent('download'); await page.locator('#local-download').click();
    const saved = JSON.parse(await readFile(await (await descriptorDownload).path(),'utf8'));
    const expected = JSON.parse(await readFile(process.env.PRIVATE_DESCRIPTOR_PATH,'utf8'));
    assert.deepEqual(saved.style.paint,expected.style.paint); assert.deepEqual(saved.legendEntries,expected.legendEntries);
    await page.locator('#capas input[type=checkbox]').check(); await page.getByText('Capa visible',{exact:true}).waitFor({timeout:120000});
    const data = JSON.parse(await readFile(process.env.PRIVATE_SAMPLE_PATH,'utf8'));
    assert.ok((await page.locator('#summary').textContent()).includes(String(data.features.length)));
    const ring = data.features[0].geometry.coordinates[0].slice(0,-1);
    await page.locator('details').filter({has:page.locator('#ir-coordenadas')}).evaluate(element=>{element.open=true;});
    await page.fill('#longitud',String(ring.reduce((n,p)=>n+p[0],0)/ring.length)); await page.fill('#latitud',String(ring.reduce((n,p)=>n+p[1],0)/ring.length));
    await page.locator('#ir-coordenadas button[type=submit]').click(); await page.waitForTimeout(3500); await page.mouse.click(720,480);
    await page.waitForFunction(()=>document.getElementById('cell-inspection').querySelectorAll('dd').length>0);
    assert.deepEqual(JSON.parse(await page.locator('#atributos').textContent()).atributos,data.features[0].properties);
    if (process.env.PRIVATE_SECOND_SAMPLE_PATH && process.env.PRIVATE_SECOND_HTML_PATH && process.env.PRIVATE_SECOND_DESCRIPTOR_PATH) {
      const secondData=JSON.parse(await readFile(process.env.PRIVATE_SECOND_SAMPLE_PATH,'utf8'));
      const secondDescriptor=JSON.parse(await readFile(process.env.PRIVATE_SECOND_DESCRIPTOR_PATH,'utf8'));
      await page.selectOption('#local-variable',secondDescriptor.variable);
      await page.locator('#local-reference').setInputFiles(process.env.PRIVATE_SECOND_HTML_PATH);
      await page.waitForFunction(id=>[...document.getElementById('local-sublayer').options].some(o=>o.value===id),secondDescriptor.name);
      await page.selectOption('#local-sublayer',secondDescriptor.name);
      await page.locator('#local-cells').setInputFiles(process.env.PRIVATE_SECOND_SAMPLE_PATH);
      await page.locator('#local-consent').check(); await page.locator('#local-pilot-form button[type=submit]').click();
      await page.waitForFunction(()=>document.querySelectorAll('#capas fieldset').length===2);
      await page.locator('#capas fieldset').last().locator('input[type=checkbox]').check();
      await page.waitForFunction(()=>[...document.querySelectorAll('#capas fieldset')].every(f=>f.textContent.includes('Capa visible')),null,{timeout:120000});
      assert.equal(await page.locator('#capas input[type=checkbox]:checked').count(),2);
      const flyPick=async feature=>{
        const points=feature.geometry.coordinates[0].slice(0,-1);
        await page.fill('#longitud',String(points.reduce((n,p)=>n+p[0],0)/points.length)); await page.fill('#latitud',String(points.reduce((n,p)=>n+p[1],0)/points.length));
        await page.locator('#ir-coordenadas button[type=submit]').click(); await page.waitForTimeout(3500); await page.mouse.click(720,480);
      };
      await flyPick(secondData.features[0]);
      await page.waitForFunction(()=>document.querySelectorAll('#cell-comparison [data-comparison-status="matched"]').length===2);
      const joined=await page.locator('#cell-comparison section pre').allTextContents();
      const sharedId=secondData.features[0].properties[secondDescriptor.analysis.cellIdField];
      const baseMatch=data.features.find(f=>f.properties[expected.analysis.cellIdField]===sharedId);
      assert.ok(baseMatch); const expectedRows=[baseMatch.properties,secondData.features[0].properties];
      assert.equal(joined.length,2); for (let i=0;i<2;i++)assert.deepEqual(JSON.parse(joined[i]),expectedRows[i]);
      assert.ok((await page.locator('#cell-comparison').textContent()).includes(secondDescriptor.temporalEvidence[0]));
      const secondIds=new Set(secondData.features.map(f=>f.properties[secondDescriptor.analysis.cellIdField]));
      const absent=data.features.find(f=>!secondIds.has(f.properties[expected.analysis.cellIdField]));
      assert.ok(absent); await flyPick(absent);
      await page.waitForFunction(()=>document.querySelectorAll('#cell-comparison [data-comparison-status="no-record"]').length===1);
      assert.equal(await page.locator('#cell-comparison [data-comparison-status="no-record"] pre').count(),0);
      assert.match(await page.locator('#cell-comparison').textContent(),/no equivale a cero/);
      console.log('PASS comparación privada simultánea: dos capas reales, ID y geometría verificados, todos los atributos originales, procedencia temporal declarada y ausencia sin cero inventado.');
    }
    await page.locator('#local-clear').click(); assert.equal(await page.locator('#local-download').isDisabled(),true);
    await page.reload({waitUntil:'networkidle'}); assert.match(await page.locator('#capas').textContent(),/Sin capas/);
    assert.equal(requests.some(r=>!['GET','HEAD'].includes(r.method)),false);
    console.log('PASS HTML autónomo por HTTP (file:// bloqueado por política del entorno): referencia original leída sin ejecutar, descriptor descargado con pintura y leyenda exactas, capa real, celda e inspector originales, limpieza y recarga sin datos persistentes.');
  }
  assert.deepEqual(errors, []);
  if (!process.env.PREVIEW_ONLY) console.log('PASS Chromium: navegación, búsqueda, GeoJSON sintético bajo demanda, opacidad, respaldo sin token, dibujo/medición, CSV, inspector móvil, muestra privada en memoria resumen de atributos sintéticos, referencia privada declarativa y ámbitos sin fallback ni subida. No certifica metodologías, cobertura territorial ni servicios ion autenticados.');
} finally { await browser?.close(); await new Promise(done => server.close(done)); }
