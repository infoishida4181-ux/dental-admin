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
  lastOfficialDatasetDebug: null,
  officialDatasetMode: 'update',
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
    this.lastOfficialDatasetDebug = null;

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
          acceptedName: this.sanitizePreviewText(facility.acceptedName || facility.acceptanceName || facility['受理届出名称'] || facility['施設基準名']),
          acceptedCode: this.sanitizePreviewText(facility.acceptedCode || facility.acceptanceCode || facility.abbr || facility['略称'] || facility['受理記号']),
          acceptedNumber: this.sanitizePreviewText(facility.acceptedNumber || facility.acceptanceNumber || facility.number || facility['受理番号']),
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
        acceptedName: this.sanitizePreviewText(record.acceptedName || record.acceptanceName || record['受理届出名称'] || record['施設基準名']),
        acceptedCode: this.sanitizePreviewText(record.acceptedCode || record.acceptanceCode || record.abbr || record['略称'] || record['受理記号']),
        acceptedNumber: this.sanitizePreviewText(record.acceptedNumber || record.acceptanceNumber || record.number || record['受理番号']),
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
      .normalize('NFKC')
      .replace(/\.0+$/, '')
      .replace(/[^\d]/g, '');
    if (!digits) return '';
    return digits.padStart(7, '0');
  },
  normalizeMedicalInstitutionCode(code) {
    return this.normalizeMedicalId(code);
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
    if (name.includes('電子的歯科診療情報連携体制整備加算2')) return '歯医DX2';
    if (name.includes('電子的歯科診療情報連携体制整備加算')) return '歯医DX1';
    return '';
  },
  inferLedgerCategory(abbr, rawName) {
    if (abbr && typeof KM !== 'undefined' && KM[abbr] && KM[abbr].c) return KM[abbr].c;
    const name = this.sanitizePreviewText(rawName);
    if (name && typeof ABBR_MAP !== 'undefined' && ABBR_MAP[name]) {
      const mappedAbbr = ABBR_MAP[name];
      if (typeof KM !== 'undefined' && KM[mappedAbbr] && KM[mappedAbbr].c) return KM[mappedAbbr].c;
    }
    if (name.includes('電子的歯科診療情報連携体制整備加算')) return 'basic';
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
  normalizeFacilityName(value) {
    const base = this.sanitizePreviewText(value)
      .replace(/（/g, '(')
      .replace(/）/g, ')')
      .normalize('NFKC');
    const romanMap = { III: '3', II: '2', IV: '4', I: '1' };
    const normalizedRomans = base
      .replace(/(^|[\s(])((?:III|II|IV|I))(?=$|[\s)])/g, (match, prefix, roman) => `${prefix}${romanMap[roman] || roman}`)
      .replace(/([一-龠ぁ-ゔァ-ヶー々])((?:III|II|IV|I))(?=$|[\s()])/g, (match, prefix, roman) => `${prefix}${romanMap[roman] || roman}`);
    return normalizedRomans
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  },
  normalizeRomanNumeralsForCompare(value) {
    return String(value || '')
      .replace(/[Ⅰⅰ]/g, 'I')
      .replace(/[Ⅱⅱ]/g, 'II')
      .replace(/[Ⅲⅲ]/g, 'III')
      .replace(/[Ⅳⅳ]/g, 'IV')
      .replace(/[Ⅴⅴ]/g, 'V')
      .replace(/[Ⅵⅵ]/g, 'VI')
      .replace(/[Ⅶⅶ]/g, 'VII')
      .replace(/[Ⅷⅷ]/g, 'VIII')
      .replace(/[Ⅸⅸ]/g, 'IX')
      .replace(/[Ⅹⅹ]/g, 'X');
  },
  normalizeAbbr(value) {
    const romanMap = { III: '3', II: '2', IV: '4', I: '1' };
    const normalized = this.normalizeRomanNumeralsForCompare(this.sanitizePreviewText(value))
      .normalize('NFKC')
      .replace(/（/g, '(')
      .replace(/）/g, ')')
      .replace(/\s+/g, '');
    return normalized.replace(/III|II|IV|I/g, roman => romanMap[roman] || roman).toLowerCase();
  },
  normalizeAcceptedNumber(value) {
    return this.sanitizePreviewText(value)
      .normalize('NFKC')
      .replace(/[第号]/g, '')
      .replace(/[\s　\-‐‑‒–—―ーｰ]/g, '')
      .toLowerCase();
  },
  buildLedgerCompareParts(abbr, number) {
    const normalizedAbbr = this.normalizeAbbr(abbr);
    const normalizedNumber = this.normalizeAcceptedNumber(number);
    return {
      abbr: normalizedAbbr,
      number: normalizedNumber,
      key: `${normalizedAbbr}::${normalizedNumber}`,
      hasFullKey: Boolean(normalizedAbbr && normalizedNumber)
    };
  },
  buildCompareReference(item, existingEntry) {
    if (!existingEntry) return '';
    const notes = [];
    if (this.normalizeFacilityName(item.name) && this.normalizeFacilityName(item.name) !== this.normalizeFacilityName(existingEntry.name || '')) {
      notes.push(`施設基準名: 台帳「${existingEntry.name || '—'}」 / 公式「${item.name || '—'}」`);
    }
    if (this.normalizeAbbr(item.abbr) && this.normalizeAbbr(item.abbr) !== this.normalizeAbbr(existingEntry.abbr || '')) {
      notes.push(`略称: 台帳「${existingEntry.abbr || '—'}」 / 公式「${item.abbr || '—'}」`);
    }
    if (this.normalizeAcceptedNumber(item.number) && this.normalizeAcceptedNumber(item.number) !== this.normalizeAcceptedNumber(existingEntry.number || '')) {
      notes.push(`受理番号: 台帳「${existingEntry.number || '—'}」 / 公式「${item.number || '—'}」`);
    }
    if ((item.entryDate || '') && this.normalizeEntryDate(existingEntry.date || '') !== (item.entryDate || '')) {
      notes.push(`算定開始: 台帳「${this.normalizeDisplayDate(existingEntry.date || '—') || '—'}」 / 公式「${item.date || '—'}」`);
    }
    return notes.join(' / ');
  },
  detectExistingLedgerMatch(abbr, number) {
    if (typeof entries === 'undefined' || !Array.isArray(entries)) return false;
    const itemKey = this.buildLedgerCompareParts(abbr, number);
    if (!itemKey.hasFullKey) return false;
    return entries.some(entry => {
      const entryKey = this.buildLedgerCompareParts(entry.abbr, entry.number);
      return entryKey.hasFullKey && entryKey.key === itemKey.key;
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
  setOfficialDatasetStatus(message, tone = 'info') {
    const el = document.getElementById('official-dataset-status');
    if (!el) return;
    el.textContent = message || '';
    el.style.display = message ? '' : 'none';
    el.classList.remove('is-error', 'is-success');
    if (tone === 'error') el.classList.add('is-error');
    if (tone === 'success') el.classList.add('is-success');
  },
  setOfficialMedicalIdHelp(message) {
    const el = document.getElementById('official-dataset-medical-id-help');
    if (!el) return;
    el.textContent = message || '';
  },
  setOfficialDatasetResultPlaceholder(message) {
    const result = document.getElementById('official-dataset-result');
    if (!result) return;
    result.innerHTML = `<div class="excel-import-empty">${this.escapeHtml(message)}</div>`;
  },
  formatDatasetDate(value, includeTime = false) {
    if (!value) return '要確認';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      const normalized = this.normalizeDisplayDate(value);
      return normalized || String(value);
    }
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    if (!includeTime) return `${y}/${m}/${d}`;
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${y}/${m}/${d} ${hh}:${mm}`;
  },
  getAreaLabel(area) {
    const map = {
      tokyo: '東京都',
      kanagawa: '神奈川県',
      chiba: '千葉県',
      saitama: '埼玉県'
    };
    return map[String(area || '').toLowerCase()] || (area || '要確認');
  },
  getCategoryDisplayLabel(category) {
    const map = {
      dental: '歯科',
      medical: '医科'
    };
    return map[String(category || '').toLowerCase()] || (category || '要確認');
  },
  getOfficialDatasetDisplayName(dataset) {
    if (!dataset) return '未読込';
    return dataset.datasetName || dataset.label || dataset.datasetId || '名称未設定';
  },
  stripBom(text) {
    return String(text == null ? '' : text).replace(/^\uFEFF/, '');
  },
  getBaseManifestUrl() {
    const configured = typeof FACILITY_STANDARD_JSON_URL !== 'undefined' && FACILITY_STANDARD_JSON_URL
      ? FACILITY_STANDARD_JSON_URL
      : './assets/data/manifest.json';
    return new URL(configured, location.href);
  },
  buildCacheBustedUrl(inputUrl) {
    const url = new URL(String(inputUrl));
    url.searchParams.set('v', Date.now());
    return url;
  },
  resolveDatasetUrl(file, manifestUrl) {
    const value = String(file || '').trim();
    if (!value) throw new Error('データファイルの指定が空です。');
    if (value.startsWith('./assets/') || value.startsWith('assets/')) {
      return new URL(value, location.href).toString();
    }
    return new URL(value, manifestUrl).toString();
  },
  getDisplayFileName(value) {
    const text = String(value || '').trim();
    if (!text) return '要確認';
    try {
      const url = new URL(text, location.href);
      const parts = url.pathname.split('/').filter(Boolean);
      return parts[parts.length - 1] || text;
    } catch {
      const normalized = text.replace(/\\/g, '/');
      const parts = normalized.split('/').filter(Boolean);
      return parts[parts.length - 1] || text;
    }
  },
  setOfficialDatasetDebug(partial) {
    this.lastOfficialDatasetDebug = {
      ...(this.lastOfficialDatasetDebug || {}),
      ...(partial && typeof partial === 'object' ? partial : {})
    };
  },
  renderOfficialDatasetDebugDetails() {
    const debug = this.lastOfficialDatasetDebug;
    if (!debug) return '';
    const datasets = Array.isArray(debug.manifestDatasets) ? debug.manifestDatasets : [];
    const datasetItems = datasets.length
      ? datasets.map(item => {
          const label = item.label || item.datasetName || item.datasetId || '名称未設定';
          const file = item.file || item.path || '未設定';
          return `<li><strong>${this.escapeHtml(label)}</strong> <span style="color:var(--text3)">(${this.escapeHtml(file)})</span></li>`;
        }).join('')
      : '<li>manifest に datasets が見つかりません。</li>';
    const lines = [
      debug.manifestRequestUrl ? `<div><strong>manifest URL:</strong> ${this.escapeHtml(debug.manifestRequestUrl)}</div>` : '',
      debug.datasetRequestUrl ? `<div><strong>データ URL:</strong> ${this.escapeHtml(debug.datasetRequestUrl)}</div>` : '',
      debug.activeDatasetId ? `<div><strong>activeDatasetId:</strong> ${this.escapeHtml(debug.activeDatasetId)}</div>` : '',
      debug.selectedDatasetId ? `<div><strong>選択データ:</strong> ${this.escapeHtml(debug.selectedDatasetId)}</div>` : '',
      debug.datasetFile ? `<div><strong>file:</strong> ${this.escapeHtml(debug.datasetFile)}</div>` : '',
      debug.httpStatus ? `<div><strong>HTTP status:</strong> ${this.escapeHtml(debug.httpStatus)}</div>` : '',
      debug.lastCheckedAt ? `<div><strong>最終確認:</strong> ${this.escapeHtml(this.formatDatasetDate(debug.lastCheckedAt, true))}</div>` : '',
      debug.errorMessage ? `<div><strong>直近エラー:</strong> ${this.escapeHtml(debug.errorMessage)}</div>` : ''
    ].filter(Boolean).join('');
    return `
      <details class="official-update-details-subtle">
        <summary>管理者向けの詳細情報</summary>
        <div class="dataset-compare-note">
          ${lines}
          <div style="margin-top:8px"><strong>manifest の datasets:</strong></div>
          <ul style="margin:6px 0 0 18px;padding:0">${datasetItems}</ul>
        </div>
      </details>
    `;
  },
  async fetchJsonTextWithDiagnostics(inputUrl, label) {
    const requestUrl = this.buildCacheBustedUrl(inputUrl);
    const response = await fetch(requestUrl.toString(), { cache: 'no-store' });
    const text = await response.text();
    if (!response.ok) {
      const err = new Error(`${label}を取得できませんでした。\n確認URL: ${requestUrl.toString()}\nHTTP status: ${response.status}`);
      err.requestUrl = requestUrl.toString();
      err.httpStatus = String(response.status);
      err.responseText = text;
      throw err;
    }
    try {
      return {
        requestUrl: requestUrl.toString(),
        httpStatus: String(response.status),
        text,
        json: JSON.parse(this.stripBom(text))
      };
    } catch (err) {
      const parseErr = new Error(`${label}の解析に失敗しました。\n確認URL: ${requestUrl.toString()}\n${err.message}`);
      parseErr.requestUrl = requestUrl.toString();
      parseErr.httpStatus = String(response.status);
      throw parseErr;
    }
  },
  normalizeLoadedOfficialDataset(dataset, selectedDataset, datasetUrl) {
    const normalized = {
      ...(dataset && typeof dataset === 'object' ? dataset : {})
    };
    normalized.datasetId = normalized.datasetId || selectedDataset?.datasetId || '';
    normalized.datasetName = normalized.datasetName || selectedDataset?.label || selectedDataset?.datasetName || normalized.datasetId || '';
    normalized.label = normalized.label || selectedDataset?.label || normalized.datasetName || normalized.datasetId || '';
    normalized.sourceDate = normalized.sourceDate || selectedDataset?.sourceDate || '';
    normalized.dataVersion = normalized.dataVersion || normalized.version || selectedDataset?.version || selectedDataset?.datasetId || normalized.datasetId || '';
    normalized.format = normalized.format || selectedDataset?.format || (Array.isArray(normalized.recordsByClinic) ? 'grouped-by-clinic' : 'records');
    normalized.schemaVersion = normalized.schemaVersion || selectedDataset?.schemaVersion || '';
    normalized.sourceFileName = normalized.sourceFileName || this.getDisplayFileName(selectedDataset?.file || selectedDataset?.path || datasetUrl);
    normalized.datasetFile = this.getDisplayFileName(selectedDataset?.file || selectedDataset?.path || datasetUrl);
    normalized.datasetUrl = normalized.datasetUrl || datasetUrl || '';
    return normalized;
  },
  resolveSavedMedicalInstitutionNumber() {
    const candidates = [];
    const profileMedicalId = typeof getClinicProfile === 'function'
      ? getClinicProfile()?.medicalInstitutionNumber
      : '';
    candidates.push(profileMedicalId);
    if (typeof getOfficialDatasetLastMedicalInstitutionNumber === 'function') {
      candidates.push(getOfficialDatasetLastMedicalInstitutionNumber());
    }
    if (typeof getLastMedicalInstitutionNumber === 'function') {
      candidates.push(getLastMedicalInstitutionNumber());
    }
    if (Array.isArray(entries)) {
      entries.forEach(entry => {
        candidates.push(entry?.importMeta?.medicalInstitutionNumber);
        candidates.push(entry?.importMeta?.medicalId);
      });
    }
    return candidates
      .map(value => this.normalizeMedicalId(value))
      .find(Boolean) || '';
  },
  applyResolvedMedicalInstitutionNumber(medicalId) {
    const input = document.getElementById('official-dataset-medical-id');
    if (input) input.value = medicalId || '';
    if (medicalId) {
      this.setOfficialMedicalIdHelp(`保存済みの医療機関コード ${medicalId} を使って確認します。必要に応じて変更できます。`);
    } else {
      this.setOfficialMedicalIdHelp('保存済みの医療機関コードが見つからなかったため、7桁の医療機関コードを入力してください。');
    }
  },
  tryAutoSearchOfficialDataset() {
    const medicalId = this.resolveSavedMedicalInstitutionNumber();
    this.applyResolvedMedicalInstitutionNumber(medicalId);
    if (!medicalId) {
      this.setOfficialDatasetResultPlaceholder('保存済みの医療機関コードが見つからないため、コードを入力して確認してください。');
      return false;
    }
    this.searchOfficialDatasetMedicalInstitution(medicalId);
    return true;
  },
  configureOfficialDatasetModal(mode = 'update') {
    const isInitial = mode === 'initial';
    this.officialDatasetMode = isInitial ? 'initial' : 'update';
    const overlay = document.getElementById('official-dataset-overlay');
    if (overlay) overlay.classList.toggle('official-dataset-initial', isInitial);
    const title = document.getElementById('official-dataset-title');
    if (title) title.textContent = isInitial ? '施設基準取り込み' : '施設基準の更新';
    const subtitle = document.getElementById('official-dataset-subtitle');
    if (subtitle) {
      subtitle.textContent = isInitial
        ? '医療機関コードを入力すると、管理者が更新した最新データから自院の届出済み施設基準を検索できます。'
        : '管理者が更新した最新データをもとに、自院の届出済み施設基準を確認します。現在の台帳は自動では上書きされません。';
    }
    const section = document.getElementById('official-dataset-candidate-title');
    if (section) section.textContent = isInitial ? '医療機関コードから取り込む' : '自院の施設基準候補';
    const searchButton = document.getElementById('official-dataset-search-btn');
    if (searchButton) searchButton.textContent = isInitial ? '検索' : '自院の施設基準を確認';
    const closeButton = document.getElementById('official-dataset-close-btn');
    if (closeButton) closeButton.textContent = isInitial ? 'キャンセル' : '閉じる';
    const status = document.getElementById('official-dataset-status');
    if (status) status.style.display = isInitial ? 'none' : '';
    const toolbar = document.getElementById('official-dataset-toolbar');
    if (toolbar) toolbar.style.display = isInitial ? 'none' : '';
    const summaryPanel = document.getElementById('official-dataset-summary-panel');
    if (summaryPanel) summaryPanel.style.display = isInitial ? 'none' : '';
    const manualDetails = document.getElementById('official-dataset-manual-details');
    if (manualDetails) {
      manualDetails.style.display = isInitial ? 'none' : '';
      manualDetails.open = false;
    }
    const helpPanel = document.getElementById('official-dataset-help-panel');
    if (helpPanel) {
      const notes = helpPanel.querySelectorAll('.form-note');
      notes.forEach((note, index) => {
        note.style.display = isInitial && index === 0 ? 'none' : '';
      });
    }
    const input = document.getElementById('official-dataset-medical-id');
    if (input && isInitial) input.value = '';
    this.lastOfficialCompareResult = isInitial ? null : this.lastOfficialCompareResult;
    const result = document.getElementById('official-dataset-result');
    if (result && (isInitial || !this.lastOfficialCompareResult)) {
      result.innerHTML = `<div class="excel-import-empty">${isInitial ? '医療機関コードを入力して検索してください。' : '「施設基準の更新」を押すと、ここに差分確認結果を表示します。'}</div>`;
    }
  },
  async openOfficialDatasetModal(options = {}) {
    const mode = options.mode || 'update';
    this.configureOfficialDatasetModal(mode);
    this.setOfficialDatasetError('');
    if (mode !== 'initial') this.renderStoredOfficialDatasetSummary();
    if (!this.lastOfficialCompareResult) {
      this.setOfficialDatasetResultPlaceholder(mode === 'initial' ? '医療機関コードを入力して検索してください。' : '最新データを確認すると、ここに自院の施設基準候補を表示します。');
    }
    document.getElementById('official-dataset-overlay').classList.add('open');
    if (mode === 'initial') {
      this.setOfficialMedicalIdHelp('医療機関コードを入力して検索してください。');
      return;
    }
    if (options.autoStart === false) {
      this.setOfficialDatasetStatus('確認したい場合は「最新データを確認」を押してください。');
      this.applyResolvedMedicalInstitutionNumber(this.resolveSavedMedicalInstitutionNumber());
      return;
    }
    this.setOfficialDatasetStatus('最新データを確認しています。');
    await this.loadOfficialDatasetFromManifest({ autoSearch: true, preferredMessage: '最新データを確認しています。' });
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
      fileNameEl.textContent = officialDataset
        ? `使用中ファイル: ${this.getDisplayFileName(officialDataset.datasetFile || officialDataset.sourceFileName)}`
        : '更新データ未読込';
    }
    const summary = document.getElementById('official-dataset-summary');
    if (!summary) return;
    const stats = this.getOfficialDatasetStats(officialDataset);
    if (!officialDataset || !stats.facilityCount) {
      summary.innerHTML = `
        <div class="excel-import-empty">最新データを確認すると、ここに作成日や収録件数を表示します。</div>
        ${this.renderOfficialDatasetDebugDetails()}
      `;
      return;
    }
    const latestCheckedAt = this.lastOfficialDatasetDebug?.lastCheckedAt || officialManifestMeta?.checkedAt || '';
    const latestCheckedText = latestCheckedAt
      ? `最終確認: ${this.formatDatasetDate(latestCheckedAt, true)}`
      : '';
    const sourceUrl = officialDataset.datasetUrl || officialDataset.sourceUrl || this.lastOfficialDatasetDebug?.datasetRequestUrl || '';
    const versionText = officialDataset.dataVersion || officialDataset.version || officialDataset.datasetId || '要確認';
    const oldWarning = this.isDatasetPossiblyOld(officialDataset)
      ? '<div class="dataset-compare-note" style="background:var(--yellow-bg);border-color:#fde68a;color:var(--yellow)">データ更新日が古い可能性があります。必要に応じて「最新データを確認」を押してください。</div>'
      : '';
    const manifestNote = officialManifestMeta && officialManifestMeta.activeDatasetId
      ? `<div class="dataset-compare-note">${officialManifestMeta.activeDatasetId !== officialDataset.datasetId ? '保存済みの更新データと、公開中の最新版が異なる可能性があります。' : '公開中の最新版と同じ更新データを確認しています。'}${latestCheckedText ? `<br>${this.escapeHtml(latestCheckedText)}` : ''}</div>`
      : '';
    summary.innerHTML = `
      <div class="dataset-summary-grid">
        <div class="dataset-summary-card"><div class="dataset-summary-label">管理者更新データ</div><div class="dataset-summary-value">${this.escapeHtml(this.getOfficialDatasetDisplayName(officialDataset))}</div></div>
        <div class="dataset-summary-card"><div class="dataset-summary-label">データ更新日</div><div class="dataset-summary-value">${this.escapeHtml(this.formatDatasetDate(officialDataset.sourceDate || officialDataset.createdAt))}</div></div>
        <div class="dataset-summary-card"><div class="dataset-summary-label">データバージョン</div><div class="dataset-summary-value">${this.escapeHtml(versionText)}</div></div>
        <div class="dataset-summary-card"><div class="dataset-summary-label">対象</div><div class="dataset-summary-value">${this.escapeHtml(this.getAreaLabel(officialDataset.area))}・${this.escapeHtml(this.getCategoryDisplayLabel(officialDataset.category))}</div></div>
        <div class="dataset-summary-card"><div class="dataset-summary-label">収録医療機関数</div><div class="dataset-summary-value">${stats.institutionCount}件</div></div>
        <div class="dataset-summary-card"><div class="dataset-summary-label">収録施設基準数</div><div class="dataset-summary-value">${stats.facilityCount}件</div></div>
        <div class="dataset-summary-card"><div class="dataset-summary-label">最終確認日時</div><div class="dataset-summary-value">${this.escapeHtml(this.formatDatasetDate(latestCheckedAt, true))}</div></div>
      </div>
      <div class="dataset-compare-note">
        <div><strong>使用中のデータファイル:</strong> ${this.escapeHtml(this.getDisplayFileName(officialDataset.datasetFile || officialDataset.sourceFileName))}</div>
        <div><strong>元データ:</strong> ${this.escapeHtml(officialDataset.sourceFileName || '要確認')}</div>
        <div><strong>出典URL:</strong> ${sourceUrl ? `<a href="${this.escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(sourceUrl)}</a>` : '要確認'}</div>
        <div>本データは管理者が公式資料をもとに作成・更新した補助データです。届出要否や算定可否の最終判断は公式情報をご確認ください。</div>
      </div>
      <details class="official-update-details-subtle">
        <summary>管理者向けの詳細情報</summary>
        <div class="dataset-compare-note">
          <div><strong>datasetId:</strong> ${this.escapeHtml(officialDataset.datasetId || '—')}</div>
          <div><strong>format:</strong> ${this.escapeHtml(officialDataset.format || (Array.isArray(officialDataset.recordsByClinic) ? 'grouped-by-clinic' : 'records'))}</div>
          <div><strong>sourceDate:</strong> ${this.escapeHtml(officialDataset.sourceDate || '—')}</div>
          <div><strong>createdAt:</strong> ${this.escapeHtml(officialDataset.createdAt || '—')}</div>
        </div>
      </details>
      ${this.renderOfficialDatasetDebugDetails()}
      ${manifestNote}
      ${oldWarning}
    `;
  },
  isDatasetPossiblyOld(dataset) {
    const source = dataset?.sourceDate || dataset?.createdAt;
    if (!source) return false;
    const d = new Date(source);
    if (Number.isNaN(d.getTime())) return false;
    return Date.now() - d.getTime() > 1000 * 60 * 60 * 24 * 120;
  },
  async handleOfficialDatasetFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    this.setOfficialDatasetError('');
    this.setOfficialDatasetStatus('手動で更新データを読み込んでいます。');
    try {
      const text = this.stripBom(await file.text());
      const dataset = JSON.parse(text);
      this.validateOfficialDataset(dataset);
      const normalizedDataset = this.normalizeLoadedOfficialDataset(dataset, { file: file.name, label: dataset.datasetName || dataset.label || file.name }, file.name);
      saveOfficialDataset(normalizedDataset);
      this.setOfficialDatasetDebug({
        manifestRequestUrl: '',
        datasetRequestUrl: file.name,
        datasetFile: file.name,
        selectedDatasetId: normalizedDataset.datasetId || '',
        lastCheckedAt: new Date().toISOString(),
        errorMessage: ''
      });
      this.lastOfficialCompareResult = null;
      this.renderStoredOfficialDatasetSummary();
      this.renderOfficialDatasetBanner();
      this.setOfficialDatasetStatus('手動で読み込んだ更新データを確認できます。', 'success');
      if (!this.tryAutoSearchOfficialDataset()) {
        this.setOfficialDatasetResultPlaceholder('更新データを読み込みました。医療機関コードを入力すると自院の施設基準候補を確認できます。');
      }
    } catch (err) {
      this.setOfficialDatasetStatus('手動読込に失敗しました。', 'error');
      this.setOfficialDatasetError(`更新データの読み込みに失敗しました。\n${err.message}`);
    } finally {
      if (event.target) event.target.value = '';
    }
  },
  validateOfficialDataset(dataset) {
    if (!dataset || typeof dataset !== 'object') throw new Error('更新データの形式が不正です。');
    const schema = String(dataset.schemaVersion || '');
    if (!(schema === '1.1.0' || schema.startsWith('official-dataset'))) throw new Error('対応していない更新データです。');
    if (!dataset.datasetId) throw new Error('更新データIDが見つかりません。');
    if (!Array.isArray(dataset.records) && !Array.isArray(dataset.recordsByClinic)) throw new Error('施設基準データ本体が見つかりません。');
  },
  async fetchFacilityStandardMaster(options = {}) {
    await this.loadOfficialDatasetFromManifest(options);
    return officialDataset;
  },
  findInstitutionByCode(code, masterData = officialDataset) {
    const medicalId = this.normalizeMedicalInstitutionCode(code);
    const records = this.flattenOfficialDatasetRecords(masterData);
    return records.filter(record => this.normalizeMedicalInstitutionCode(record.medicalInstitutionNumber || record.medicalId) === medicalId);
  },
  previewFacilityImport(institutionRecords) {
    const ledgerRows = this.convertOfficialRecordsToLedgerPreview(institutionRecords || []);
    return this.compareOfficialLedgerWithEntries(ledgerRows);
  },
  mergeFacilityStandards(compareResult) {
    this.lastOfficialCompareResult = compareResult;
    return this.applyOfficialDatasetNewCandidates();
  },
  async searchOfficialDatasetMedicalInstitution(forcedMedicalId = '') {
    this.setOfficialDatasetError('');
    const input = document.getElementById('official-dataset-medical-id');
    const medicalId = this.normalizeMedicalId(forcedMedicalId || (input ? input.value.trim() : ''));
    if (input && medicalId) input.value = medicalId;
    if (!medicalId) {
      this.setOfficialDatasetStatus('医療機関コードの入力が必要です。', 'error');
      this.setOfficialDatasetError('医療機関コードを入力してください。');
      this.setOfficialMedicalIdHelp('医療機関コードを入力してください。');
      return;
    }
    let records = this.flattenOfficialDatasetRecords(officialDataset);
    if (!officialDataset || !records.length) {
      try {
        await this.loadOfficialDatasetFromManifest({ autoSearch: false, preferredMessage: '最新データを取得しています。' });
        records = this.flattenOfficialDatasetRecords(officialDataset);
      } catch (err) {
        this.setOfficialDatasetStatus('最新データの取得に失敗しました。', 'error');
        this.setOfficialDatasetError(this.buildOfficialDatasetFriendlyError(err));
        return;
      }
    }
    if (!officialDataset || !records.length) {
      this.setOfficialDatasetStatus('最新データを取得できませんでした。', 'error');
      this.setOfficialDatasetError('GitHub上のデータ形式が想定と異なるため、取り込みできませんでした。');
      return;
    }
    this.setOfficialDatasetStatus('自院の施設基準候補を確認しています。');
    const filtered = this.findInstitutionByCode(medicalId, officialDataset);
    const result = document.getElementById('official-dataset-result');
    if (!result) return;
    if (!filtered.length) {
      this.lastOfficialCompareResult = null;
      this.setOfficialDatasetStatus('自院の施設基準候補を確認しました。');
      result.innerHTML = `<div class="excel-import-empty">該当する医療機関コードが見つかりませんでした。入力したコードをご確認ください。<br>検索コード: ${this.escapeHtml(medicalId)}</div>`;
      return;
    }
    if (typeof setOfficialDatasetLastMedicalInstitutionNumber === 'function') {
      if (this.officialDatasetMode !== 'initial') setOfficialDatasetLastMedicalInstitutionNumber(medicalId);
    }
    const compareResult = this.previewFacilityImport(filtered);
    if (!compareResult.ledgerRows.length) {
      this.lastOfficialCompareResult = null;
      this.setOfficialDatasetStatus('該当データに施設基準がありません。', 'error');
      result.innerHTML = `<div class="excel-import-empty">該当する医療機関は見つかりましたが、施設基準データが空です。管理者更新データをご確認ください。</div>`;
      return;
    }
    this.lastOfficialCompareResult = compareResult;
    this.setOfficialDatasetStatus('自院の施設基準候補を確認しました。', 'success');
    this.setOfficialMedicalIdHelp(this.officialDatasetMode === 'initial' ? '検索結果を確認し、問題なければ取り込んでください。' : `医療機関コード ${medicalId} で確認しました。必要に応じて別のコードでも確認できます。`);
    this.renderOfficialDatasetCompareResult(compareResult, medicalId);
  },
  convertOfficialRecordsToLedgerPreview(records) {
    return records.map((record, idx) => {
      const acceptedName = record.acceptedName || record.acceptanceName || record['受理届出名称'] || record['施設基準名'];
      const acceptedCode = record.acceptedCode || record.acceptanceCode || record.abbr || record['略称'] || record['受理記号'];
      const acceptedNumber = record.acceptedNumber || record.acceptanceNumber || record.number || record['受理番号'];
      const abbr = this.inferLedgerAbbr(acceptedCode, acceptedName);
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
    const existingMatches = [];
    const reviewCandidates = [];
    const newCandidates = [];
    const comparedRows = [];
    const safeEntries = Array.isArray(entries) ? entries : [];
    const officialKeys = new Set();
    const usedEntryIds = new Set();
    const entryRows = safeEntries.map((entry, idx) => ({
      entry,
      idx,
      parts: this.buildLedgerCompareParts(entry.abbr, entry.number)
    }));
    const entryToken = row => String(row.entry?.id ?? `idx-${row.idx}`);
    ledgerRows.forEach(item => {
      const officialParts = this.buildLedgerCompareParts(item.abbr, item.number);
      if (officialParts.hasFullKey) officialKeys.add(officialParts.key);
      const exactMatch = officialParts.hasFullKey
        ? entryRows.find(row => row.parts.hasFullKey && row.parts.key === officialParts.key)
        : null;
      if (exactMatch) {
        const existing = exactMatch.entry;
        const reference = this.buildCompareReference(item, existing);
        const compared = {
          ...item,
          compareStatus: 'existing',
          compareLabel: 'すでに台帳にある項目',
          compareReference: [
            '略称と受理番号が一致しているため、すでに台帳にある項目として扱います。',
            reference
          ].filter(Boolean).join(' / '),
          existingEntry: existing
        };
        usedEntryIds.add(entryToken(exactMatch));
        existingMatches.push(compared);
        comparedRows.push(compared);
        return;
      }
      const sameAbbrMatch = officialParts.abbr
        ? entryRows.find(row => row.parts.abbr && row.parts.abbr === officialParts.abbr)
        : null;
      if (sameAbbrMatch) {
        const existing = sameAbbrMatch.entry;
        const compared = {
          ...item,
          compareStatus: 'review',
          compareLabel: '要確認',
          compareReference: [
            '同じ略称ですが受理番号が異なります。',
            this.buildCompareReference(item, existing),
            '既存項目は自動変更しません。'
          ].filter(Boolean).join(' / '),
          existingEntry: existing
        };
        usedEntryIds.add(entryToken(sameAbbrMatch));
        reviewCandidates.push(compared);
        comparedRows.push(compared);
        return;
      }
      const sameNumberMatch = officialParts.number
        ? entryRows.find(row => row.parts.number && row.parts.number === officialParts.number)
        : null;
      if (sameNumberMatch) {
        const existing = sameNumberMatch.entry;
        const compared = {
          ...item,
          compareStatus: 'review',
          compareLabel: '要確認',
          compareReference: [
            '同じ受理番号ですが略称が異なります。',
            this.buildCompareReference(item, existing),
            '既存項目は自動変更しません。'
          ].filter(Boolean).join(' / '),
          existingEntry: existing
        };
        usedEntryIds.add(entryToken(sameNumberMatch));
        reviewCandidates.push(compared);
        comparedRows.push(compared);
        return;
      }
      const compared = { ...item, compareStatus: 'new', compareLabel: '新規候補' };
      newCandidates.push(compared);
      comparedRows.push(compared);
    });
    const removedCandidates = entryRows
      .filter(row => {
        if (usedEntryIds.has(entryToken(row))) return false;
        return !row.parts.hasFullKey || !officialKeys.has(row.parts.key);
      })
      .map(row => ({
        id: `removed-${row.entry.id}`,
        name: row.entry.name,
        abbr: row.entry.abbr,
        number: row.entry.number,
        date: row.entry.date ? row.entry.date.replace(/-/g, '/') : '—',
        memo: row.entry.memo || '—',
        compareStatus: 'removed',
        compareLabel: '公式データでは見つからない項目'
      }));
    const clinicName = ledgerRows[0]?.clinicName || '要確認';
    const address = ledgerRows[0]?.address || '—';
    const phone = ledgerRows[0]?.phone || '—';
    return { clinicName, address, phone, ledgerRows: comparedRows, existingMatches, reviewCandidates, newCandidates, removedCandidates };
  },
  renderOfficialDatasetCompareResult(compareResult, medicalId) {
    const result = document.getElementById('official-dataset-result');
    if (!result) return;
    if (this.officialDatasetMode === 'initial') {
      this.renderSimpleFacilityImportResult(compareResult, medicalId);
      return;
    }
    const renderCompareRow = item => {
      const compareClass = item.compareStatus === 'existing'
        ? 'exact'
        : item.compareStatus === 'review'
          ? 'changed'
          : 'new';
      return `
        <tr data-compare-status="${this.escapeHtml(item.compareStatus)}">
          <td>${this.escapeHtml(item.name)}</td>
          <td>${this.escapeHtml(item.abbr)}</td>
          <td>${this.escapeHtml(item.number)}</td>
          <td>${this.escapeHtml(item.date)}</td>
          <td>${this.escapeHtml(item.categoryLabel)}</td>
          <td>${this.escapeHtml(item.statusLabel)}</td>
          <td>${this.escapeHtml(item.kaiteiLabel)}</td>
          <td>${this.escapeHtml(item.teireiLabel)}</td>
          <td>${this.escapeHtml(item.memo)}</td>
          <td>
            <span class="dataset-compare-chip ${compareClass}">${this.escapeHtml(item.compareLabel)}</span>
            ${item.compareReference ? `<div class="dataset-compare-note" style="margin:6px 0 0">${this.escapeHtml(item.compareReference)}</div>` : ''}
          </td>
        </tr>
      `;
    };
    const rows = compareResult.ledgerRows.map(renderCompareRow).join('');
    const removedRows = compareResult.removedCandidates.map(item => `
      <tr>
        <td>${this.escapeHtml(item.name || '—')}</td>
        <td>${this.escapeHtml(item.abbr || '—')}</td>
        <td>${this.escapeHtml(item.number || '—')}</td>
        <td>${this.escapeHtml(item.date || '—')}</td>
        <td>${this.escapeHtml(item.memo || '—')}</td>
      </tr>
    `).join('');
    const filterChips = [
      ['all', '全件', compareResult.ledgerRows.length + compareResult.removedCandidates.length],
      ['new', '新規候補', compareResult.newCandidates.length],
      ['existing', 'すでに台帳にある項目', compareResult.existingMatches.length],
      ['review', '要確認', compareResult.reviewCandidates.length],
      ['removed', '公式データでは見つからない項目', compareResult.removedCandidates.length]
    ].map(([filter, label, count]) => `
      <button type="button" class="dataset-filter-chip ${filter === 'all' ? 'active' : ''}" data-filter="${this.escapeHtml(filter)}" onclick="filterOfficialDatasetCompareRows('${this.escapeHtml(filter)}')">
        ${this.escapeHtml(label)} ${count}件
      </button>
    `).join('');
    const sourceUrl = officialDataset?.datasetUrl || officialDataset?.sourceUrl || this.lastOfficialDatasetDebug?.datasetRequestUrl || '';
    const versionText = officialDataset?.dataVersion || officialDataset?.version || officialDataset?.datasetId || '要確認';
    const sourceDate = this.formatDatasetDate(officialDataset?.sourceDate || officialDataset?.createdAt);
    result.innerHTML = `
      <div class="excel-search-meta">検索コード: ${this.escapeHtml(medicalId)}</div>
      <div class="excel-search-summary">
        <div class="excel-search-card"><div class="excel-search-label">医療機関名称</div><div class="excel-search-value">${this.escapeHtml(compareResult.clinicName)}</div></div>
        <div class="excel-search-card"><div class="excel-search-label">医療機関コード</div><div class="excel-search-value">${this.escapeHtml(medicalId)}</div></div>
        <div class="excel-search-card"><div class="excel-search-label">データ更新日</div><div class="excel-search-value">${this.escapeHtml(sourceDate)}</div></div>
        <div class="excel-search-card"><div class="excel-search-label">データバージョン</div><div class="excel-search-value">${this.escapeHtml(versionText)}</div></div>
        <div class="excel-search-card"><div class="excel-search-label">医療機関所在地</div><div class="excel-search-value">${this.escapeHtml(compareResult.address)}</div></div>
        <div class="excel-search-card"><div class="excel-search-label">電話番号</div><div class="excel-search-value">${this.escapeHtml(compareResult.phone)}</div></div>
      </div>
      <div class="dataset-compare-note">
        <div><strong>出典URL:</strong> ${sourceUrl ? `<a href="${this.escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(sourceUrl)}</a>` : '要確認'}</div>
        <div>本データは管理者が公式資料をもとに作成・更新した補助データです。最終判断は必ず公式情報をご確認ください。</div>
      </div>
      <div class="excel-ledger-summary">
        <span class="excel-ledger-chip is-new">新規候補 ${compareResult.newCandidates.length}件</span>
        <span class="excel-ledger-chip is-existing">すでに台帳にある項目 ${compareResult.existingMatches.length}件</span>
        <span class="excel-ledger-chip is-new" style="background:var(--yellow-bg);border-color:#fde68a;color:var(--yellow)">要確認 ${compareResult.reviewCandidates.length}件</span>
        <span class="excel-ledger-chip" style="background:var(--red-bg);border-color:#fecaca;color:var(--red)">公式データでは見つからない項目 ${compareResult.removedCandidates.length}件</span>
      </div>
      <div class="dataset-compare-note">既存項目は自動変更されません。台帳へ反映できるのは新規候補のみです。略称と受理番号が一致しているため、すでに台帳にある項目として扱います。</div>
      <div class="dataset-filter-bar" aria-label="比較結果の表示切替">${filterChips}</div>
      <div class="excel-search-result-table-wrap official-compare-table-wrap" data-official-compare-table>
        <table class="excel-import-table excel-ledger-table official-compare-table">
          <thead>
            <tr><th>施設基準名</th><th>略称</th><th>受理番号</th><th>算定開始</th><th>カテゴリ</th><th>状態</th><th>改定影響</th><th>定例報告</th><th>メモ</th><th>比較</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="excel-import-empty official-compare-filter-empty" data-official-compare-empty style="display:none">この分類に表示できる項目はありません。</div>
      ${compareResult.removedCandidates.length ? `
        <div class="excel-import-section-title" style="margin:14px 0 8px">公式データでは見つからない項目</div>
        <div class="excel-search-result-table-wrap official-compare-removed-wrap">
          <table class="excel-import-table">
            <thead><tr><th>施設基準名</th><th>略称</th><th>受理番号</th><th>算定開始</th><th>メモ</th></tr></thead>
            <tbody>${removedRows}</tbody>
          </table>
        </div>` : ''}
      <div class="excel-search-placeholder">
        <button class="btn btn-primary" onclick="applyOfficialDatasetNewCandidates()" ${compareResult.newCandidates.length ? '' : 'disabled'}>この内容を取り込む</button>
        <button class="btn btn-ghost" onclick="closeOfficialDatasetModal()">キャンセル</button>
        <span>${compareResult.newCandidates.length ? '新規候補のみ追加します。既存項目・要確認・公式データでは見つからない項目は自動変更しません。' : '追加できる新規候補はありません。'}</span>
      </div>
    `;
  },
  renderSimpleFacilityImportResult(compareResult, medicalId) {
    const result = document.getElementById('official-dataset-result');
    if (!result) return;
    const rows = compareResult.ledgerRows.map(item => `
      <tr>
        <td>${this.escapeHtml(item.name)}</td>
        <td>${this.escapeHtml(item.abbr)}</td>
        <td>${this.escapeHtml(item.number)}</td>
        <td>${this.escapeHtml(item.date)}</td>
      </tr>
    `).join('');
    result.innerHTML = `
      <div class="excel-search-summary">
        <div class="excel-search-card"><div class="excel-search-label">医療機関名</div><div class="excel-search-value">${this.escapeHtml(compareResult.clinicName)}</div></div>
        <div class="excel-search-card"><div class="excel-search-label">医療機関コード</div><div class="excel-search-value">${this.escapeHtml(medicalId)}</div></div>
        <div class="excel-search-card"><div class="excel-search-label">届出済み施設基準</div><div class="excel-search-value">${compareResult.ledgerRows.length}件</div></div>
      </div>
      <div class="excel-search-result-table-wrap official-compare-table-wrap">
        <table class="excel-import-table excel-ledger-table official-compare-table">
          <thead><tr><th>施設基準名</th><th>略称</th><th>受理番号</th><th>算定開始</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="dataset-compare-note">この取込は現在の届出台帳を検索結果で置き換えます。既存データがある場合は、実行前に確認画面を表示します。</div>
      <div class="excel-search-placeholder">
        <button class="btn btn-primary" onclick="applyOfficialDatasetNewCandidates()" ${compareResult.ledgerRows.length ? '' : 'disabled'}>この内容を取り込む</button>
        <button class="btn btn-ghost" onclick="closeOfficialDatasetModal()">キャンセル</button>
        <span>${compareResult.ledgerRows.length ? `届出台帳を ${compareResult.ledgerRows.length}件の施設基準に置き換えます。` : '取り込める施設基準はありません。'}</span>
      </div>
    `;
  },
  filterOfficialDatasetCompareRows(filter = 'all') {
    const result = document.getElementById('official-dataset-result');
    if (!result) return;
    const normalizedFilter = ['all', 'new', 'existing', 'review', 'removed'].includes(filter) ? filter : 'all';
    result.querySelectorAll('.dataset-filter-chip').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.filter === normalizedFilter);
    });
    const tableWrap = result.querySelector('[data-official-compare-table]');
    const empty = result.querySelector('[data-official-compare-empty]');
    const rows = Array.from(result.querySelectorAll('.official-compare-table tbody tr'));
    let visibleCount = 0;
    rows.forEach(row => {
      const show = normalizedFilter === 'all' || row.dataset.compareStatus === normalizedFilter;
      row.hidden = !show;
      if (show) visibleCount += 1;
    });
    const removedSection = result.querySelector('.official-compare-removed-wrap');
    const removedTitle = removedSection ? removedSection.previousElementSibling : null;
    const showRemovedOnly = normalizedFilter === 'removed';
    const hasRemovedRows = Boolean(removedSection && removedSection.querySelector('tbody tr'));
    if (tableWrap) tableWrap.style.display = visibleCount ? '' : 'none';
    if (empty) empty.style.display = visibleCount || (showRemovedOnly && hasRemovedRows) ? 'none' : '';
    if (removedSection) removedSection.style.display = normalizedFilter === 'all' || showRemovedOnly ? '' : 'none';
    if (removedTitle && removedTitle.classList.contains('excel-import-section-title')) {
      removedTitle.style.display = normalizedFilter === 'all' || showRemovedOnly ? '' : 'none';
    }
  },
  applyOfficialDatasetNewCandidates() {
    if (!this.lastOfficialCompareResult) {
      this.setOfficialDatasetError('先に最新データから自院の施設基準候補を確認してください。');
      return;
    }
    if (this.officialDatasetMode === 'initial') {
      return this.replaceLedgerWithOfficialDatasetResult();
    }
    const newCandidates = this.lastOfficialCompareResult.newCandidates || [];
    const existingCount = this.lastOfficialCompareResult.existingMatches.length;
    const reviewCount = this.lastOfficialCompareResult.reviewCandidates.length;
    const removedCount = this.lastOfficialCompareResult.removedCandidates.length;
    if (!newCandidates.length) {
      this.setOfficialDatasetError('追加できる新規候補はありません。');
      return;
    }
    if (!confirm(`新規候補 ${newCandidates.length}件を台帳に追加します。既存データは上書きしません。すでに台帳にある項目 ${existingCount}件、要確認 ${reviewCount}件、公式データでは見つからない項目 ${removedCount}件は確認のみです。よろしいですか？`)) {
      return;
    }
    const importedAt = new Date().toISOString();
    const medicalId = newCandidates[0]?.medicalId || this.normalizeMedicalInstitutionCode(document.getElementById('official-dataset-medical-id')?.value || '');
    const importedClinicName = this.lastOfficialCompareResult.clinicName && this.lastOfficialCompareResult.clinicName !== '要確認'
      ? this.lastOfficialCompareResult.clinicName
      : '';
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
        medicalInstitutionNumber: item.medicalId,
        medicalId: item.medicalId,
        clinicName: item.clinicName,
        importedAt,
        mode: 'official-dataset-new-candidate-import'
      }
    }));
    entries.push(...added);
    if (medicalId && typeof setOfficialDatasetLastMedicalInstitutionNumber === 'function') {
      setOfficialDatasetLastMedicalInstitutionNumber(medicalId);
    }
    if (medicalId && typeof saveClinicProfile === 'function') {
      saveClinicProfile({ medicalInstitutionNumber: medicalId });
    }
    if (importedClinicName) {
      clinicName = importedClinicName;
      localStorage.setItem('clinic_name', clinicName);
    }
    save();
    render();
    if (typeof updateClinicPill === 'function') updateClinicPill();
    this.renderOfficialDatasetBanner();
    this.searchOfficialDatasetMedicalInstitution();
    this.setOfficialDatasetStatus('確認した内容を台帳へ反映しました。', 'success');
    alert(`✅ 新規候補 ${added.length}件を届出台帳へ追加しました。\n既存項目は自動変更していません。`);
  },
  replaceLedgerWithOfficialDatasetResult() {
    const compareResult = this.lastOfficialCompareResult;
    const ledgerRows = compareResult?.ledgerRows || [];
    if (!ledgerRows.length) {
      this.setOfficialDatasetError('取り込める施設基準がありません。医療機関コードを確認してください。');
      return;
    }
    const medicalId = ledgerRows[0]?.medicalId || this.normalizeMedicalInstitutionCode(document.getElementById('official-dataset-medical-id')?.value || '');
    const importedClinicName = compareResult.clinicName && compareResult.clinicName !== '要確認'
      ? compareResult.clinicName
      : '';
    const existingCount = Array.isArray(entries) ? entries.length : 0;
    if (existingCount) {
      const ok = confirm([
        'この内容で届出台帳を置き換えます。',
        '',
        `現在の届出台帳に登録されている施設基準データ ${existingCount}件は削除されます。`,
        '検索結果の医療機関の施設基準データに置き換えられます。',
        '既存のメモやチェック状態など、届出台帳に紐づくローカル情報も失われる可能性があります。',
        '現在のデータを残したい場合は、先に右上の設定ボタンなどからデータをエクスポートして保存してください。',
        '',
        '続行しますか？'
      ].join('\n'));
      if (!ok) return;
    }
    const importedAt = new Date().toISOString();
    const replacementEntries = ledgerRows.map((item, idx) => ({
      id: String(idx + 1),
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
        medicalInstitutionNumber: item.medicalId,
        medicalId: item.medicalId,
        clinicName: item.clinicName,
        importedAt,
        mode: 'official-dataset-ledger-replace'
      }
    }));
    entries.length = 0;
    entries.push(...replacementEntries);
    if (medicalId && typeof setOfficialDatasetLastMedicalInstitutionNumber === 'function') {
      setOfficialDatasetLastMedicalInstitutionNumber(medicalId);
    }
    if (medicalId && typeof saveClinicProfile === 'function') {
      saveClinicProfile({ medicalInstitutionNumber: medicalId });
    }
    if (importedClinicName) {
      clinicName = importedClinicName;
      localStorage.setItem('clinic_name', clinicName);
    }
    save();
    render();
    if (typeof updateClinicPill === 'function') updateClinicPill();
    this.renderOfficialDatasetBanner();
    this.setOfficialDatasetStatus('届出台帳を検索結果で置き換えました。', 'success');
    this.setOfficialDatasetError('');
    alert(`✅ 届出台帳を ${replacementEntries.length}件の施設基準に置き換えました。`);
    closeOfficialDatasetModal();
  },
  async loadOfficialDatasetFromManifest(options = {}) {
    const preferredMessage = options.preferredMessage || '最新データを確認しています。';
    this.setOfficialDatasetError('');
    this.setOfficialDatasetStatus(preferredMessage);
    if (window.location && window.location.protocol === 'file:') {
      this.setOfficialDatasetStatus('この画面は公開版で利用してください。', 'error');
      this.setOfficialDatasetError('このローカル表示では最新データの自動確認は使えません。公開版で利用するか、「管理者・トラブル対応用」から手動で更新データを読み込んでください。');
      if (this.officialDatasetMode !== 'initial') {
        this.applyResolvedMedicalInstitutionNumber(this.resolveSavedMedicalInstitutionNumber());
      }
      return;
    }
    try {
      const { manifest, manifestUrl, manifestRequestUrl } = await this.fetchOfficialManifest();
      const datasets = Array.isArray(manifest.datasets) ? manifest.datasets : [];
      const active = datasets.find(item => item.datasetId === manifest.activeDatasetId) || datasets[0];
      this.setOfficialDatasetDebug({
        manifestRequestUrl,
        activeDatasetId: manifest.activeDatasetId || '',
        manifestDatasets: datasets,
        selectedDatasetId: active?.datasetId || '',
        datasetFile: active?.file || active?.path || '',
        lastCheckedAt: new Date().toISOString(),
        errorMessage: ''
      });
      const file = active?.file || active?.path || '';
      if (!active || !file) {
        throw new Error('最新版データ設定が見つかりません。');
      }
      const datasetBaseUrl = this.resolveDatasetUrl(file, manifestUrl);
      const fetchedDataset = await this.fetchJsonTextWithDiagnostics(datasetBaseUrl, '最新版データ');
      this.setOfficialDatasetDebug({
        datasetRequestUrl: fetchedDataset.requestUrl,
        httpStatus: fetchedDataset.httpStatus,
        datasetFile: file
      });
      const dataset = this.normalizeLoadedOfficialDataset(fetchedDataset.json, active, datasetBaseUrl);
      this.validateOfficialDataset(dataset);
      saveOfficialDataset(dataset);
      this.lastOfficialCompareResult = null;
      this.renderStoredOfficialDatasetSummary();
      this.renderOfficialDatasetBanner();
      this.setOfficialDatasetStatus('最新データを確認しました。', 'success');
      if (options.autoSearch) {
        if (!this.tryAutoSearchOfficialDataset()) {
          this.setOfficialDatasetResultPlaceholder('最新データを確認しました。医療機関コードを入力すると自院の施設基準候補を表示します。');
        }
      } else {
        if (this.officialDatasetMode !== 'initial') {
          this.applyResolvedMedicalInstitutionNumber(this.resolveSavedMedicalInstitutionNumber());
          this.setOfficialDatasetResultPlaceholder('最新データを確認しました。医療機関コードを入力すると自院の施設基準候補を表示します。');
        } else {
          this.setOfficialDatasetResultPlaceholder('医療機関コードを入力して検索してください。');
        }
      }
    } catch (err) {
      this.setOfficialDatasetStatus('最新データの確認に失敗しました。', 'error');
      const friendly = this.buildOfficialDatasetFriendlyError(err);
      this.setOfficialDatasetError(friendly);
      this.setOfficialDatasetDebug({
        httpStatus: err.httpStatus || this.lastOfficialDatasetDebug?.httpStatus || '',
        datasetRequestUrl: err.requestUrl || this.lastOfficialDatasetDebug?.datasetRequestUrl || '',
        errorMessage: err.message || '不明なエラー'
      });
      this.renderStoredOfficialDatasetSummary();
      if (officialDataset) {
        this.renderOfficialDatasetBanner();
        if (options.autoSearch) {
          this.tryAutoSearchOfficialDataset();
        }
      }
    }
  },
  buildOfficialDatasetFriendlyError(err) {
    const message = String(err?.message || '');
    const parts = [];
    if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
      parts.push('最新データを取得できませんでした。インターネット接続を確認するか、時間をおいて再度お試しください。');
    } else if (message.includes('解析に失敗') || message.includes('JSON')) {
      parts.push('GitHub上のデータ形式が想定と異なるため、取り込みできませんでした。');
    } else if (window.location && window.location.protocol === 'file:') {
      parts.push('ローカルHTML実行環境では最新データを取得できない場合があります。公開版で開くか、手動取り込みを利用してください。');
    } else {
      parts.push('最新データを取得できませんでした。インターネット接続を確認するか、時間をおいて再度お試しください。');
    }
    if (message) parts.push(message);
    return parts.join('\n');
  },
  async fetchOfficialManifest() {
    const manifestUrl = this.getBaseManifestUrl();
    const fetched = await this.fetchJsonTextWithDiagnostics(manifestUrl.toString(), '最新データ設定');
    const manifest = fetched.json;
    saveOfficialManifestMeta({
      activeDatasetId: manifest.activeDatasetId || '',
      checkedAt: new Date().toISOString(),
      datasetCount: Array.isArray(manifest.datasets) ? manifest.datasets.length : 0
    });
    this.setOfficialDatasetDebug({
      manifestRequestUrl: fetched.requestUrl,
      httpStatus: fetched.httpStatus,
      manifestDatasets: Array.isArray(manifest.datasets) ? manifest.datasets : [],
      activeDatasetId: manifest.activeDatasetId || '',
      lastCheckedAt: new Date().toISOString(),
      errorMessage: ''
    });
    return {
      manifest,
      manifestUrl: manifestUrl.toString(),
      manifestRequestUrl: fetched.requestUrl
    };
  },
  async maybeCheckManifestOnStartup() {
    if (window.location && window.location.protocol === 'file:') {
      this.renderOfficialDatasetBanner();
      return;
    }
    try {
      const { manifest } = await this.fetchOfficialManifest();
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
      text.innerHTML = `保存済みの更新データは <strong>${this.escapeHtml(this.getOfficialDatasetDisplayName(officialDataset))}</strong> です。公開中の最新版が更新されている可能性があります。必要に応じて「施設基準の更新」で確認してください。`;
      return;
    }
    if (officialDataset) {
      banner.style.display = 'flex';
      text.innerHTML = `現在の更新データ: <strong>${this.escapeHtml(this.getOfficialDatasetDisplayName(officialDataset))}</strong>`;
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

async function openFacilityUpdateModal() {
  await ExcelImport.openOfficialDatasetModal({ mode: 'update' });
}

async function openFacilityImportModal() {
  await ExcelImport.openOfficialDatasetModal({ mode: 'initial' });
}

function openOfficialDatasetModal() {
  ExcelImport.openOfficialDatasetModal({ mode: 'update' });
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

function filterOfficialDatasetCompareRows(filter) {
  ExcelImport.filterOfficialDatasetCompareRows(filter);
}

async function refreshFacilityUpdateData() {
  await ExcelImport.loadOfficialDatasetFromManifest({ autoSearch: true, preferredMessage: '最新データを確認しています。' });
}

async function loadOfficialDatasetFromManifest() {
  await ExcelImport.loadOfficialDatasetFromManifest();
}

async function fetchFacilityStandardMaster(options = {}) {
  return ExcelImport.fetchFacilityStandardMaster(options);
}

function normalizeMedicalInstitutionCode(code) {
  return ExcelImport.normalizeMedicalInstitutionCode(code);
}

function findInstitutionByCode(code, masterData) {
  return ExcelImport.findInstitutionByCode(code, masterData);
}

function previewFacilityImport(institutionData) {
  return ExcelImport.previewFacilityImport(institutionData);
}

function mergeFacilityStandards(compareResult) {
  return ExcelImport.mergeFacilityStandards(compareResult);
}

ExcelImport.init();
