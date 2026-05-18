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
  if(window.currentMember && window.currentMember.role !== 'admin'){
    alert('管理者機能は管理者権限の会員のみ利用できます。');
    return;
  }
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

function getAllShinkiSupportAbbrs(){
  if(typeof SHINKI_GROUPS === 'undefined') return [];
  return [...new Set(SHINKI_GROUPS.flatMap(g => g.abbrs || []))];
}

function auditFacilityFormLinksR08(){
  const abbrs=getAllShinkiSupportAbbrs();
  const rows=abbrs.map(abbr => {
    const link=typeof getFacilityFormLinkR08 === 'function' ? getFacilityFormLinkR08(abbr) : null;
    const def=typeof SHINKI_MASTER !== 'undefined' ? SHINKI_MASTER[abbr] : null;
    const forms=Array.isArray(link?.forms) ? link.forms : [];
    const directForms=forms.filter(f=>f?.url);
    const pdfCount=directForms.filter(f=>f.type==='pdf').length;
    const wordCount=directForms.filter(f=>f.type==='word').length;
    const excelCount=directForms.filter(f=>f.type==='excel').length;
    const zipCount=directForms.filter(f=>f.type==='zip').length;
    const otherCount=directForms.filter(f=>!['pdf','word','excel','zip'].includes(f.type)).length;
    const page=link?.officialListUrl || link?.officialPageUrl || '';
    const directFormExempt=link?.directFormStatus === 'abolished' || def?.facilityStandardAbolished;
    const issues=[];
    const missingTypes=[];
    if(!link) issues.push('様式リンク未登録');
    if(link?.officialCategory==='basic' && page.includes('tokukei_shinryo_r08')) issues.push('区分と公式ページが不一致');
    if(link?.officialCategory==='tokukei' && page.includes('kihon_shinryo_r08')) issues.push('区分と公式ページが不一致');
    if(page.includes('_r06')) issues.push('令和6年度ページがメイン導線');
    if(forms.length===0 && !page) issues.push('公式一覧ページ未登録');
    if(forms.some(f=>!f.url)) issues.push('空の様式リンクあり');
    if(!directFormExempt){
      if(!link || directForms.length===0) missingTypes.push('直接リンク');
      if(pdfCount===0) missingTypes.push('PDF');
      if(wordCount+excelCount===0) missingTypes.push('Word/Excel');
    }
    const reason=link?.missingReason || link?.note || (missingTypes.length ? '公式ページの掲載状況を確認してください' : '');
    return {
      abbr,
      name: link?.name || def?.name || abbr,
      category: link?.officialCategory || (def?.category==='basic'?'basic':'tokukei'),
      page,
      pdfCount,
      wordCount,
      excelCount,
      zipCount,
      otherCount,
      directCount: directForms.length,
      directFormExempt,
      missingTypes,
      searchKeywords: Array.isArray(link?.searchKeywords) ? link.searchKeywords.join('、') : '',
      lastChecked: link?.lastChecked || '',
      reason,
      note: [reason, issues.join(' / ')].filter(Boolean).join(' / ')
    };
  });
  const summary={
    supportCount: abbrs.length,
    registeredCount: rows.filter(r=>r.directCount>0 || r.page).length,
    pdfFacilityCount: rows.filter(r=>r.pdfCount>0).length,
    wordFacilityCount: rows.filter(r=>r.wordCount>0).length,
    excelFacilityCount: rows.filter(r=>r.excelCount>0).length,
    zipFacilityCount: rows.filter(r=>r.zipCount>0).length,
    directMissingCount: rows.filter(r=>!r.directFormExempt && r.directCount===0).length,
    pageOnlyCount: rows.filter(r=>!r.directFormExempt && r.directCount===0 && r.page).length,
    exemptCount: rows.filter(r=>r.directFormExempt).length
  };
  return {rows,summary};
}

function renderFacilityFormLinkAudit(){
  const el=document.getElementById('facility-form-link-audit');
  if(!el)return;
  const audit=auditFacilityFormLinksR08();
  const rows=audit.rows;
  const missingRows=rows.filter(r=>r.missingTypes.length>0);
  const metric=(label,value)=>`<div class="admin-audit-metric"><span>${label}</span><strong>${value}</strong></div>`;
  const missingTable=missingRows.length?`<div class="admin-audit-alert">
    <div class="admin-audit-alert-title">不足リンク確認</div>
    <div class="tw"><table class="admin-form-audit-table">
      <thead><tr><th>施設基準名</th><th>略称</th><th>区分</th><th>不足しているリンク種別</th><th>理由</th><th>公式一覧ページ</th><th>検索キーワード</th></tr></thead>
      <tbody>${missingRows.map(r=>`<tr>
        <td>${r.name}</td>
        <td><span class="badge bb">${r.abbr}</span></td>
        <td>${r.category==='basic'?'基本診療料':'特掲診療料'}</td>
        <td>${r.missingTypes.join(' / ')}</td>
        <td>${r.reason || '確認理由未入力'}</td>
        <td>${r.page?`<a href="${r.page}" target="_blank" rel="noopener noreferrer">公式一覧ページ</a>`:'未登録'}</td>
        <td>${r.searchKeywords || '-'}</td>
      </tr>`).join('')}</tbody>
    </table></div>
  </div>`:'';
  el.innerHTML=`<div class="admin-audit-metrics">
    ${metric('新規届出サポート登録件数',audit.summary.supportCount)}
    ${metric('様式リンク登録件数',audit.summary.registeredCount)}
    ${metric('PDFリンクあり件数',audit.summary.pdfFacilityCount)}
    ${metric('Wordリンクあり件数',audit.summary.wordFacilityCount)}
    ${metric('Excelリンクあり件数',audit.summary.excelFacilityCount)}
    ${metric('ZIPリンクあり件数',audit.summary.zipFacilityCount)}
    ${metric('直接リンク未登録件数',audit.summary.directMissingCount)}
    ${metric('公式ページ確認のみの件数',audit.summary.pageOnlyCount)}
    ${metric('廃止・再編で様式なし',audit.summary.exemptCount)}
  </div>
  ${missingTable}
  <div class="tw"><table class="admin-form-audit-table">
    <thead><tr><th>受理番号</th><th>施設基準名</th><th>区分</th><th>公式ページ</th><th>PDF</th><th>Word</th><th>Excel</th><th>ZIP</th><th>最終確認日</th><th>注意メモ</th></tr></thead>
    <tbody>${rows.map(r=>`<tr>
      <td><span class="badge bb">${r.abbr}</span></td>
      <td>${r.name}</td>
      <td>${r.category==='basic'?'基本診療料':'特掲診療料'}</td>
      <td>${r.page?`<a href="${r.page}" target="_blank" rel="noopener noreferrer">公式一覧ページ</a>`:'未登録'}</td>
      <td>${r.pdfCount}</td>
      <td>${r.wordCount}</td>
      <td>${r.excelCount}</td>
      <td>${r.zipCount}</td>
      <td>${r.lastChecked || '未確認'}</td>
      <td>${r.note || '直接リンク登録済み'}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function adminEscapeHtml(value){
  return String(value ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function adminCategoryLabel(category){
  if(typeof CL !== 'undefined' && CL[category]) return CL[category];
  return {basic:'基本診療料',special:'特掲診療料',other:'その他'}[category] || category || '未分類';
}

function adminNormalizeMasterKey(value){
  if(typeof normalizeReviewKey === 'function') return normalizeReviewKey(value);
  return String(value||'').trim().replace(/\s+/g,'').toLowerCase();
}

function createAdminMasterEntryMap(){
  const map=new Map();
  const upsert=(abbr,data={})=>{
    const key=adminNormalizeMasterKey(abbr || data.name);
    if(!key)return null;
    const row=map.get(key)||{
      abbr:abbr||'',
      name:data.name||abbr||'',
      category:data.category||'other',
      sources:new Set(),
      sourceUrls:new Set(),
      notes:[],
      adminStatus:'未確認',
      lastChecked:'',
      searchKeywords:new Set()
    };
    if(abbr&&!row.abbr)row.abbr=abbr;
    if(data.name&&(!row.name||row.name===row.abbr))row.name=data.name;
    if(data.category&&row.category==='other')row.category=data.category;
    if(data.category==='basic'||data.category==='special')row.category=data.category;
    (data.sources||[]).forEach(s=>row.sources.add(s));
    (data.sourceUrls||[]).filter(Boolean).forEach(u=>row.sourceUrls.add(u));
    (data.searchKeywords||[]).filter(Boolean).forEach(k=>row.searchKeywords.add(k));
    if(data.note)row.notes.push(data.note);
    if(data.adminStatus)row.adminStatus=data.adminStatus;
    if(data.lastChecked)row.lastChecked=data.lastChecked;
    map.set(key,row);
    return row;
  };

  if(typeof SHINKI_MASTER !== 'undefined'){
    Object.entries(SHINKI_MASTER).forEach(([abbr,def])=>{
      const row=upsert(abbr,{
        name:def?.name||abbr,
        category:def?.category||'other',
        sources:['新規届出サポート','アプリ内マスタ'],
        sourceUrls:[def?.sourcePage, ...(Array.isArray(def?.yoshiki)?def.yoshiki.map(y=>y.url):[])],
        note:def?.adminMemo||def?.note||'',
        adminStatus:def?.adminReviewStatus||''
      });
      if(row){
        if(def?.facilityStandardAbolished)row.sources.add('廃止・再編');
        if(def?.limitedApplicability||def?.limitedBadge)row.sources.add('対象限定');
        if(def?.lastChecked)row.lastChecked=def.lastChecked;
      }
    });
  }
  if(typeof SHINKI_GROUPS !== 'undefined'){
    SHINKI_GROUPS.forEach(group=>{
      (group.abbrs||[]).forEach(abbr=>{
        const def=typeof SHINKI_MASTER !== 'undefined' ? SHINKI_MASTER[abbr] : null;
        const row=upsert(abbr,{
          name:def?.name||abbr,
          category:def?.category||'other',
          sources:['新規届出サポート'],
          note:group.label||''
        });
        if(row){
          if((group.label||'').includes('廃止'))row.sources.add('廃止・再編');
          if((group.label||'').includes('対象限定'))row.sources.add('対象限定');
          if((group.label||'').includes('賃上げ'))row.sources.add('ベースアップ');
        }
      });
    });
  }
  if(Array.isArray(entries)){
    entries.forEach(entry=>{
      upsert(entry.abbr||entry.name,{
        name:entry.name||entry.abbr,
        category:entry.category||'other',
        sources:['台帳管理'],
        note:entry.memo||''
      });
    });
  }
  if(typeof FACILITY_FORM_LINKS_R08 !== 'undefined'){
    Object.entries(FACILITY_FORM_LINKS_R08).forEach(([abbr,link])=>{
      const category=link?.officialCategory==='basic'?'basic':link?.officialCategory==='tokukei'?'special':'other';
      const row=upsert(abbr,{
        name:link?.name||abbr,
        category,
        sources:['様式リンク'],
        sourceUrls:[link?.officialListUrl, link?.officialPageUrl, link?.sourceUrl],
        searchKeywords:Array.isArray(link?.searchKeywords)?link.searchKeywords:[],
        note:link?.note||link?.missingReason||'',
        lastChecked:link?.lastChecked||''
      });
      if(row&&link?.directFormStatus==='abolished')row.sources.add('廃止・再編');
    });
  }
  if(typeof TEIREI_ROW !== 'undefined'){
    Object.keys(TEIREI_ROW).forEach(abbr=>{
      const def=typeof SHINKI_MASTER !== 'undefined' ? SHINKI_MASTER[abbr] : null;
      upsert(abbr,{name:def?.name||abbr,category:def?.category||'other',sources:['定例報告・自己点検']});
    });
  }
  if(typeof CHK !== 'undefined'){
    Object.keys(CHK).forEach(abbr=>{
      const def=typeof SHINKI_MASTER !== 'undefined' ? SHINKI_MASTER[abbr] : null;
      upsert(abbr,{name:def?.name||abbr,category:def?.category||'other',sources:['講習会・研修管理']});
    });
  }
  try{
    const records=window.ExcelImport&&typeof ExcelImport.flattenOfficialDatasetRecords==='function'
      ? ExcelImport.flattenOfficialDatasetRecords(officialDataset)
      : [];
    records.forEach(record=>{
      const abbr=record.acceptedCode||record.acceptanceCode||record.abbr||record['略称']||record['受理記号']||record.acceptedName||record.acceptanceName;
      const name=record.acceptedName||record.acceptanceName||record['受理届出名称']||record['施設基準名']||abbr;
      const ledgerAbbr=window.ExcelImport&&typeof ExcelImport.inferLedgerAbbr==='function' ? ExcelImport.inferLedgerAbbr(abbr,name) : abbr;
      upsert(ledgerAbbr,{name,category:'other',sources:['管理者更新JSON'],sourceUrls:[officialDataset?.sourceUrl]});
    });
  }catch(_err){}
  return [...map.values()];
}

function buildAdminMasterReviewRows(){
  return createAdminMasterEntryMap().map(row=>{
    const def=typeof getFacilityMasterForEntry === 'function'
      ? getFacilityMasterForEntry({abbr:row.abbr,name:row.name})
      : (typeof SHINKI_MASTER !== 'undefined' ? SHINKI_MASTER[row.abbr] : null);
    const form=typeof getFacilityFormLinkR08 === 'function' ? getFacilityFormLinkR08(row.abbr) : null;
    const entry={
      id:`admin-${row.abbr}`,
      name:row.name,
      abbr:row.abbr,
      number:'',
      date:'',
      category:row.category,
      status:'green',
      kaitei:'none',
      memo:row.notes.filter(Boolean).join(' / ')
    };
    if(def?.facilityStandardAbolished||form?.directFormStatus==='abolished')entry.kaitei='expire';
    if(isBaseUpStandard(entry))row.sources.add('ベースアップ');
    const impact=typeof getRevisionImpact === 'function' ? getRevisionImpact(entry) : {key:'none',label:'変更なし',badge:'<span class="badge bgr">変更なし</span>',message:''};
    const review=typeof shouldRequireReview === 'function' ? shouldRequireReview(entry) : {requiresReview:false,reasons:[]};
    const inMaster=Boolean(def);
    const inForm=Boolean(form);
    const normalizedName=adminNormalizeMasterKey(row.name);
    const nameVariant=typeof SHINKI_MASTER !== 'undefined' && !inMaster
      ? Object.entries(SHINKI_MASTER).some(([,d])=>adminNormalizeMasterKey(d?.name)===normalizedName)
      : false;
    const matchStatus=inMaster||inForm ? '照合済み' : nameVariant ? '表記ゆれ候補' : '未照合';
    const needsInvestigation=matchStatus==='未照合'||impact.key==='abolished'||review.requiresReview||!row.name||!row.notes.join('').trim();
    const isNew=def ? (typeof isShinkiNewFacility==='function'&&isShinkiNewFacility(def)) : null;
    const memberStatus=typeof getLedgerDisplayStatusLabel === 'function' ? getLedgerDisplayStatusLabel(entry) : (review.requiresReview?'要確認':'要件充足');
    const memberLabels=[
      memberStatus,
      impact.label,
      typeof TEIREI_ROW !== 'undefined' && TEIREI_ROW[row.abbr] ? TEIREI_ROW[row.abbr] : '自己点検のみ',
      def?.limitedBadge||def?.limitedApplicability?'対象限定':''
    ].filter(Boolean);
    const adminMemo=matchStatus==='未照合'
      ? '最新マスタと照合できません。名称変更、廃止、再編、表記ゆれの可能性があります。管理者確認が必要です。'
      : needsInvestigation
        ? '会員向け表示前に説明文・出典・分類を確認してください。'
        : '管理者確認上の大きな不足はありません。';
    const explanation=def?.summary||impact.message||row.notes.find(Boolean)||'会員向け説明文未設定';
    const sourceUrl=[...row.sourceUrls].find(Boolean)||def?.sourcePage||form?.officialListUrl||form?.officialPageUrl||'';
    return {
      ...row,
      def,
      form,
      impact,
      review,
      matchStatus,
      needsInvestigation,
      isNew,
      memberStatus,
      memberLabels,
      adminMemo,
      explanation,
      sourceUrl,
      lastChecked:row.lastChecked||form?.lastChecked||def?.lastChecked||''
    };
  }).sort((a,b)=>adminCategoryLabel(a.category).localeCompare(adminCategoryLabel(b.category),'ja')||String(a.abbr).localeCompare(String(b.abbr),'ja'));
}

function renderAdminMasterReview(){
  const container=document.getElementById('admin-master-review');
  const alerts=document.getElementById('admin-master-alerts');
  if(!container||!alerts)return;
  const rows=buildAdminMasterReviewRows();
  const summary={
    total:rows.length,
    needs:rows.filter(r=>r.needsInvestigation).length,
    unmatched:rows.filter(r=>r.matchStatus==='未照合').length,
    investigate:rows.filter(r=>r.needsInvestigation||r.adminStatus==='要調査').length,
    missingExplanation:rows.filter(r=>!r.explanation||r.explanation==='会員向け説明文未設定').length
  };
  alerts.innerHTML=[
    `<button class="admin-master-alert ${summary.needs?'warn':''}" onclick="document.getElementById('admin-master-filter').value='investigate';renderAdminMasterReview()">管理者確認が必要な施設基準<strong>${summary.needs}</strong></button>`,
    `<button class="admin-master-alert ${summary.unmatched?'danger':''}" onclick="document.getElementById('admin-master-filter').value='unmatched';renderAdminMasterReview()">最新マスタ未照合<strong>${summary.unmatched}</strong></button>`,
    `<button class="admin-master-alert ${summary.investigate?'warn':''}" onclick="document.getElementById('admin-master-filter').value='investigate';renderAdminMasterReview()">要調査<strong>${summary.investigate}</strong></button>`,
    `<button class="admin-master-alert ${summary.missingExplanation?'warn':''}" onclick="document.getElementById('admin-master-search').value='会員向け説明文未設定';renderAdminMasterReview()">会員向け説明文未設定<strong>${summary.missingExplanation}</strong></button>`,
    `<div class="admin-master-alert">登録総数<strong>${summary.total}</strong></div>`
  ].join('');
  const q=(document.getElementById('admin-master-search')?.value||'').trim().toLowerCase();
  const filter=document.getElementById('admin-master-filter')?.value||'all';
  const catFilter=document.getElementById('admin-master-category-filter')?.value||'all';
  const filtered=rows.filter(r=>{
    const hay=[r.name,r.abbr,r.explanation,r.adminMemo,r.matchStatus,r.impact.label,[...r.sources].join(' ')].join(' ').toLowerCase();
    if(q&&!hay.includes(q))return false;
    if(catFilter!=='all'&&r.category!==catFilter)return false;
    if(filter==='unmatched'&&r.matchStatus!=='未照合')return false;
    if(filter==='investigate'&&!r.needsInvestigation)return false;
    if(filter==='abolished'&&r.impact.key!=='abolished')return false;
    if(filter==='baseup'&&!isBaseUpStandard({name:r.name,abbr:r.abbr,category:r.category}))return false;
    if(filter==='report'&&!(r.impact.key==='report'||r.impact.key==='report-ended'||(typeof TEIREI_ROW!=='undefined'&&TEIREI_ROW[r.abbr])))return false;
    if(filter==='new'&&r.isNew!==true)return false;
    if(filter==='member-alert'&&!['要確認','要対応'].includes(r.memberStatus))return false;
    return true;
  });
  const matchBadge=r=>r.matchStatus==='照合済み'
    ? '<span class="badge bg">照合済み</span>'
    : r.matchStatus==='表記ゆれ候補'
      ? '<span class="badge by">表記ゆれ候補</span>'
      : '<span class="badge br">未照合</span>';
  container.innerHTML=`<div class="admin-master-muted" style="margin-bottom:8px">表示 ${filtered.length}件 / 全 ${rows.length}件。未照合・要調査は管理者向けの確認タスクです。会員画面には確認済みの結論を表示してください。</div>
  <div class="tw"><table class="admin-master-table">
    <thead><tr><th>施設基準名</th><th>略称</th><th>カテゴリ</th><th>データ由来</th><th>最新マスタ照合</th><th>改定影響分類</th><th>新設</th><th>会員画面表示</th><th>会員向け説明文</th><th>管理者メモ</th><th>出典</th><th>最終確認</th></tr></thead>
    <tbody>${filtered.map(r=>`<tr>
      <td><strong>${adminEscapeHtml(r.name)}</strong></td>
      <td><span class="badge bb">${adminEscapeHtml(r.abbr||'-')}</span></td>
      <td>${adminEscapeHtml(adminCategoryLabel(r.category))}</td>
      <td><div class="admin-master-source-list">${[...r.sources].map(s=>`<span class="badge bgr">${adminEscapeHtml(s)}</span>`).join('')}</div></td>
      <td>${matchBadge(r)}</td>
      <td>${r.impact.badge}</td>
      <td>${r.isNew===true?'<span class="badge br">令和8年新設</span>':r.isNew===false?'<span class="badge bgr">新設ではない</span>':'<span class="badge bgr">未判定</span>'}</td>
      <td><div class="admin-master-member-status">${r.memberLabels.map(label=>`<span class="badge ${label==='要対応'?'br':label==='要確認'?'by':'bgr'}">${adminEscapeHtml(label)}</span>`).join('')}</div></td>
      <td><div class="admin-master-note">${adminEscapeHtml(r.explanation)}</div></td>
      <td><div class="admin-master-note">${adminEscapeHtml(r.adminMemo)}</div><div class="admin-master-muted">確認ステータス: ${adminEscapeHtml(r.adminStatus||'未確認')}</div></td>
      <td>${r.sourceUrl?`<a href="${adminEscapeHtml(r.sourceUrl)}" target="_blank" rel="noopener noreferrer">公式・出典</a>`:'未設定'}</td>
      <td>${adminEscapeHtml(r.lastChecked||'未確認')}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
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
  renderFacilityFormLinkAudit();
  renderAdminMasterReview();
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
