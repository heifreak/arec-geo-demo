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
  const artifacts = process.env.ARTIFACT_DIR || '/tmp/arec-browser-artifacts'; await mkdir(artifacts, { recursive: true });
  await page.screenshot({ path: resolve(artifacts, 'synthetic-test.png') });
  useFixture = false; await page.reload({ waitUntil: 'networkidle' });
  assert.match(await page.locator('#capas').textContent(), /Sin capas/);
  await page.screenshot({ path: resolve(artifacts, 'desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#toggle-inspector').click(); assert.equal(await page.locator('.right-panel').isVisible(), true);
  await page.screenshot({ path: resolve(artifacts, 'mobile-inspector.png') });
  assert.deepEqual(errors, []);
  console.log('PASS Chromium: navegación, búsqueda, GeoJSON sintético bajo demanda, opacidad, respaldo sin token, dibujo/medición, CSV, inspector móvil, muestra privada en memoria y resumen de atributos sintéticos sin subida. No valida servicios ion autenticados ni datos AREC reales.');
} finally { await browser?.close(); await new Promise(done => server.close(done)); }
