// NODE_PATH must contain Playwright. No user profile or real clinic data is used.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const executablePath = process.env.TEST_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

async function main() {
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : decodeURIComponent(pathname)));
      if (!file.startsWith(root + path.sep)) throw new Error('Path');
      const body = await fs.readFile(file);
      res.writeHead(200, { 'Content-Type': ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' })[path.extname(file)] || 'application/octet-stream' }); res.end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  let context;
  const open = async (profile, blockRecovery = false) => {
    context = await chromium.launchPersistentContext(profile, { executablePath, headless: true });
    await context.route('https://**/*', route => route.fulfill({ body: 'window.pdfjsLib={GlobalWorkerOptions:{}};', contentType: 'text/javascript' }));
    // Disable only the unrelated startup update check, whose checkedAt changes on every launch.
    await context.route('**/assets/data/manifest.json*', route => route.fulfill({ status: 503, body: 'Offline test' }));
    if (blockRecovery) await context.addInitScript(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) { if (key.endsWith(':koushu_list')) throw new DOMException('Recovery still unavailable', 'QuotaExceededError'); return original.call(this, key, value); };
    });
    const page = await context.newPage(); await page.goto(url);
    assert.equal(await page.evaluate(() => window.dentalAppReady), !blockRecovery, 'Startup recovery must finish or block');
    return page;
  };
  const freshProfile = () => fs.mkdtemp(path.join(os.tmpdir(), 'dental-restore-test-'));
  const seed = page => page.evaluate(async () => {
    const dentistId = ensureDentistByName('Dummy dentist');
    const stored = await saveCertificateBlob(new Blob(['%PDF-1.4\nORIGINAL\n%%EOF'], { type: 'application/pdf' }), 'test-record', 'existing-file', { fileName: 'original.pdf' });
    saveTrainingRecords([normalizeTrainingRecord({ id: 'test-record', type: 'custom', customName: 'Dummy training', attendedAt: '2026-08-01', attendeeIds: [dentistId], certificates: [{ id: 'cert-id', storageKey: stored.id, fileName: stored.fileName, mimeType: stored.mimeType, size: stored.size }] })]);
    localStorage.setItem('shisetsu_kijun', '[]');
    localStorage.setItem('clinic_name', 'Original fixture');
    localStorage.setItem('teirei_records', '[]');
    localStorage.setItem('kijun_hist_test', '[{"memo":"Original history"}]');
    localStorage.setItem('unrelated-fixture', 'Untouched');
    for (const key of Object.keys(DATA_KEYS)) {
      if (localStorage.getItem(key) !== null) continue;
      const value = key.startsWith('teirei_') ? [] : key.includes('medical') && !key.includes('cache') ? '1234567' : null;
      localStorage.setItem(key, JSON.stringify(value));
    }
  });
  const snapshot = page => page.evaluate(async () => {
    const storage = Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)]));
    const files = [];
    for (const entry of await getAllTrainingCertificateRecords()) {
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await entry.blob.arrayBuffer()))].map(byte => byte.toString(16).padStart(2, '0')).join('');
      const { blob, ...meta } = entry; files.push({ ...meta, hash });
    }
    return { storage, files: files.sort((a, b) => a.id.localeCompare(b.id)) };
  });
  const payloadFor = page => page.evaluate(async () => {
    const record = JSON.parse(localStorage.getItem('koushu_list'))[0];
    record.memo = 'Imported fixture';
    const files = await exportTrainingCertificatesForBackup([record]);
    files[0].dataUrl = 'data:application/pdf;base64,' + btoa('%PDF-1.4\nREPLACEMENT\n%%EOF');
    const base = {};
    for (const key of Object.keys(DATA_KEYS)) {
      const raw = localStorage.getItem(key);
      if (raw !== null) { try { base[key] = JSON.parse(raw); } catch { base[key] = raw; } }
    }
    return { ...base, _meta: { appVersion: 'test' }, shisetsu_kijun: [{ id: 'new-facility', name: 'Dummy facility' }],
      clinic_name: 'Imported fixture', koushu_list: [record], koushu_dentists_v1: loadDentists(), teirei_records: [{ memo: 'New report' }],
      _kijun_hist: { kijun_hist_test: [{ memo: 'New history' }] }, _training_certificates: files };
  });
  const restore = (page, payload) => page.evaluate(async payload => {
    try { return { ok: true, result: await DentalBackupRestore.restore(payload, Object.keys(DATA_KEYS)) }; }
    catch (error) { return { ok: false, error: error.message }; }
  }, payload);
  const resetFaults = page => page.evaluate(() => { window.undoFault?.(); });
  const pass = name => console.log('PASS: ' + name);

  try {
    const profile = await freshProfile(); let page = await open(profile);
    await seed(page); let before = await snapshot(page); const payload = await payloadFor(page);
    const malformed = [
      null, {}, { _meta: {} }, { ...payload, koushu_list: {} },
      { ...payload, _training_certificates: [] },
      { ...payload, _training_certificates_warning: 'Missing files' },
      { ...payload, _training_certificates: [payload._training_certificates[0], payload._training_certificates[0]] },
      { ...payload, _training_certificates: [{ ...payload._training_certificates[0], recordId: 'wrong-record' }] },
      { ...payload, koushu_dentists_v1: [] },
      { ...payload, _kijun_hist: { unrelated: [] } }
    ];
    for (const input of malformed) { assert.equal((await restore(page, input)).ok, false); assert.deepEqual(await snapshot(page), before); }
    pass('10 incomplete/invalid/missing-body/reference/duplicate cases preserve all keys and SHA-256 hashes');
    for (const fault of ['journal', 'file', 'quota', 'first-key', 'middle-key', 'history', 'commit']) {
      await page.evaluate(fault => {
        const originalPut = IDBObjectStore.prototype.put;
        const originalAdd = IDBObjectStore.prototype.add;
        const originalSet = Storage.prototype.setItem;
        window.undoFault = () => { IDBObjectStore.prototype.put = originalPut; IDBObjectStore.prototype.add = originalAdd; Storage.prototype.setItem = originalSet; };
        let fired = false;
        IDBObjectStore.prototype.put = function(value) {
          if (!fired && this.name === 'journal' && ((fault === 'journal' && value.phase === 'prepared') || (fault === 'commit' && value.phase === 'committed'))) {
            fired = true; throw new DOMException('Dummy journal failure', 'QuotaExceededError');
          }
          return originalPut.call(this, value);
        };
        IDBObjectStore.prototype.add = function(value) {
          if (!fired && this.name === 'dentalAdminTrainingCertificates' && ['file', 'quota'].includes(fault)) {
            fired = true; throw new DOMException('Dummy file failure', fault === 'quota' ? 'QuotaExceededError' : 'UnknownError');
          }
          return originalAdd.call(this, value);
        };
        Storage.prototype.setItem = function(key, value) {
          const logicalKey = key.replace(/^dental_isolated_v1:/, '');
          const target = { 'first-key': 'shisetsu_kijun', 'middle-key': 'koushu_list', history: 'kijun_hist_test' }[fault];
          if (!fired && logicalKey === target) { fired = true; throw new DOMException('Dummy metadata failure', 'QuotaExceededError'); }
          return originalSet.call(this, key, value);
        };
      }, fault);
      assert.equal((await restore(page, payload)).ok, false, fault);
      await resetFaults(page); assert.deepEqual(await snapshot(page), before, fault);
      pass(fault + ' failure rolls back every metadata key, history, references and file hash');
    }
    // Fill actual localStorage quota with a test-only value, then exceed it during restore.
    await page.evaluate(() => { for (let n = 128 * 1024; n <= 12 * 1024 * 1024; n += 128 * 1024) { try { localStorage.setItem('quota-fixture', 'x'.repeat(n)); } catch { break; } } });
    const quotaBefore = await snapshot(page);
    assert.equal((await restore(page, { ...payload, clinic_name: 'x'.repeat(1024 * 1024) })).ok, false);
    assert.deepEqual(await snapshot(page), quotaBefore);
    await page.evaluate(() => localStorage.removeItem('quota-fixture')); pass('real localStorage quota exhaustion preserves all original data');

    await page.evaluate(async () => {
      await saveCertificateBlob(new Blob(['Collision fixture'], { type: 'application/pdf' }), 'collision', 'restore_forced_0', { fileName: 'collision.pdf' });
      const original = crypto.randomUUID.bind(crypto);
      window.undoFault = () => { crypto.randomUUID = original; };
      crypto.randomUUID = () => 'forced';
    });
    before = await snapshot(page);
    assert.equal((await restore(page, payload)).ok, false);
    await resetFaults(page); assert.deepEqual(await snapshot(page), before);
    pass('generated staging ID collision cannot overwrite or delete an unrelated existing file');

    const other = await context.newPage(); await other.goto(url); assert.equal(await other.evaluate(() => dentalAppReady), true);
    assert.equal((await restore(page, payload)).ok, false); assert.deepEqual(await snapshot(page), before);
    await other.close(); pass('another running app tab prevents restore');

    // Persistent metadata failure blocks the app and retains the durable recovery journal.
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) { if (key.endsWith(':koushu_list')) throw new DOMException('Persistent failure', 'QuotaExceededError'); return original.call(this, key, value); };
    });
    assert.equal((await restore(page, payload)).ok, false);
    assert.equal(await page.locator('#restore-blocked').isVisible(), true);
    await context.close(); context = null; page = await open(profile, true);
    assert.equal(await page.locator('#restore-blocked').isVisible(), true);
    assert.equal(await page.evaluate(() => typeof window.render), 'undefined', 'Application scripts must not run before recovery');
    await context.close(); context = null; page = await open(profile);
    assert.deepEqual(await snapshot(page), before); pass('persistent rollback failure blocks app; restart restores all snapshots');

    // Keep the commit-marker transaction pending, then crash the actual Chrome process.
    await page.evaluate(payload => {
      const original = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function(value) {
        if (this.name === 'journal' && value.phase === 'committed') {
          window.crashPointReached = true;
          const store = this;
          const keepAlive = () => { store.get('active').onsuccess = keepAlive; };
          keepAlive(); return store.get('active');
        }
        return original.call(this, value);
      };
      window.interruptedRestore = DentalBackupRestore.restore(payload, Object.keys(DATA_KEYS)).catch(() => {});
    }, payload);
    await page.waitForFunction(() => window.crashPointReached);
    // Browser.crash can leave its DevTools command unresolved. Terminate only this test profile's process.
    const quoted = profile.replace(/'/g, "''");
    const pidText = execFileSync('powershell.exe', ['-NoProfile', '-Command',
      `$p = '${quoted}'; Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine.Contains($p) -and $_.CommandLine.Contains('--remote-debugging-pipe') -and -not $_.CommandLine.Contains('--type=') } | Select-Object -ExpandProperty ProcessId`
    ], { encoding: 'utf8' }).trim();
    assert.match(pidText, /^\d+$/, 'Exactly one isolated test Chrome process must be identified');
    process.kill(Number(pidText), 'SIGKILL'); context = null;
    console.log('INFO: isolated Chrome process forcibly terminated');
    page = await open(profile); assert.deepEqual(await snapshot(page), before);
    pass('Chrome process crash after metadata writes and before commit: startup restores all keys and SHA-256 hashes');

    // A completed import whose cleanup fails must remain committed on restart.
    await page.evaluate(() => {
      const original = IDBObjectStore.prototype.delete;
      IDBObjectStore.prototype.delete = function(key) { if (this.name === 'journal') throw new DOMException('Cleanup failure', 'UnknownError'); return original.call(this, key); };
    });
    const success = await restore(page, payload); assert.equal(success.ok, true); assert.equal(success.result.cleanupPending, true);
    await page.evaluate(() => loadTrainingRecords());
    const committed = await snapshot(page);
    assert.equal(committed.storage.clinic_name, 'Imported fixture');
    assert.equal(committed.files.find(file => file.id === 'existing-file').hash, before.files.find(file => file.id === 'existing-file').hash);
    assert.notEqual(JSON.parse(committed.storage.koushu_list)[0].certificates[0].storageKey, 'existing-file');
    // Emulate a partial localStorage persistence loss after a durable commit marker.
    await page.evaluate(before => {
      localStorage.setItem('clinic_name', before.storage.clinic_name);
      localStorage.setItem('koushu_list', before.storage.koushu_list);
    }, before);
    await context.close(); context = null; page = await open(profile);
    assert.deepEqual(await snapshot(page), committed);
    assert.equal(await page.evaluate(async () => {
      const db = await new Promise((resolve, reject) => { const r = indexedDB.open(DentalBackupRestore.journalDbName, 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
      return new Promise((resolve, reject) => { const tx = db.transaction('journal'); const r = tx.objectStore('journal').get('active'); r.onsuccess = () => { db.close(); resolve(!r.result); }; r.onerror = () => reject(r.error); });
    }), true);
    pass('colliding source ID remapped; original PDF retained; committed metadata replay and cleanup resume on restart');
    const legacyBytes = '%PDF-1.4\nLEGACY\n%%EOF';
    const legacyPayload = { _meta: { appVersion: 'legacy-fixture' }, koushu_list: [{ id: 'legacy-training', type: 'custom', customName: 'Legacy fixture', attendedAt: '2026-08-01', attendeeIds: ['dentist_0001'], cert: { id: 'legacy-cert', name: 'legacy.pdf', type: 'application/pdf', data: 'data:application/pdf;base64,' + Buffer.from(legacyBytes).toString('base64') } }, { id: 123, type: 'custom', customName: 'Numeric ID fixture', attendedAt: '2026-08-01', attendeeIds: ['dentist_0001'], cert: { id: 456, name: 'legacy.pdf', type: 'application/pdf', data: 'data:application/pdf;base64,' + Buffer.from(legacyBytes).toString('base64') } }] };
    assert.equal((await restore(page, legacyPayload)).ok, true);
    assert.equal(await page.evaluate(async () => (await getCertificateBlob(loadTrainingRecords()[0].certificates[0].storageKey)).blob.text()), legacyBytes);
    assert.equal(await page.evaluate(() => loadTrainingRecords()[1].id), 123);
    const legacyState = await snapshot(page);
    await context.close(); context = null; page = await open(profile);
    assert.deepEqual(await snapshot(page), legacyState);
    pass('legacy inline PDF backup restores to fresh storage IDs and survives browser restart');
    console.log('ALL RESTORE SAFETY TESTS PASSED');
  } finally { if (context) await context.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
