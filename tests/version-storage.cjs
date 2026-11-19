const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const legacyRef = 'e2ad9ee75e20d97b2501920bbd3094f8b209e6cb';
async function main() {
  const server = http.createServer(async (req, res) => {
    try {
      let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const old = pathname.startsWith('/legacy/'); if (old) pathname = pathname.slice(7);
      if (pathname === '/') pathname = '/index.html';
      const filename = path.resolve(root, '.' + pathname); if (!filename.startsWith(root + path.sep)) throw new Error('Path');
      const body = old ? execFileSync('git', ['show', legacyRef + ':' + pathname.slice(1)], { cwd: root }) : await fs.readFile(filename);
      res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' })[path.extname(filename)] || 'application/octet-stream' }); res.end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  let context;
  const open = async profile => {
    context = await chromium.launchPersistentContext(profile, { executablePath: process.env.TEST_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, acceptDownloads: true });
    await context.route('https://**/*', route => route.fulfill({ body: 'window.pdfjsLib={GlobalWorkerOptions:{}};', contentType: 'text/javascript' }));
    await context.route('**/assets/data/manifest.json*', route => route.fulfill({ status: 503, body: 'Offline fixture' }));
  };
  const seed = async () => {
    const page = await context.newPage(); await page.goto(url + 'legacy/');
    await page.evaluate(async () => {
      const id = ensureDentistByName('Migration fixture');
      const stored = await saveCertificateBlob(new Blob(['%PDF-1.4\nMigration fixture\n%%EOF'], { type: 'application/pdf' }), 'migration-training', 'migration-cert', { fileName: 'fixture.pdf' });
      saveTrainingRecords([normalizeTrainingRecord({ id: 'migration-training', trainingType: 'custom', customName: 'Migration', attendedAt: '2026-08-01', attendeeIds: [id], certificates: [{ id: stored.id, storageKey: stored.id, fileName: stored.fileName, mimeType: stored.mimeType, size: stored.size }] })]);
    }); return page;
  };
  const hash = page => page.evaluate(async () => {
    const entry = await getCertificateBlob('migration-cert');
    return [...new Uint8Array(await crypto.subtle.digest('SHA-256', await entry.blob.arrayBuffer()))].map(n => n.toString(16).padStart(2, '0')).join('');
  });
  const current = async patch => {
    const page = await context.newPage(); if (patch) await page.addInitScript(patch); await page.goto(url); return page;
  };
  try {
    for (const fault of ['file-copy', 'activation']) {
      const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'dental-migration-'));
      await open(profile); const old = await seed(); const beforeHash = await hash(old);
      const before = await old.evaluate(() => ({ training: localStorage.getItem('koushu_list'), dentists: localStorage.getItem('koushu_dentists_v1'), facilities: localStorage.getItem('shisetsu_kijun') }));
      const page = await current(fault === 'activation' ? () => {
        const native = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function(value) { if (this.name === 'control') throw new DOMException('Fixture activation failure', 'QuotaExceededError'); return native.call(this, value); };
      } : () => {
        const native = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function(row) { if (this.transaction.db.name === 'dentalAdminTraining_isolated_v1') throw new DOMException('Fixture copy failure', 'QuotaExceededError'); return native.call(this, row); };
      });
      assert.equal(await page.evaluate(() => dentalAppReady), false);
      assert.equal(await hash(old), beforeHash);
      assert.equal(await old.evaluate(() => Object.keys(localStorage).some(key => key.startsWith('dental_isolated_v1:'))), false);
      assert.deepEqual(await old.evaluate(() => ({ training: localStorage.getItem('koushu_list'), dentists: localStorage.getItem('koushu_dentists_v1'), facilities: localStorage.getItem('shisetsu_kijun') })), before);
      await page.close(); const retry = await current(); assert.equal(await retry.evaluate(() => dentalAppReady), true);
      assert.equal(await hash(retry), beforeHash);
      assert.deepEqual(await retry.evaluate(() => ({ training: localStorage.getItem('koushu_list'), dentists: localStorage.getItem('koushu_dentists_v1'), facilities: localStorage.getItem('shisetsu_kijun') })), before);
      await old.evaluate(() => deleteCertificateBlob('migration-cert'));
      assert.equal(await hash(retry), beforeHash);
      const [download] = await Promise.all([retry.waitForEvent('download'), retry.evaluate(() => downloadCertificate(loadTrainingRecords()[0].certificates[0]))]);
      assert.equal((await fs.readFile(await download.path())).toString(), '%PDF-1.4\nMigration fixture\n%%EOF');
      await old.evaluate(() => { entries[0].memo = 'Legacy fixture change'; save(); }); await retry.waitForSelector('#legacy-storage-warning');
      await retry.evaluate(() => deleteCertificateBlob('migration-cert')); // Emulate destination eviction, not a user delete.
      await retry.close(); const missing = await current(); assert.equal(await missing.evaluate(() => dentalAppReady), false);
      assert.equal(await missing.locator('#restore-blocked').isVisible(), true);
      await context.close(); context = null;
      console.log('PASS: ' + fault + ' failure preserves originals; retry copies exact bytes; legacy deletion isolated; eviction blocks startup');
    }
    const inlineProfile = await fs.mkdtemp(path.join(os.tmpdir(), 'dental-inline-migration-'));
    await open(inlineProfile); const inlineOld = await seed();
    const expectedHash = await inlineOld.evaluate(async () => {
      const text = '%PDF-1.4\n' + 'x'.repeat(3 * 1024 * 1024);
      const rows = JSON.parse(localStorage.getItem('koushu_list'));
      rows[0].certificates[0].legacyDataUrl = 'data:application/pdf;base64,' + btoa(text);
      localStorage.setItem('koushu_list', JSON.stringify(rows));
      return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(n => n.toString(16).padStart(2, '0')).join('');
    });
    const interrupted = await current(() => {
      const native = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function(value) { if (this.name === 'control' && value.phase === 'active') throw new DOMException('Fixture first-start interruption', 'UnknownError'); return native.call(this, value); };
    });
    assert.equal(await interrupted.evaluate(() => dentalAppReady), false);
    await inlineOld.evaluate(() => localStorage.removeItem('dental_isolated_v1:koushu_list'));
    await interrupted.close(); const resumed = await current(); assert.equal(await resumed.evaluate(() => dentalAppReady), true);
    assert.equal(await resumed.evaluate(async () => {
      const cert = loadTrainingRecords()[0].certificates[0]; const file = await getCertificateBlob(cert.storageKey);
      return [...new Uint8Array(await crypto.subtle.digest('SHA-256', await file.blob.arrayBuffer()))].map(n => n.toString(16).padStart(2, '0')).join('');
    }), expectedHash);
    assert.equal(await resumed.evaluate(() => localStorage.getItem('koushu_list').length < 5000), true);
    assert.equal(await inlineOld.evaluate(() => localStorage.getItem('koushu_list').length > 4 * 1024 * 1024), true);
    await context.close(); context = null;
    console.log('PASS: large inline legacy PDF moves to Blob without doubling localStorage; durable cutover repairs interrupted first startup');
    const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'dental-migration-crash-'));
    await open(profile); const old = await seed(); const beforeHash = await hash(old);
    await context.close(); context = null; await open(profile);
    const pending = await current(() => {
      const native = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function(row) {
        if (this.transaction.db.name === 'dentalAdminTraining_isolated_v1') {
          window.migrationCheckpoint = true; const store = this;
          const keepAlive = () => { store.get('migration-cert').onsuccess = keepAlive; }; keepAlive(); return store.get('migration-cert');
        }
        return native.call(this, row);
      };
    });
    await pending.waitForFunction(() => window.migrationCheckpoint);
    const quoted = profile.replace(/'/g, "''");
    const pid = execFileSync('powershell.exe', ['-NoProfile', '-Command', `$p='${quoted}'; Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine.Contains($p) -and $_.CommandLine.Contains('--remote-debugging-pipe') -and -not $_.CommandLine.Contains('--type=') } | Select-Object -ExpandProperty ProcessId`], { encoding: 'utf8' }).trim();
    assert.match(pid, /^\d+$/); process.kill(Number(pid), 'SIGKILL'); context = null;
    await open(profile); const recovered = await current(); assert.equal(await recovered.evaluate(() => dentalAppReady), true); assert.equal(await hash(recovered), beforeHash);
    console.log('PASS: Chrome termination during migration retains original files and safely retries activation');
  } finally { if (context) await context.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
