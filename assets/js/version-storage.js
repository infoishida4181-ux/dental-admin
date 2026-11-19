/* Copy-on-first-use isolation: legacy app tabs cannot overwrite this release's stores. */
(function () {
  'use strict';
  const native = window.localStorage;
  const PREFIX = 'dental_isolated_v1:';
  const MARKER = 'dental_isolated_v1_active';
  const FILE_DB = 'dentalAdminTraining_isolated_v1';
  const STORE = 'dentalAdminTrainingCertificates';
  let installed = false;
  let legacyChanged = false;
  window.addEventListener('storage', event => {
    if (event.storageArea === native && (event.key === null || (event.key !== MARKER && !event.key.startsWith(PREFIX)))) {
      legacyChanged = true;
      if (installed) notifyLegacyChange();
    }
  });
  function notifyLegacyChange() {
    if (!document.body || document.getElementById('legacy-storage-warning')) return;
    const note = document.createElement('div'); note.id = 'legacy-storage-warning'; note.setAttribute('role', 'alert');
    note.style.cssText = 'position:fixed;bottom:12px;left:12px;right:12px;z-index:12000;padding:12px;background:#fff7ed;color:#9a3412;border:1px solid #fdba74;overflow-wrap:anywhere';
    note.textContent = '旧版タブでの保存を検出しました。新版のデータは保護されています。旧版の変更は自動同期されません。旧版でJSONバックアップを保存し、旧版タブを閉じてください。必要な変更は新版で確認・復元してください。';
    document.body.append(note);
  }
  function snapshot() {
    const values = [];
    for (let i = 0; i < native.length; i++) {
      const key = native.key(i);
      if (key !== MARKER && !key.startsWith(PREFIX)) values.push([key, native.getItem(key)]);
    }
    return values.sort(([a], [b]) => a.localeCompare(b));
  }
  async function fingerprint(values) {
    return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(values))))].map(n => n.toString(16).padStart(2, '0')).join('');
  }
  async function activation(value) {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('dentalAdminIsolation_v1', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('control', { keyPath: 'id' });
      req.onerror = () => reject(req.error); req.onsuccess = () => resolve(req.result);
    });
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('control', value ? 'readwrite' : 'readonly', { durability: 'strict' }); let result;
        tx.oncomplete = () => resolve(result); tx.onabort = () => reject(tx.error);
        try {
          const req = value ? tx.objectStore('control').put(value) : tx.objectStore('control').get('active');
          req.onsuccess = () => { result = req.result; };
        } catch (error) { tx.abort(); reject(error); }
      });
    } finally { db.close(); }
  }
  function open(name) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(name, 1);
      let blocked = false;
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          const store = req.result.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('recordId', 'recordId', { unique: false });
        }
      };
      req.onblocked = () => { blocked = true; reject(new Error('保存領域が使用中です。他のタブを閉じて再試行してください。')); };
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        if (blocked) { req.result.close(); return; }
        req.result.onversionchange = () => req.result.close(); resolve(req.result);
      };
    });
  }
  async function readFiles(name = 'dentalAdminTraining_v1') {
    const db = await open(name);
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE); let rows;
        tx.objectStore(STORE).getAll().onsuccess = event => { rows = event.target.result; };
        tx.oncomplete = () => resolve(rows); tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  }
  async function copyFiles(rows) {
    const db = await open(FILE_DB);
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite', { durability: 'strict' });
        tx.oncomplete = resolve; tx.onabort = () => reject(tx.error);
        try {
          // This destination is not authoritative until the activation marker is written.
          const store = tx.objectStore(STORE); rows.forEach(row => store.put(row));
        } catch (error) { tx.abort(); reject(error); }
      });
    } finally { db.close(); }
  }
  function logicalKeys() {
    const keys = [];
    for (let i = 0; i < native.length; i++) {
      const key = native.key(i); if (key.startsWith(PREFIX)) keys.push(key.slice(PREFIX.length));
    }
    return keys;
  }
  function install() {
    if (installed) return;
    const methods = Object.assign(Object.create(null), {
      getItem: key => native.getItem(PREFIX + String(key)),
      setItem: (key, value) => native.setItem(PREFIX + String(key), String(value)),
      removeItem: key => native.removeItem(PREFIX + String(key)),
      clear: () => logicalKeys().forEach(key => native.removeItem(PREFIX + key)),
      key: index => logicalKeys()[Number(index)] ?? null
    });
    const facade = new Proxy(Object.create(null), {
      get: (_target, key) => key === 'length' ? logicalKeys().length : typeof key === 'symbol' ? undefined : methods[key] || methods.getItem(key),
      set: (_target, key, value) => { methods.setItem(key, value); return true; },
      deleteProperty: (_target, key) => { methods.removeItem(key); return true; },
      ownKeys: logicalKeys,
      getOwnPropertyDescriptor: (_target, key) => logicalKeys().includes(key) ? { enumerable: true, configurable: true, writable: true, value: methods.getItem(key) } : undefined
    });
    Object.defineProperty(window, 'localStorage', { value: facade, configurable: true });
    installed = true;
    if (legacyChanged) notifyLegacyChange();
  }
  function validateReferences(values, files) {
    const raw = new Map(values).get('koushu_list');
    const records = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(records)) throw new Error('受講記録の形式を確認できません。元の保存データは変更していません。');
    const ids = new Set(files.map(file => String(file.id)));
    for (const record of records) {
      if (record.deletedAt) continue;
      for (const cert of record.certificates || []) {
        if (cert.legacyDataUrl || cert.data || cert.fileData || cert.base64) continue;
        if (!ids.has(String(cert.storageKey || cert.id))) throw new Error('保存済み証明書の本体が見つかりません。元の保存データを削除せずバックアップを確認してください。');
      }
    }
  }
  async function moveInlineFiles(values, files) {
    const data = new Map(values); const raw = data.get('koushu_list');
    if (!raw) return values;
    const records = JSON.parse(raw);
    for (const [recordIndex, record] of records.entries()) {
      const legacy = record.cert || record.certificate || record.certificateFile || record.certFile || record.file
        || (record.fileData || record.base64 || record.data ? { name: record.fileName, type: record.mimeType, data: record.fileData || record.base64 || record.data } : null);
      const certs = record.certificates || (legacy ? [legacy] : []);
      for (const [certIndex, cert] of certs.entries()) {
        let inline = cert.legacyDataUrl || cert.data || cert.fileData || cert.base64;
        if (!inline) continue;
        const fileName = cert.fileName || cert.name || 'certificate';
        const mime = cert.mimeType || cert.type || (/\.pdf$/i.test(fileName) ? 'application/pdf' : /\.png$/i.test(fileName) ? 'image/png' : /\.jpe?g$/i.test(fileName) ? 'image/jpeg' : 'application/octet-stream');
        if (!inline.startsWith('data:')) inline = `data:${mime};base64,${inline}`;
        const match = inline.match(/^data:([^;,]*);base64,([A-Za-z0-9+/\s]*={0,2})$/);
        if (!match) throw new Error('旧形式の証明書データを読み取れません。元のデータは保持されています。');
        const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
        const id = `migrate_${await fingerprint([recordIndex, certIndex, inline])}`;
        const blob = new Blob([bytes], { type: match[1] || mime });
        files.push({ id, recordId: record.id, blob, fileName, mimeType: blob.type, size: blob.size, uploadedAt: cert.uploadedAt || new Date().toISOString() });
        Object.assign(cert, { id: cert.id || id, storageKey: id, fileName, mimeType: blob.type, size: blob.size });
        for (const key of ['legacyDataUrl', 'data', 'fileData', 'base64']) delete cert[key];
      }
      record.certificates = certs;
      for (const key of ['cert', 'certificate', 'certificateFile', 'certFile', 'file', 'fileData', 'base64', 'data']) delete record[key];
    }
    data.set('koushu_list', JSON.stringify(records)); return [...data].sort(([a], [b]) => a.localeCompare(b));
  }
  async function activate() {
    const active = await activation();
    if (active) {
      if (active.phase === 'copied') {
        for (const [key, value] of active.values) native.setItem(PREFIX + key, value);
      }
      if (await fingerprint(snapshot()) !== active.legacyFingerprint) legacyChanged = true;
      install();
      return;
    }
    const before = snapshot();
    const rows = await readFiles();
    validateReferences(before, rows);
    const prepared = await moveInlineFiles(before, rows);
    await copyFiles(rows);
    const copied = await readFiles(FILE_DB);
    if (copied.length !== rows.length || rows.some(row => !copied.some(copy => copy.id === row.id && copy.blob?.size === row.blob?.size))) throw new Error('証明書の移行確認に失敗しました。元の保存データは変更していません。');
    if (JSON.stringify(snapshot()) !== JSON.stringify(before)) throw new Error('旧版の保存データが更新されました。旧版タブを閉じて再読み込みしてください。');
    try {
      logicalKeys().forEach(key => native.removeItem(PREFIX + key));
      prepared.forEach(([key, value]) => native.setItem(PREFIX + key, value));
      // IndexedDB, not a delayed localStorage marker, owns the durable cutover decision.
      await activation({ id: 'active', version: 1, phase: 'copied', values: prepared, legacyFingerprint: await fingerprint(before) });
    } catch (error) {
      if (!(await activation())) logicalKeys().forEach(key => native.removeItem(PREFIX + key));
      throw error;
    }
    install();
  }
  async function validateActive() {
    const active = await activation();
    const required = new Set(['shisetsu_kijun', 'koushu_list', 'koushu_dentists_v1', 'clinic_name']);
    if (active?.values.some(([key]) => required.has(key) && native.getItem(PREFIX + key) === null)) {
      throw new Error('保存情報の一部が見つかりません。既存のバックアップ・旧版データを保護するため起動を停止しました。保存領域を削除しないでください。');
    }
    validateReferences(logicalKeys().map(key => [key, native.getItem(PREFIX + key)]), await readFiles(FILE_DB));
  }
  async function completeActivation() {
    const active = await activation();
    if (active?.phase === 'copied') await activation({ ...active, phase: 'active' });
  }
  window.DentalVersionStorage = { activate, validateActive, completeActivation, isActive: async () => !!(await activation()), fileDbName: FILE_DB, prefix: PREFIX };
})();
