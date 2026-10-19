import './app.js';
import { descriptorFromHTML, referenceLayerOptions } from './reference-html.js';
const details = document.createElement('details'); details.open = true;
details.innerHTML = `<summary>Demostración privada · archivos de tu computadora</summary>
<p>Este visor nuevo lee el HTML de referencia como texto; no ejecuta sus scripts. Los archivos se usan en memoria. El mapa y Cesium requieren Internet.</p>
<form id="local-pilot-form">
<label>Referencia HTML original<input id="local-reference" type="file" accept=".html,.htm" required></label>
<label>Capa de celdas GeoJSON (puedes agregar varias sucesivamente)<input id="local-cells" type="file" accept=".geojson,.json" required></label>
<label>Variable<select id="local-variable"></select></label>
<label>Subcapa<select id="local-sublayer"><option value="">Regla categórica detectada por campos</option></select></label>
<label class="check"><input id="local-consent" type="checkbox" required>Autorizo revisar estos archivos solo en esta sesión</label>
<p>Selecciona antes la plaza y el ámbito en la barra superior.</p>
<button type="submit">Preparar capa privada</button></form>
<button id="local-download" disabled>Descargar mi descriptor privado</button>
<button id="local-clear" type="button">Retirar capa y descriptor de sesión</button>
<p id="local-status" role="status">Sin archivos privados cargados.</p>`;
document.querySelector('.left-panel').prepend(details);
for (let i = 1; i <= 23; i++) { if (i >= 15 && i <= 18) continue; const option = document.createElement('option'); option.value = 'V' + String(i).padStart(2,'0'); option.textContent = option.value; document.getElementById('local-variable').append(option); }
document.getElementById('local-variable').value = 'V14';
if(document.documentElement.dataset.localPreview==='true'){document.getElementById('scope').value = 'metro_analysis'; document.getElementById('scope').dispatchEvent(new Event('change'));}
async function refreshSublayers() {
  const select=document.getElementById('local-sublayer'); select.replaceChildren(new Option('Regla categórica detectada por campos',''));
  const file=document.getElementById('local-reference').files[0]; if (!file || file.size>2*1024*1024) return;
  try { for (const option of referenceLayerOptions(await file.text(),document.getElementById('local-variable').value)) select.append(new Option(option.name,option.id)); }
  catch { document.getElementById('local-status').textContent='No se pudieron leer las opciones; referencia no ejecutada.'; }
}
document.getElementById('local-reference').addEventListener('change',refreshSublayers);
document.getElementById('local-variable').addEventListener('change',refreshSublayers);
let reviewedDescriptor = null;
document.getElementById('local-pilot-form').addEventListener('submit', async event => {
  event.preventDefault(); const status = document.getElementById('local-status'); const download = document.getElementById('local-download');
  reviewedDescriptor = null; download.disabled = true;
  const reference = document.getElementById('local-reference').files[0]; const cells = document.getElementById('local-cells').files[0];
  if (!reference || !cells || !document.getElementById('local-consent').checked) return;
  if (reference.size > 2*1024*1024 || cells.size > 25*1024*1024) { status.textContent = 'Referencia: máximo 2 MiB; muestra: máximo 25 MiB.'; return; }
  const context = { plaza: document.getElementById('plaza').value, scope: document.getElementById('scope').value, variable: document.getElementById('local-variable').value, logicalId: document.getElementById('local-sublayer').value || undefined };
  try {
    status.textContent = 'Leyendo referencias locales sin ejecutarlas…';
    const descriptor = await descriptorFromHTML(await reference.text(), await cells.text(), context);
    if (context.plaza !== document.getElementById('plaza').value || context.scope !== document.getElementById('scope').value) throw Error('El contexto cambió; vuelve a preparar la capa.');
    for (const [id, file] of [['session-geojson',cells],['session-descriptor',new File([JSON.stringify(descriptor)],'descriptor-privado.json',{type:'application/json'})]]) {
      const transfer = new DataTransfer(); transfer.items.add(file); document.getElementById(id).files = transfer.files;
    }
    document.getElementById('session-consent').checked = true;
    document.getElementById('session-form').requestSubmit();
    reviewedDescriptor = descriptor; download.disabled = false;
    status.textContent = 'Descriptor generado localmente. Comprueba el estado en Muestra privada y activa la capa en Capas territoriales. Puedes descargar tu descriptor privado.';
    document.getElementById('local-reference').value = ''; document.getElementById('local-cells').value = ''; document.getElementById('local-consent').checked = false;
  } catch (error) { status.textContent = `No se preparó la capa: ${error.message}`; }
});
document.getElementById('local-download').addEventListener('click', () => {
  if (!reviewedDescriptor) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(reviewedDescriptor,null,2)],{type:'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = 'descriptor-privado.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
});
document.getElementById('session-clear').addEventListener('click',()=>{ reviewedDescriptor=null; document.getElementById('local-download').disabled=true; document.getElementById('local-status').textContent='Referencias retiradas de esta sesión.'; });

document.getElementById('local-clear').addEventListener('click', () => document.getElementById('session-clear').click());
