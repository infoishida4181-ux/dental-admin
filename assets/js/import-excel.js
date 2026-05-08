/* Excel取り込み（第1段階: ファイル読込とプレビュー） */
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
  workbook: null,
  fileName: '',
  selectedSheet: '',
  sheetRows: {},
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
    this.setError('');
  },
  setError(message) {
    const el = document.getElementById('excel-import-error');
    if (!el) return;
    el.textContent = message || '';
    el.style.display = message ? 'block' : 'none';
  },
  open() {
    this.setError('');
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
      const workbook = XLSX.read(ab, { type: 'array' });
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
  prepareSheetRows() {
    this.sheetRows = {};
    this.headerRowBySheet = {};
    this.detectedHeaderRowBySheet = {};
    if (!this.workbook) return;
    this.workbook.SheetNames.forEach(name => {
      const worksheet = this.workbook.Sheets[name];
      const rows = worksheet && worksheet['!ref']
        ? XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', blankrows: true })
        : [];
      this.sheetRows[name] = Array.isArray(rows) ? rows : [];
      const detected = this.detectHeaderRowIndex(this.sheetRows[name]);
      this.detectedHeaderRowBySheet[name] = detected;
      this.headerRowBySheet[name] = detected;
    });
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
    const max = Math.max(rows.length, 1);
    let parsed = Number(value);
    if (!Number.isFinite(parsed)) parsed = 1;
    parsed = Math.max(1, Math.min(max, Math.floor(parsed)));
    this.headerRowBySheet[this.selectedSheet] = parsed - 1;
    const input = document.getElementById('excel-import-header-row');
    if (input) input.value = String(parsed);
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
    return rows.findIndex(row => this.isNonEmptyRow(row)) >= 0
      ? rows.findIndex(row => this.isNonEmptyRow(row))
      : 0;
  },
  isNonEmptyRow(row) {
    return Array.isArray(row) && row.some(value => String(value == null ? '' : value).trim() !== '');
  },
  buildHeadersFromRow(row) {
    const values = Array.isArray(row) ? row : [];
    return values.map((value, idx) => {
      const text = String(value == null ? '' : value).trim();
      return text || `列${idx + 1}`;
    }).filter((_, idx, arr) => idx < arr.length);
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
      headerInput.disabled = true;
      cols.innerHTML = '<div class="excel-import-empty">シートを選択すると列名を表示します。</div>';
      preview.innerHTML = '<div class="excel-import-empty">Excelファイルを読み込むと、ここに先頭10〜20行の表を表示します。</div>';
      previewMeta.textContent = 'まだプレビューはありません。';
      return;
    }
    const rows = this.sheetRows[this.selectedSheet] || [];
    if (!rows.length) {
      headerStatus.innerHTML = `<strong>見出し行:</strong> 判定できませんでした`;
      headerInput.value = '1';
      headerInput.disabled = true;
      cols.innerHTML = '<div class="excel-import-empty">このシートには表示できるデータがありません。</div>';
      preview.innerHTML = '<div class="excel-import-empty">このシートには表示できるデータがありません。</div>';
      previewMeta.textContent = `選択中シート: ${this.selectedSheet}`;
      return;
    }
    const detectedIndex = typeof this.detectedHeaderRowBySheet[this.selectedSheet] === 'number'
      ? this.detectedHeaderRowBySheet[this.selectedSheet]
      : this.detectHeaderRowIndex(rows);
    const headerIndex = typeof this.headerRowBySheet[this.selectedSheet] === 'number'
      ? this.headerRowBySheet[this.selectedSheet]
      : detectedIndex;
    const safeHeaderIndex = Math.max(0, Math.min(rows.length - 1, headerIndex));
    this.headerRowBySheet[this.selectedSheet] = safeHeaderIndex;
    headerInput.disabled = false;
    headerInput.min = '1';
    headerInput.max = String(Math.max(rows.length, 1));
    headerInput.value = String(safeHeaderIndex + 1);
    const isAuto = safeHeaderIndex === detectedIndex;
    headerStatus.innerHTML = isAuto
      ? `<strong>自動判定された見出し行:</strong> ${safeHeaderIndex + 1}行目`
      : `<strong>見出し行:</strong> ${safeHeaderIndex + 1}行目 <span style="color:var(--text3)">（自動判定候補: ${detectedIndex + 1}行目）</span>`;

    const headerRow = Array.isArray(rows[safeHeaderIndex]) ? rows[safeHeaderIndex] : [];
    const headers = this.buildHeadersFromRow(headerRow);
    if (!headers.length) {
      headerStatus.innerHTML = `<strong>見出し行:</strong> ${safeHeaderIndex + 1}行目 <span style="color:var(--red)">列名を取得できません</span>`;
      cols.innerHTML = '<div class="excel-import-empty">列名を取得できませんでした。1行目に見出しがあるか確認してください。</div>';
      preview.innerHTML = '<div class="excel-import-empty">列名を取得できませんでした。1行目に見出しがあるか確認してください。</div>';
      previewMeta.textContent = `選択中シート: ${this.selectedSheet}`;
      return;
    }

    cols.innerHTML = headers.map(name => `<span class="excel-import-chip">${this.escapeHtml(name)}</span>`).join('');
    const dataRows = rows
      .map((row, idx) => ({ row, rowNumber: idx + 1 }))
      .filter(item => item.rowNumber > safeHeaderIndex + 1 && this.isNonEmptyRow(item.row))
      .slice(0, this.previewLimit);
    previewMeta.textContent = `選択中シート: ${this.selectedSheet} / 見出し行: ${safeHeaderIndex + 1}行目 / 列数: ${headers.length} / プレビュー: 見出し行の次から先頭${Math.min(dataRows.length, this.previewLimit)}行`;

    if (!dataRows.length) {
      preview.innerHTML = '<div class="excel-import-empty">見出し行は読み込めましたが、その下に表示できるデータ行はまだありません。</div>';
      return;
    }

    preview.innerHTML = `
      <table class="excel-import-table">
        <thead>
          <tr><th>Excel行</th>${headers.map(name => `<th>${this.escapeHtml(name)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${dataRows.map(item => {
            const cells = headers.map((_, idx) => this.escapeHtml(String(item.row[idx] == null ? '' : item.row[idx])));
            return `<tr><td class="excel-import-rowno">${item.rowNumber}</td>${cells.map(cell => `<td>${cell || '&nbsp;'}</td>`).join('')}</tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
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

ExcelImport.init();
