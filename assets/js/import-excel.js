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
  lastSearchResult: null,
  lastDatasetPreview: null,
  lastOfficialCompareResult: null,
  init() {
    this.reset();
    this.renderStoredOfficialDatasetSummary();
    this.renderOfficialDatasetBanner();
    this.maybeCheckManifestOnStartup();
  },
  reset() {
    this.workbook = null;
    this.fileName = '';
    this.selectedSheet = '';
    this.sheetRows = {};
    this.sheetRowStartBySheet = {};
    this.headerRowBySheet = {};
    this.detectedHeaderRowBySheet = {};
    this.lastSearchResult = null;
    this.lastDatasetPreview = null;

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
    this.resetDatasetBuilderUI();
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
  resetDatasetBuilderUI() {
    const summary = document.getElementById('excel-dataset-summary');
    if (summary) summary.innerHTML = '<div class="excel-import-empty">Excelを読み込んでから配布用JSONの作成内容を確認できます。</div>';

    const preview = document.getElementById('excel-dataset-preview');
    if (preview) preview.innerHTML = '<div class="excel-import-empty">まだ配布用JSONは作成されていません。</div>';

    const downloadBtn = document.getElementById('excel-dataset-download-btn');
    if (downloadBtn) downloadBtn.disabled = true;
    const prettyBtn = document.getElementById('excel-dataset-download-pretty-btn');
    if (prettyBtn) prettyBtn.disabled = true;
    const sizeEl = document.getElementById('excel-dataset-size-estimate');
    if (sizeEl) sizeEl.textContent = 'まだ計算していません';

    const fields = {
      'excel-dataset-id': '',
      'excel-dataset-name': '',
      'excel-dataset-source-date': '',
      'excel-dataset-source-file': this.fileName || '',
      'excel-dataset-format': 'grouped-by-clinic',
      'excel-dataset-area': 'tokyo',
      'excel-dataset-category': 'dental'
    };
    Object.entries(fields).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.value = value;
    });
  },
  renderDatasetBuilderContext() {
    const summary = document.getElementById('excel-dataset-summary');
    if (!summary) return;
    if (!this.workbook || !this.selectedSheet) {
      summary.innerHTML = '<div class="excel-import-empty">Excelを読み込んでから配布用JSONの作成内容を確認できます。</div>';
      return;
    }
    const ctx = this.getCurrentSheetContext();
    if (!ctx || !ctx.headers || !ctx.headers.length) {
      summary.innerHTML = '<div class="excel-import-empty">見出し行を確認すると、ここにデータセット候補の件数と推定情報を表示します。</div>';
      return;
    }
    this.prefillDatasetMetadata();
    try {
      const payload = this.buildOfficialDatasetFromCurrentSheet({ previewOnly: true });
      const sizeMin = this.estimateJsonSize(payload, false);
      const sizePretty = this.estimateJsonSize(payload, true);
      summary.innerHTML = `
        <div class="dataset-summary-grid">
          <div class="dataset-summary-card"><div class="dataset-summary-label">レコード数</div><div class="dataset-summary-value">${payload.recordCount}件</div></div>
          <div class="dataset-summary-card"><div class="dataset-summary-label">医療機関数</div><div class="dataset-summary-value">${payload.institutionCount}件</div></div>
          <div class="dataset-summary-card"><div class="dataset-summary-label">対象地域</div><div class="dataset-summary-value">${this.escapeHtml(payload.area || 'tokyo')}</div></div>
          <div class="dataset-summary-card"><div class="dataset-summary-label">診療区分</div><div class="dataset-summary-value">${this.escapeHtml(payload.category || 'dental')}</div></div>
        </div>
        <div class="dataset-compare-note">見出し行 ${payload.headerDisplayRow}行目を基準に、${payload.sourceSheetName} シート全体から正規化候補を集計しています。推定サイズ: minify ${sizeMin.label} / pretty ${sizePretty.label}</div>
      `;
      const sizeEl = document.getElementById('excel-dataset-size-estimate');
      if (sizeEl) sizeEl.textContent = `minify ${sizeMin.label} / pretty ${sizePretty.label}`;
    } catch (err) {
      summary.innerHTML = `<div class="excel-import-empty">${this.escapeHtml(err.message)}</div>`;
    }
  },
  prefillDatasetMetadata() {
    const defaults = this.inferDatasetDefaults();
    const assignIfEmpty = (id, value) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (!el.value || el.dataset.autofill !== 'manual') {
        el.value = value || '';
        el.dataset.autofill = 'auto';
      }
      el.addEventListener('input', () => { el.dataset.autofill = 'manual'; }, { once: true });
    };
    assignIfEmpty('excel-dataset-id', defaults.datasetId);
    assignIfEmpty('excel-dataset-name', defaults.datasetName);
    assignIfEmpty('excel-dataset-source-date', defaults.sourceDate);
    assignIfEmpty('excel-dataset-source-file', defaults.sourceFileName);
    assignIfEmpty('excel-dataset-area', defaults.area);
    assignIfEmpty('excel-dataset-category', defaults.category);
  },
  inferDatasetDefaults() {
    const fileName = this.fileName || '';
    const rows = this.selectedSheet ? (this.sheetRows[this.selectedSheet] || []) : [];
    const joinedIntro = rows.slice(0, 5).map(row => (Array.isArray(row) ? row.join(' ') : '')).join(' ');
    const areaMap = [
      { match: '東京', slug: 'tokyo', label: '東京都' },
      { match: '神奈川', slug: 'kanagawa', label: '神奈川県' },
      { match: '千葉', slug: 'chiba', label: '千葉県' },
      { match: '埼玉', slug: 'saitama', label: '埼玉県' }
    ];
    const areaInfo = areaMap.find(item => fileName.includes(item.match) || joinedIntro.includes(item.match)) || { slug: 'tokyo', label: '東京都' };
    const category = fileName.includes('歯科') || joinedIntro.includes('歯科') ? 'dental' : 'medical';
    const versionMatch = fileName.match(/r\d{4}/i);
    const sourceDate = this.extractOfficialSourceDate(joinedIntro);
    return {
      datasetId: `${areaInfo.slug}-${category}-${(versionMatch ? versionMatch[0].toLowerCase() : 'latest')}`.replace(/[^a-z0-9\-]/g, ''),
      datasetName: `${areaInfo.label} ${category === 'dental' ? '歯科施設基準' : '施設基準'} ${sourceDate ? sourceDate.replace(/-/g, '/') : '最新版'}`,
      sourceDate,
      sourceFileName: fileName,
      area: areaInfo.slug,
      category
    };
  },
  extractOfficialSourceDate(text) {
    const match = String(text || '').replace(/\s+/g, '').match(/(令和|平成|昭和)(\d+)年(\d+)月(\d+)日現在/);
    if (!match) return '';
    const era = match[1];
    const year = Number(match[2]);
    const month = Number(match[3]);
    const day = Number(match[4]);
    const westernYear = era === '令和' ? 2018 + year : era === '平成' ? 1988 + year : 1925 + year;
    return `${westernYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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
      this.renderDatasetBuilderContext();
    } catch (err) {
      this.workbook = null;
      this.selectedSheet = '';
      this.setError(`Excelファイルの読み込みに失敗しました。破損していない .xlsx ファイルか確認してください。\n${err.message}`);
      this.renderWorkbookSummary();
      this.renderSheetOptions();
      this.renderCurrentSheet();
      this.resetDatasetBuilderUI();
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
      this.resetDatasetBuilderUI();
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
      this.renderDatasetBuilderContext();
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
      this.renderDatasetBuilderContext();
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
    this.renderDatasetBuilderContext();
  },
  searchMedicalInstitution() {
    this.setSearchError('');
    const ctx = this.getCurrentSheetContext();
    if (!ctx || !this.workbook || !this.selectedSheet) {
      this.lastSearchResult = null;
      this.setSearchError('先にExcelファイルを読み込んでください。');
      return;
    }

    const input = document.getElementById('excel-search-medical-id');
    const rawInput = input ? input.value.trim() : '';
    const targetMedicalId = this.normalizeMedicalId(rawInput);
    if (!targetMedicalId) {
      this.lastSearchResult = null;
      this.setSearchError('医療機関番号を入力してください。');
      return;
    }

    const columnMap = this.detectColumnIndexes(ctx.headers);
    if (columnMap.medicalId < 0) {
      this.lastSearchResult = null;
      this.setSearchError('医療機関番号列を認識できませんでした。見出し行を確認してください。');
      return;
    }
    if (columnMap.acceptanceName < 0) {
      this.lastSearchResult = null;
      this.setSearchError('受理届出名称列を認識できませんでした。見出し行を確認してください。');
      return;
    }

    const matches = ctx.rows
      .map((row, idx) => ({ row, internalIndex: idx, excelRow: ctx.rowStart + idx }))
      .filter(item => item.internalIndex > ctx.headerInternalIndex && this.isNonEmptyRow(item.row))
      .filter(item => this.normalizeMedicalId(item.row[columnMap.medicalId]) === targetMedicalId);

    if (!matches.length) {
      this.lastSearchResult = null;
      this.renderSearchResultNoMatch(targetMedicalId);
      return;
    }

    this.lastSearchResult = { matches, columnMap, targetMedicalId };
    this.renderSearchResultMatches(matches, columnMap, targetMedicalId);
  },
  renderSearchResultNoMatch(targetMedicalId) {
    const el = document.getElementById('excel-search-result');
    if (!el) return;
    el.innerHTML = `
      <div class="excel-import-empty">該当する医療機関番号が見つかりません。<br>検索番号: ${this.escapeHtml(targetMedicalId)}</div>
      <div class="excel-search-placeholder">
        <button class="btn btn-secondary" disabled>新規候補を届出台帳へ追加</button>
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
        <button class="btn btn-primary" onclick="importExcelNewCandidates()" ${newCount > 0 ? '' : 'disabled'}>＋ 新規候補を届出台帳へ追加</button>
        <span>新規候補のみを追加し、既存あり ${existingCount}件はスキップします。</span>
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
        entryDate: this.normalizeEntryDate(rawDate) || '',
        category: categoryKey,
        categoryLabel: this.getCategoryLabel(categoryKey),
        status: 'yellow',
        statusLabel: '要確認',
        kaitei: 'none',
        kaiteiLabel: '変更なし',
        teireiLabel: this.inferTeireiLabel(abbr),
        memo: this.sanitizePreviewText(rawNote) || '要確認',
        compareKey,
        compareLabel: compareKey === 'existing' ? '既存あり' : '新規候補'
      };
    });
  },
  importNewCandidates() {
    if (!this.lastSearchResult || !this.lastSearchResult.matches || !this.lastSearchResult.matches.length) {
      this.setSearchError('先に医療機関番号検索を実行してください。');
      return;
    }
    if (typeof entries === 'undefined' || !Array.isArray(entries)) {
      this.setSearchError('届出台帳データを参照できませんでした。ページを再読み込みしてから再度お試しください。');
      return;
    }
    if (typeof save !== 'function' || typeof render !== 'function') {
      this.setSearchError('届出台帳の保存処理を呼び出せませんでした。');
      return;
    }

    const { matches, columnMap, targetMedicalId } = this.lastSearchResult;
    const ledgerPreview = this.convertMatchesToLedgerPreview(matches, columnMap);
    const existingCount = ledgerPreview.filter(item => item.compareKey === 'existing').length;
    const newCandidates = ledgerPreview.filter(item => item.compareKey === 'new');

    if (!newCandidates.length) {
      this.setSearchError('追加できる新規候補はありません。');
      this.renderSearchResultMatches(matches, columnMap, targetMedicalId);
      return;
    }

    if (!confirm(`新規候補 ${newCandidates.length}件を届出台帳へ追加します。既存あり ${existingCount}件はスキップします。よろしいですか？`)) {
      return;
    }

    const first = matches[0] && matches[0].row ? matches[0].row : [];
    const clinicName = this.sanitizePreviewText(this.formatCell(first[columnMap.clinicName], '医療機関名称')) || '要確認';
    const importedAt = new Date().toISOString();
    const idBase = this.getNextEntryIdBase();
    const addedEntries = newCandidates.map((item, idx) => ({
      id: String(idBase + idx),
      name: item.name === '要確認' ? '要確認' : item.name,
      abbr: item.abbr === '要確認' ? '' : item.abbr,
      number: item.number === '要確認' ? '' : item.number,
      date: item.entryDate || '',
      category: item.category || 'other',
      status: 'yellow',
      kaitei: 'none',
      nextCheck: '',
      memo: this.buildImportedEntryMemo(item, targetMedicalId, clinicName),
      importMeta: {
        source: 'official-excel',
        fileName: this.fileName || '',
        sheetName: this.selectedSheet || '',
        medicalId: targetMedicalId,
        clinicName,
        importedAt,
        mode: 'excel-new-candidate-import'
      }
    }));

    entries.push(...addedEntries);
    save();
    render();
    this.setSearchError('');
    this.searchMedicalInstitution();
    alert(`✅ 新規候補 ${addedEntries.length}件を届出台帳へ追加しました。\n既存あり ${existingCount}件はスキップしました。`);
  },
  buildOfficialDatasetFromCurrentSheet(options = {}) {
    const ctx = this.getCurrentSheetContext();
    if (!ctx || !this.workbook || !this.selectedSheet) {
      throw new Error('先にExcelファイルを読み込んでください。');
    }
    const columnMap = this.detectColumnIndexes(ctx.headers);
    if (columnMap.medicalId < 0 || columnMap.acceptanceName < 0) {
      throw new Error('医療機関番号列または受理届出名称列を認識できませんでした。見出し行を確認してください。');
    }
    const datasetId = (document.getElementById('excel-dataset-id')?.value || '').trim();
    const datasetName = (document.getElementById('excel-dataset-name')?.value || '').trim();
    const sourceDate = (document.getElementById('excel-dataset-source-date')?.value || '').trim();
    const sourceFileName = (document.getElementById('excel-dataset-source-file')?.value || this.fileName || '').trim();
    const format = (document.getElementById('excel-dataset-format')?.value || 'grouped-by-clinic').trim() || 'grouped-by-clinic';
    const area = (document.getElementById('excel-dataset-area')?.value || 'tokyo').trim() || 'tokyo';
    const category = (document.getElementById('excel-dataset-category')?.value || 'dental').trim() || 'dental';
    const createdAt = new Date().toISOString();
    const normalizedRecords = ctx.rows
      .map((row, idx) => ({ row, internalIndex: idx, excelRow: ctx.rowStart + idx }))
      .filter(item => item.internalIndex > ctx.headerInternalIndex && this.isNonEmptyRow(item.row))
      .map(item => this.normalizeOfficialRecord(item, columnMap))
      .filter(record => record.medicalInstitutionNumber && record.acceptedName);
    const groupedClinics = this.groupRecordsByClinic(normalizedRecords);
    const payload = {
      schemaVersion: '1.1.0',
      datasetId: datasetId || this.inferDatasetDefaults().datasetId,
      datasetName: datasetName || this.inferDatasetDefaults().datasetName,
      sourceFileName,
      sourceDate: sourceDate || this.inferDatasetDefaults().sourceDate || '',
      createdAt,
      area,
      category,
      format,
      sourceSheetName: this.selectedSheet,
      headerDisplayRow: ctx.headerDisplayRow
    };
    if (format === 'records') {
      payload.records = normalizedRecords;
    } else {
      payload.recordsByClinic = groupedClinics;
    }
    const stats = this.getOfficialDatasetStats(payload);
    payload.recordCount = stats.recordCount;
    payload.institutionCount = stats.institutionCount;
    payload.facilityCount = stats.facilityCount;
    if (!options.previewOnly) {
      this.lastDatasetPreview = payload;
    }
    return payload;
  },
  normalizeOfficialRecord(item, columnMap) {
    const row = item.row;
    const note = this.buildNote(row, columnMap);
    return {
      medicalInstitutionNumber: this.normalizeMedicalId(row[columnMap.medicalId]),
      clinicName: this.sanitizePreviewText(this.formatCell(row[columnMap.clinicName], '医療機関名称')),
      address: this.buildCompactAddress(row, columnMap),
      phone: this.sanitizePreviewText(this.formatCell(row[columnMap.phone], '電話番号')),
      acceptedName: this.sanitizePreviewText(this.formatCell(row[columnMap.acceptanceName], '受理届出名称')),
      acceptedCode: this.sanitizePreviewText(this.formatCell(row[columnMap.acceptanceCode], '受理記号')),
      acceptedNumber: this.sanitizePreviewText(this.formatCell(row[columnMap.acceptanceNumber], '受理番号')),
      startDate: this.normalizeDisplayDate(this.formatCell(row[columnMap.startDate], '算定開始年月日')),
      remarks: this.sanitizePreviewText(note)
    };
  },
  groupRecordsByClinic(records) {
    const grouped = new Map();
    records.forEach(record => {
      const key = record.medicalInstitutionNumber;
      if (!key) return;
      if (!grouped.has(key)) {
        grouped.set(key, {
          medicalInstitutionNumber: key,
          clinicName: record.clinicName || '',
          address: record.address || '',
          phone: record.phone || '',
          facilities: []
        });
      }
      grouped.get(key).facilities.push({
        acceptedName: record.acceptedName || '',
        acceptedCode: record.acceptedCode || '',
        acceptedNumber: record.acceptedNumber || '',
        startDate: record.startDate || '',
        remarks: record.remarks || ''
      });
    });
    return Array.from(grouped.values());
  },
  generateOfficialDatasetPreview() {
    try {
      const payload = this.buildOfficialDatasetFromCurrentSheet();
      const stats = this.getOfficialDatasetStats(payload);
      const sizeMin = this.estimateJsonSize(payload, false);
      const sizePretty = this.estimateJsonSize(payload, true);
      const preview = document.getElementById('excel-dataset-preview');
      if (preview) {
        preview.innerHTML = `
          <div class="dataset-preview-box">
            <div class="dataset-summary-grid">
              <div class="dataset-summary-card"><div class="dataset-summary-label">datasetId</div><div class="dataset-summary-value">${this.escapeHtml(payload.datasetId)}</div></div>
              <div class="dataset-summary-card"><div class="dataset-summary-label">datasetName</div><div class="dataset-summary-value">${this.escapeHtml(payload.datasetName)}</div></div>
              <div class="dataset-summary-card"><div class="dataset-summary-label">sourceDate</div><div class="dataset-summary-value">${this.escapeHtml(payload.sourceDate || '要確認')}</div></div>
              <div class="dataset-summary-card"><div class="dataset-summary-label">format</div><div class="dataset-summary-value">${this.escapeHtml(payload.format)}</div></div>
              <div class="dataset-summary-card"><div class="dataset-summary-label">医療機関数</div><div class="dataset-summary-value">${stats.institutionCount}件</div></div>
              <div class="dataset-summary-card"><div class="dataset-summary-label">施設基準件数</div><div class="dataset-summary-value">${stats.facilityCount}件</div></div>
              <div class="dataset-summary-card"><div class="dataset-summary-label">JSONサイズ</div><div class="dataset-summary-value">${this.formatBytes(sizeMin.bytes)}</div></div>
            </div>
            <div class="dataset-compare-note">
              <div><strong>sourceFileName:</strong> ${this.escapeHtml(payload.sourceFileName || this.fileName || '要確認')}</div>
              <div><strong>createdAt:</strong> ${this.escapeHtml(payload.createdAt)}</div>
              <div><strong>sourceSheetName:</strong> ${this.escapeHtml(payload.sourceSheetName)}</div>
              <div><strong>出力形式:</strong> minify ${this.escapeHtml(sizeMin.label)} / pretty ${this.escapeHtml(sizePretty.label)}</div>
            </div>
            <div class="excel-import-empty">JSONダウンロード時には ${payload.format==='grouped-by-clinic' ? '<code>recordsByClinic</code>' : '<code>records</code>'} に必要項目のみを保存します。</div>
          </div>
        `;
      }
      const sizeEl = document.getElementById('excel-dataset-size-estimate');
      if (sizeEl) sizeEl.textContent = `minify ${sizeMin.label} / pretty ${sizePretty.label}`;
      const downloadBtn = document.getElementById('excel-dataset-download-btn');
      if (downloadBtn) downloadBtn.disabled = stats.facilityCount === 0;
      const prettyBtn = document.getElementById('excel-dataset-download-pretty-btn');
      if (prettyBtn) prettyBtn.disabled = stats.facilityCount === 0;
      this.setError('');
    } catch (err) {
      this.setError(`配布用JSONの作成に失敗しました。\n${err.message}`);
    }
  },
  downloadOfficialDatasetJson(pretty = false) {
    try {
      const payload = this.lastDatasetPreview || this.buildOfficialDatasetFromCurrentSheet();
      const fileName = `${payload.datasetId || 'official-dataset'}${pretty ? '.pretty' : ''}.json`;
      const blob = new Blob([JSON.stringify(payload, null, pretty ? 2 : 0)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      this.setError('');
    } catch (err) {
      this.setError(`JSONダウンロードに失敗しました。\n${err.message}`);
    }
  },
  estimateJsonSize(payload, pretty = false) {
    const json = JSON.stringify(payload, null, pretty ? 2 : 0);
    const bytes = new TextEncoder().encode(json).length;
    return { bytes, label: this.formatBytes(bytes) };
  },
  formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
  },
  getOfficialDatasetStats(dataset) {
    const flatRecords = this.flattenOfficialDatasetRecords(dataset);
    const institutionSet = new Set(flatRecords.map(record => this.normalizeMedicalId(record.medicalInstitutionNumber || record.medicalId)));
    return {
      recordCount: flatRecords.length,
      facilityCount: flatRecords.length,
      institutionCount: institutionSet.size
    };
  },
  flattenOfficialDatasetRecords(dataset) {
    if (!dataset || typeof dataset !== 'object') return [];
    if (Array.isArray(dataset.recordsByClinic)) {
      return dataset.recordsByClinic.flatMap(clinic => {
        const medicalInstitutionNumber = this.normalizeMedicalId(clinic.medicalInstitutionNumber || clinic.medicalId);
        const clinicName = this.sanitizePreviewText(clinic.clinicName);
        const address = this.sanitizePreviewText(clinic.address);
        const phone = this.sanitizePreviewText(clinic.phone);
        return Array.isArray(clinic.facilities) ? clinic.facilities.map(facility => ({
          medicalInstitutionNumber,
          clinicName,
          address,
          phone,
          acceptedName: this.sanitizePreviewText(facility.acceptedName || facility.acceptanceName),
          acceptedCode: this.sanitizePreviewText(facility.acceptedCode || facility.acceptanceCode),
          acceptedNumber: this.sanitizePreviewText(facility.acceptedNumber || facility.acceptanceNumber),
          startDate: this.normalizeDisplayDate(facility.startDate || facility.startDateDisplay),
          remarks: this.sanitizePreviewText(facility.remarks || facility.note || facility.noteData || '')
        })) : [];
      });
    }
    if (Array.isArray(dataset.records)) {
      return dataset.records.map(record => ({
        medicalInstitutionNumber: this.normalizeMedicalId(record.medicalInstitutionNumber || record.medicalId),
        clinicName: this.sanitizePreviewText(record.clinicName),
        address: this.sanitizePreviewText(record.address),
        phone: this.sanitizePreviewText(record.phone),
        acceptedName: this.sanitizePreviewText(record.acceptedName || record.acceptanceName),
        acceptedCode: this.sanitizePreviewText(record.acceptedCode || record.acceptanceCode),
        acceptedNumber: this.sanitizePreviewText(record.acceptedNumber || record.acceptanceNumber),
        startDate: this.normalizeDisplayDate(record.startDate || record.startDateDisplay),
        remarks: this.sanitizePreviewText(record.remarks || record.note || '')
      }));
    }
    return [];
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
  buildCompactAddress(row, columnMap) {
    const postal = this.formatPostalCode(this.formatCell(row[columnMap.postalCode], '医療機関所在地（郵便番号)'));
    const address = this.sanitizePreviewText(this.formatCell(row[columnMap.address], '医療機関所在地（住所)'));
    return [postal, address].filter(Boolean).join(' ');
  },
  formatPostalCode(value) {
    const digits = String(value == null ? '' : value).replace(/[^\d]/g, '');
    if (digits.length === 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return this.sanitizePreviewText(value);
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
  normalizeEntryDate(value) {
    const displayDate = this.normalizeDisplayDate(value);
    if (!displayDate) return '';
    const parsed = displayDate.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
    if (parsed) {
      return `${parsed[1]}-${parsed[2]}-${parsed[3]}`;
    }
    return this.sanitizePreviewText(String(value == null ? '' : value));
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
  buildImportedEntryMemo(item, medicalId, clinicName) {
    const parts = [];
    if (item.memo && item.memo !== '要確認') {
      parts.push(item.memo);
    }
    parts.push('公式Excel取込');
    parts.push(`医療機関番号:${medicalId}`);
    parts.push(`医療機関名:${clinicName}`);
    return this.sanitizePreviewText(parts.join(' / '));
  },
  getNextEntryIdBase() {
    if (typeof entries === 'undefined' || !Array.isArray(entries) || !entries.length) {
      return Date.now();
    }
    const numericIds = entries
      .map(entry => Number(entry && entry.id))
      .filter(id => Number.isFinite(id));
    if (!numericIds.length) return Date.now();
    return Math.max(Date.now(), Math.max(...numericIds) + 1);
  },
  openOfficialDatasetModal() {
    this.setOfficialDatasetError('');
    this.renderStoredOfficialDatasetSummary();
    if (!this.lastOfficialCompareResult) {
      const result = document.getElementById('official-dataset-result');
      if (result) result.innerHTML = '<div class="excel-import-empty">公式JSONを読み込んでから医療機関番号を入力してください。</div>';
    }
    document.getElementById('official-dataset-overlay').classList.add('open');
  },
  closeOfficialDatasetModal() {
    closeOverlay('official-dataset-overlay');
  },
  setOfficialDatasetError(message) {
    const el = document.getElementById('official-dataset-error');
    if (!el) return;
    el.textContent = message || '';
    el.style.display = message ? 'block' : 'none';
  },
  renderStoredOfficialDatasetSummary() {
    const fileNameEl = document.getElementById('official-dataset-file-name');
    if (fileNameEl) {
      fileNameEl.textContent = officialDataset && officialDataset.datasetId
        ? `${officialDataset.datasetId} を読込中`
        : 'データセット未読込';
    }
    const summary = document.getElementById('official-dataset-summary');
    if (!summary) return;
    const stats = this.getOfficialDatasetStats(officialDataset);
    if (!officialDataset || !stats.facilityCount) {
      summary.innerHTML = '<div class="excel-import-empty">公式JSONを読み込むと、ここに datasetId・作成日・件数などを表示します。</div>';
      return;
    }
    const manifestNote = officialManifestMeta && officialManifestMeta.activeDatasetId
      ? `<div class="dataset-compare-note">manifest.activeDatasetId: <strong>${this.escapeHtml(officialManifestMeta.activeDatasetId)}</strong>${officialManifestMeta.activeDatasetId !== officialDataset.datasetId ? ' / 現在読込中のデータセットと異なります。' : ' / 現在の読込データセットと一致しています。'}</div>`
      : '';
    summary.innerHTML = `
      <div class="dataset-summary-grid">
        <div class="dataset-summary-card"><div class="dataset-summary-label">datasetId</div><div class="dataset-summary-value">${this.escapeHtml(officialDataset.datasetId || '—')}</div></div>
        <div class="dataset-summary-card"><div class="dataset-summary-label">datasetName</div><div class="dataset-summary-value">${this.escapeHtml(officialDataset.datasetName || '—')}</div></div>
        <div class="dataset-summary-card"><div class="dataset-summary-label">sourceDate</div><div class="dataset-summary-value">${this.escapeHtml(officialDataset.sourceDate || '—')}</div></div>
        <div class="dataset-summary-card"><div class="dataset-summary-label">format</div><div class="dataset-summary-value">${this.escapeHtml(officialDataset.format || (Array.isArray(officialDataset.recordsByClinic) ? 'grouped-by-clinic' : 'records'))}</div></div>
        <div class="dataset-summary-card"><div class="dataset-summary-label">施設基準件数</div><div class="dataset-summary-value">${stats.facilityCount}件 / ${stats.institutionCount}医療機関</div></div>
      </div>
      <div class="dataset-compare-note">
        <div><strong>sourceFileName:</strong> ${this.escapeHtml(officialDataset.sourceFileName || '—')}</div>
        <div><strong>area/category:</strong> ${this.escapeHtml(officialDataset.area || '—')} / ${this.escapeHtml(officialDataset.category || '—')}</div>
        <div><strong>createdAt:</strong> ${this.escapeHtml(officialDataset.createdAt || '—')}</div>
      </div>
      ${manifestNote}
    `;
  },
  async handleOfficialDatasetFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    this.setOfficialDatasetError('');
    try {
      const text = await file.text();
      const dataset = JSON.parse(text);
      this.validateOfficialDataset(dataset);
      saveOfficialDataset(dataset);
      this.lastOfficialCompareResult = null;
      this.renderStoredOfficialDatasetSummary();
      this.renderOfficialDatasetBanner();
      const result = document.getElementById('official-dataset-result');
      if (result) result.innerHTML = '<div class="excel-import-empty">データセットを読み込みました。医療機関番号を入力して比較してください。</div>';
    } catch (err) {
      this.setOfficialDatasetError(`公式JSONの読み込みに失敗しました。\n${err.message}`);
    } finally {
      if (event.target) event.target.value = '';
    }
  },
  validateOfficialDataset(dataset) {
    if (!dataset || typeof dataset !== 'object') throw new Error('JSONの形式が不正です。');
    const schema = String(dataset.schemaVersion || '');
    if (!(schema === '1.1.0' || schema.startsWith('official-dataset'))) throw new Error('schemaVersion が対応形式ではありません。');
    if (!dataset.datasetId) throw new Error('datasetId がありません。');
    if (!Array.isArray(dataset.records) && !Array.isArray(dataset.recordsByClinic)) throw new Error('records または recordsByClinic がありません。');
  },
  searchOfficialDatasetMedicalInstitution() {
    this.setOfficialDatasetError('');
    const records = this.flattenOfficialDatasetRecords(officialDataset);
    if (!officialDataset || !records.length) {
      this.setOfficialDatasetError('先に公式JSONデータセットを読み込んでください。');
      return;
    }
    const input = document.getElementById('official-dataset-medical-id');
    const medicalId = this.normalizeMedicalId(input ? input.value.trim() : '');
    if (!medicalId) {
      this.setOfficialDatasetError('医療機関番号を入力してください。');
      return;
    }
    const filtered = records.filter(record => this.normalizeMedicalId(record.medicalInstitutionNumber || record.medicalId) === medicalId);
    const result = document.getElementById('official-dataset-result');
    if (!result) return;
    if (!filtered.length) {
      this.lastOfficialCompareResult = null;
      result.innerHTML = `<div class="excel-import-empty">該当する医療機関番号が見つかりません。<br>検索番号: ${this.escapeHtml(medicalId)}</div>`;
      return;
    }
    const ledgerRows = this.convertOfficialRecordsToLedgerPreview(filtered);
    const compareResult = this.compareOfficialLedgerWithEntries(ledgerRows);
    this.lastOfficialCompareResult = compareResult;
    this.renderOfficialDatasetCompareResult(compareResult, medicalId);
  },
  convertOfficialRecordsToLedgerPreview(records) {
    return records.map((record, idx) => {
      const abbr = this.inferLedgerAbbr(record.acceptedCode || record.acceptanceCode, record.acceptedName || record.acceptanceName);
      const acceptedName = record.acceptedName || record.acceptanceName;
      const acceptedNumber = record.acceptedNumber || record.acceptanceNumber;
      const category = this.inferLedgerCategory(abbr, acceptedName);
      return {
        id: `official-${record.medicalInstitutionNumber || record.medicalId}-${idx}`,
        medicalId: this.normalizeMedicalId(record.medicalInstitutionNumber || record.medicalId),
        clinicName: this.sanitizePreviewText(record.clinicName) || '要確認',
        name: this.sanitizePreviewText(acceptedName) || '要確認',
        abbr: this.sanitizePreviewText(abbr) || '要確認',
        number: this.sanitizePreviewText(acceptedNumber) || '要確認',
        date: this.normalizeDisplayDate(record.startDateDisplay || record.startDate) || '要確認',
        entryDate: this.normalizeEntryDate(record.startDateDisplay || record.startDate) || '',
        category,
        categoryLabel: this.getCategoryLabel(category),
        status: 'yellow',
        statusLabel: '要確認',
        kaitei: 'none',
        kaiteiLabel: '変更なし',
        teireiLabel: this.inferTeireiLabel(abbr),
        memo: this.sanitizePreviewText(record.remarks || record.note) || '要確認',
        address: this.sanitizePreviewText(record.address) || '—',
        phone: this.sanitizePreviewText(record.phone) || '—'
      };
    });
  },
  compareOfficialLedgerWithEntries(ledgerRows) {
    const exactMatches = [];
    const changedCandidates = [];
    const newCandidates = [];
    const comparedRows = [];
    const officialAbbrs = new Set();
    ledgerRows.forEach(item => {
      officialAbbrs.add(this.normalizeCompareValue(item.abbr));
      const sameAbbrEntries = Array.isArray(entries)
        ? entries.filter(entry => this.normalizeCompareValue(entry.abbr) === this.normalizeCompareValue(item.abbr))
        : [];
      const exact = sameAbbrEntries.find(entry =>
        this.normalizeCompareValue(entry.number) === this.normalizeCompareValue(item.number) &&
        this.normalizeEntryDate(entry.date) === (item.entryDate || '')
      );
      if (exact) {
        const compared = { ...item, compareStatus: 'exact', compareLabel: '既存一致', existingEntry: exact };
        exactMatches.push(compared);
        comparedRows.push(compared);
        return;
      }
      if (sameAbbrEntries.length) {
        const compared = { ...item, compareStatus: 'changed', compareLabel: '変更候補', existingEntry: sameAbbrEntries[0] };
        changedCandidates.push(compared);
        comparedRows.push(compared);
        return;
      }
      const compared = { ...item, compareStatus: 'new', compareLabel: '新規候補' };
      newCandidates.push(compared);
      comparedRows.push(compared);
    });
    const removedCandidates = Array.isArray(entries)
      ? entries.filter(entry => !officialAbbrs.has(this.normalizeCompareValue(entry.abbr))).map(entry => ({
          id: `removed-${entry.id}`,
          name: entry.name,
          abbr: entry.abbr,
          number: entry.number,
          date: entry.date ? entry.date.replace(/-/g, '/') : '—',
          memo: entry.memo || '—',
          compareStatus: 'removed',
          compareLabel: '公式データから消えた候補'
        }))
      : [];
    const clinicName = ledgerRows[0]?.clinicName || '要確認';
    const address = ledgerRows[0]?.address || '—';
    const phone = ledgerRows[0]?.phone || '—';
    return { clinicName, address, phone, ledgerRows: comparedRows, exactMatches, changedCandidates, newCandidates, removedCandidates };
  },
  renderOfficialDatasetCompareResult(compareResult, medicalId) {
    const result = document.getElementById('official-dataset-result');
    if (!result) return;
    const rows = compareResult.ledgerRows.map(item => {
      const compareClass = item.compareStatus === 'exact' ? 'exact' : item.compareStatus === 'changed' ? 'changed' : 'new';
      return `
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
          <td><span class="dataset-compare-chip ${compareClass}">${this.escapeHtml(item.compareLabel)}</span></td>
        </tr>
      `;
    }).join('');
    const removedRows = compareResult.removedCandidates.map(item => `
      <tr>
        <td>${this.escapeHtml(item.name || '—')}</td>
        <td>${this.escapeHtml(item.abbr || '—')}</td>
        <td>${this.escapeHtml(item.number || '—')}</td>
        <td>${this.escapeHtml(item.date || '—')}</td>
        <td>${this.escapeHtml(item.memo || '—')}</td>
      </tr>
    `).join('');
    result.innerHTML = `
      <div class="excel-search-meta">検索番号: ${this.escapeHtml(medicalId)}</div>
      <div class="excel-search-summary">
        <div class="excel-search-card"><div class="excel-search-label">医療機関名称</div><div class="excel-search-value">${this.escapeHtml(compareResult.clinicName)}</div></div>
        <div class="excel-search-card"><div class="excel-search-label">医療機関番号</div><div class="excel-search-value">${this.escapeHtml(medicalId)}</div></div>
        <div class="excel-search-card"><div class="excel-search-label">医療機関所在地</div><div class="excel-search-value">${this.escapeHtml(compareResult.address)}</div></div>
        <div class="excel-search-card"><div class="excel-search-label">電話番号</div><div class="excel-search-value">${this.escapeHtml(compareResult.phone)}</div></div>
      </div>
      <div class="excel-ledger-summary">
        <span class="excel-ledger-chip is-new">新規候補 ${compareResult.newCandidates.length}件</span>
        <span class="excel-ledger-chip is-existing">既存一致 ${compareResult.exactMatches.length}件</span>
        <span class="excel-ledger-chip is-new" style="background:var(--yellow-bg);border-color:#fde68a;color:var(--yellow)">変更候補 ${compareResult.changedCandidates.length}件</span>
        <span class="excel-ledger-chip" style="background:var(--red-bg);border-color:#fecaca;color:var(--red)">消えた候補 ${compareResult.removedCandidates.length}件</span>
      </div>
      <div class="dataset-compare-note">既存台帳を自動上書きせず、まずは差分だけ確認します。反映できるのは新規候補のみです。</div>
      <div class="excel-search-result-table-wrap">
        <table class="excel-import-table excel-ledger-table">
          <thead>
            <tr><th>施設基準名</th><th>略称</th><th>受理番号</th><th>算定開始</th><th>カテゴリ</th><th>状態</th><th>改定影響</th><th>定例報告</th><th>メモ</th><th>比較</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      ${compareResult.removedCandidates.length ? `
        <div class="excel-import-section-title" style="margin:14px 0 8px">公式データから消えた候補</div>
        <div class="excel-search-result-table-wrap">
          <table class="excel-import-table">
            <thead><tr><th>施設基準名</th><th>略称</th><th>受理番号</th><th>算定開始</th><th>メモ</th></tr></thead>
            <tbody>${removedRows}</tbody>
          </table>
        </div>` : ''}
      <div class="excel-search-placeholder">
        <button class="btn btn-primary" onclick="applyOfficialDatasetNewCandidates()" ${compareResult.newCandidates.length ? '' : 'disabled'}>＋ 新規候補を届出台帳へ追加</button>
        <span>既存一致・変更候補・消えた候補は確認のみで、自動更新しません。</span>
      </div>
    `;
  },
  applyOfficialDatasetNewCandidates() {
    if (!this.lastOfficialCompareResult) {
      this.setOfficialDatasetError('先に公式JSONから医療機関番号を抽出してください。');
      return;
    }
    const newCandidates = this.lastOfficialCompareResult.newCandidates || [];
    const exactCount = this.lastOfficialCompareResult.exactMatches.length;
    const changedCount = this.lastOfficialCompareResult.changedCandidates.length;
    if (!newCandidates.length) {
      this.setOfficialDatasetError('追加できる新規候補はありません。');
      return;
    }
    if (!confirm(`新規候補 ${newCandidates.length}件を届出台帳へ追加します。既存一致 ${exactCount}件、変更候補 ${changedCount}件はスキップします。よろしいですか？`)) {
      return;
    }
    const importedAt = new Date().toISOString();
    const idBase = this.getNextEntryIdBase();
    const added = newCandidates.map((item, idx) => ({
      id: String(idBase + idx),
      name: item.name === '要確認' ? '要確認' : item.name,
      abbr: item.abbr === '要確認' ? '' : item.abbr,
      number: item.number === '要確認' ? '' : item.number,
      date: item.entryDate || '',
      category: item.category || 'other',
      status: 'yellow',
      kaitei: 'none',
      nextCheck: '',
      memo: this.buildImportedEntryMemo(item, item.medicalId, item.clinicName),
      importMeta: {
        source: 'official-dataset',
        datasetId: officialDataset?.datasetId || '',
        datasetName: officialDataset?.datasetName || '',
        medicalId: item.medicalId,
        clinicName: item.clinicName,
        importedAt,
        mode: 'official-dataset-new-candidate-import'
      }
    }));
    entries.push(...added);
    save();
    render();
    this.renderOfficialDatasetBanner();
    this.searchOfficialDatasetMedicalInstitution();
    alert(`✅ 新規候補 ${added.length}件を届出台帳へ追加しました。\n既存一致 ${exactCount}件、変更候補 ${changedCount}件はスキップしました。`);
  },
  async loadOfficialDatasetFromManifest() {
    this.setOfficialDatasetError('');
    if (window.location && window.location.protocol === 'file:') {
      this.setOfficialDatasetError('file:// では manifest の自動取得は利用できません。GitHub Pages 公開後は ./assets/data/manifest.json から最新版確認ができます。');
      return;
    }
    try {
      const manifest = await this.fetchOfficialManifest();
      const active = Array.isArray(manifest.datasets)
        ? manifest.datasets.find(item => item.datasetId === manifest.activeDatasetId)
        : null;
      if (!active || !active.path) {
        throw new Error('manifest.json に activeDatasetId または path が設定されていません。');
      }
      const response = await fetch(`${active.path}?t=${Date.now()}`);
      if (!response.ok) throw new Error(`データセット取得に失敗しました (${response.status})`);
      const dataset = await response.json();
      this.validateOfficialDataset(dataset);
      saveOfficialDataset(dataset);
      this.lastOfficialCompareResult = null;
      this.renderStoredOfficialDatasetSummary();
      this.renderOfficialDatasetBanner();
      const result = document.getElementById('official-dataset-result');
      if (result) result.innerHTML = '<div class="excel-import-empty">manifest から最新版データセットを読み込みました。医療機関番号を入力して比較してください。</div>';
    } catch (err) {
      this.setOfficialDatasetError(`manifest からの読込に失敗しました。\n${err.message}`);
    }
  },
  async fetchOfficialManifest() {
    const response = await fetch(`./assets/data/manifest.json?t=${Date.now()}`);
    if (!response.ok) throw new Error(`manifest.json の取得に失敗しました (${response.status})`);
    const manifest = await response.json();
    saveOfficialManifestMeta({
      activeDatasetId: manifest.activeDatasetId || '',
      checkedAt: new Date().toISOString(),
      datasetCount: Array.isArray(manifest.datasets) ? manifest.datasets.length : 0
    });
    return manifest;
  },
  async maybeCheckManifestOnStartup() {
    if (window.location && window.location.protocol === 'file:') {
      this.renderOfficialDatasetBanner();
      return;
    }
    try {
      const manifest = await this.fetchOfficialManifest();
      saveOfficialManifestMeta({
        activeDatasetId: manifest.activeDatasetId || '',
        checkedAt: new Date().toISOString(),
        datasetCount: Array.isArray(manifest.datasets) ? manifest.datasets.length : 0
      });
      this.renderOfficialDatasetBanner();
      this.renderStoredOfficialDatasetSummary();
    } catch {
      this.renderOfficialDatasetBanner();
    }
  },
  renderOfficialDatasetBanner() {
    const banner = document.getElementById('official-data-banner');
    const text = document.getElementById('official-data-banner-text');
    if (!banner || !text) return;
    if (!officialDataset && !officialManifestMeta) {
      banner.style.display = 'none';
      return;
    }
    if (officialManifestMeta && officialManifestMeta.activeDatasetId && officialDataset && officialDataset.datasetId !== officialManifestMeta.activeDatasetId) {
      banner.style.display = 'flex';
      text.innerHTML = `現在読込中の公式データセットは <strong>${this.escapeHtml(officialDataset.datasetId)}</strong> です。manifest の最新版 <strong>${this.escapeHtml(officialManifestMeta.activeDatasetId)}</strong> と異なります。`;
      return;
    }
    if (officialDataset) {
      banner.style.display = 'flex';
      text.innerHTML = `現在の公式データセット: <strong>${this.escapeHtml(officialDataset.datasetId)}</strong> / ${this.escapeHtml(officialDataset.datasetName || '名称未設定')}`;
      return;
    }
    banner.style.display = 'none';
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

function importExcelNewCandidates() {
  ExcelImport.importNewCandidates();
}

function generateOfficialDatasetPreview() {
  ExcelImport.generateOfficialDatasetPreview();
}

function downloadOfficialDatasetJson() {
  ExcelImport.downloadOfficialDatasetJson(false);
}

function downloadOfficialDatasetPrettyJson() {
  ExcelImport.downloadOfficialDatasetJson(true);
}

function openOfficialDatasetModal() {
  ExcelImport.openOfficialDatasetModal();
}

function closeOfficialDatasetModal() {
  ExcelImport.closeOfficialDatasetModal();
}

async function handleOfficialDatasetFileSelect(event) {
  await ExcelImport.handleOfficialDatasetFile(event);
}

function searchOfficialDatasetMedicalInstitution() {
  ExcelImport.searchOfficialDatasetMedicalInstitution();
}

function applyOfficialDatasetNewCandidates() {
  ExcelImport.applyOfficialDatasetNewCandidates();
}

async function loadOfficialDatasetFromManifest() {
  await ExcelImport.loadOfficialDatasetFromManifest();
}

ExcelImport.init();
