import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, stat, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { importPrivateFile, prepareVault } from '../tools/private-intake.mjs';
test('entrada fuera del checkout: permisos restringidos, hash, sin ejecutar HTML ni aprobar publicación', async () => {
  const root = await mkdtemp(join(tmpdir(), 'arec-intake-test-'));
  try {
    const source = join(root, 'reference.html'); const vault = join(root, 'private');
    const text = '<script>throw new Error("TEST-NEVER-EXECUTE")</script>';
    await writeFile(source, text);
    const receipt = await importPrivateFile(source, vault);
    assert.equal(receipt.publicApproved, false); assert.equal(receipt.sha256, createHash('sha256').update(text).digest('hex'));
    assert.equal(await readFile(join(vault, receipt.storedName), 'utf8'), text);
    assert.equal((await stat(vault)).mode & 0o777, 0o700);
    assert.equal((await stat(join(vault, receipt.storedName))).mode & 0o777, 0o600);
    await assert.rejects(prepareVault('/workspace/arec-geo-demo/private-originals'), /bajo \/tmp/);
    await symlink(source, join(root, 'link.html'));
    await assert.rejects(importPrivateFile(join(root, 'link.html'), vault), /regulares/);
    await writeFile(join(root, 'token.env'), 'test-only');
    await assert.rejects(importPrivateFile(join(root, 'token.env'), vault), /Formato no admitido/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
