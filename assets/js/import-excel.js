/* Excel取り込み（見出し行判定 + 医療機関番号検索） */
window.ExcelImport = window.ExcelImport || {
  previewLimit: 15,
  headerKeywords: [
    '医療機関番号',
    '医療機関名称',
    '受理届出名称',
    '受理記号',
    '受理番号',
    '算定開始年月日',
    '都道府県名',
    '区分'
  ],
  columnHints: {
    medicalId: ['医療機関番号'],
    clinicName: ['医療機関名称'],
    address: ['医療機関所在地（住所）', '医療機関所在地'],
    postalCode: ['医療機関所在地（郵便番号）'],
    phone: ['電話番号'],
    acceptanceName: ['受理届出名称'],
    acceptanceCode: ['受理記号'],
    acceptanceNumber: ['受理番号'],
    startDate: ['算定開始年月日'],
    noteHeader: ['備考（見出し）'],
    noteData: ['備考（データ）'],
    note: ['備考']
  },
  workbook: null,
  fileName: '',
  selectedSheet: '',
  sheetRows: {},
  sheetRowStartBySheet: {},
  headerRowBySheet: {},
  detectedHeaderRowBySheet: {},
  init() {
    this.reset();
  },
  reset() {
    this.workbook = null;
    this.fileName = '';
    this.selectedSheet = '';
    this.sheetRows = {};
    this.sheetRowStartBySheet = {};
    this.headerRowBySheet = {};
    this.detectedHeaderRowBySheet = {};

    const input = document.getElementById('excel-import-file');
    if (input) input.value = '';

    const nameEl = document.getElementById('excel-import-file-name');
    if (nameEl) nameEl.textContent = 'ファイル未選択';

    const meta = document.getElementById('excel-import-meta');
    if (meta) meta.innerHTML = '<div class="excel-import-empty">Excelファイルを選択すると、ここにシート一覧と基本情報を表示します。</div>';

    const sheet = document.getElementById('excel-import-sheet');
    if (sheet) {
      sheet.innerHTML = '<option value="">シートを選択してください</option>';
      sheet.disabled = true;
    }

    const headerRow = document.getElementById('excel-import-header-row');
    if (headerRow) {
      headerRow.value = '1';
      headerRow.min = '1';
      headerRow.max = '1';
      headerRow.disabled = true;
    }

    const headerStatus = document.getElementById('excel-import-header-status');
    if (headerStatus) headerStatus.textContent = '見出し行は未判定です。';

    const cols = document.getElementById('excel-import-columns');
    if (cols) cols.innerHTML = '<div class="excel-import-empty">シートを選択すると列名を表示します。</div>';

    const previewMeta = document.getElementById('excel-import-preview-meta');
    if (previewMeta) previewMeta.textContent = 'まだプレビューはありません。';

    const preview = document.getElementById('excel-import-preview');
    if (preview) preview.innerHTML = '<div class="excel-import-empty">Excelファイルを読み込むと、ここに先頭10〜20行の表を表示します。</div>';

    const searchInput = document.getElementById('excel-search-medical-id');
    if (searchInput) searchInput.value = '';

    this.setError('');
    this.setSearchError('');
    this.renderSearchPlaceholder('Excelを読み込んでから医療機関番号を検索してください。');
  },
  setError(message) {
    const el = document.getElementById('excel-import-error');
    if (!el) return;
    el.textContent = message || '';
    el.style.display = message ? 'block' : 'none';
  },
  setSearchError(message) {
    const el = document.getElementById('excel-search-error');
    if (!el) return;
    el.textContent = message || '';
    el.style.display = message ? 'block' : 'none';
  },
  renderSearchPlaceholder(message) {
    const el = document.getElementById('excel-search-result');
    if (!el) return;
    el.innerHTML = `<div class="excel-import-empty">${this.escapeHtml(message)}</div>`;
  },
  open() {
    this.setError('');
    this.setSearchError('');
    document.getElementById('excel-import-overlay').classList.add('open');
  },
  close() {
    closeOverlay('excel-import-overlay');
  },
  triggerFileInput() {
    const input = document.getElementById('excel-import-file');
    if (input) input.click();
  },
  async handleFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    await this.loadFile(file);
  },
  async loadFile(file) {
    this.setError('');
    this.setSearchError('');
    if (!window.XLSX) {
      this.setError('Excelライブラリの読み込みに失敗しました。ページを再読み込みしてから再度お試しください。');
      return;
    }
    if (!/\.xlsx$/i.test(file.name)) {
      this.setError('現在の第1段階では .xlsx ファイルのみ対応しています。Excel形式を確認してください。');
      return;
    }
    try {
      const ab = await file.arrayBuffer();
      const workbook = XLSX.read(ab, { type: 'array', cellDates: true });
      if (!workbook.SheetNames || !workbook.SheetNames.length) {
        throw new Error('シートが見つかりませんでした。');
      }
      this.workbook = workbook;
      this.fileName = file.name;
      this.selectedSheet = workbook.SheetNames[0];
      this.prepareSheetRows();
      this.renderWorkbookSummary();
      this.renderSheetOptions();
      this.renderCurrentSheet();
    } catch (err) {
      this.workbook = null;
      this.selectedSheet = '';
      this.setError(`Excelファイルの読み込みに失敗しました。破損していない .xlsx ファイルか確認してください。\n${err.message}`);
      this.renderWorkbookSummary();
      this.renderSheetOptions();
      this.renderCurrentSheet();
    }
  },
  prepareSheetRows() {
    this.sheetRows = {};
    this.sheetRowStartBySheet = {};
    this.headerRowBySheet = {};
    this.detectedHeaderRowBySheet = {};
    if (!this.workbook) return;

    this.workbook.SheetNames.forEach(name => {
      const worksheet = this.workbook.Sheets[name];
      const range = worksheet && worksheet['!ref'] ? XLSX.utils.decode_range(worksheet['!ref']) : null;
      const rows = worksheet && worksheet['!ref']
        ? XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', blankrows: true, raw: true })
        : [];
      this.sheetRows[name] = Array.isArray(rows) ? rows : [];
      this.sheetRowStartBySheet[name] = range ? range.s.r + 1 : 1;
      const detected = this.detectHeaderRowIndex(this.sheetRows[name]);
      this.detectedHeaderRowBySheet[name] = detected;
      this.headerRowBySheet[name] = detected;
    });
  },
  renderWorkbookSummary() {
    const nameEl = document.getElementById('excel-import-file-name');
    if (nameEl) nameEl.textContent = this.fileName || 'ファイル未選択';

    const meta = document.getElementById('excel-import-meta');
    if (!meta) return;
    if (!this.workbook) {
      meta.innerHTML = '<div class="excel-import-empty">Excelファイルを選択すると、ここにシート一覧と基本情報を表示します。</div>';
      return;
    }

    const sheetCount = this.workbook.SheetNames.length;
    meta.innerHTML = `
      <div class="excel-import-meta-item"><strong>ファイル名:</strong> ${this.escapeHtml(this.fileName)}</div>
      <div class="excel-import-meta-item"><strong>シート数:</strong> ${sheetCount}</div>
      <div class="excel-import-meta-item"><strong>シート一覧:</strong></div>
      <div class="excel-import-chip-list">
        ${this.workbook.SheetNames.map(name => `<span class="excel-import-chip">${this.escapeHtml(name)}</span>`).join('')}
      </div>
    `;
  },
  renderSheetOptions() {
    const select = document.getElementById('excel-import-sheet');
    if (!select) return;
    if (!this.workbook) {
      select.innerHTML = '<option value="">シートを選択してください</option>';
      select.disabled = true;
      return;
    }
    select.disabled = false;
    select.innerHTML = this.workbook.SheetNames.map(name => `<option value="${this.escapeAttr(name)}">${this.escapeHtml(name)}</option>`).join('');
    select.value = this.selectedSheet;
  },
  handleSheetChange(sheetName) {
    if (!this.workbook) return;
    this.selectedSheet = sheetName;
    if (typeof this.headerRowBySheet[sheetName] !== 'number') {
      const detected = this.detectHeaderRowIndex(this.sheetRows[sheetName] || []);
      this.detectedHeaderRowBySheet[sheetName] = detected;
      this.headerRowBySheet[sheetName] = detected;
    }
    this.renderCurrentSheet();
  },
  handleHeaderRowChange(value) {
    if (!this.workbook || !this.selectedSheet) return;
    const rows = this.sheetRows[this.selectedSheet] || [];
    const rowStart = this.sheetRowStartBySheet[this.selectedSheet] || 1;
    const maxDisplayRow = rowStart + Math.max(rows.length - 1, 0);
    let displayRow = Number(value);
    if (!Number.isFinite(displayRow)) displayRow = rowStart;
    displayRow = Math.max(rowStart, Math.min(maxDisplayRow, Math.floor(displayRow)));
    this.headerRowBySheet[this.selectedSheet] = displayRow - rowStart;

    const input = document.getElementById('excel-import-header-row');
    if (input) input.value = String(displayRow);
    this.renderCurrentSheet();
  },
  detectHeaderRowIndex(rows) {
    let bestIndex = -1;
    let bestScore = -1;
    let bestFilled = -1;

    rows.forEach((row, idx) => {
      const values = Array.isArray(row) ? row : [];
      const normalized = values.map(value => String(value == null ? '' : value).trim()).filter(Boolean);
      if (!normalized.length) return;
      const joined = normalized.join(' | ');
      const score = this.headerKeywords.reduce((sum, keyword) => sum + (joined.includes(keyword) ? 1 : 0), 0);
      const filled = normalized.length;
      if (score > bestScore || (score === bestScore && filled > bestFilled)) {
        bestScore = score;
        bestFilled = filled;
        bestIndex = idx;
      }
    });

    if (bestScore > 0) return bestIndex;
    const firstNonEmpty = rows.findIndex(row => this.isNonEmptyRow(row));
    return firstNonEmpty >= 0 ? firstNonEmpty : 0;
  },
  isNonEmptyRow(row) {
    return Array.isArray(row) && row.some(value => String(value == null ? '' : value).trim() !== '');
  },
  buildHeadersFromRow(row) {
    const values = Array.isArray(row) ? row : [];
    return values.map((value, idx) => {
      const text = String(value == null ? '' : value).trim();
      return text || `列${idx + 1}`;
    });
  },
  getCurrentSheetContext() {
    if (!this.workbook || !this.selectedSheet) return null;
    const rows = this.sheetRows[this.selectedSheet] || [];
    const rowStart = this.sheetRowStartBySheet[this.selectedSheet] || 1;
    if (!rows.length) return { rows, rowStart, headerInternalIndex: 0, headerDisplayRow: rowStart, headers: [] };

    const detectedIndex = typeof this.detectedHeaderRowBySheet[this.selectedSheet] === 'number'
      ? this.detectedHeaderRowBySheet[this.selectedSheet]
      : this.detectHeaderRowIndex(rows);
    const headerIndex = typeof this.headerRowBySheet[this.selectedSheet] === 'number'
      ? this.headerRowBySheet[this.selectedSheet]
      : detectedIndex;
    const safeHeaderIndex = Math.max(0, Math.min(rows.length - 1, headerIndex));
    const headerDisplayRow = rowStart + safeHeaderIndex;
    const headers = this.buildHeadersFromRow(rows[safeHeaderIndex]);
    return { rows, rowStart, detectedIndex, headerInternalIndex: safeHeaderIndex, headerDisplayRow, headers };
  },
  renderCurrentSheet() {
    const headerStatus = document.getElementById('excel-import-header-status');
    const headerInput = document.getElementById('excel-import-header-row');
    const cols = document.getElementById('excel-import-columns');
    const preview = document.getElementById('excel-import-preview');
    const previewMeta = document.getElementById('excel-import-preview-meta');
    if (!cols || !preview || !previewMeta || !headerStatus || !headerInput) return;

    if (!this.workbook || !this.selectedSheet) {
      headerStatus.textContent = '見出し行は未判定です。';
      headerInput.value = '1';
      headerInput.min = '1';
      headerInput.max = '1';
      headerInput.disabled = true;
      cols.innerHTML = '<div class="excel-import-empty">シートを選択すると列名を表示します。</div>';
      preview.innerHTML = '<div class="excel-import-empty">Excelファイルを読み込むと、ここに先頭10〜20行の表を表示します。</div>';
      previewMeta.textContent = 'まだプレビューはありません。';
      this.renderSearchPlaceholder('Excelを読み込んでから医療機関番号を検索してください。');
      return;
    }

    const ctx = this.getCurrentSheetContext();
    const { rows, rowStart, detectedIndex, headerInternalIndex, headerDisplayRow, headers } = ctx;
    if (!rows.length) {
      headerStatus.innerHTML = '<strong>見出し行:</strong> 判定できませんでした';
      headerInput.value = String(rowStart);
      headerInput.min = String(rowStart);
      headerInput.max = String(rowStart);
      headerInput.disabled = true;
      cols.innerHTML = '<div class="excel-import-empty">このシートには表示できるデータがありません。</div>';
      preview.innerHTML = '<div class="excel-import-empty">このシートには表示できるデータがありません。</div>';
      previewMeta.textContent = `選択中シート: ${this.selectedSheet}`;
      this.renderSearchPlaceholder('このシートには検索できるデータがありません。');
      return;
    }

    this.headerRowBySheet[this.selectedSheet] = headerInternalIndex;
    headerInput.disabled = false;
    headerInput.min = String(rowStart);
    headerInput.max = String(rowStart + rows.length - 1);
    headerInput.value = String(headerDisplayRow);

    const detectedDisplayRow = rowStart + detectedIndex;
    const isAuto = headerInternalIndex === detectedIndex;
    headerStatus.innerHTML = isAuto
      ? `<strong>自動判定された見出し行:</strong> ${headerDisplayRow}行目`
      : `<strong>見出し行:</strong> ${headerDisplayRow}行目 <span style="color:var(--text3)">（自動判定候補: ${detectedDisplayRow}行目）</span>`;

    if (!headers.length || !headers.some(Boolean)) {
      cols.innerHTML = '<div class="excel-import-empty">列名を取得できませんでした。見出し行の指定を確認してください。</div>';
      preview.innerHTML = '<div class="excel-import-empty">列名を取得できませんでした。見出し行の指定を確認してください。</div>';
      previewMeta.textContent = `選択中シート: ${this.selectedSheet}`;
      this.renderSearchPlaceholder('見出し行を確認してから医療機関番号を検索してください。');
      return;
    }

    cols.innerHTML = headers.map(name => `<span class="excel-import-chip">${this.escapeHtml(name)}</span>`).join('');

    const dataRows = rows
      .map((row, idx) => ({ row, internalIndex: idx, excelRow: rowStart + idx }))
      .filter(item => item.internalIndex > headerInternalIndex && this.isNonEmptyRow(item.row))
      .slice(0, this.previewLimit);

    previewMeta.textContent = `選択中シート: ${this.selectedSheet} / 見出し行: ${headerDisplayRow}行目 / 列数: ${headers.length} / プレビュー: ${headerDisplayRow + 1}行目から先頭${Math.min(dataRows.length, this.previewLimit)}行`;

    if (!dataRows.length) {
      preview.innerHTML = '<div class="excel-import-empty">見出し行は読み込めましたが、その下に表示できるデータ行はまだありません。</div>';
      this.renderSearchPlaceholder('見出し行を確認してから医療機関番号を検索してください。');
      return;
    }

    preview.innerHTML = `
      <table class="excel-import-table">
        <thead>
          <tr><th>Excel行</th>${headers.map(name => `<th>${this.escapeHtml(name)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${dataRows.map(item => {
            const cells = headers.map((_, idx) => this.escapeHtml(this.formatCell(item.row[idx], headers[idx])));
            return `<tr><td class="excel-import-rowno">${item.excelRow}</td>${cells.map(cell => `<td>${cell || '&nbsp;'}</td>`).join('')}</tr>`;
          }).join('')}
        </tbody>
      </table>
    `;

    this.setSearchError('');
    this.renderSearchPlaceholder('見出し行を確認後、医療機関番号を検索してください。');
  },
  searchMedicalInstitution() {
    this.setSearchError('');
    const ctx = this.getCurrentSheetContext();
    if (!ctx || !this.workbook || !this.selectedSheet) {
      this.setSearchError('先にExcelファイルを読み込んでください。');
      return;
    }

    const input = document.getElementById('excel-search-medical-id');
    const rawInput = input ? input.value.trim() : '';
    const targetMedicalId = this.normalizeMedicalId(rawInput);
    if (!targetMedicalId) {
      this.setSearchError('医療機関番号を入力してください。');
      return;
    }

    const columnMap = this.detectColumnIndexes(ctx.headers);
    if (columnMap.medicalId < 0) {
      this.setSearchError('医療機関番号列を認識できませんでした。見出し行を確認してください。');
      return;
    }
    if (columnMap.acceptanceName < 0) {
      this.setSearchError('受理届出名称列を認識できませんでした。見出し行を確認してください。');
      return;
    }

    const matches = ctx.rows
      .map((row, idx) => ({ row, internalIndex: idx, excelRow: ctx.rowStart + idx }))
      .filter(item => item.internalIndex > ctx.headerInternalIndex && this.isNonEmptyRow(item.row))
      .filter(item => this.normalizeMedicalId(item.row[columnMap.medicalId]) === targetMedicalId);

    if (!matches.length) {
      this.renderSearchResultNoMatch(targetMedicalId);
      return;
    }

    this.renderSearchResultMatches(matches, columnMap, targetMedicalId);
  },
  renderSearchResultNoMatch(targetMedicalId) {
    const el = document.getElementById('excel-search-result');
    if (!el) return;
    el.innerHTML = `
      <div class="excel-import-empty">該当する医療機関番号が見つかりません。<br>検索番号: ${this.escapeHtml(targetMedicalId)}</div>
      <div class="excel-search-placeholder">
        <button class="btn btn-secondary" disabled>届出台帳へ反映（次フェーズ対応予定）</button>
      </div>
    `;
  },
  renderSearchResultMatches(matches, columnMap, targetMedicalId) {
    const el = document.getElementById('excel-search-result');
    if (!el) return;
    const first = matches[0].row;
    const clinicName = this.sanitizePreviewText(this.formatCell(first[columnMap.clinicName], '医療機関名称')) || '—';
    const medicalId = this.normalizeMedicalId(first[columnMap.medicalId]) || targetMedicalId;
    const address = this.sanitizePreviewText(this.joinAddress(first, columnMap));
    const phone = this.sanitizePreviewText(this.formatCell(first[columnMap.phone], '電話番号')) || '—';
    const ledgerPreview = this.convertMatchesToLedgerPreview(matches, columnMap);
    const facilityRows = matches.map(item => {
      const note = this.buildNote(item.row, columnMap);
      return `
        <tr>
          <td class="excel-import-rowno">${item.excelRow}</td>
          <td>${this.escapeHtml(this.formatCell(item.row[columnMap.acceptanceName], '受理届出名称') || '—')}</td>
          <td>${this.escapeHtml(this.formatCell(item.row[columnMap.acceptanceCode], '受理記号') || '—')}</td>
          <td>${this.escapeHtml(this.formatCell(item.row[columnMap.acceptanceNumber], '受理番号') || '—')}</td>
          <td>${this.escapeHtml(this.formatCell(item.row[columnMap.startDate], '算定開始年月日') || '—')}</td>
          <td>${this.escapeHtml(this.sanitizePreviewText(note) || '—')}</td>
        </tr>
      `;
    }).join('');
    const ledgerRows = ledgerPreview.map(item => `
      <tr>
        <td>${this.escapeHtml(item.name)}</td>
        <td>${this.escapeHtml(item.abbr)}</td>
        <td>${this.escapeHtml(item.number)}</td>
        <td>${this.escapeHtml(item.date)}</td>
        <td>${this.escapeHtml(item.categoryLabel)}</td>
        <td>${this.escapeHtml(item.statusLabel)}</td>
        <td>${this.escapeHtml(item.kaiteiLabel)}</td>
        <td>${this.escapeHtml(item.teireiLabel)}</td>
        <td>${this.escapeHtml(item.memo)}</td>
        <td>${this.escapeHtml(item.compareLabel)}</td>
      </tr>
    `).join('');
    const existingCount = ledgerPreview.filter(item => item.compareKey === 'existing').length;
    const newCount = ledgerPreview.filter(item => item.compareKey === 'new').length;

    el.innerHTML = `
      <div class="excel-search-meta">検索番号: ${this.escapeHtml(targetMedicalId)} / 該当件数: ${matches.length}件</div>
      <div class="excel-search-summary">
        <div class="excel-search-card">
          <div class="excel-search-label">医療機関名称</div>
          <div class="excel-search-value">${this.escapeHtml(clinicName)}</div>
        </div>
        <div class="excel-search-card">
          <div class="excel-search-label">医療機関番号</div>
          <div class="excel-search-value">${this.escapeHtml(medicalId)}</div>
        </div>
        <div class="excel-search-card">
          <div class="excel-search-label">医療機関所在地</div>
          <div class="excel-search-value">${this.escapeHtml(address || '—')}</div>
        </div>
        <div class="excel-search-card">
          <div class="excel-search-label">電話番号</div>
          <div class="excel-search-value">${this.escapeHtml(phone)}</div>
        </div>
      </div>
      <div class="excel-import-section-title" style="margin-bottom:8px">該当する施設基準一覧</div>
      <div class="excel-search-result-table-wrap">
        <table class="excel-import-table">
          <thead>
            <tr>
              <th>Excel行</th>
              <th>受理届出名称</th>
              <th>受理記号</th>
              <th>受理番号</th>
              <th>算定開始年月日</th>
              <th>備考</th>
            </tr>
          </thead>
          <tbody>${facilityRows}</tbody>
        </table>
      </div>
      <div class="excel-ledger-summary">
        <span class="excel-ledger-chip">${ledgerPreview.length}件を台帳形式へ変換</span>
        <span class="excel-ledger-chip is-existing">既存あり ${existingCount}件</span>
        <span class="excel-ledger-chip is-new">新規候補 ${newCount}件</span>
      </div>
      <div class="excel-import-section-title" style="margin-bottom:8px">台帳形式プレビュー</div>
      <div class="excel-ledger-note">検索結果を既存の届出台帳に近い形式へ変換した確認用プレビューです。この段階では本体データへ反映しません。</div>
      <div class="excel-search-result-table-wrap">
        <table class="excel-import-table excel-ledger-table">
          <thead>
            <tr>
              <th>施設基準名</th>
              <th>略称</th>
              <th>受理番号</th>
              <th>算定開始</th>
              <th>カテゴリ</th>
              <th>状態</th>
              <th>改定影響</th>
              <th>定例報告</th>
              <th>メモ</th>
              <th>比較</th>
            </tr>
          </thead>
          <tbody>${ledgerRows}</tbody>
        </table>
      </div>
      <div class="excel-search-placeholder">
        <button class="btn btn-secondary" disabled>届出台帳へ反映（次フェーズ対応予定）</button>
        <span>この段階では抽出確認のみを行います。</span>
      </div>
    `;
  },
  convertMatchesToLedgerPreview(matches, columnMap) {
    return matches.map((item, idx) => {
      const row = item.row;
      const rawName = this.formatCell(row[columnMap.acceptanceName], '受理届出名称');
      const rawAbbr = this.formatCell(row[columnMap.acceptanceCode], '受理記号');
      const rawNumber = this.formatCell(row[columnMap.acceptanceNumber], '受理番号');
      const rawDate = this.formatCell(row[columnMap.startDate], '算定開始年月日');
      const rawNote = this.buildNote(row, columnMap);
      const abbr = this.inferLedgerAbbr(rawAbbr, rawName);
      const categoryKey = this.inferLedgerCategory(abbr, rawName);
      const compareKey = this.detectExistingLedgerMatch(abbr, rawNumber) ? 'existing' : 'new';
      return {
        id: `excel-preview-${item.excelRow}-${idx}`,
        name: this.sanitizePreviewText(rawName) || '要確認',
        abbr: this.sanitizePreviewText(abbr) || '要確認',
        number: this.sanitizePreviewText(rawNumber) || '要確認',
        date: this.normalizeDisplayDate(rawDate) || '要確認',
        category: categoryKey,
        categoryLabel: this.getCategoryLabel(categoryKey),
        status: 'yellow',
        statusLabel: '要確認',
        kaitei: 'pending',
        kaiteiLabel: '未判定',
        teireiLabel: this.inferTeireiLabel(abbr),
        memo: this.sanitizePreviewText(rawNote) || '要確認',
        compareKey,
        compareLabel: compareKey === 'existing' ? '既存あり' : '新規候補'
      };
    });
  },
  detectColumnIndexes(headers) {
    const normalizedHeaders = headers.map(header => this.normalizeHeader(header));
    const detect = (key, options = {}) => {
      const candidates = this.columnHints[key] || [];
      for (let i = 0; i < normalizedHeaders.length; i++) {
        if (!normalizedHeaders[i]) continue;
        if (candidates.some(candidate => normalizedHeaders[i] === this.normalizeHeader(candidate))) return i;
      }
      if (options.exactOnly) return -1;
      for (let i = 0; i < normalizedHeaders.length; i++) {
        if (!normalizedHeaders[i]) continue;
        if (candidates.some(candidate => normalizedHeaders[i].includes(this.normalizeHeader(candidate)))) return i;
      }
      return -1;
    };
    return {
      medicalId: detect('medicalId'),
      clinicName: detect('clinicName'),
      address: detect('address'),
      postalCode: detect('postalCode'),
      phone: detect('phone'),
      acceptanceName: detect('acceptanceName'),
      acceptanceCode: detect('acceptanceCode'),
      acceptanceNumber: detect('acceptanceNumber'),
      startDate: detect('startDate'),
      noteHeader: detect('noteHeader'),
      noteData: detect('noteData'),
      note: detect('note', { exactOnly: true })
    };
  },
  normalizeHeader(value) {
    return String(value == null ? '' : value).replace(/\s+/g, '').trim();
  },
  normalizeMedicalId(value) {
    if (value == null) return '';
    const digits = String(value)
      .trim()
      .replace(/\.0+$/, '')
      .replace(/[^\d]/g, '');
    if (!digits) return '';
    return digits.padStart(7, '0');
  },
  joinAddress(row, columnMap) {
    const postal = this.formatCell(row[columnMap.postalCode], '医療機関所在地（郵便番号)');
    const address = this.formatCell(row[columnMap.address], '医療機関所在地（住所)');
    return [postal, address].filter(Boolean).join(' ');
  },
  buildNote(row, columnMap) {
    const noteSingle = this.formatCell(row[columnMap.note], '備考');
    if (noteSingle) return noteSingle;
    const noteHeader = this.formatCell(row[columnMap.noteHeader], '備考（見出し）');
    const noteData = this.formatCell(row[columnMap.noteData], '備考（データ）');
    if (noteHeader && noteData) return `${noteHeader}：${noteData}`;
    return noteHeader || noteData || '';
  },
  formatCell(value, columnName) {
    if (value == null) return '';
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    }
    if (typeof value === 'number') {
      if ((columnName || '').includes('医療機関番号')) {
        return this.normalizeMedicalId(value);
      }
      if ((columnName || '').includes('年月日') && window.XLSX && XLSX.SSF && typeof XLSX.SSF.parse_date_code === 'function') {
        const parsed = XLSX.SSF.parse_date_code(value);
        if (parsed && parsed.y && parsed.m && parsed.d) {
          return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
        }
      }
      return String(value);
    }
    const text = String(value).trim();
    if ((columnName || '').includes('年月日')) {
      return this.normalizeDisplayDate(text) || text;
    }
    return text;
  },
  normalizeDisplayDate(value) {
    if (value == null) return '';
    const text = String(value).trim();
    if (!text) return '';
    const iso = text.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (iso) {
      return `${iso[1]}/${String(iso[2]).padStart(2, '0')}/${String(iso[3]).padStart(2, '0')}`;
    }
    const wareki = text.replace(/\s+/g, '').match(/^(令和|平成|昭和)(\d+)年(\d+)月(\d+)日$/);
    if (wareki) {
      const era = wareki[1];
      const year = Number(wareki[2]);
      const month = Number(wareki[3]);
      const day = Number(wareki[4]);
      const westernYear = era === '令和'
        ? 2018 + year
        : era === '平成'
          ? 1988 + year
          : 1925 + year;
      return `${westernYear}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
    }
    return text.replace(/\s+/g, ' ');
  },
  sanitizePreviewText(value) {
    return String(value == null ? '' : value)
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  },
  inferLedgerAbbr(rawAbbr, rawName) {
    const abbr = this.sanitizePreviewText(rawAbbr);
    if (abbr) return abbr;
    const name = this.sanitizePreviewText(rawName);
    if (name && typeof ABBR_MAP !== 'undefined' && ABBR_MAP[name]) return ABBR_MAP[name];
    return '';
  },
  inferLedgerCategory(abbr, rawName) {
    if (abbr && typeof KM !== 'undefined' && KM[abbr] && KM[abbr].c) return KM[abbr].c;
    const name = this.sanitizePreviewText(rawName);
    if (name && typeof ABBR_MAP !== 'undefined' && ABBR_MAP[name]) {
      const mappedAbbr = ABBR_MAP[name];
      if (typeof KM !== 'undefined' && KM[mappedAbbr] && KM[mappedAbbr].c) return KM[mappedAbbr].c;
    }
    return 'other';
  },
  getCategoryLabel(categoryKey) {
    if (typeof CL !== 'undefined' && CL[categoryKey]) return CL[categoryKey];
    return categoryKey === 'other' ? 'その他' : '要確認';
  },
  inferTeireiLabel(abbr) {
    if (abbr && typeof TEIREI_ROW !== 'undefined' && TEIREI_ROW[abbr]) {
      return this.sanitizePreviewText(TEIREI_ROW[abbr]);
    }
    return '要確認';
  },
  detectExistingLedgerMatch(abbr, number) {
    if (typeof entries === 'undefined' || !Array.isArray(entries)) return false;
    const normalizedAbbr = this.normalizeCompareValue(abbr);
    const normalizedNumber = this.normalizeCompareValue(number);
    return entries.some(entry => {
      return this.normalizeCompareValue(entry.abbr) === normalizedAbbr
        && this.normalizeCompareValue(entry.number) === normalizedNumber;
    });
  },
  normalizeCompareValue(value) {
    return this.sanitizePreviewText(value).replace(/\s+/g, '');
  },
  escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },
  escapeAttr(value) {
    return this.escapeHtml(value);
  }
};

function openExcelImportModal() {
  ExcelImport.open();
}

function closeExcelImportModal() {
  ExcelImport.close();
}

function triggerExcelFileInput() {
  ExcelImport.triggerFileInput();
}

async function handleExcelFileSelect(event) {
  await ExcelImport.handleFile(event);
}

function handleExcelSheetChange(sheetName) {
  ExcelImport.handleSheetChange(sheetName);
}

function handleExcelHeaderRowChange(value) {
  ExcelImport.handleHeaderRowChange(value);
}

function searchExcelMedicalInstitution() {
  ExcelImport.searchMedicalInstitution();
}

ExcelImport.init();
