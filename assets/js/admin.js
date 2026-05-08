/* 管理者モード・設定メニュー */
function ensureAdminStorageInitialized(){
  if(!localStorage.getItem(ADMIN_PASS_HASH_KEY)){
    localStorage.setItem(ADMIN_PASS_HASH_KEY, ADMIN_DEFAULT_PASS_HASH);
    localStorage.setItem(ADMIN_PASS_DEFAULT_KEY, '1');
    localStorage.setItem(ADMIN_PASS_UPDATED_AT_KEY, new Date().toISOString());
    return;
  }
  if(!localStorage.getItem(ADMIN_PASS_DEFAULT_KEY)){
    const stored=localStorage.getItem(ADMIN_PASS_HASH_KEY);
    localStorage.setItem(ADMIN_PASS_DEFAULT_KEY, stored===ADMIN_DEFAULT_PASS_HASH?'1':'0');
  }
  if(!localStorage.getItem(ADMIN_PASS_UPDATED_AT_KEY)){
    localStorage.setItem(ADMIN_PASS_UPDATED_AT_KEY, new Date().toISOString());
  }
}

function findNavItem(view){
  return document.querySelector(`.nav-item[data-view="${view}"]`);
}

function toggleSettingsMenu(event){
  event.stopPropagation();
  const menu=document.getElementById('settings-menu');
  const btn=document.getElementById('settings-btn');
  if(!menu||!btn)return;
  const open=!menu.classList.contains('open');
  menu.classList.toggle('open',open);
  btn.setAttribute('aria-expanded',open?'true':'false');
}

function closeSettingsMenu(){
  const menu=document.getElementById('settings-menu');
  const btn=document.getElementById('settings-btn');
  if(menu)menu.classList.remove('open');
  if(btn)btn.setAttribute('aria-expanded','false');
}

function handleSettingsAction(action){
  closeSettingsMenu();
  if(action==='clinic') return editClinicName();
  if(action==='data') return openDataMgr();
  if(action==='admin') return requestAdminModeAccess();
}

function updateClinicPill(){
  const pill=document.getElementById('clinic-pill');
  if(pill) pill.textContent=`🏥 ${clinicName}`;
}

function isAdminSessionActive(){
  return sessionStorage.getItem(ADMIN_SESSION_KEY)==='1';
}

async function sha256Hex(text){
  if(!(window.crypto&&window.crypto.subtle)) throw new Error('このブラウザではSHA-256が利用できません。');
  const bytes=new TextEncoder().encode(text);
  const digest=await window.crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

async function verifyAdminPassphrase(text){
  ensureAdminStorageInitialized();
  const stored=localStorage.getItem(ADMIN_PASS_HASH_KEY)||ADMIN_DEFAULT_PASS_HASH;
  if(stored.startsWith('sha256:')){
    return `sha256:${await sha256Hex(text)}`===stored;
  }
  return `plain:${text}`===stored;
}

async function createAdminPassphraseHash(text){
  return `sha256:${await sha256Hex(text)}`;
}

function updateAdminAccessNote(){
  const note=document.getElementById('admin-access-note');
  if(!note)return;
  const isDefault=localStorage.getItem(ADMIN_PASS_DEFAULT_KEY)!=='0';
  note.innerHTML=isDefault
    ? `現在は初期パスフレーズ <code>${ADMIN_DEFAULT_PASSPHRASE}</code> が設定されています。ログイン後に変更してください。`
    : '現在はカスタムの管理者パスフレーズが設定されています。';
}

function setAdminAccessError(message){
  const el=document.getElementById('admin-access-error');
  if(!el)return;
  el.textContent=message||'';
  el.style.display=message?'block':'none';
}

function requestAdminModeAccess(){
  ensureAdminStorageInitialized();
  if(isAdminSessionActive()){
    openAdminMode();
    return;
  }
  updateAdminAccessNote();
  setAdminAccessError('');
  const input=document.getElementById('admin-passphrase-input');
  if(input) input.value='';
  document.getElementById('admin-access-overlay').classList.add('open');
  setTimeout(()=>{ if(input) input.focus(); }, 0);
}

async function submitAdminPassphrase(){
  const input=document.getElementById('admin-passphrase-input');
  if(!input)return;
  const pass=input.value;
  if(!pass.trim()){
    setAdminAccessError('管理者パスフレーズを入力してください。');
    input.focus();
    return;
  }
  try{
    const ok=await verifyAdminPassphrase(pass);
    if(!ok){
      setAdminAccessError('パスフレーズが一致しません。');
      input.select();
      return;
    }
    sessionStorage.setItem(ADMIN_SESSION_KEY,'1');
    closeOverlay('admin-access-overlay');
    input.value='';
    openAdminMode();
  }catch(err){
    setAdminAccessError(`管理者認証の確認に失敗しました。${err.message}`);
  }
}

function openAdminMode(){
  nav('admin');
  renderAdminSecurityStatus();
}

function clearAdminPassphraseInputs(){
  ['admin-current-passphrase','admin-new-passphrase','admin-confirm-passphrase'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.value='';
  });
}

function formatAdminUpdatedAt(value){
  if(!value) return '更新日時不明';
  const d=new Date(value);
  if(Number.isNaN(d.getTime())) return '更新日時不明';
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function renderAdminSecurityStatus(){
  ensureAdminStorageInitialized();
  const status=document.getElementById('admin-security-status');
  const defaultTip=document.getElementById('admin-default-tip');
  if(status){
    const isDefault=localStorage.getItem(ADMIN_PASS_DEFAULT_KEY)!=='0';
    const updatedAt=formatAdminUpdatedAt(localStorage.getItem(ADMIN_PASS_UPDATED_AT_KEY));
    status.innerHTML=isDefault
      ? `現在は <strong style="color:var(--yellow)">初期パスフレーズ</strong> を使用しています。<br>更新日時: ${updatedAt}`
      : `現在は <strong style="color:var(--green)">カスタムパスフレーズ</strong> を使用しています。<br>更新日時: ${updatedAt}`;
  }
  if(defaultTip){
    defaultTip.style.display=localStorage.getItem(ADMIN_PASS_DEFAULT_KEY)!=='0'?'block':'none';
  }
}

async function changeAdminPassphrase(){
  ensureAdminStorageInitialized();
  if(!isAdminSessionActive()){
    alert('管理者モードに入ってから操作してください。');
    return;
  }
  const current=document.getElementById('admin-current-passphrase')?.value||'';
  const next=document.getElementById('admin-new-passphrase')?.value||'';
  const confirmPass=document.getElementById('admin-confirm-passphrase')?.value||'';
  if(!current || !next || !confirmPass){
    alert('現在のパスフレーズ、新しいパスフレーズ、確認用パスフレーズを入力してください。');
    return;
  }
  if(next!==confirmPass){
    alert('新しいパスフレーズと確認用パスフレーズが一致しません。');
    return;
  }
  if(current===next && localStorage.getItem(ADMIN_PASS_DEFAULT_KEY)==='0'){
    alert('現在と同じパスフレーズが入力されています。');
    return;
  }
  try{
    const ok=await verifyAdminPassphrase(current);
    if(!ok){
      alert('現在のパスフレーズが一致しません。');
      return;
    }
    localStorage.setItem(ADMIN_PASS_HASH_KEY, await createAdminPassphraseHash(next));
    localStorage.setItem(ADMIN_PASS_DEFAULT_KEY, next===ADMIN_DEFAULT_PASSPHRASE?'1':'0');
    localStorage.setItem(ADMIN_PASS_UPDATED_AT_KEY, new Date().toISOString());
    clearAdminPassphraseInputs();
    renderAdminSecurityStatus();
    updateAdminAccessNote();
    alert('管理者パスフレーズを更新しました。');
  }catch(err){
    alert(`管理者パスフレーズの更新に失敗しました。\n${err.message}`);
  }
}

function resetAdminPassphraseToDefault(){
  ensureAdminStorageInitialized();
  if(!isAdminSessionActive()){
    alert('管理者モードに入ってから操作してください。');
    return;
  }
  if(!confirm(`管理者パスフレーズを初期値「${ADMIN_DEFAULT_PASSPHRASE}」に戻しますか？`)) return;
  localStorage.setItem(ADMIN_PASS_HASH_KEY, ADMIN_DEFAULT_PASS_HASH);
  localStorage.setItem(ADMIN_PASS_DEFAULT_KEY, '1');
  localStorage.setItem(ADMIN_PASS_UPDATED_AT_KEY, new Date().toISOString());
  clearAdminPassphraseInputs();
  renderAdminSecurityStatus();
  updateAdminAccessNote();
  alert('管理者パスフレーズを初期値に戻しました。');
}

function exitAdminMode(){
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  const fallback=lastMemberView&&lastMemberView!=='admin'?lastMemberView:'daichou';
  nav(fallback);
}
