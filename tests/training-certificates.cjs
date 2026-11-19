// Run with NODE_PATH pointing to a Playwright installation. Uses a fresh browser context only.
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');

async function main() {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const filename = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
      if (!filename.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
      const data = await fs.readFile(filename);
      const type = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(filename)] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type }); res.end(data);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.TEST_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => { if (['error', 'warning'].includes(msg.type())) errors.push(msg.text()); });
    // Third-party parsers are unrelated to certificate storage; keep this test offline.
    const offlineParser = 'window.pdfjsLib = { GlobalWorkerOptions: {} };';
    await context.route('https://**/*', route => route.fulfill({ body: offlineParser, contentType: 'text/javascript' }));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    assert.equal(await page.evaluate(() => window.dentalAppReady), true);
    assert.deepEqual(errors, [], 'Application startup errors');
    await page.evaluate(() => {
      ensureDentistByName('Test A'); ensureDentistByName('Test B');
      nav('koushu');
      openTrainingRecordModal({ dentistIds: loadDentists().map(d => d.id) });
    });
    await page.locator('#koushu-date').fill('2026-08-01');
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9WQAAAAASUVORK5CYII=', 'base64');
    // Generate a small valid JPEG in the browser, and a PDF with explicit xref offsets.
    const jpg = Buffer.from(await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 2;
      return canvas.toDataURL('image/jpeg').split(',')[1];
    }), 'base64');
    let pdfText = '%PDF-1.4\n';
    const offsets = [0];
    for (const [i, body] of [ '<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >>' ].entries()) {
      offsets.push(Buffer.byteLength(pdfText)); pdfText += `${i + 1} 0 obj\n${body}\nendobj\n`;
    }
    const xref = Buffer.byteLength(pdfText);
    pdfText += 'xref\n0 4\n0000000000 65535 f \n' + offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('') + `trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    const files = [ { name: 'test.PDF', mimeType: 'application/octet-stream', buffer: Buffer.from(pdfText) }, { name: 'test.jpg', mimeType: 'image/jpeg', buffer: jpg }, { name: 'test.png', mimeType: 'image/png', buffer: png } ];
    await page.locator('#koushu-cert-input').setInputFiles(files);
    await page.waitForFunction(() => window._koushuPendingCertificates?.length === 3);
    await page.locator('#koushu-overlay button[onclick="saveKoushu()"]').click();
    await page.waitForFunction(() => loadTrainingRecords()[0]?.certificates.length === 3);
    await page.reload();
    assert.equal(await page.evaluate(() => window.dentalAppReady), true);
    const records = await page.evaluate(() => loadTrainingRecords());
    assert.equal(records[0].attendeeIds.length, 2);
    assert.equal(records[0].certificates.length, 3);
    for (const cert of records[0].certificates) {
      await page.evaluate(async cert => { openCertificateListModal(loadTrainingRecords()[0].id); selectCertificateFromModal(cert.id); }, cert);
      const isPdf = cert.fileName.endsWith('.PDF');
      await page.waitForSelector(isPdf ? '#cert-modal-body embed' : '#cert-modal-body img');
      if (!isPdf) await page.waitForFunction(() => document.querySelector('#cert-modal-body img')?.naturalWidth > 0);
      const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#cert-download-btn').click()]);
      assert.equal(download.suggestedFilename(), cert.fileName);
      const bytes = await fs.readFile(await download.path());
      assert.deepEqual(bytes, files.find(f => f.name === cert.fileName).buffer);
      if (isPdf) {
        const [popup] = await Promise.all([page.waitForEvent('popup'), page.locator('#cert-open-btn').click()]);
        await popup.waitForURL('blob:**');
        await popup.close();
      }
    }
    await page.evaluate(() => closeCertificateOverlay());
    const backup = await page.evaluate(() => exportTrainingCertificatesForBackup(loadTrainingRecords()));
    assert.equal(backup.length, 3);
    const [jsonDownload] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => exportAllData())]);
    const jsonBytes = await fs.readFile(await jsonDownload.path());
    assert.equal(JSON.parse(jsonBytes)._training_certificates.length, 3);
    // Restore in a separate fresh context to avoid clearing any existing data.
    const restoreContext = await browser.newContext();
    await restoreContext.route('https://**/*', route => route.fulfill({ body: offlineParser, contentType: 'text/javascript' }));
    const restorePage = await restoreContext.newPage(); await restorePage.goto(page.url());
    assert.equal(await restorePage.evaluate(() => window.dentalAppReady), true);
    restorePage.on('dialog', dialog => dialog.accept());
    await Promise.all([
      restorePage.waitForEvent('load'),
      restorePage.locator('#import-json-file').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: jsonBytes })
    ]);
    assert.equal(await restorePage.evaluate(() => window.dentalAppReady), true);
    await restorePage.waitForFunction(() => loadTrainingRecords()[0]?.certificates.length === 3);
    const canonical = items => items.map(({ id, ...item }) => item);
    assert.deepEqual(canonical(await restorePage.evaluate(() => exportTrainingCertificatesForBackup(loadTrainingRecords()))), canonical(backup));
    assert.notEqual(await restorePage.evaluate(() => loadTrainingRecords()[0].certificates[0].storageKey), backup[0].id);
    await restorePage.reload();
    assert.equal(await restorePage.evaluate(() => window.dentalAppReady), true);
    assert.equal(await restorePage.evaluate(() => loadTrainingRecords()[0].attendeeIds.length), 2);
    await page.evaluate(id => { editKoushu(id); document.getElementById('koushu-memo').value = 'Edited'; }, records[0].id);
    await page.evaluate(id => removePendingCertificate(id), records[0].certificates[0].id);
    await page.evaluate(() => saveTrainingRecordFromModal());
    assert.equal(await page.evaluate(() => loadTrainingRecords()[0].certificates.length), 2);
    assert.equal(await page.evaluate(id => getCertificateBlob(id), records[0].certificates[0].storageKey), null);
    await page.evaluate(async () => {
      await addPendingTrainingCertificate(new File([new Uint8Array(6 * 1024 * 1024)], 'large.pdf', { type: '' }));
      for (const file of [new File([], 'empty.pdf'), new File([new Uint8Array(21 * 1024 * 1024)], 'too-large.pdf')]) {
        let rejected = false; try { await addPendingTrainingCertificate(file); } catch { rejected = true; }
        if (!rejected) throw new Error('Invalid size accepted');
      }
      if (getTrainingCertificateMimeType('TEST.PDF', '') !== 'application/pdf' || getTrainingCertificateMimeType('scan', 'application/x-pdf') !== 'application/pdf') throw new Error('PDF MIME normalization');
    });
    // A metadata write failure must not delete an existing attachment's body.
    await page.evaluate(async () => {
      const record = loadTrainingRecords()[0];
      editKoushu(record.id);
      const cert = record.certificates[0];
      await removePendingCertificate(cert.id);
      const original = saveTrainingRecords;
      saveTrainingRecords = () => { throw new Error('Test metadata failure'); };
      try { await saveTrainingRecordFromModal(); } finally { saveTrainingRecords = original; }
      if (!(await getCertificateBlob(cert.storageKey))) throw new Error('Existing body was lost');
      if (loadTrainingRecords()[0].certificates.length !== 2) throw new Error('Existing metadata changed');
    });
    // Invalid backup input must not partially overwrite the first item.
    await restorePage.evaluate(async backup => {
      let failed = false;
      try { await importTrainingCertificatesFromBackup([backup[0], { id: 'invalid' }]); } catch { failed = true; }
      if (!failed) throw new Error('Invalid backup accepted');
    }, backup);
    assert.deepEqual(canonical(await restorePage.evaluate(() => exportTrainingCertificatesForBackup(loadTrainingRecords()))), canonical(backup));
    assert.deepEqual(errors, []);
    console.log('PASS: PDF/JPG/PNG upload, multi-attendee save, reload, preview, byte-identical download, backup/restore, edit/delete, size validation, no page errors');
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
