import assert from 'node:assert/strict';
import {readFile}from'node:fs/promises';
export async function runFolderSmoke({page,baseUrl,requests}){
  // The preceding regression checks mobile; picks below use desktop canvas coordinates.
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(baseUrl,{waitUntil:'networkidle',timeout:60000});
  await page.selectOption('#scope','metro_analysis');
  // Cancel while work is active, before automation round trips let tiny fixtures finish.
  await page.evaluate(()=>{
    const progress=document.getElementById('folder-progress');
    const observer=new MutationObserver(()=>{if(progress.value>0&&progress.value<progress.max){observer.disconnect();document.getElementById('folder-cancel').click();}});
    observer.observe(progress,{attributes:true,attributeFilter:['value']});
  });
  await page.locator('#folder-input').setInputFiles(process.env.FOLDER_TEST_PATH);
  await page.waitForFunction(()=>document.getElementById('folder-status').textContent.includes('Inventario cancelado'));
  assert.ok(await page.locator('#folder-count').textContent());assert.equal(await page.locator('#capas fieldset').count(),0);
  await page.locator('#folder-input').setInputFiles(process.env.FOLDER_TEST_PATH);
  await page.waitForFunction(()=>document.getElementById('folder-status').textContent.includes('Inventario terminado'),null,{timeout:120000});
  await page.waitForFunction(()=>document.getElementById('folder-reference-status').textContent.includes('subcapas'));
  assert.match(await page.locator('#folder-count').textContent(),/1255 archivos inventariados/);
  assert.equal(await page.locator('#folder-plazas button').count(),18);
  assert.match(await page.locator('#folder-status').textContent(),/1 errores/);
  assert.equal(await page.locator('#capas fieldset').count(),0,'Inventario no dibuja geometrías');
  assert.equal(await page.evaluate(()=>globalThis.__originalExecuted),undefined);
  await page.fill('#folder-search','synthetic_v15_jrz');
  const blocked=page.locator('#folder-rows details').first();await blocked.locator('summary').click();assert.equal(await blocked.locator('button').isDisabled(),true);
  assert.match(await blocked.textContent(),/contenido no leído/);
  await page.fill('#folder-search','synthetic_v01_jrz');
  let row=page.locator('#folder-rows details').first();await row.locator('summary').click();await row.locator('button').click();
  await page.waitForFunction(()=>document.getElementById('folder-status').textContent.includes('Capa activa'),null,{timeout:120000});
  assert.equal(await page.locator('#capas input[type=checkbox]:checked').count(),1);
  await page.locator('details').filter({has:page.locator('#ir-coordenadas')}).evaluate(e=>{e.open=true;});
  await page.fill('#longitud','-106.4245');await page.fill('#latitud','31.6904');await page.locator('#ir-coordenadas button[type=submit]').click();await page.waitForTimeout(3500);await page.mouse.click(720,480);await page.waitForFunction(()=>document.getElementById('atributos').textContent.includes('synthetic-JRZ'));
  await page.locator('#capas input[type=checkbox]').click();assert.equal(await page.locator('#capas fieldset').count(),0,'Ocultar libera capa masiva');
  await page.locator('details').filter({has:page.locator('#folder-save')}).last().evaluate(e=>{e.open=true;});
  await page.locator('#folder-save').click();assert.match(await page.locator('#folder-storage-status').textContent(),/autorización/);
  await page.locator('#folder-save-consent').check();await page.locator('#folder-save').click();
  await page.waitForFunction(()=>document.getElementById('folder-storage-status').textContent.includes('Copia local completa'),null,{timeout:120000});
  await page.evaluate(()=>{globalThis.__originalStorageEstimate=navigator.storage.estimate;navigator.storage.estimate=async()=>({quota:1,usage:0});});
  await page.locator('#folder-save-consent').check();await page.locator('#folder-save').click();
  await page.waitForFunction(()=>document.getElementById('folder-storage-status').textContent.includes('Espacio local insuficiente'));
  await page.evaluate(()=>{navigator.storage.estimate=globalThis.__originalStorageEstimate;delete globalThis.__originalStorageEstimate;});
  await page.locator('#folder-save-consent').check();await page.locator('#folder-save').click();
  await page.waitForFunction(()=>document.getElementById('folder-storage-status').textContent.includes('Guardando copia local'));
  await page.locator('#folder-cancel').click();await page.waitForFunction(()=>document.getElementById('folder-storage-status').textContent.includes('Copia cancelada'));
  await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('#folder-rows details').count(),0,'No restaurar privados automáticamente');
  await page.locator('details').filter({has:page.locator('#folder-restore')}).last().evaluate(e=>{e.open=true;});
  await page.locator('#folder-restore').click();await page.waitForFunction(()=>document.getElementById('folder-status').textContent.includes('Copia local restaurada'));
  assert.match(await page.locator('#folder-count').textContent(),/1255 archivos inventariados/);assert.equal(await page.locator('#capas fieldset').count(),0);
  await page.fill('#folder-search','synthetic_v01_jrz');row=page.locator('#folder-rows details').first();await row.locator('summary').click();await row.locator('button').click();
  await page.waitForFunction(()=>document.getElementById('folder-status').textContent.includes('Capa activa'),null,{timeout:120000});
  await page.selectOption('#plaza','MTY');assert.equal(await page.locator('#capas fieldset').count(),0,'Cambio plaza libera capas');
  assert.match(await page.locator('#folder-count').textContent(),/1255 archivos inventariados/,'Cambio plaza conserva inventario');
  await page.locator('details').filter({has:page.locator('#folder-delete')}).last().evaluate(e=>{e.open=true;});
  await page.locator('#folder-delete').click();await page.waitForFunction(()=>document.getElementById('folder-storage-status').textContent.includes('eliminada'));
  await page.locator('#folder-clear').click();await page.locator('#folder-restore').click();await page.waitForFunction(()=>document.getElementById('folder-storage-status').textContent.includes('No hay copia'));
  assert.equal(requests.some(r=>!['GET','HEAD'].includes(r.method)),false);
  console.log('PASS carpeta sintética: 1.255 archivos, 18 plazas, cancelación/reimportación, internos sin leer, carga y liberación bajo demanda, inspector, persistencia con consentimiento, restauración y borrado.');
  if(process.env.FOLDER_ACTUAL_PATH){
    const plan=JSON.parse(await readFile(process.env.FOLDER_ACTUAL_PLAN_PATH,'utf8'));
    await page.selectOption('#plaza',plan.plaza);await page.selectOption('#scope',plan.scope);await page.fill('#folder-search','');
    await page.locator('#folder-input').setInputFiles(process.env.FOLDER_ACTUAL_PATH);
    await page.waitForFunction(()=>document.getElementById('folder-status').textContent.includes('Inventario terminado'),null,{timeout:120000});
    await page.waitForFunction(()=>document.getElementById('folder-reference-status').textContent.includes('62 subcapas'));
    assert.equal(await page.locator('#capas fieldset').count(),0);
    for(const layer of plan.layers){
      await page.fill('#folder-search',layer.relativePath);const target=page.locator('#folder-rows details').first();await target.locator('summary').click();await target.locator('button').click();
      await page.waitForFunction(()=>document.getElementById('folder-status').textContent.includes('Capa activa'),null,{timeout:120000});
    }
    assert.equal(await page.locator('#capas input[type=checkbox]:checked').count(),2);
    const second=JSON.parse(await readFile(process.env.FOLDER_ACTUAL_PATH+'/'+plan.layers[1].relativePath,'utf8'));
    const first=JSON.parse(await readFile(process.env.FOLDER_ACTUAL_PATH+'/'+plan.layers[0].relativePath,'utf8'));
    const points=second.features[0].geometry.coordinates[0].slice(0,-1);
    await page.locator('details').filter({has:page.locator('#ir-coordenadas')}).evaluate(e=>{e.open=true;});
    await page.fill('#longitud',String(points.reduce((n,p)=>n+p[0],0)/points.length));await page.fill('#latitud',String(points.reduce((n,p)=>n+p[1],0)/points.length));await page.locator('#ir-coordenadas button[type=submit]').click();await page.waitForTimeout(3500);
    // Ground primitives can finish after the flight; require the intended cell, not a stale pick.
    const targetId=second.features[0].properties[plan.layers[1].idField];let picked=false;
    for(let attempt=0;attempt<12&&!picked;attempt++){
      await page.mouse.click(720,480);await page.waitForTimeout(750);
      picked=await page.evaluate(({field,id})=>{try{return JSON.parse(document.getElementById('atributos').textContent).atributos[field]===id;}catch{return false;}},{field:plan.layers[1].idField,id:targetId});
    }
    assert.ok(picked,'Seleccionar la celda solicitada después del vuelo y preparación de primitivas');
    await page.waitForFunction(()=>document.querySelectorAll('#cell-comparison [data-comparison-status="matched"]').length===2);
    const actual=await page.locator('#cell-comparison section pre').allTextContents();const properties=second.features[0].properties;const match=first.features.find(f=>f.properties[plan.layers[0].idField]===properties[plan.layers[1].idField]);
    assert.deepEqual(JSON.parse(actual[0]),match.properties);assert.deepEqual(JSON.parse(actual[1]),properties);
    assert.ok((await page.locator('#cell-comparison').textContent()).includes(properties[plan.layers[1].temporalField]));
    await page.locator('#folder-clear').click();assert.equal(await page.locator('#capas fieldset').count(),0);assert.equal(await page.locator('#cell-comparison section').count(),0);
    assert.equal(requests.some(r=>!['GET','HEAD'].includes(r.method)),false);
    console.log('PASS carpeta privada real: una selección de carpeta con referencia local, inventario de V13/V14, ambas capas a demanda, atributos originales por celda y evidencia temporal, limpieza sin subida. No prueba el corpus corporativo completo.');
  }
}
