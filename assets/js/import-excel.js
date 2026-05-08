/* Excel取り込み（第1段階: ファイル読込とプレビュー） */
window.ExcelImport = window.ExcelImport || {
  previewLimit: 15,
  workbook: null,
  fileName: '',
  selectedSheet: '',
  init() {
    this.reset();
  },
  reset() {
    this.workbook = null;
    this.fileName = '';
    this.selectedSheet = '';
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
    this.renderCurrentSheet();
  },
  renderCurrentSheet() {
    const cols = document.getElementById('excel-import-columns');
    const preview = document.getElementById('excel-import-preview');
    const previewMeta = document.getElementById('excel-import-preview-meta');
    if (!cols || !preview || !previewMeta) return;
    if (!this.workbook || !this.selectedSheet) {
      cols.innerHTML = '<div class="excel-import-empty">シートを選択すると列名を表示します。</div>';
      preview.innerHTML = '<div class="excel-import-empty">Excelファイルを読み込むと、ここに先頭10〜20行の表を表示します。</div>';
      previewMeta.textContent = 'まだプレビューはありません。';
      return;
    }
    const worksheet = this.workbook.Sheets[this.selectedSheet];
    if (!worksheet || !worksheet['!ref']) {
      cols.innerHTML = '<div class="excel-import-empty">このシートには表示できるデータがありません。</div>';
      preview.innerHTML = '<div class="excel-import-empty">このシートには表示できるデータがありません。</div>';
      previewMeta.textContent = `選択中シート: ${this.selectedSheet}`;
      return;
    }
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', blankrows: false });
    const headerRow = Array.isArray(rows[0]) ? rows[0] : [];
    const headers = headerRow.length
      ? headerRow.map((value, idx) => {
          const text = String(value == null ? '' : value).trim();
          return text || `列${idx + 1}`;
        })
      : [];
    if (!headers.length) {
      cols.innerHTML = '<div class="excel-import-empty">列名を取得できませんでした。1行目に見出しがあるか確認してください。</div>';
      preview.innerHTML = '<div class="excel-import-empty">列名を取得できませんでした。1行目に見出しがあるか確認してください。</div>';
      previewMeta.textContent = `選択中シート: ${this.selectedSheet}`;
      return;
    }

    cols.innerHTML = headers.map(name => `<span class="excel-import-chip">${this.escapeHtml(name)}</span>`).join('');
    const dataRows = rows.slice(1, this.previewLimit + 1);
    previewMeta.textContent = `選択中シート: ${this.selectedSheet} / 列数: ${headers.length} / プレビュー: 先頭${Math.min(dataRows.length, this.previewLimit)}行`;

    if (!dataRows.length) {
      preview.innerHTML = '<div class="excel-import-empty">見出し行は読み込めましたが、データ行はまだありません。</div>';
      return;
    }

    preview.innerHTML = `
      <table class="excel-import-table">
        <thead>
          <tr>${headers.map(name => `<th>${this.escapeHtml(name)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${dataRows.map(row => {
            const cells = headers.map((_, idx) => this.escapeHtml(String(row[idx] == null ? '' : row[idx])));
            return `<tr>${cells.map(cell => `<td>${cell || '&nbsp;'}</td>`).join('')}</tr>`;
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

ExcelImport.init();
