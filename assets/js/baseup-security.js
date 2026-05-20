/* ベースアップ評価料 賃上げシミュレーター向けセキュリティUI */
let importedBaseupSecureData = null;

function notifyBaseupSecurity(message, type='info'){
  if(typeof showAppToast === 'function') showAppToast(message, type);
}

function renderBaseupSecurityCard(){
  const unavailable = !isSecureStorageAvailable();
  return `
    <section class="baseup-security-card">
      <div class="baseup-security-head">
        <div>
          <div class="baseup-security-kicker">端末内処理・外部送信なし</div>
          <h3>賃上げ試算のセキュリティについて</h3>
        </div>
        <span class="badge ${unavailable ? 'br' : 'bg'}">${unavailable ? '暗号化非対応' : '暗号化保存対応'}</span>
      </div>
      <div class="baseup-security-body">
        <p>本機能は、ベースアップ評価料に関する賃上げ額を検討するための試算支援ツールです。</p>
        <p>入力された給与情報は、この端末内でのみ処理され、歯科医師会、管理者、事務局、外部サーバーには送信されません。</p>
        <p>給与情報は自動保存されません。保存する場合は、パスワードで暗号化されたJSONファイルとして各医院の責任で保管してください。</p>
        <p>パスワードはアプリ側では保存されません。パスワードを忘れた場合、暗号化ファイルを復元することはできません。</p>
        <p>本機能は公式届出様式、賃金台帳、給与計算ソフト、社労士による確認を代替するものではありません。</p>
      </div>
      <div class="baseup-security-hints">
        <span>保存せずに試算できます</span>
        <span>給与情報は外部送信されません</span>
        <span>職員名ではなく、職員1・職員2・DH1・受付1など匿名で入力してください</span>
        <span>印刷・出力時も匿名名を使用してください</span>
      </div>
      ${unavailable ? `
        <div class="baseup-security-alert">古いブラウザのため暗号化保存機能を利用できません。保存せずに試算してください。</div>
      ` : `
        <div class="baseup-security-actions">
          <button class="btn btn-secondary" id="baseup-secure-save-btn" type="button">暗号化して保存</button>
          <label class="btn btn-ghost" for="baseup-secure-import-file">暗号化ファイルを読み込む</label>
          <input type="file" id="baseup-secure-import-file" accept=".json,.baseup-secure.json,application/json" hidden>
        </div>
      `}
    </section>
  `;
}

function initBaseupSecurityUi(){
  const saveBtn = document.getElementById('baseup-secure-save-btn');
  const fileInput = document.getElementById('baseup-secure-import-file');
  if(saveBtn) saveBtn.addEventListener('click', () => downloadEncryptedBaseupJson(collectBaseupSimulationData()));
  if(fileInput) fileInput.addEventListener('change', async event => {
    const file = event.target.files && event.target.files[0];
    if(!file) return;
    try{
      importedBaseupSecureData = await importEncryptedBaseupJson(file);
      if(typeof applyBaseupSimulationData === 'function') applyBaseupSimulationData(importedBaseupSecureData);
      notifyBaseupSecurity('暗号化ファイルを復元しました。試算フォームに反映しました。', 'success');
    }catch(err){
      notifyBaseupSecurity(err.message || '復号に失敗しました。', 'error');
    }finally{
      event.target.value = '';
    }
  });
}

function collectBaseupSimulationData(){
  return {
    clinic: {
      name: typeof clinicName !== 'undefined' ? clinicName : ''
    },
    simulation: {
      calculationCount: null,
      pointSettings: {},
      staff: [],
      socialInsurance: {},
      assumptions: {}
    },
    notice: '給与情報は自動保存されません。職員名は匿名名で入力する前提です。'
  };
}

function showBaseupPasswordDialog(mode){
  return new Promise((resolve, reject)=>{
    const existing = document.getElementById('baseup-password-overlay');
    if(existing) existing.remove();
    const needsConfirm = mode === 'save';
    const overlay = document.createElement('div');
    overlay.id = 'baseup-password-overlay';
    overlay.className = 'overlay open';
    overlay.innerHTML = `
      <div class="modal" style="max-width:440px">
        <div class="mt">${needsConfirm ? '暗号化して保存' : '暗号化ファイルを読み込む'}</div>
        <div class="ms">パスワードはアプリ側では保存されません。忘れた場合、暗号化ファイルを復元できません。</div>
        <div class="form-error" id="baseup-password-error"></div>
        <div class="fr">
          <div class="fl">パスワード（8文字以上推奨）</div>
          <input type="password" class="fi" id="baseup-secure-password" autocomplete="new-password">
        </div>
        ${needsConfirm ? `
          <div class="fr">
            <div class="fl">パスワード確認</div>
            <input type="password" class="fi" id="baseup-secure-password-confirm" autocomplete="new-password">
          </div>
        ` : ''}
        <div class="baseup-security-alert">給与情報を扱う場合は、ファイルとパスワードを各医院の責任で安全に保管してください。</div>
        <div class="mf">
          <button class="btn btn-ghost" id="baseup-password-cancel" type="button">キャンセル</button>
          <button class="btn btn-primary" id="baseup-password-ok" type="button">${needsConfirm ? '暗号化する' : '復元する'}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const error = document.getElementById('baseup-password-error');
    const close = () => overlay.remove();
    document.getElementById('baseup-password-cancel').onclick = () => { close(); reject(new Error('キャンセルしました。')); };
    document.getElementById('baseup-password-ok').onclick = () => {
      const password = document.getElementById('baseup-secure-password').value;
      const confirm = document.getElementById('baseup-secure-password-confirm')?.value;
      if(!password || password.length < 8){
        error.textContent = 'パスワードは8文字以上を推奨します。';
        error.style.display = 'block';
        return;
      }
      if(needsConfirm && password !== confirm){
        error.textContent = 'パスワードが一致しません。';
        error.style.display = 'block';
        return;
      }
      close();
      resolve(password);
    };
    setTimeout(()=>document.getElementById('baseup-secure-password')?.focus(),0);
  });
}

async function downloadEncryptedBaseupJson(data){
  if(!isSecureStorageAvailable()){
    notifyBaseupSecurity('このブラウザでは暗号化保存機能を利用できません。', 'error');
    return;
  }
  const password = await showBaseupPasswordDialog('save');
  try{
    const encrypted = await encryptBaseupData(data, password);
    downloadBaseupSecureObject(encrypted);
    notifyBaseupSecurity('暗号化JSONファイルを作成しました。', 'success');
  }catch(err){
    notifyBaseupSecurity(err.message || '暗号化に失敗しました。', 'error');
  }
}

async function importEncryptedBaseupJson(file){
  if(!isSecureStorageAvailable()) throw new Error('このブラウザでは暗号化ファイルを読み込めません。');
  const text = await file.text();
  let fileObject;
  try{
    fileObject = JSON.parse(text);
  }catch(_err){
    throw new Error('ファイル形式が違います。');
  }
  const password = await showBaseupPasswordDialog('load');
  return decryptBaseupData(fileObject, password);
}
