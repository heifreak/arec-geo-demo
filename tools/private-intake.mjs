import { mkdir, lstat, realpath, chmod, copyFile, readFile, writeFile, unlink } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, sep, extname, basename } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const DEFAULT_VAULT = '/tmp/arec-geo-private';
const CHECKOUT = resolve(import.meta.dirname, '..');
const ALLOWED = new Set(['.html', '.htm', '.pdf', '.docx', '.txt', '.md', '.mp4', '.webm', '.mov', '.geojson', '.json']);
export async function prepareVault(directory = DEFAULT_VAULT) {
  const requested = resolve(directory);
  if (!requested.startsWith('/tmp' + sep)) throw Error('La entrada privada debe estar bajo /tmp.');
  await mkdir(requested, { recursive: true, mode: 0o700 });
  const metadata = await lstat(requested);
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) throw Error('La entrada privada debe ser un directorio regular, sin enlaces simbólicos.');
  const root = await realpath(requested);
  // Keep originals out of both the checkout and /workspace (possible served/snapshotted content).
  if (!root.startsWith('/tmp' + sep)) throw Error('La entrada privada debe estar bajo /tmp.');
  if (root === CHECKOUT || root.startsWith(CHECKOUT + sep)) throw Error('Entrada privada dentro del checkout prohibida.');
  await chmod(root, 0o700);
  return root;
}
export async function importPrivateFile(source, directory = DEFAULT_VAULT) {
  const file = resolve(source); const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw Error('Solo se aceptan archivos regulares, sin enlaces.');
  const extension = extname(file).toLowerCase();
  if (!ALLOWED.has(extension)) throw Error('Formato no admitido; no se extraen ZIP ni se reciben secretos.');
  if (stat.size > 32 * 1024 * 1024) throw Error('Entrega cada archivo o fragmento en menos de 32 MiB.');
  const root = await prepareVault(directory);
  const id = randomUUID(); const destination = resolve(root, id + extension);
  await copyFile(file, destination, constants.COPYFILE_EXCL); await chmod(destination, 0o600);
  const sha256 = createHash('sha256').update(await readFile(destination)).digest('hex');
  const receipt = { id, originalName: basename(file), storedName: basename(destination), bytes: stat.size, sha256, use: 'private-reference-only', publicApproved: false };
  // One receipt per file avoids a shared-manifest race and overwrites.
  try { await writeFile(resolve(root, id + '.receipt.json'), JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600, flag: 'wx' }); }
  catch (error) { await unlink(destination); throw error; }
  return receipt;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [command, source] = process.argv.slice(2);
  if (command === 'init') { await prepareVault(); console.log('Entrada privada temporal preparada fuera del checkout. Sin servidor de subida ni publicación.'); }
  else if (command === 'import' && source) { const receipt = await importPrivateFile(source); console.log(`Archivo recibido: ${receipt.id}. Solo referencia privada; no autorizado para publicar.`); }
  else { console.error('Uso: node tools/private-intake.mjs init | import ARCHIVO_ADJUNTO'); process.exitCode = 1; }
}
