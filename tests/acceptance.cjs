// Independent acceptance checks. Temporary Chrome profiles and generated fixtures only.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const executablePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const legacyRef = 'e2ad9ee75e20d97b2501920bbd3094f8b209e6cb';
const results = [];
const record = (name, ok) => { results.push({ name, result: ok ? 'PASS' : 'FAIL' }); console.log((ok ? 'PASS: ' : 'FAIL: ') + name); };

async function main() {
  const server = http.createServer(async (req, res) => {
    try {
      let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const legacy = pathname.startsWith('/legacy/');
      if (legacy) pathname = pathname.slice('/legacy'.length);
      if (pathname === '/') pathname = '/index.html';
      const filename = path.resolve(root, '.' + pathname);
      if (!filename.startsWith(path.resolve(root) + path.sep)) throw new Error('Path');
      const body = legacy ? execFileSync('git', ['show', legacyRef + ':' + pathname.slice(1)], { cwd: root }) : await fs.readFile(filename);
      res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[path.extname(filename)] || 'application/octet-stream' }); res.end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  let context;
  const fresh = () => fs.mkdtemp(path.join(os.tmpdir(), 'dental-acceptance-'));
  const open = async (profile, patch, wait = true) => {
    context = await chromium.launchPersistentContext(profile, { executablePath, headless: true });
    await context.route('https://**/*', route => route.fulfill({ body: 'window.pdfjsLib={GlobalWorkerOptions:{}};', contentType: 'text/javascript' }));
    await context.route('**/assets/data/manifest.json*', route => route.fulfill({ status: 503, body: 'Offline acceptance fixture' }));
    if (patch) await context.addInitScript(patch);
    const page = await context.newPage(); await page.goto(url);
    if (wait) await page.evaluate(() => window.dentalAppReady);
    return page;
  };
  const seed = page => page.evaluate(async () => {
    const id = ensureDentistByName('Acceptance fixture');
    const file = await saveCertificateBlob(new Blob(['%PDF-1.4\nORIGINAL\n%%EOF'], { type: 'application/pdf' }), 'record-original', 'file-original', { fileName: 'fixture.pdf' });
    saveTrainingRecords([normalizeTrainingRecord({ id: 'record-original', trainingType: 'custom', customName: 'Fixture training', attendedAt: '2026-08-01', attendeeIds: [id], certificates: [{ id: 'cert-original', storageKey: file.id, fileName: file.fileName, mimeType: file.mimeType, size: file.size }] })]);
    localStorage.setItem('shisetsu_kijun', JSON.stringify([{ id: 700, name: 'Fixture facility', abbr: 'fixture', category: 'basic', status: 'green', kaitei: 'none', number: 'fixture', date: '2026-08-01', memo: '' }]));
    localStorage.setItem('clinic_name', 'Fixture clinic');
    localStorage.setItem('kijun_hist_700', '[{"memo":"Original fixture"}]');
  });
  const snapshot = page => page.evaluate(async () => {
    const storage = Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)]));
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open(DentalBackupRestore.fileDbName, 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const rows = await new Promise((resolve, reject) => { const tx = db.transaction('dentalAdminTrainingCertificates'); const r = tx.objectStore('dentalAdminTrainingCertificates').getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); db.close();
    const files = [];
    for (const row of rows) files.push({ id: row.id, recordId: row.recordId, hash: [...new Uint8Array(await crypto.subtle.digest('SHA-256', await row.blob.arrayBuffer()))].map(v => v.toString(16).padStart(2, '0')).join('') });
    return { storage, files: files.sort((a, b) => a.id.localeCompare(b.id)) };
  });
  const journal = page => page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open(DentalBackupRestore.journalDbName, 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const row = await new Promise((resolve, reject) => { const tx = db.transaction('journal'); const r = tx.objectStore('journal').get('active'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); db.close(); return row;
  });
  const payloadFor = page => page.evaluate(async () => {
    const records = loadTrainingRecords(); records[0].memo = 'Imported fixture';
    const files = await exportTrainingCertificatesForBackup(records);
    files[0].dataUrl = 'data:application/pdf;base64,' + btoa('%PDF-1.4\nNEW\n%%EOF');
    return { _meta: { appVersion: 'fixture' }, shisetsu_kijun: [{ id: 800, name: 'Imported fixture', abbr: 'fixture', category: 'basic', status: 'green', kaitei: 'none', number: 'fixture', date: '2026-08-01', memo: '' }], clinic_name: 'Imported fixture', koushu_list: records, koushu_dentists_v1: loadDentists(), _training_certificates: files, _kijun_hist: { kijun_hist_700: [{ memo: 'Imported history' }] } };
  });
  const restore = (page, payload) => page.evaluate(async payload => {
    try { return { ok: true, result: await DentalBackupRestore.restore(payload, Object.keys(DATA_KEYS)) }; }
    catch (error) { return { ok: false, error: error.message }; }
  }, payload);
  const close = async () => { await context.close(); context = null; };
  try {
    // Repeated failures followed by termination while rollback is deleting its journal.
    const profile = await fresh(); let page = await open(profile); await seed(page);
    const before = await snapshot(page); const payload = await payloadFor(page);
    await page.evaluate(() => {
      const native = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) { if (key.endsWith(':koushu_list')) throw new DOMException('Fixture write failure', 'QuotaExceededError'); return native.call(this, key, value); };
    });
    assert.equal((await restore(page, payload)).ok, false);
    const savedJournal = await journal(page);
    assert.equal(savedJournal.phase, 'prepared'); await close();
    const persistentFault = () => {
      const native = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) { if (key.endsWith(':koushu_list')) throw new DOMException('Fixture repeated failure', 'QuotaExceededError'); return native.call(this, key, value); };
    };
    for (let i = 0; i < 3; i++) {
      page = await open(profile, persistentFault);
      assert.equal(await page.evaluate(() => window.dentalAppReady), false);
      assert.equal(await page.evaluate(() => typeof window.render), 'undefined');
      assert.deepEqual(await journal(page), savedJournal);
      assert.equal((await snapshot(page)).files.find(f => f.id === 'file-original').hash, before.files[0].hash);
      await close();
    }
    record('three failed rollback startups keep journal and original PDF hash intact', true);
    page = await open(profile, () => {
      const native = IDBObjectStore.prototype.delete;
      IDBObjectStore.prototype.delete = function(key) {
        if (this.name === 'journal' && key === 'active') {
          window.recoveryCheckpoint = true;
          const store = this; const keepAlive = () => { store.get('active').onsuccess = keepAlive; };
          keepAlive(); return store.get('active');
        }
        return native.call(this, key);
      };
    }, false);
    await page.waitForFunction(() => window.recoveryCheckpoint);
    const quoted = profile.replace(/'/g, "''");
    const pid = execFileSync('powershell.exe', ['-NoProfile', '-Command', `$p='${quoted}'; Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine.Contains($p) -and $_.CommandLine.Contains('--remote-debugging-pipe') -and -not $_.CommandLine.Contains('--type=') } | Select-Object -ExpandProperty ProcessId`], { encoding: 'utf8' }).trim();
    assert.match(pid, /^\d+$/); process.kill(Number(pid), 'SIGKILL'); context = null;
    page = await open(profile);
    assert.deepEqual(await snapshot(page), before); assert.equal(await journal(page), undefined);
    record('second crash during startup rollback: full data and SHA-256 hashes restored', true);
    await close();

    // A committed operation must retry roll-forward, not revert to pre-import metadata.
    const committedProfile = await fresh(); page = await open(committedProfile); await seed(page);
    const committedPayload = await payloadFor(page); const original = await snapshot(page);
    await page.evaluate(() => {
      const native = IDBObjectStore.prototype.delete;
      IDBObjectStore.prototype.delete = function(key) { if (this.name === 'journal') throw new DOMException('Fixture cleanup failure', 'UnknownError'); return native.call(this, key); };
    });
    assert.equal((await restore(page, committedPayload)).ok, true);
    const committedJournal = await journal(page); assert.equal(committedJournal.phase, 'committed');
    await page.evaluate(() => localStorage.removeItem('koushu_list')); await close();
    for (let i = 0; i < 3; i++) {
      page = await open(committedProfile, persistentFault);
      assert.equal(await page.evaluate(() => window.dentalAppReady), false);
      assert.deepEqual(await journal(page), committedJournal);
      assert.equal((await snapshot(page)).files.find(f => f.id === 'file-original').hash, original.files[0].hash);
      await close();
    }
    page = await open(committedProfile);
    assert.equal(await page.evaluate(() => loadTrainingRecords()[0].memo), 'Imported fixture');
    assert.equal(await journal(page), undefined);
    record('three failed committed-recovery startups followed by successful roll-forward', true);
    await close();

    // Independent reference validation probes. These should reject inconsistent partial imports.
    page = await open(await fresh()); await seed(page);
    const partialBefore = await snapshot(page);
    const partial = await restore(page, { _meta: {}, koushu_dentists_v1: [] });
    const partialAfter = await snapshot(page);
    const orphan = await page.evaluate(() => {
      const ids = new Set(loadDentists().map(d => d.id)); return loadTrainingRecords().some(r => r.attendeeIds.some(id => !ids.has(id)));
    });
    record('partial attendee-master import rejects dangling existing training references', !partial.ok && !orphan && JSON.stringify(partialAfter) === JSON.stringify(partialBefore));
    await close();
    page = await open(await fresh()); await seed(page);
    const missing = await restore(page, { _meta: {}, koushu_list: [{ id: 'new-training', trainingType: 'custom', customName: 'Fixture', attendedAt: '2026-08-01', attendeeIds: ['missing-attendee'], certificates: [] }] });
    const missingOrphan = await page.evaluate(() => {
      const ids = new Set(loadDentists().map(d => d.id)); return loadTrainingRecords().some(r => r.attendeeIds.some(id => !ids.has(id)));
    });
    record('partial training import validates attendees against retained master', !missing.ok && !missingOrphan);
    await close();

    // The old implementation has no Web Lock and can still save its stale in-memory ledger.
    page = await open(await fresh()); await seed(page);
    const old = await context.newPage(); await old.goto(url + 'legacy/');
    assert.equal(await old.evaluate(() => typeof window.DentalBackupRestore), 'undefined');
    const oldTabPayload = await payloadFor(page);
    const accepted = await restore(page, oldTabPayload);
    const intended = await page.evaluate(() => localStorage.getItem('shisetsu_kijun'));
    await old.evaluate(() => save());
    const overwritten = await page.evaluate(() => localStorage.getItem('shisetsu_kijun'));
    record('old-version tab cannot silently overwrite restored ledger', !accepted.ok || overwritten === intended);
    await close();
  } finally { if (context) await close(); await new Promise(resolve => server.close(resolve)); }
  console.log(JSON.stringify({ results, verdict: results.some(r => r.result === 'FAIL') ? 'NO-GO' : 'PASS' }));
  if (results.some(r => r.result === 'FAIL')) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
