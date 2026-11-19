/* Recover interrupted imports before any application script reads browser storage. */
(function () {
  'use strict';
  let JOURNAL_DB = 'dentalAdminRestore_v1';
  let FILE_DB = 'dentalAdminTraining_v1';
  const FILE_STORE = 'dentalAdminTrainingCertificates';
  const SESSION_LOCK = 'dental-admin-restore-session-v1';
  let releaseSession;
  let sessionFinished;
  let busy = false;

  function openDb(name, store, keyPath) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      let blocked = false;
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(store)) {
          const created = request.result.createObjectStore(store, { keyPath });
          if (name === FILE_DB) created.createIndex('recordId', 'recordId', { unique: false });
        }
      };
      request.onblocked = () => { blocked = true; reject(new Error('保存領域が他のタブで使用中です。他のアプリタブを閉じて再試行してください。')); };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        if (blocked) { request.result.close(); return; }
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
    });
  }

  async function transaction(name, store, mode, run) {
    const db = await openDb(name, store, 'id');
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(store, mode, mode === 'readwrite' ? { durability: 'strict' } : {});
        let result;
        tx.oncomplete = () => resolve(result);
        tx.onabort = () => reject(tx.error || new Error('保存処理が中断されました。'));
        try { run(tx.objectStore(store), value => { result = value; }); }
        catch (error) { tx.abort(); reject(error); }
      });
    } finally { db.close(); }
  }

  const journal = () => transaction(JOURNAL_DB, 'journal', 'readonly', (store, result) => {
    store.get('active').onsuccess = event => result(event.target.result);
  });
  const writeJournal = value => transaction(JOURNAL_DB, 'journal', 'readwrite', store => store.put(value));
  const clearJournal = () => transaction(JOURNAL_DB, 'journal', 'readwrite', store => store.delete('active'));

  async function holdSession() {
    if (!navigator.locks) return;
    await new Promise((resolve, reject) => {
      sessionFinished = navigator.locks.request(SESSION_LOCK, { mode: 'shared' }, async () => {
        await new Promise(release => { releaseSession = release; resolve(); });
      }).catch(reject);
    });
  }

  async function exclusive(work) {
    if (!navigator.locks) throw new Error('安全な復元に必要なブラウザ機能を利用できません。最新のChromeまたはEdgeで開いてください。');
    if (releaseSession) { releaseSession(); releaseSession = null; await sessionFinished; }
    try {
      return await navigator.locks.request(SESSION_LOCK, { mode: 'exclusive', ifAvailable: true }, lock => {
        if (!lock) throw new Error('他のアプリタブが開いています。すべて閉じてから復元を再試行してください。');
        return work();
      });
    } finally { await holdSession(); }
  }

  async function cleanStaged(operation) {
    if (!operation.fileIds.length) return;
    await transaction(FILE_DB, FILE_STORE, 'readwrite', store => {
      operation.fileIds.forEach(id => {
        store.get(id).onsuccess = event => {
          if (event.target.result?.restoreOperationId === operation.operationId) store.delete(id);
        };
      });
    });
  }

  async function recover() {
    const operation = await journal();
    if (!operation) return '';
    if (operation.version !== 1 || !Array.isArray(operation.before) || !Array.isArray(operation.after) || !Array.isArray(operation.fileIds)
      || !['prepared', 'committed'].includes(operation.phase)) {
      throw new Error('復旧記録の形式を確認できません。既存データを保護するため起動を停止しました。');
    }
    if (operation.phase === 'prepared') {
      // Remove only import-owned keys to free quota; the durable journal survives every retry.
      for (const [key] of operation.before) localStorage.removeItem(key);
      for (const [key, value] of operation.before) if (value !== null) localStorage.setItem(key, value);
      await cleanStaged(operation);
    } else if (operation.after.some(([key, value]) => localStorage.getItem(key) !== value)) {
      // Replay committed metadata if shutdown interrupted persistence of localStorage writes.
      for (const [key] of operation.after) localStorage.removeItem(key);
      for (const [key, value] of operation.after) localStorage.setItem(key, value);
    }
    await clearJournal();
    return operation.phase;
  }

  function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
  function requireValid(condition, message) { if (!condition) throw new Error(message); }
  function decodeFile(dataUrl, fileName, mimeType, allowRawBase64 = false) {
    if (allowRawBase64 && typeof dataUrl === 'string' && !dataUrl.startsWith('data:')) {
      dataUrl = `data:${getTrainingCertificateMimeType(fileName, mimeType)};base64,${dataUrl}`;
    }
    requireValid(typeof dataUrl === 'string' && /^data:[^,]*;base64,[A-Za-z0-9+/\s]*={0,2}$/i.test(dataUrl), '添付ファイルの形式が不正です。');
    const blob = dataUrlToBlob(dataUrl);
    requireValid(blob.size > 0 && blob.size <= TRAINING_CERT_MAX_SIZE, '添付ファイルは空でない20MB以下のファイルにしてください。');
    return blob.slice(0, blob.size, getTrainingCertificateMimeType(fileName, mimeType || blob.type));
  }

  function prepare(payload, keys) {
    requireValid(object(payload) && object(payload._meta), '歯科行政管理システムのバックアップJSONを選択してください。');
    requireValid(!payload._training_certificates_warning, '証明書本体が欠落しているバックアップは安全に復元できません。完全なバックアップを使用してください。');
    const data = JSON.parse(JSON.stringify(payload));
    const writes = new Map();
    const arrayKeys = new Set(['shisetsu_kijun', 'koushu_list', 'koushu_dentists_v1', 'teirei_records', ...keys.filter(key => key.startsWith('teirei_'))]);
    keys.forEach(key => {
      if (!Object.hasOwn(data, key)) return;
      const value = data[key];
      if (arrayKeys.has(key)) requireValid(Array.isArray(value) && value.every(object), `${key} のデータ形式が不正です。`);
      else if (key === 'clinic_name') requireValid(typeof value === 'string', '医院名の形式が不正です。');
      else if (key.endsWith('_number_v1') || key === 'official_dataset_last_medical_id_v1') requireValid(typeof value === 'string' || typeof value === 'number', '医療機関コードの形式が不正です。');
      else requireValid(value === null || object(value), `${key} のデータ形式が不正です。`);
      writes.set(key, key === 'clinic_name' ? value : JSON.stringify(value));
    });
    if (Object.hasOwn(data, '_kijun_hist')) {
      requireValid(object(data._kijun_hist), '変更履歴の形式が不正です。');
      for (const [key, value] of Object.entries(data._kijun_hist)) {
        requireValid(key.startsWith('kijun_hist_') && Array.isArray(value) && value.every(object), '変更履歴のキーまたは内容が不正です。');
        writes.set(key, JSON.stringify(value));
      }
    }
    requireValid(writes.size > 0, '復元対象のデータがありません。');
    const operationId = crypto.randomUUID();
    const sourceFiles = new Map();
    if (Object.hasOwn(data, '_training_certificates')) {
      requireValid(Array.isArray(data._training_certificates), '証明書一覧の形式が不正です。');
      for (const item of data._training_certificates) {
        requireValid(object(item) && ['string', 'number'].includes(typeof item.id) && String(item.id) && !sourceFiles.has(String(item.id)), '証明書IDが未設定または重複しています。');
        sourceFiles.set(String(item.id), { ...item, blob: decodeFile(item.dataUrl, item.fileName, item.mimeType) });
      }
    }
    const files = [];
    const usedSources = new Set();
    const recordIds = new Set();
    const certIds = new Set();
    if (data.koushu_list) {
      for (const record of data.koushu_list) {
        record.id = record.id || `training_restore_${crypto.randomUUID()}`;
        requireValid(['string', 'number'].includes(typeof record.id) && !recordIds.has(String(record.id)), '受講記録IDが不正または重複しています。');
        recordIds.add(String(record.id));
        if (Object.hasOwn(record, 'attendeeIds')) requireValid(Array.isArray(record.attendeeIds) && record.attendeeIds.every(id => typeof id === 'string'), '受講者IDの形式が不正です。');
        if (Object.hasOwn(record, 'certificates')) requireValid(Array.isArray(record.certificates), '添付一覧の形式が不正です。');
        const legacy = extractLegacyCertificate(record);
        record.certificates = record.certificates || (legacy ? [legacy] : []);
        record.certificates = record.certificates.map(cert => {
          requireValid(object(cert), '証明書情報の形式が不正です。');
          const sourceId = cert.storageKey || cert.id;
          const source = sourceFiles.get(String(sourceId));
          const inline = cert.legacyDataUrl || cert.data || cert.fileData || cert.base64;
          const fileName = cert.fileName || cert.name || source?.fileName || 'certificate';
          const blob = source?.blob || (inline ? decodeFile(inline, fileName, cert.mimeType || cert.type, true) : null);
          requireValid(blob, '参照先の証明書本体がバックアップにありません。復元を中止しました。');
          requireValid(!source?.recordId || String(source.recordId) === String(record.id), '証明書と受講記録の参照先が一致しません。');
          if (source) { requireValid(!usedSources.has(String(sourceId)), '証明書の保存IDが複数の記録で重複しています。'); usedSources.add(String(sourceId)); }
          const id = cert.id || `cert_restore_${crypto.randomUUID()}`;
          requireValid(['string', 'number'].includes(typeof id) && !certIds.has(String(id)), '証明書IDが重複しています。'); certIds.add(String(id));
          const linked = cert.linkedAttendeeIds || [];
          requireValid(Array.isArray(linked) && linked.every(id => typeof id === 'string' && (record.attendeeIds || []).includes(id)), '証明書の受講者参照が不正です。');
          const storageKey = `restore_${operationId}_${files.length}`;
          const uploadedAt = cert.uploadedAt || source?.uploadedAt || new Date().toISOString();
          files.push({ id: storageKey, recordId: record.id, fileName, mimeType: blob.type, blob, size: blob.size, uploadedAt, restoreOperationId: operationId });
          return { id, storageKey, fileName, mimeType: blob.type, size: blob.size, uploadedAt, linkedAttendeeIds: linked, memo: cert.memo || '' };
        });
        for (const key of ['cert', 'certificate', 'certificateFile', 'certFile', 'file', 'fileData', 'base64', 'data']) delete record[key];
      }
      writes.set('koushu_list', JSON.stringify(data.koushu_list));
    }
    // Validate the final state, including records or attendees omitted from a partial backup.
    const master = data.koushu_dentists_v1 ?? JSON.parse(localStorage.getItem('koushu_dentists_v1') || '[]');
    const records = data.koushu_list ?? JSON.parse(localStorage.getItem('koushu_list') || '[]');
    requireValid(Array.isArray(master) && master.every(object) && Array.isArray(records) && records.every(object), '保持する受講者・受講記録の形式が不正です。');
    let addedLegacyAttendee = false;
    if (data.koushu_list) {
      for (const record of records) {
        const names = Array.isArray(record.attendeeNamesSnapshot) ? record.attendeeNamesSnapshot
          : Array.isArray(record.attendeeNames) ? record.attendeeNames : [record.person, record.attendeeName, record.attendee, record.name].filter(Boolean);
        if (!(record.attendeeIds || []).length && names.length) {
          record.attendeeIds = names.map(name => {
            const normalized = normalizeKoushuName(name);
            requireValid(normalized, '旧形式の受講者名を確認してください。');
            let attendee = master.find(item => normalizeKoushuName(item.name) === normalized);
            if (!attendee) { attendee = createKoushuDentistRecord({ name: normalized }, master); master.push(attendee); addedLegacyAttendee = true; }
            return attendee.id;
          });
        }
      }
      writes.set('koushu_list', JSON.stringify(records));
    }
    const ids = master.map(d => d.id);
    requireValid(ids.every(id => typeof id === 'string' && id) && new Set(ids).size === ids.length, '受講者IDが不正または重複しています。');
    requireValid(records.every(record => (record.attendeeIds || []).every(id => ids.includes(id))), '受講記録が存在しない受講者を参照しています。');
    if (addedLegacyAttendee || data.koushu_dentists_v1) writes.set('koushu_dentists_v1', JSON.stringify(master));
    requireValid(usedSources.size === sourceFiles.size, '受講記録から参照されない証明書本体が含まれています。');
    return { operationId, writes, files };
  }

  async function restore(payload, keys) {
    if (busy) throw new Error('復元処理中です。完了するまでお待ちください。');
    busy = true;
    const wasInert = document.body.inert;
    document.body.inert = true;
    try {
      return await exclusive(async () => {
        if (typeof koushuInlineMigrationPromise !== 'undefined' && koushuInlineMigrationPromise) await koushuInlineMigrationPromise;
        const plan = prepare(payload, keys);
        requireValid(!(await journal()), '未完了の復元があります。アプリを再読み込みして復旧してください。');
        const operation = { id: 'active', version: 1, operationId: plan.operationId, phase: 'prepared',
          before: [...plan.writes.keys()].map(key => [key, localStorage.getItem(key)]), after: [...plan.writes], fileIds: plan.files.map(file => file.id) };
        try {
          await writeJournal(operation);
          if (plan.files.length) await transaction(FILE_DB, FILE_STORE, 'readwrite', store => plan.files.forEach(file => store.add(file)));
          for (const [key, value] of plan.writes) localStorage.setItem(key, value);
          await writeJournal({ ...operation, phase: 'committed' });
        } catch (error) {
          try {
            const recoveredPhase = await recover();
            if (recoveredPhase === 'committed') return { restored: plan.writes.size, certificates: plan.files.length };
          } catch (recoveryError) {
            showBlocked('復元を完了できませんでした。変更前のデータは復旧記録に保管されています。他のタブを閉じ、保存容量を確保して再読み込みしてください。', recoveryError);
            throw new Error('復旧待ちのため操作を停止しました。復旧記録を削除しないでください。');
          }
          throw new Error(`復元に失敗しました。変更前のデータを保持しています。（${error.name || '保存エラー'}）`);
        }
        let cleanupPending = false;
        try { await clearJournal(); } catch { cleanupPending = true; }
        return { restored: plan.writes.size, certificates: plan.files.length, cleanupPending };
      });
    } finally { busy = false; if (!document.getElementById('restore-blocked')) document.body.inert = wasInert; }
  }

  function showBlocked(message, error) {
    document.body.inert = true;
    let box = document.getElementById('restore-blocked');
    if (!box) {
      box = document.createElement('dialog'); box.id = 'restore-blocked';
      const text = document.createElement('p'); const button = document.createElement('button');
      button.textContent = '再読み込みして復旧'; button.onclick = () => location.reload();
      box.append(text, button); document.body.append(box); box.showModal();
    }
    box.querySelector('p').textContent = `${message}（${error?.name || '保存エラー'}）`;
  }

  async function boot(scripts) {
    document.body.inert = true;
    try {
      await holdSession();
      if (!(await DentalVersionStorage.isActive())) {
        await exclusive(async () => {
          if (await journal()) await recover();
          await DentalVersionStorage.activate();
        });
      } else { await DentalVersionStorage.activate(); }
      JOURNAL_DB = 'dentalAdminRestore_isolated_v1';
      FILE_DB = DentalVersionStorage.fileDbName;
      if (await journal()) await exclusive(recover);
      await DentalVersionStorage.validateActive();
      for (const src of scripts) await new Promise((resolve, reject) => {
        const script = document.createElement('script'); script.src = src;
        script.onload = resolve; script.onerror = () => reject(new Error('アプリの読み込みに失敗しました。'));
        document.body.append(script);
      });
      await DentalVersionStorage.completeActivation();
      document.body.inert = false;
      return true;
    } catch (error) {
      showBlocked('保存データの安全確認・復旧を完了できないため、起動を停止しました。保存領域を削除せず再試行してください。', error);
      return false;
    }
  }
  window.DentalBackupRestore = { boot, restore, fileDbName: 'dentalAdminTraining_isolated_v1', journalDbName: 'dentalAdminRestore_isolated_v1' };
})();
