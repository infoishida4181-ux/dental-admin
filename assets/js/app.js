/* アプリ本体・画面描画・各機能 */
/* ═══ RENDER ═══ */
function render(){
  const f=entries.filter(e=>(fStat==='all'||e.status===fStat)&&(fCatV==='all'||e.category===fCatV));
  document.getElementById('s-total').textContent=entries.length;
  document.getElementById('s-ok').textContent=entries.filter(e=>e.status==='green').length;
  document.getElementById('s-check').textContent=entries.filter(e=>e.status==='yellow').length;
  document.getElementById('s-alert').textContent=entries.filter(e=>e.status==='red').length;
  document.getElementById('abanner').style.display=entries.some(e=>e.status==='red'||e.kaitei==='reapply')?'flex':'none';
  const tb=document.getElementById('tbody');
  tb.innerHTML='';
  document.getElementById('empty-state').style.display=f.length?'none':'block';
  f.forEach(e=>{
    const tr=document.createElement('tr');
    tr.onclick=()=>openDP(e.id);
    tr.innerHTML=`<td><div class="kn">${e.name}</div></td>
      <td><span class="badge bb">${e.abbr||'—'}</span></td>
      <td><span class="mono">${e.number||'—'}</span></td>
      <td><span class="mono">${e.date?e.date.replace(/-/g,'/'):'—'}</span></td>
      <td><span class="badge bgr">${CL[e.category]||e.category}</span></td>
      <td>${SB[e.status]||''}</td>
      <td>${KB[e.kaitei]||KB.none}</td>
      <td>${TEIREI_ROW[e.abbr]
        ? '<span class="badge by">'+TEIREI_ROW[e.abbr]+'</span>'
        : '<span class="badge bgr" style="color:var(--green)">自己点検のみ</span>'
      }</td>`;
    tb.appendChild(tr);
  });
}
function dlFmt(ds){
  if(!ds)return '<span class="deadline-ok">—</span>';
  const d=new Date(ds),now=new Date(),diff=Math.floor((d-now)/86400000),s=ds.replace(/-/g,'/');
  if(diff<0)return`<span class="deadline-near">⚠ ${s}</span>`;
  if(diff<=60)return`<span class="deadline-soon">⏰ ${s} (${diff}日後)</span>`;
  return`<span class="deadline-ok">${s}</span>`;
}
function fStatus(v,el){fStat=v;document.querySelectorAll('#status-pills .fp').forEach(b=>b.classList.remove('active'));el.classList.add('active');render();}
function fCat(v,el){fCatV=v;document.querySelectorAll('#cat-pills .fp').forEach(b=>b.classList.remove('active'));el.classList.add('active');render();}

/* ═══ DETAIL PANEL ═══ */
const CHK={'歯初診':[['ok','院内感染防止対策研修（4年に1回以上）受講記録'],['ok','院内感染防止対策の院内掲示'],['ok','ウェブサイトへの掲載'],['ok','年1回 実施状況報告（様式2の7）→厚生局']],'外安全１':[['ok','緊急時対応研修 受講記録（常勤歯科医師）'],['ok','AED・パルスオキシメーター等の設置'],['warn','医療安全管理者の配置（要確認）'],['ok','連携医療機関との事前連携体制'],['ok','院内掲示・ウェブサイト掲載']],'外感染１':[['ok','院内感染管理者の配置'],['ok','歯科用吸引装置（ユニット毎）'],['warn','職員向け院内感染対策研修の実施記録'],['ok','院内掲示・ウェブサイト掲載']],'歯外在ベⅠ':[['ng','令和8年度改定で再届出必要'],['warn','最新様式で再提出'],['warn','対象職員・賃上げ額の再確認']]};
function openDP(id){
  const e=entries.find(x=>x.id===id);if(!e)return;
  document.getElementById('dp-title').textContent=e.abbr||e.name;

  const kl={none:'変更なし',reapply:'再届出必要',check:'要件確認',grace:'経過措置中',expire:'廃止・統合'}[e.kaitei];
  const vCls=e.kaitei==='reapply'?'v-ng':e.kaitei==='check'||e.kaitei==='grace'?'v-warn':'v-ok';
  const vTxt=e.kaitei==='reapply'?'🔴 再届出が必要です':e.kaitei==='check'?'🟡 要件の充足を確認してください':e.kaitei==='grace'?'🔵 経過措置中：期限を確認してください':'🟢 対応不要（現状維持）';
  const chks=(CHK[e.abbr]||[['ok','施設基準要件を自己点検（8月1日時点）'],['ok','関係書類の保管確認'],['warn','改定通知で変更点を確認']]);
  const cl=chks.map(([t,txt])=>`<li><span class="ci" style="color:${t==='ok'?'var(--green)':t==='warn'?'var(--yellow)':'var(--red)'}">${t==='ok'?'✓':t==='warn'?'⚠':'✕'}</span>${txt}</li>`).join('');

  // ── 様式ダウンロード ──
  const YOSHIKI_DL={
    // 【令和8年改定】歯初診・外感染2の様式27は定例報告廃止のため削除
    '在支歯':   [{label:'特掲様式18の2（PDF）',url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/r07tokkei18-2.pdf'},
                 {label:'特掲様式18の2（Word）',url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/r07tokkei18-2.docx'}],
    '歯外在ベⅠ':[
      {label:'計画書・実績報告書 ダウンロードページ（関東信越厚生局）',url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/baseup.html'},
      {label:'様式・記載例（厚生労働省）',url:'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000188411_00053.html'},
    ],
  };
  const COMMON_DL=[
    {label:'別添2-2（PDF）',url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/r07teirei_betten2-2_dental.pdf'},
    {label:'別添2-2（Word）',url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/r07teirei_betten2-2_dental.docx'},
  ];
  const dlItems=YOSHIKI_DL[e.abbr]||[];
  const yoshikiBlock=dlItems.length>0?(()=>{
    const links=dlItems.map(d=>`<a href="${d.url}" target="_blank" rel="noopener noreferrer"
      style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--blue-bg);border:1px solid #bfdbfe;border-radius:6px;text-decoration:none;color:var(--accent);font-size:12px;font-weight:500;margin-bottom:6px">
      <span>${d.url.endsWith('.pdf')?'📄':d.url.endsWith('.xlsx')?'📊':d.url.endsWith('.docx')?'📝':'🔗'}</span>${d.label}
      <span style="margin-left:auto;font-size:10px;color:var(--text3)">↗ 厚生局</span></a>`).join('');
    const common=COMMON_DL.map(d=>`<a href="${d.url}" target="_blank" rel="noopener noreferrer"
      style="display:flex;align-items:center;gap:8px;padding:7px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;text-decoration:none;color:var(--text2);font-size:11px;margin-bottom:4px">
      <span>📄</span>${d.label}<span style="margin-left:auto;font-size:10px">↗</span></a>`).join('');
    return `<div class="ds"><div class="dst">📥 定例報告 様式ダウンロード</div>${links}${common}</div>`;
  })():'';

  // ── 講習会受講状況（歯初診のみ） ──
  let koushuBlock='';
  if(e.abbr==='歯初診'){
    const kList=JSON.parse(localStorage.getItem('koushu_list')||'[]');
    const kRecs=kList.filter(r=>r.type==='歯初診_院内感染').sort((a,b)=>new Date(b.date)-new Date(a.date));
    const latest=kRecs[0];
    const now=new Date();
    const expD=latest?new Date(latest.expire):null;
    const days=expD?Math.floor((expD-now)/86400000):null;
    let sc='var(--red)',sl='受講記録なし',sb='var(--red-bg)',sbr='#fecaca';
    if(days!==null){
      if(days<0){sc='var(--red)';sl=`期限切れ（${Math.abs(days)}日超過）`;}
      else if(days<90){sc='var(--red)';sl=`⚠ 残り${days}日`;}
      else if(days<180){sc='var(--yellow)';sl=`⏰ 残り${days}日`;sb='var(--yellow-bg)';sbr='#fde68a';}
      else{sc='var(--green)';sl=`✓ 残り${days}日`;sb='var(--green-bg)';sbr='#a7f3d0';}
    }
    koushuBlock=`<div class="ds"><div class="dst">🎓 院内感染防止対策研修（4年に1回）</div>
      <div style="background:${sb};border:1px solid ${sbr};border-radius:8px;padding:12px 14px;margin-bottom:10px">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px">
          <div style="font-size:15px;font-weight:700;color:${sc}">${sl}</div>
          ${latest?`<div style="text-align:right;font-size:11px;color:var(--text2)">
            <div>最終受講：<strong>${latest.date.replace(/-/g,'/')}</strong></div>
            <div>期限：<strong style="color:${sc}">${latest.expire.replace(/-/g,'/')}</strong></div>
          </div>`:''}
        </div>
      </div>
      <button class="btn btn-secondary" style="width:100%;justify-content:center;font-size:12px"
        onclick="closeDP();setTimeout(function(){nav('koushu');openKoushuModalWith('歯初診_院内感染')},50)">
        ＋ 受講記録を登録する
      </button>
    </div>`;
  }

  // ── 定例報告の記録（TREC_KIJUNが定義済みの場合のみ） ──
  let teireiBlock='';
  // typeof チェックで安全に参照
  const trecDef=(typeof TREC_KIJUN!=='undefined')?TREC_KIJUN[e.abbr]:null;
  if(trecDef){
    const abbr=e.abbr;
    const tLabel=trecDef.tabLabel;
    // loadTeireiByAbbr が定義済みかチェック
    const tRecs=(typeof loadTeireiByAbbr==='function')?loadTeireiByAbbr(abbr).sort((a,b)=>b.year-a.year):[];
    const stIcon={submitted:'📮',pending:'⏳',unnecessary:'✅'};
    const stLbl={submitted:'提出済み',pending:'準備中',unnecessary:'提出不要'};
    const stCls={submitted:'bg',pending:'by',unnecessary:'bg'};
    const histRows=tRecs.length===0
      ?'<div style="font-size:11px;color:var(--text3);padding:6px 0">記録なし</div>'
      :tRecs.map(r=>`<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px">
          <strong style="min-width:80px">${r.nengo||r.year+'年度'}</strong>
          <span class="badge ${stCls[r.status]||'bgr'}" style="font-size:10px">${stIcon[r.status]||''} ${stLbl[r.status]||'—'}</span>
          ${r.sentDate?`<span class="mono" style="font-size:10px;color:var(--text3)">${r.sentDate.replace(/-/g,'/')}</span>`:''}
        </div>`).join('');
    const onSave="closeDP();setTimeout(function(){nav('teirei');setTimeout(function(){openTeireiRecModal('"+abbr+"')},80)},50)";
    const onHist="closeDP();setTimeout(function(){nav('teirei');setTimeout(function(){const a=document.getElementById('teirei-history-area');if(a.style.display==='block')a.style.display='none';showTeireiHistory()},80)},50)";
    teireiBlock=`<div style="background:var(--blue-bg);border:1px solid #bfdbfe;border-radius:10px;padding:14px 16px;margin-bottom:8px">
      <div style="font-size:11px;color:var(--text2);margin-bottom:8px;font-weight:600">📋 定例報告の記録 — ${tLabel}</div>
      <div style="margin-bottom:10px">${histRows}</div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-primary" style="flex:1;justify-content:center;font-size:12px" onclick="${onSave}">💾 今年の記録を保存</button>
        <button class="btn btn-ghost" style="font-size:12px;padding:6px 12px" onclick="${onHist}">📂 履歴</button>
      </div>
    </div>`;
  }

  document.getElementById('dp-body').innerHTML=`
    <div class="ds"><div class="dst">基本情報</div>
      <div class="dr2"><span class="dk">施設基準名</span><span class="dv" style="font-size:11px;text-align:right;max-width:200px">${e.name}</span></div>
      <div class="dr2"><span class="dk">略称</span><span class="dv">${e.abbr||'—'}</span></div>
      <div class="dr2"><span class="dk">受理番号</span><span class="dv">${e.number||'—'}</span></div>
      <div class="dr2"><span class="dk">算定開始</span><span class="dv">${e.date||'—'}</span></div>
      <div class="dr2"><span class="dk">カテゴリ</span><span class="dv">${CL[e.category]||'—'}</span></div>
    </div>
    ${koushuBlock}
    <div class="ai-box"><div class="ai-box-title">⚡ 令和8年度改定 影響判定</div>
      <div style="font-size:12px;margin-bottom:8px;font-weight:600">判定：${kl}</div>
      <ul class="checklist">${cl}</ul>
      <div class="verdict ${vCls}">${vTxt}</div>
    </div>
    ${yoshikiBlock}
    ${teireiBlock}
    <div class="ds">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div class="dst" style="margin:0">届出・変更履歴</div>
        <button class="btn btn-ghost" style="font-size:11px;padding:3px 9px" onclick="openKijunHistModal(${id})">＋ 追加</button>
      </div>
      <div id="kijun-hist-${id}">${renderKijunHist(id)}</div>
    </div>
    <div class="ds"><div class="dst">ステータス</div>
      <div class="dr2"><span class="dk">現在の状態</span>${SB[e.status]||''}</div>
      ${e.memo?`<div style="margin-top:8px;padding:10px;background:var(--bg3);border-radius:6px;font-size:11px;color:var(--text2);border:1px solid var(--border)">📝 ${e.memo}</div>`:''}
    </div>
    <div style="display:flex;gap:8px;margin-top:4px">
      <button class="btn btn-secondary" style="flex:1" onclick="openEditModal(${id})">✏ 編集</button>
      <button class="btn btn-danger" onclick="deleteEntry(${id})">🗑</button>
    </div>`;
  document.getElementById('dp').classList.add('open');
}

function closeDP(){document.getElementById('dp').classList.remove('open');}

/* ═══ ADD/EDIT ═══ */
function openAddModal(){
  document.getElementById('edit-id').value='';
  document.getElementById('add-modal-title').textContent='施設基準を追加';
  ['new-name','new-abbr','new-num','new-memo'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('new-date').value=new Date().toISOString().slice(0,10);
  document.getElementById('new-cat').value='basic';
  document.getElementById('new-status').value='green';
  document.getElementById('new-kaitei').value='none';
  document.getElementById('custom-row').style.display='none';
  document.getElementById('add-overlay').classList.add('open');
}
function openEditModal(id){
  const e=entries.find(x=>x.id===id);if(!e)return;closeDP();
  document.getElementById('edit-id').value=id;
  document.getElementById('add-modal-title').textContent='施設基準を編集';
  document.getElementById('new-name').value=e.name;
  document.getElementById('new-abbr').value=e.abbr;
  document.getElementById('new-num').value=e.number;
  document.getElementById('new-date').value=e.date;
  document.getElementById('new-cat').value=e.category;
  document.getElementById('new-status').value=e.status;
  document.getElementById('new-kaitei').value=e.kaitei;
  document.getElementById('new-memo').value=e.memo;
  document.getElementById('custom-row').style.display='none';
  document.getElementById('add-overlay').classList.add('open');
}
function onNameChange(sel){
  const c=sel.value==='__custom__';
  document.getElementById('custom-row').style.display=c?'block':'none';
  if(!c&&ABBR_MAP[sel.value])document.getElementById('new-abbr').value=ABBR_MAP[sel.value];
}
function saveEntry(){
  const eid=document.getElementById('edit-id').value;
  const nameEl=document.getElementById('new-name');
  const name=nameEl.value==='__custom__'?document.getElementById('custom-name').value:nameEl.value;
  if(!name){alert('施設基準名を選択または入力してください');return;}
  const _abbr=document.getElementById('new-abbr').value;
  const _needsRep=['歯初診','外感染２','在支歯','歯外在ベⅠ','歯外在ベⅡ'].includes(_abbr);
  const data={name,abbr:_abbr,number:document.getElementById('new-num').value,date:document.getElementById('new-date').value,category:document.getElementById('new-cat').value,status:document.getElementById('new-status').value,kaitei:document.getElementById('new-kaitei').value,nextCheck:_needsRep?'2025-08-29':'',memo:document.getElementById('new-memo').value};
  if(eid){const i=entries.findIndex(e=>e.id==eid);if(i>-1)entries[i]={...entries[i],...data};}
  else entries.push({id:Date.now(),...data});
  save();render();closeOverlay('add-overlay');
}
function deleteEntry(id){if(!confirm('このエントリを削除しますか？'))return;entries=entries.filter(e=>e.id!==id);save();closeDP();render();}

/* ═══ AI MODAL（改定影響分析 インライン表示） ═══ */
function openAiModal(){
  nav('kaitei');
  const el = document.getElementById('kaitei-body');
  if (!el) return;
  const na=entries.filter(e=>e.kaitei==='reapply'||e.status==='red');
  const nc=entries.filter(e=>(e.kaitei==='check'||e.kaitei==='grace')&&e.status!=='red');
  const ok=entries.filter(e=>e.kaitei==='none'&&e.status==='green');
  el.innerHTML=`
    <div style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:12px;margin-bottom:16px">
      <div style="font-size:11px;color:var(--text3);font-family:var(--mono);margin-bottom:4px">分析対象</div>
      <div><strong>${entries.length}件</strong>の届出済み施設基準を分析 — 令和8年度改定基準</div>
    </div>
    ${na.length?`<div style="margin-bottom:14px">
      <div style="color:var(--red);font-weight:700;margin-bottom:8px;font-size:13px">🔴 再届出が必要（${na.length}件）</div>
      ${na.map(e=>`<div style="background:var(--red-bg);border:1px solid #fecaca;border-radius:6px;padding:11px;margin-bottom:6px">
        <div style="font-weight:600;margin-bottom:3px">${e.name}</div>
        <div style="font-size:11px;color:var(--text2)">${e.memo||'令和8年度改定で変更あり。新要件を確認の上、再届出してください。'}</div>
      </div>`).join('')}
    </div>`:''}
    ${nc.length?`<div style="margin-bottom:14px">
      <div style="color:var(--yellow);font-weight:700;margin-bottom:8px;font-size:13px">🟡 要件を確認（${nc.length}件）</div>
      ${nc.map(e=>`<div style="background:var(--yellow-bg);border:1px solid #fde68a;border-radius:6px;padding:11px;margin-bottom:6px">
        <div style="font-weight:600;margin-bottom:3px">${e.name}</div>
        <div style="font-size:11px;color:var(--text2)">${e.memo||'施設基準の要件充足を自院で確認してください。'}</div>
      </div>`).join('')}
    </div>`:''}
    ${ok.length?`<div style="margin-bottom:14px">
      <div style="color:var(--green);font-weight:700;margin-bottom:8px;font-size:13px">🟢 対応不要（${ok.length}件）</div>
      <div style="background:var(--green-bg);border-radius:6px;padding:10px;border:1px solid #a7f3d0">
        ${ok.map(e=>`<span style="display:inline-block;margin:2px 4px;font-size:11px;font-family:var(--mono);color:var(--green)">✓ ${e.abbr}</span>`).join('')}
      </div>
    </div>`:''}
    <div style="background:var(--blue-bg);border:1px solid #bfdbfe;border-radius:6px;padding:12px;margin-top:6px">
      <div style="color:var(--accent);font-weight:700;margin-bottom:6px;font-size:12px">📋 推奨アクション</div>
      <div style="font-size:12px;line-height:1.9;color:var(--text2)">
        1. <strong style="color:var(--text)">再届出必要</strong>：改定通知の該当箇所を確認し、新要件の書類を準備<br>
        2. <strong style="color:var(--text)">毎年8月の定例報告</strong>：8月1日現在の自己点検 → 8月29日までに厚生局へ郵送<br>
        3. <strong style="color:var(--text)">経過措置期限</strong>：令和7年5月31日（旧外来環等）が既に過ぎていないか確認
      </div>
    </div>`;
}

/* ═══ VIEWS ═══ */
function nav(v,el){
  if(v==='admin' && !isAdminSessionActive()){
    requestAdminModeAccess();
    return;
  }
  currentView=v;
  if(v!=='admin'){
    lastMemberView=v;
    sessionStorage.setItem(ADMIN_LAST_VIEW_KEY,v);
  }
  document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('view-'+v).classList.add('active');
  if(v!=='admin'){
    const navEl=el||findNavItem(v);
    if(navEl)navEl.classList.add('active');
  }
  closeSettingsMenu();
  closeDP();
  if(v==='kaitei')renderKaitei();
  if(v==='teirei')renderTeirei();
  if(v==='deadline')renderDeadline();
  if(v==='koushu')renderKoushu();
  if(v==='shinki')renderShinki();
  if(v==='baseup')renderBaseup();
  if(v==='admin')renderAdminSecurityStatus();
}
function renderKaitei(){
  const items=entries.filter(e=>e.kaitei!=='none');
  document.getElementById('kaitei-body').innerHTML=items.length===0
    ?'<div class="empty"><div class="ei">✅</div><p>令和8年度改定による対応が必要な施設基準はありません。<br><small style="color:var(--text3)">※ 初めてご利用の場合は「⚡ 改定影響を一括再判定」ボタンで自動判定してください。</small></p></div>'
    :items.map(e=>`<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:10px;cursor:pointer;box-shadow:var(--shadow)" onclick="nav('daichou');openDP(${e.id})">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">${KB[e.kaitei]||''}<strong style="font-size:13px">${e.name}</strong></div>
      <div style="font-size:12px;color:var(--text2)">${e.memo||'改定通知を確認し、対応要否を判断してください。'}</div>
    </div>`).join('');
}

// ── 令和8年6月改定 自動影響判定マスタ（一括再判定用）──────────────
const KAITEI_AUTO_MAP = {
  '歯外在ベⅠ':  { kaitei:'reapply', status:'red',    memo:'令和8年改定で施設基準届出が必要（5月7日受付開始・5月31日送付期限（6月1日必着））。賃金改善計画書は算定開始前月末までに専用メールアドレスへ添付送付（6月算定開始なら5月末が期限）。8月報告は継続施設＝前年分実績報告、新規施設＝中間報告。' },
  '歯外在ベⅡ':  { kaitei:'reapply', status:'red',    memo:'令和8年改定で施設基準届出が必要（5月7日受付開始・5月31日送付期限（6月1日必着））。賃金改善計画書は算定開始前月末までに専用メールアドレスへ添付送付（6月算定開始なら5月末が期限）。8月報告は継続施設＝前年分実績報告、新規施設＝中間報告。' },
  '口管強':      { kaitei:'check',   status:'yellow', memo:'口腔機能実地指導料（令和8年6月新設）との関係要確認。要件への影響は厚生局告示で確認のこと。' },
  '歯ＣＡＤ':   { kaitei:'check',   status:'yellow', memo:'令和8年6月改定で全大臼歯に拡大・材料区分変更。様式変更の有無を厚生局に確認のこと。' },
  '医療ＤＸ':   { kaitei:'expire',  status:'red',    memo:'令和8年6月改定で廃止・再編。後継は「電子的歯科診療情報連携体制整備加算」（新設）。既届出施設は厚生局の案内に従い対応要確認。' },
  '咀嚼能力':   { kaitei:'check',   status:'yellow', memo:'令和8年6月改定で施設基準が廃止→算定要件化の可能性あり。届出不要になる場合は辞退届不要。厚生局告示を要確認。' },
  '咬合圧':     { kaitei:'check',   status:'yellow', memo:'令和8年6月改定で施設基準が廃止→算定要件化の可能性あり。届出不要になる場合は辞退届不要。厚生局告示を要確認。' },
  '外安全１':   { kaitei:'check',   status:'yellow', memo:'令和8年改定で様式変更あり。要件充足を再確認のこと。' },
  '外感染１':   { kaitei:'check',   status:'yellow', memo:'令和8年改定で要件変更あり。院内感染管理者配置等を再確認のこと。' },
  '歯初診':     { kaitei:'grace',   status:'yellow', memo:'令和8年改定で様式27の定例報告が廃止。施設基準自体は継続。' },
  '口細菌':     { kaitei:'check',   status:'yellow', memo:'令和8年6月改定で施設基準の届出が不要になりました。廃止届は不要。装置があれば引き続き算定可能です。' },
  // kaiteiマップにないものは 'none' / 'green' のまま
};

function applyKaiteiAuto(){
  let changed = 0;
  entries.forEach(e => {
    const kd = KAITEI_AUTO_MAP[e.abbr];
    if(kd){
      e.kaitei  = kd.kaitei;
      e.status  = kd.status;
      // memoが空、またはまだ自動判定メモでない場合のみ上書き（手動メモは保持）
      if(!e.memo || Object.values(KAITEI_AUTO_MAP).some(m=>m.memo===e.memo)){
        e.memo = kd.memo;
      }
      changed++;
    } else {
      // マップにない = 改定影響なし
      if(e.kaitei === 'none') e.status = 'green';
    }
  });
  save();
  render();
  renderKaitei();
  const msg = changed > 0
    ? `✅ ${changed}件の施設基準に令和8年改定影響を自動判定しました。\n内容を確認し、必要に応じて修正してください。`
    : '台帳に改定影響の対象施設基準が見つかりませんでした。';
  alert(msg);
}
function renderTeirei(){
  // ══════════════════════════════════════════════════
  // 定例報告が必要な施設基準マスタ
  // 出典: 関東信越厚生局「歯科診療所に係る定例報告等について」
  // https://kouseikyoku.mhlw.go.jp/kantoshinetsu/iryo_shido/teirei-shika.html
  // ══════════════════════════════════════════════════
  // 【令和8年改定】歯初診（様式27）および外感染2は定例報告が廃止（8月報告不要に）
  // 在支歯（様式18の2）・ベースアップ（様式98）は継続
  const TEIREI_MASTER = {
    // 番号9: 特掲様式18の2
    '在支歯': {
      num: '番号9',
      yoshiki: '（特掲）様式18の2',
      name: '在宅療養支援歯科診療所（1又は2）の施設基準に係る報告書',
      note: '年1回・8月定例報告（管轄の地方厚生局へ郵送）',
      required: true,
    },
    // 番号10: 特掲様式98（継続算定施設）
    '歯外在ベⅠ': {
      num: '番号10',
      yoshiki: '（特掲）様式98',
      name: '歯科外来・在宅ベースアップ評価料(1)(2) 賃金改善実績報告書（継続算定施設：前年度分）',
      note: '⚠ 郵送ではなくメールによる提出。継続施設は前年分実績報告。令和8年度から新規算定の施設は中間報告書を提出。',
      required: true,
    },
    '歯外在ベⅡ': {
      num: '番号10',
      yoshiki: '（特掲）様式98',
      name: '歯科外来・在宅ベースアップ評価料(1)(2) 賃金改善実績報告書（継続算定施設：前年度分）',
      note: '⚠ 郵送ではなくメールによる提出。継続施設は前年分実績報告。令和8年度から新規算定の施設は中間報告書を提出。',
      required: true,
    },
  };

  // 番号2: 別紙様式4-2（特別の療養環境＝差額ベッド）
  // 番号3: 別紙様式5（選定療養・歯科衛生実地指導料の実績がある場合）
  // 番号4: 別紙様式12（明細書を無料発行していない正当な理由がある場合）
  // 番号5: 予約診療・時間外診察の実施報告書（特別料金を徴収している場合）
  // 番号6: 別紙様式16（摂食嚥下機能回復体制加算の届出がある場合）
  // 番号7: 別紙様式26（情報通信機器を用いた診療の届出がある場合）
  // → これらは施設基準台帳とは別の条件で発生するため、下記の「その他」欄に記載

  // 自院の届出と定例報告を照合
  const reportItems = entries
    .map(e => ({ entry: e, teirei: TEIREI_MASTER[e.abbr] || null }))
    .filter(x => x.teirei !== null);

  const noReportItems = entries.filter(e => !TEIREI_MASTER[e.abbr]);

  const y = new Date().getFullYear();

  document.getElementById('teirei-body').innerHTML = `
    <div class="teirei-banner">
      📅 提出期限：<strong>${y}年8月29日（金）</strong>　→　関東信越厚生局東京事務所（郵送）
      <span style="margin-left:16px;font-size:11px;color:var(--text2)">8月1日現在の施設基準要件を自己点検してください</span>
    </div>
    <div style="background:var(--yellow-bg);border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:12px;color:var(--text2);line-height:1.9">
      <strong style="color:var(--yellow)">⚠ 令和8年度 ベースアップ評価料の8月報告（施設により異なります）</strong><br>
      ・<strong style="color:var(--text)">継続算定施設</strong>（令和7年度以前から算定）→ 前年分（令和7年度）<strong>実績報告書</strong>を提出<br>
      ・<strong style="color:var(--text)">令和8年度から新規算定の施設</strong> → 令和8年度分<strong>中間報告書</strong>を提出（実績報告は翌年8月）<br>
      <span style="font-size:11px;color:var(--text3)">※ 最終的な様式・提出先は管轄厚生局（関東信越厚生局）の令和8年版案内で必ず確認してください。</span>
    </div>

    ${reportItems.length > 0 ? `
    <div style="margin-bottom:8px;font-size:13px;font-weight:700;color:var(--text)">
      📋 報告書の提出が必要な施設基準（${reportItems.length}件）
    </div>
    <div class="tw" style="margin-bottom:20px">
      <table>
        <thead><tr>
          <th>届出施設基準</th>
          <th>番号</th>
          <th>提出様式</th>
          <th>備考</th>
          <th>自己点検</th>
          <th>提出状況</th>
        </tr></thead>
        <tbody>
          ${reportItems.map((x, i) => `<tr>
            <td>
              <div class="kn">${x.entry.name}</div>
              <div style="font-size:10px;color:var(--text2);margin-top:2px;font-family:var(--mono)">${x.entry.number||''}</div>
            </td>
            <td><span class="badge bb">${x.teirei.num}</span></td>
            <td style="font-size:11px;color:var(--text2)">${x.teirei.yoshiki}</td>
            <td style="font-size:11px;color:${x.teirei.note.includes('⚠')?'var(--yellow)':'var(--text2)'}">${x.teirei.note||'—'}</td>
            <td><input type="checkbox" id="chk-r-${i}" style="accent-color:var(--accent);width:16px;height:16px;cursor:pointer"></td>
            <td><span class="badge bgr" id="sub-r-${i}">未提出</span></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : `
    <div style="background:var(--green-bg);border:1px solid #a7f3d0;border-radius:8px;padding:14px 18px;margin-bottom:20px;font-size:13px;color:var(--green);font-weight:600">
      ✅ 報告書の提出が必要な施設基準は届出台帳の中にありません
    </div>`}

    <div style="margin-bottom:8px;font-size:13px;font-weight:700;color:var(--text)">
      ✅ 自己点検のみ（提出書類なし）（${noReportItems.length}件）
    </div>
    <div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:12px;color:var(--text2);line-height:1.9">
      以下の施設基準は、要件を満たしていれば報告書の提出は不要です。<br>
      ただし要件を満たしていない場合は <strong style="color:var(--red)">辞退届（別添2-2）</strong> の提出が必要です。
      <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px">
        ${noReportItems.map(e=>`<span class="badge bb">${e.abbr}</span>`).join('')}
      </div>
    </div>

    <div style="background:var(--blue-bg);border:1px solid #bfdbfe;border-radius:8px;padding:14px 16px;margin-bottom:20px">
      <div style="font-size:12px;font-weight:700;color:var(--accent);margin-bottom:8px">📌 その他・条件付きで提出が必要な様式</div>
      <div style="font-size:12px;color:var(--text2);line-height:1.9">
        <strong style="color:var(--text)">番号2 別紙様式4-2</strong>：特別の療養環境（差額室料）を提供している場合<br>
        <strong style="color:var(--text)">番号3 別紙様式5</strong>：選定療養の実施実績がある、または歯科衛生実地指導料・訪問歯科衛生指導料の算定実績がある場合<br>
        <strong style="color:var(--text)">番号4 別紙様式12</strong>：明細書を全患者に無料発行していない（正当な理由がある）診療所<br>
        <strong style="color:var(--text)">番号5</strong>：予約診察・時間外診察で特別料金を徴収している場合<br>
        <strong style="color:var(--text)">番号6 別紙様式16</strong>：摂食嚥下機能回復体制加算の届出がある場合<br>
        <strong style="color:var(--text)">番号7 別紙様式26</strong>：情報通信機器を用いた診療（オンライン診療）の届出がある場合
      </div>
    </div>

    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-primary" onclick="checkAllTeirei()">全項目 確認済みにする</button>
      <button class="btn btn-ghost" onclick="printTeirei()">🖨 印刷用チェックシート</button>
      <button class="btn btn-secondary" onclick="openTeireiRecModal()">💾 この年度の記録を保存</button>
      <button class="btn btn-ghost" onclick="showTeireiHistory()">📂 過去の記録を見る</button>
    </div>
    <div id="teirei-history-area" style="display:none;margin-top:16px"></div>
  `;

  // チェックボックスイベント
  reportItems.forEach((_, i) => {
    const chk = document.getElementById(`chk-r-${i}`);
    if (chk) chk.addEventListener('change', function() {
      const b = document.getElementById(`sub-r-${i}`);
      b.className = this.checked ? 'badge bg' : 'badge bgr';
      b.textContent = this.checked ? '提出済' : '未提出';
    });
  });
}

function checkAllTeirei(){
  document.querySelectorAll('[id^="chk-r-"]').forEach(chk => {
    chk.checked = true;
    chk.dispatchEvent(new Event('change'));
  });
}

function printTeirei(){
  // 【令和8年改定】歯初診（様式27）・外感染2の定例報告は廃止
  const TEIREI_MASTER_PRINT = {
    '在支歯':'番号9 特掲様式18の2',
    '歯外在ベⅠ':'番号10 特掲様式98（メール）','歯外在ベⅡ':'番号10 特掲様式98（メール）',
  };
  const w = window.open('','_blank');
  const reportRows = entries
    .filter(e => TEIREI_MASTER_PRINT[e.abbr])
    .map(e => `<tr style="background:#fff9e6"><td><strong>${e.name}</strong></td><td>${e.abbr||''}</td><td>${e.number||''}</td><td>${e.date||''}</td><td style="color:#d97706;font-weight:bold">${TEIREI_MASTER_PRINT[e.abbr]}</td><td style="text-align:center">□</td></tr>`).join('');
  const checkRows = entries
    .filter(e => !TEIREI_MASTER_PRINT[e.abbr])
    .map(e => `<tr><td>${e.name}</td><td>${e.abbr||''}</td><td>${e.number||''}</td><td>${e.date||''}</td><td style="color:#059669">自己点検のみ</td><td style="text-align:center">□</td></tr>`).join('');
  w.document.write(`<html><head><meta charset="UTF-8"><title>施設基準定例報告 チェックシート</title>
  <style>
    body{font-family:'Noto Sans JP',sans-serif;font-size:11px;padding:20px}
    h2{font-size:15px;margin-bottom:4px}
    .sub{font-size:10px;color:#666;margin-bottom:6px}
    .legend{font-size:10px;background:#fff9e6;border:1px solid #fde68a;padding:6px 10px;border-radius:4px;margin-bottom:12px}
    table{width:100%;border-collapse:collapse;margin-bottom:16px}
    th,td{border:1px solid #ccc;padding:5px 8px;text-align:left}
    th{background:#f5f5f5;font-size:10px;font-weight:600}
    h3{font-size:12px;margin:12px 0 6px;border-left:3px solid #2563eb;padding-left:8px}
  </style>
</head>
  <body>
  <h2>施設基準届出 定例報告 チェックシート</h2>
  <div class="sub">${clinicName}　　${new Date().getFullYear()}年8月1日現在　→　提出期限：${new Date().getFullYear()}年8月29日（金）　関東信越厚生局東京事務所</div>
  <div class="legend">🟡 黄色行：報告書の提出が必要　／　白色行：自己点検のみ（要件充足で提出不要）</div>
  <table>
    <thead><tr><th>施設基準名</th><th>略称</th><th>受理番号</th><th>算定開始</th><th>定例報告</th><th>確認</th></tr></thead>
    <tbody>${reportRows}${checkRows}</tbody>
  </table>
  <div style="font-size:10px;color:#666;border-top:1px solid #ccc;padding-top:8px">
  ※ 要件を満たしていない施設基準がある場合は辞退届（別添2-2）の提出が必要です。<br>
  ※ 番号10（ベースアップ評価料）は郵送ではなくメールによる提出です。
  </div>
  </body></html>`);
  w.print();
}

/* ═══════════════════════════════════════════════════════
   講習会・研修管理
═══════════════════════════════════════════════════════ */

// 研修種別マスタ（有効期間・関連施設基準）
// ══════════════════════════════════════════════════════════════
// KOUSHU_MASTER — 受講種別マスタ
// 新しい施設基準の研修を追加する場合は以下のフォーマットで追記:
//
//   'キー名': {
//     label: '研修の正式名称',         // 画面表示・記録名
//     abbr:  '施設基準略称',           // 台帳の abbr と一致させる
//     years: 数値 または null,          // 受講義務の周期（年）。規定なしはnull
//     color: 'var(--accent)',           // 期限バーの色（期限管理ありは --accent）
//     note:  '備考・根拠規定',
//   },
//
// 例：口管強の追加研修が義務化された場合:
//   '口管強_新研修': {
//     label: '○○研修（口管強）',
//     abbr: '口管強', years: 3,
//     color: 'var(--purple)', note: '令和○年度改定で義務化。',
//   },
// ══════════════════════════════════════════════════════════════
const KOUSHU_MASTER = {
  '歯初診_院内感染': {
    label: '院内感染防止対策研修（歯初診）',
    abbr: '歯初診',
    years: 4,  // 4年に1回義務
    color: 'var(--accent)',
    note: '歯科点数表初診料注1の施設基準要件。4年に1回以上の受講が必須。',
    certRequired: true,  // 証明書保管を推奨（指導監査で確認される場合あり）
  },
  '外安全_医療安全': {
    label: '医療安全対策研修（外安全1）',
    abbr: '外安全１',
    years: null,
    color: 'var(--text2)',
    note: '受講頻度の規定なし。受講履歴の保管用。',
    certRequired: false,
  },
  '外感染_院内感染': {
    label: '院内感染防止対策研修（外感染1）',
    abbr: '外感染１',
    years: null,
    color: 'var(--text2)',
    note: '受講頻度の規定なし。受講履歴の保管用。',
    certRequired: false,
  },
  // ── 将来の施設基準追加はここに追記 ──
  // （select要素のoptionも koushu-type に追加してください）
  'custom': { label: 'カスタム研修', abbr: '', years: null, color: 'var(--text2)', certRequired: false, note: '' },
};

function loadKoushuList() {
  return JSON.parse(localStorage.getItem('koushu_list') || '[]');
}
function saveKoushuList(list) {
  localStorage.setItem('koushu_list', JSON.stringify(list));
}

function renderKoushu() {
  const list = loadKoushuList();
  const now = new Date();

  // 施設基準と紐づけ：台帳に登録済みの施設基準に関連する研修を表示
  const linkedAbbrs = new Set(entries.map(e => e.abbr));

  // 警告バッジ更新
  const hasAlert = list.some(r => {
    if (!r.expire) return false;
    const d = new Date(r.expire);
    const diff = Math.floor((d - now) / 86400000);
    return diff < 180; // 6ヶ月以内は警告
  });
  const badge = document.getElementById('koushu-badge');
  if (badge) badge.style.display = hasAlert ? 'inline-block' : 'none';

  // 台帳に歯初診があるのに受講記録がない場合は警告
  const has歯初診 = linkedAbbrs.has('歯初診');
  const has歯初診記録 = list.some(r => r.type === '歯初診_院内感染');

  let html = '';

  // ── 歯初診：専用の詳細ウィジェット ──
  if (has歯初診) {
    const records歯初診 = list
      .filter(r => r.type === '歯初診_院内感染')
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    const latest = records歯初診[0];
    const expireDate = latest ? new Date(latest.expire) : null;
    const daysLeft = expireDate ? Math.floor((expireDate - now) / 86400000) : null;

    let statusColor = 'var(--text3)', statusLabel = '未登録', statusBg = 'var(--bg3)';
    if (daysLeft === null) {
      statusColor = 'var(--red)'; statusLabel = '⚠ 受講記録なし'; statusBg = 'var(--red-bg)';
    } else if (daysLeft < 0) {
      statusColor = 'var(--red)'; statusLabel = '❌ 期限切れ'; statusBg = 'var(--red-bg)';
    } else if (daysLeft < 180) {
      statusColor = 'var(--yellow)'; statusLabel = `⏰ 残り${daysLeft}日`; statusBg = 'var(--yellow-bg)';
    } else {
      statusColor = 'var(--green)'; statusLabel = `✓ 残り${daysLeft}日`; statusBg = 'var(--green-bg)';
    }

    html += `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:20px;margin-bottom:20px;box-shadow:var(--shadow)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
        <div>
          <div style="font-size:14px;font-weight:700">🦷 院内感染防止対策研修（歯初診 注1）</div>
          <div style="font-size:11px;color:var(--text2);margin-top:3px">4年に1回以上の受講が義務（施設基準要件）</div>
        </div>
        <div style="background:${statusBg};border-radius:8px;padding:10px 18px;text-align:center">
          <div style="font-size:18px;font-weight:700;color:${statusColor}">${statusLabel}</div>
          ${expireDate ? `<div style="font-size:11px;color:var(--text2);margin-top:2px">期限：${latest.expire.replace(/-/g,'/')}</div>` : ''}
        </div>
      </div>

      ${latest ? `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">
        <div style="background:var(--bg3);border-radius:6px;padding:10px;border:1px solid var(--border)">
          <div style="font-size:10px;color:var(--text3);font-family:var(--mono);margin-bottom:4px">最新受講日</div>
          <div style="font-size:13px;font-weight:600">${latest.date.replace(/-/g,'/')}</div>
        </div>
        <div style="background:var(--bg3);border-radius:6px;padding:10px;border:1px solid var(--border)">
          <div style="font-size:10px;color:var(--text3);font-family:var(--mono);margin-bottom:4px">有効期限</div>
          <div style="font-size:13px;font-weight:600;color:${statusColor}">${latest.expire.replace(/-/g,'/')}</div>
        </div>
        <div style="background:var(--bg3);border-radius:6px;padding:10px;border:1px solid var(--border)">
          <div style="font-size:10px;color:var(--text3);font-family:var(--mono);margin-bottom:4px">受講者</div>
          <div style="font-size:13px;font-weight:600">${latest.person||'—'}</div>
        </div>
        <div style="background:var(--bg3);border-radius:6px;padding:10px;border:1px solid var(--border)">
          <div style="font-size:10px;color:var(--text3);font-family:var(--mono);margin-bottom:4px">研修機関</div>
          <div style="font-size:12px;font-weight:500">${latest.org||'—'}</div>
        </div>
      </div>` : `
      <div style="background:var(--red-bg);border:1px solid #fecaca;border-radius:6px;padding:12px;margin-bottom:14px;font-size:12px;color:var(--red)">
        受講記録が登録されていません。「＋ 受講記録を追加」から登録してください。
      </div>`}

      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" onclick="openKoushuModalWith('歯初診_院内感染')">＋ 受講記録を追加</button>
        ${records歯初診.length > 1 ? `<button class="btn btn-ghost" onclick="toggleKoushuHistory('歯初診_院内感染')">📋 受講履歴（${records歯初診.length}件）</button>` : ''}
      </div>

      <div id="hist-歯初診_院内感染" style="display:none;margin-top:12px">
        <div class="tw">
          <table>
            <thead><tr><th>受講日</th><th>有効期限</th><th>受講者</th><th>研修機関</th><th>メモ</th><th>証明書</th><th></th></tr></thead>
            <tbody>
              ${records歯初診.map(r => `<tr>
                <td class="mono">${r.date.replace(/-/g,'/')}</td>
                <td class="mono">${r.expire.replace(/-/g,'/')}</td>
                <td>${r.person||'—'}</td>
                <td style="font-size:11px">${r.org||'—'}</td>
                <td style="font-size:11px;color:var(--text2)">${r.memo||'—'}</td>
                <td>${r.cert
          ? `<button class="btn btn-secondary" style="padding:3px 9px;font-size:10px;background:var(--green-bg);color:var(--green);border-color:#a7f3d0" onclick="viewCert('${r.id}')">📎 証明書あり</button>`
          : (master && master.certRequired
              ? `<button class="btn btn-ghost" style="padding:3px 9px;font-size:10px;color:var(--yellow);border-color:#fde68a" onclick="editKoushu('${r.id}')">⚠ 未登録</button>`
              : `<span style="font-size:10px;color:var(--text3)">—</span>`)
        }</td>
                <td><button class="btn btn-danger" style="padding:3px 8px;font-size:10px" onclick="deleteKoushu('${r.id}')">削除</button></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
  }

  // ── その他の研修記録（外安全・外感染など：期限管理不要、記録のみ） ──
  const otherRecords = list.filter(r => r.type !== '歯初診_院内感染');
  if (otherRecords.length > 0 || linkedAbbrs.has('外安全１') || linkedAbbrs.has('外感染１')) {
    html += `<div style="font-size:13px;font-weight:700;margin-bottom:6px">その他の研修・受講記録</div>
    <div style="font-size:11px;color:var(--text2);margin-bottom:10px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:8px 12px">
      💡 外安全1・外感染1の研修は受講頻度の規定がないため、期限管理は不要です。受講記録の保管用としてご利用ください。
    </div>
    <div class="tw" style="margin-bottom:16px">
      <table>
        <thead><tr><th>研修種別</th><th>受講者</th><th>受講日</th><th>研修機関</th><th>メモ</th><th>証明書</th><th></th></tr></thead>
        <tbody>
          ${otherRecords.length === 0
            ? `<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:20px">記録なし</td></tr>`
            : otherRecords.sort((a,b)=>new Date(b.date)-new Date(a.date)).map(r => {
                const m = KOUSHU_MASTER[r.type] || KOUSHU_MASTER.custom;
                return `<tr>
                  <td><div class="kn" style="font-size:12px">${r.customName || m.label}</div></td>
                  <td>${r.person||'—'}</td>
                  <td class="mono">${r.date.replace(/-/g,'/')}</td>
                  <td style="font-size:11px">${r.org||'—'}</td>
                  <td style="font-size:11px;color:var(--text2)">${r.memo||'—'}</td>
                  <td>${r.cert
          ? `<button class="btn btn-secondary" style="padding:3px 9px;font-size:10px;background:var(--green-bg);color:var(--green);border-color:#a7f3d0" onclick="viewCert('${r.id}')">📎 証明書あり</button>`
          : (master && master.certRequired
              ? `<button class="btn btn-ghost" style="padding:3px 9px;font-size:10px;color:var(--yellow);border-color:#fde68a" onclick="editKoushu('${r.id}')">⚠ 未登録</button>`
              : `<span style="font-size:10px;color:var(--text3)">—</span>`)
        }</td>
                  <td><button class="btn btn-danger" style="padding:3px 8px;font-size:10px" onclick="deleteKoushu('${r.id}')">削除</button></td>
                </tr>`;
              }).join('')
          }
        </tbody>
      </table>
    </div>
    <button class="btn btn-secondary" onclick="openKoushuModal()">＋ その他の受講記録を追加</button>`;
  }

  if (!has歯初診 && otherRecords.length === 0) {
    html = `<div class="empty"><div class="ei">🎓</div><p>台帳に施設基準を登録すると、関連する研修の管理ができます。<br>「＋ 受講記録を追加」から手動で追加することもできます。</p>
    <div style="margin-top:16px"><button class="btn btn-primary" onclick="openKoushuModal()">＋ 受講記録を追加</button></div></div>`;
  }

  document.getElementById('koushu-body').innerHTML = html;
}

function toggleKoushuHistory(type) {
  const el = document.getElementById(`hist-${type}`);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function openKoushuModal() {
  window._koushuCertPending = undefined;
  document.getElementById('koushu-cert-dropzone').style.display = '';
  document.getElementById('koushu-cert-preview').style.display = 'none';
  document.getElementById('koushu-cert-preview').innerHTML = '';
  document.getElementById('koushu-edit-id').value = '';
  document.getElementById('koushu-modal-title').textContent = '受講記録を追加';
  document.getElementById('koushu-type').value = '歯初診_院内感染';
  document.getElementById('koushu-custom-row').style.display = 'none';
  document.getElementById('koushu-person').value = '';
  document.getElementById('koushu-date').value = '';
  document.getElementById('koushu-expire').value = '';
  document.getElementById('koushu-org').value = '';
  document.getElementById('koushu-memo').value = '';
  document.getElementById('koushu-overlay').classList.add('open');
}

function openKoushuModalWith(type) {
  openKoushuModal();
  document.getElementById('koushu-type').value = type;
  onKoushuTypeChange(document.getElementById('koushu-type'));
}

function onKoushuTypeChange(sel) {
  const isCustom = sel.value === 'custom';
  document.getElementById('koushu-custom-row').style.display = isCustom ? 'block' : 'none';
  // 受講日が入力済みなら有効期限を再計算
  const dateVal = document.getElementById('koushu-date').value;
  if (dateVal) calcExpire(dateVal, sel.value);
}

// 受講日変更 → 有効期限自動計算（イベント委任）
document.addEventListener('change', function(e) {
  if (e.target && e.target.id === 'koushu-date') {
    const type = document.getElementById('koushu-type').value;
    calcExpire(e.target.value, type);
  }
});

function calcExpire(dateStr, type) {
  const master = KOUSHU_MASTER[type];
  if (!master || !master.years || !dateStr) return;
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() + master.years);
  // 1日引いて「4年後の前日」を期限に
  d.setDate(d.getDate() - 1);
  document.getElementById('koushu-expire').value = d.toISOString().slice(0,10);
}

function saveKoushu() {
  const type = document.getElementById('koushu-type').value;
  const date = document.getElementById('koushu-date').value;
  if (!date) { alert('受講日を入力してください'); return; }
  const list = loadKoushuList();
  const editId = document.getElementById('koushu-edit-id').value;
  const certData = window._koushuCertPending || null;
  const editList = loadKoushuList();
  const existingRec = editId ? editList.find(r=>r.id===editId) : null;
  const rec = {
    id: editId || String(Date.now()),
    type,
    customName: type === 'custom' ? document.getElementById('koushu-custom-name').value : '',
    person: document.getElementById('koushu-person').value,
    date,
    expire: document.getElementById('koushu-expire').value,
    org: document.getElementById('koushu-org').value,
    memo: document.getElementById('koushu-memo').value,
    cert: certData !== null ? certData : (existingRec ? existingRec.cert : null),
  };
  if (editId) {
    const i = list.findIndex(r => r.id === editId);
    if (i > -1) list[i] = rec; else list.push(rec);
  } else {
    list.push(rec);
  }
  saveKoushuList(list);
  window._koushuCertPending = undefined;
  closeOverlay('koushu-overlay');
  renderKoushu();
}


/* ═══════════════════════════════════════════════════════
   受講証明書（サーティフィケート）管理
═══════════════════════════════════════════════════════ */

function onCertDrop(event) {
  event.preventDefault();
  document.getElementById('koushu-cert-dropzone').style.background = 'var(--bg3)';
  const file = event.dataTransfer.files[0];
  if (file) loadCertFile(file);
}

function onCertSelect(event) {
  const file = event.target.files[0];
  if (file) loadCertFile(file);
}

function loadCertFile(file) {
  const MAX = 5 * 1024 * 1024;
  if (file.size > MAX) {
    alert('ファイルサイズが5MBを超えています。\n証明書をスキャンする際は解像度を下げてください。');
    return;
  }
  const allowed = ['application/pdf','image/jpeg','image/png','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (!allowed.includes(file.type)) {
    alert('PDF・JPG・PNG・Word（.docx）のみ対応しています。');
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    window._koushuCertPending = {
      name: file.name,
      type: file.type,
      size: file.size,
      data: e.target.result, // base64 data URL
    };
    renderCertPreviewInModal(window._koushuCertPending);
  };
  reader.readAsDataURL(file);
}

function renderCertPreviewInModal(cert) {
  const dz = document.getElementById('koushu-cert-dropzone');
  const pv = document.getElementById('koushu-cert-preview');
  dz.style.display = 'none';
  pv.style.display = 'block';
  const sizeKB = (cert.size / 1024).toFixed(0);
  const isWord = cert.type && cert.type.includes('wordprocessingml');
  const icon = cert.type === 'application/pdf' ? '📄' : isWord ? '📝' : '🖼';
  pv.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--blue-bg);border:1px solid #bfdbfe;border-radius:8px">
      <span style="font-size:22px">${icon}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600;color:var(--accent);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${cert.name}</div>
        <div style="font-size:10px;color:var(--text3)">${sizeKB}KB · ${cert.type === 'application/pdf' ? 'PDF' : '画像'}</div>
      </div>
      <button class="btn btn-ghost" style="font-size:11px;padding:4px 8px" onclick="removeCertFromModal()">✕ 削除</button>
    </div>`;
}

function removeCertFromModal() {
  window._koushuCertPending = null;
  document.getElementById('koushu-cert-dropzone').style.display = '';
  document.getElementById('koushu-cert-preview').style.display = 'none';
  document.getElementById('koushu-cert-preview').innerHTML = '';
  document.getElementById('koushu-cert-input').value = '';
}

function openKoushuModalWith(type) {
  window._koushuCertPending = undefined;
  document.getElementById('koushu-cert-dropzone').style.display = '';
  document.getElementById('koushu-cert-preview').style.display = 'none';
  document.getElementById('koushu-cert-preview').innerHTML = '';
  window._koushuCertPending = undefined;
  document.getElementById('koushu-cert-dropzone').style.display = '';
  document.getElementById('koushu-cert-preview').style.display = 'none';
  document.getElementById('koushu-cert-preview').innerHTML = '';
  document.getElementById('koushu-edit-id').value = '';
  document.getElementById('koushu-modal-title').textContent = '受講記録を追加';
  document.getElementById('koushu-type').value = type;
  onKoushuTypeChange(document.getElementById('koushu-type'));
  document.getElementById('koushu-person').value = '';
  document.getElementById('koushu-date').value = '';
  document.getElementById('koushu-expire').value = '';
  document.getElementById('koushu-org').value = '';
  document.getElementById('koushu-memo').value = '';
  document.getElementById('koushu-overlay').classList.add('open');
}

function viewCert(id) {
  const list = loadKoushuList();
  const rec = list.find(r => r.id === id);
  if (!rec || !rec.cert) return;
  const cert = rec.cert;
  const title = document.getElementById('cert-modal-title');
  const body  = document.getElementById('cert-modal-body');
  const dlBtn = document.getElementById('cert-download-btn');
  const delBtn= document.getElementById('cert-delete-btn');

  const isWord = cert.type && cert.type.includes('wordprocessingml');
  const isPDF  = cert.type === 'application/pdf';
  const isImg  = cert.type && cert.type.startsWith('image/');
  const icon = isPDF ? '📄' : isWord ? '📝' : '🖼';
  const typeLabel = isPDF ? 'PDF' : isWord ? 'Word' : '画像';
  const sizeKB = (cert.size / 1024).toFixed(0);
  title.textContent = '📎 受講証明書 — ' + cert.name;

  // プレビュー内容を種別で切り替え
  let previewHTML = '';
  if (isPDF) {
    previewHTML = `<embed src="${cert.data}" type="application/pdf"
      style="width:100%;height:420px;border-radius:6px;border:1px solid var(--border)">`;
  } else if (isImg) {
    previewHTML = `<img src="${cert.data}" alt="${cert.name}"
      style="max-width:100%;max-height:440px;border-radius:6px;border:1px solid var(--border);object-fit:contain">`;
  } else {
    previewHTML = `<div style="padding:32px 0">
      <div style="font-size:48px;margin-bottom:12px">${icon}</div>
      <div style="font-weight:700;font-size:15px;margin-bottom:4px">${cert.name}</div>
      <div style="font-size:12px;color:var(--text3)">Wordファイル · ${sizeKB}KB<br>ダウンロードして確認してください</div>
    </div>`;
  }
  body.innerHTML = `
    <div style="margin-bottom:10px;text-align:left;font-size:11px;color:var(--text3);display:flex;gap:12px;flex-wrap:wrap">
      <span>${icon} ${typeLabel}</span>
      <span>📦 ${sizeKB}KB</span>
      <span>📄 ${cert.name}</span>
    </div>
    ${previewHTML}`;

  const openBtn = document.getElementById('cert-open-btn');
  openBtn.textContent = isWord ? '⬇ Wordを開く（ダウンロード）' : '🔗 別タブで開く';
  openBtn.onclick = function() {
    if (cert.type === 'application/pdf' || cert.type.startsWith('image/')) {
      const newTab = window.open();
      newTab.document.write('<html><head><title>' + cert.name + '</title><style>body{margin:0;background:#1e1e1e}</style></head><body>');
      if (cert.type === 'application/pdf') {
        newTab.document.write('<embed src="' + cert.data + '" type="application/pdf" style="position:fixed;top:0;left:0;width:100%;height:100%">');
      } else {
        newTab.document.write('<div style="display:flex;justify-content:center;padding:20px"><img src="' + cert.data + '" style="max-width:100%"></div>');
      }
      newTab.document.write('</body></html>');
      newTab.document.close();
    } else {
      const a = document.createElement('a');
      a.href = cert.data; a.download = cert.name; a.click();
    }
  };

  dlBtn.onclick = function() {
    const a = document.createElement('a');
    a.href = cert.data;
    a.download = cert.name;
    a.click();
  };
  delBtn.onclick = function() {
    if (!confirm('この証明書データを削除しますか？\n受講記録自体は残ります。')) return;
    const list2 = loadKoushuList();
    const i = list2.findIndex(r => r.id === id);
    if (i > -1) { list2[i].cert = null; saveKoushuList(list2); }
    closeOverlay('cert-overlay');
    renderKoushu();
  };

  document.getElementById('cert-overlay').classList.add('open');
}

/* ═══════════════════════════════════════════════════════
   AI アシスタント（お試し版）
═══════════════════════════════════════════════════════ */



/* ═══════════════════════════════════════════════════════
   AI 書類生成
═══════════════════════════════════════════════════════ */

let _selectedDocType = null;







/* ═══════════════════════════════════════════════════════
   ベースアップ評価料 書類作成
═══════════════════════════════════════════════════════ */

// BASEUP_XLSX_B64 removed (copy mode)

const BASEUP_SUPPORT_LINKS = {
  previousReport: 'https://www.mhlw.go.jp/stf/newpage_53382.html',
  currentYear: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000188411_00053.html',
  dentalLab: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000188411_00053.html'
};

function renderBaseup() {
  const body = document.getElementById('baseup-body');
  body.innerHTML = [
    '<div class="baseup-support-intro">',
      '<strong>公式ページを用途別に分けて確認できます。</strong><br>',
      '昨年度から算定している医院の報告、今年度の新規・変更・再届出、歯科技工所ベースアップを混同しないよう、目的に合う公式ページを開いてください。',
    '</div>',

    '<div class="baseup-support-grid">',
      '<section class="baseup-support-card">',
        '<div class="baseup-support-kicker">昨年度分の報告書</div>',
        '<h3>令和7年度分実績報告</h3>',
        '<p>昨年度からベースアップ評価料を算定していた医院向けです。賃金改善実績報告書や届出後に行う報告の確認に進みます。</p>',
        `<a class="baseup-support-link" href="${BASEUP_SUPPORT_LINKS.previousReport}" target="_blank" rel="noopener noreferrer">厚生労働省の昨年度ベースアップ関連ページを開く</a>`,
      '</section>',

      '<section class="baseup-support-card">',
        '<div class="baseup-support-kicker">今年度のベースアップ評価料</div>',
        '<h3>新規届出・変更届出・計画書作成</h3>',
        '<p>今年度から新規算定する医院、変更届出・再届出・計画書作成を行う医院向けです。令和8年度改定に対応した最新の届出情報を確認します。</p>',
        `<a class="baseup-support-link" href="${BASEUP_SUPPORT_LINKS.currentYear}" target="_blank" rel="noopener noreferrer">厚生労働省の今年度ベースアップ評価料ページを開く</a>`,
      '</section>',

      '<section class="baseup-support-card">',
        '<div class="baseup-support-kicker">歯科技工所ベースアップ</div>',
        '<h3>技工所ベースアップ支援料</h3>',
        '<p>歯科技工所ベースアップ支援料の届出、様式101から102、提出方法、賃金改善実績報告の確認に進みます。</p>',
        `<a class="baseup-support-link" href="${BASEUP_SUPPORT_LINKS.dentalLab}" target="_blank" rel="noopener noreferrer">歯科技工所ベースアップに関する厚生労働省ページを開く</a>`,
      '</section>',
    '</div>',

    '<div class="baseup-support-note">',
      '<strong>提出前の確認</strong><br>',
      'リンク先は厚生労働省の公式ページです。地方厚生局ごとの提出先メールアドレスや締切、様式の更新状況は、提出前に必ず公式ページで確認してください。',
    '</div>',

    '<button id="baseup-teirei-btn" class="baseup-teirei-button">',
      '提出後は「定例報告」に記録を保存する',
    '</button>',
  ].join('');

  document.getElementById('baseup-teirei-btn').addEventListener('click', function(){ nav('teirei'); });
}


function switchBaseupTab(tab) { // tab: '95' or '100'
  document.getElementById('bform-95').style.display  = tab==='95'  ? 'block' : 'none';
  document.getElementById('bform-100').style.display = tab==='100' ? 'block' : 'none';
  document.getElementById('btab-95').style.borderBottomColor  = tab==='95'  ? 'var(--accent)' : 'transparent';
  document.getElementById('btab-100').style.borderBottomColor = tab==='100' ? 'var(--accent)' : 'transparent';
  document.getElementById('btab-95').style.color  = tab==='95'  ? 'var(--accent)' : 'var(--text3)';
  document.getElementById('btab-100').style.color = tab==='100' ? 'var(--accent)' : 'var(--text3)';
  document.getElementById('btab-95').style.fontWeight  = tab==='95'  ? '700' : '600';
  document.getElementById('btab-100').style.fontWeight = tab==='100' ? '700' : '600';
}

function downloadBaseup95() {
  // コピー支援モード：公式Excelに貼り付けて使用する
  const code  = document.getElementById('b95-code').value.trim();
  const name  = document.getElementById('b95-name').value.trim();
  const year  = document.getElementById('b95-year').value;
  const month = document.getElementById('b95-month').value;
  const day   = document.getElementById('b95-day').value;
  const owner = document.getElementById('b95-owner').value.trim();
  const staff = document.getElementById('b95-staff').value;
  const note5sel = document.getElementById('b95-note5');
  const note5txt = note5sel.options[note5sel.selectedIndex].text;
  const chk8  = document.getElementById('b95-chk8').checked  ? '☑' : '☐';
  const chk12 = document.getElementById('b95-chk12').checked ? '☑' : '☐';
  const chk23 = document.getElementById('b95-chk23').checked ? '☑' : '☐';
  const chk28 = document.getElementById('b95-chk28').checked ? '☑' : '☐';

  if (!code || !name) { alert('保険医療機関コードと医療機関名を入力してください'); return; }

  // コピー確認ダイアログを表示
  showBaseupCopyDialog('95', [
    { label:'保険医療機関コード',   cell:'H17', value: code },
    { label:'保険医療機関名',       cell:'H18', value: name },
    { label:'届出年（令和）',       cell:'E14', value: year },
    { label:'届出月',               cell:'H14', value: month },
    { label:'届出日',               cell:'K14', value: day },
    { label:'開設者名',             cell:'R14', value: owner },
    { label:'対象職員（常勤換算）数', cell:'L30', value: staff },
    { label:'誓約①（毎年8月報告）', cell:'AL8',  value: chk8 },
    { label:'誓約②（収入充当）',    cell:'AL12', value: chk12 },
    { label:'届出評価料（歯科Ⅰ）',  cell:'AL23', value: chk23 },
    { label:'外来医療等（歯科）',    cell:'AL28', value: chk28 },
    { label:'注5該当区分',          cell:'AL39〜44', value: note5txt },
  ]);
}

function downloadBaseup100() {
  const code      = document.getElementById('b100-code').value.trim();
  const name      = document.getElementById('b100-name').value.trim();
  const income4   = document.getElementById('b100-income4').value   || '0';
  const carry     = document.getElementById('b100-carry').value     || '0';
  const staff     = document.getElementById('b100-staff').value     || '0';
  const salAfter  = document.getElementById('b100-salary-after').value || '0';
  const salBase   = document.getElementById('b100-salary-base').value  || '0';
  const extra     = document.getElementById('b100-extra').value     || '0';

  if (!name) { alert('保険医療機関名を入力してください'); return; }

  showBaseupCopyDialog('別添1', [
    { label:'保険医療機関コード',       cell:'T4',  value: code },
    { label:'保険医療機関名',           cell:'T5',  value: name },
    { label:'書類種別チェック（実績報告書）', cell:'AH10', value: '☑' },
    { label:'医療機関種別チェック（歯科）',  cell:'AH15', value: '☑' },
    { label:'（４）外来・在宅ベースアップ評価料（Ⅰ）等 収入実績額', cell:'AF28', value: Number(income4).toLocaleString() + ' 円' },
    { label:'（８）前年度からの繰越額',  cell:'AF35', value: Number(carry).toLocaleString() + ' 円' },
    { label:'（10）対象職員 常勤換算数', cell:'AC50', value: staff + ' 人' },
    { label:'（11）基本給等総額（改善後）', cell:'AC51', value: Number(salAfter).toLocaleString() + ' 円' },
    { label:'（12）令和8年5月時点の基本給等総額', cell:'AC52', value: Number(salBase).toLocaleString() + ' 円' },
    { label:'（13）ベア実績額 ※自動計算', cell:'AC53', value: '← 数式セルのため自動計算されます' },
    { label:'（15）賞与・時間外・法定福利費等の増加分', cell:'AG55', value: Number(extra).toLocaleString() + ' 円' },
  ]);
}


function showBaseupCopyDialog(sheetName, items) {
  // 既存ダイアログがあれば削除
  const existing = document.getElementById('baseup-copy-overlay');
  if (existing) existing.remove();

  const rows = items.map(item => `
    <tr style="border-bottom:1px solid var(--border)">
      <td style="padding:7px 10px;font-size:11px;color:var(--text2);white-space:nowrap">${item.label}</td>
      <td style="padding:7px 8px;font-size:10px;color:var(--text3);font-family:monospace;white-space:nowrap">${item.cell}</td>
      <td style="padding:7px 10px;font-size:12px;font-weight:600;color:var(--text)">${item.value || '（未入力）'}</td>
      <td style="padding:7px 8px">
        ${item.value && !item.value.includes('自動計算') ? `<button onclick="copyToClipboard('${item.value.replace(/'/g, "\\'")}', this)"
          style="padding:3px 10px;background:var(--accent);border:none;border-radius:5px;color:#fff;font-size:10px;cursor:pointer;white-space:nowrap">📋 コピー</button>` : ''}
      </td>
    </tr>`).join('');

  const allText = items
    .filter(i => i.value && !i.value.includes('自動計算'))
    .map(i => `【${i.label}】${i.value}`)
    .join('\n');

  const overlay = document.createElement('div');
  overlay.id = 'baseup-copy-overlay';
  overlay.className = 'overlay open';
  overlay.onclick = function(e) { if(e.target===this) this.remove(); };
  overlay.innerHTML = `
    <div class="modal" style="max-width:680px;width:95vw;max-height:88vh;display:flex;flex-direction:column;overflow:hidden">
      <div class="mt">📋 入力内容の確認・コピー（${sheetName}）</div>
      <div class="ms" style="background:var(--blue-bg);border:1px solid #bfdbfe;border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:12px;line-height:1.8;color:var(--text2)">
        ① <strong style="color:var(--accent)">公式Excelを別途開いて</strong>ください　
        ② セル番号を確認しながら各値をコピー＆貼り付け　
        ③ チェックボックスは該当セルをクリックして✓を入れてください
      </div>
      <div style="overflow-y:auto;flex:1">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:var(--bg3)">
              <th style="padding:7px 10px;font-size:11px;text-align:left;color:var(--text2)">項目名</th>
              <th style="padding:7px 8px;font-size:11px;text-align:left;color:var(--text2)">セル番号</th>
              <th style="padding:7px 10px;font-size:11px;text-align:left;color:var(--text2)">入力値</th>
              <th style="padding:7px 8px;font-size:11px;text-align:left;color:var(--text2)"></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="mf" style="flex-shrink:0;border-top:1px solid var(--border);padding-top:12px;gap:8px">
        <button class="btn btn-ghost" onclick="document.getElementById('baseup-copy-overlay').remove()">閉じる</button>
        <button class="btn btn-secondary" onclick="copyAllBaseup('${allText.replace(/'/g, "\\'").replace(/\n/g, '\\n')}')">📋 全項目をまとめてコピー</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = '✓ コピー済み';
    btn.style.background = 'var(--green)';
    setTimeout(() => { btn.textContent = orig; btn.style.background = 'var(--accent)'; }, 2000);
  }).catch(() => {
    // フォールバック
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    btn.textContent = '✓ コピー済み';
    setTimeout(() => { btn.textContent = '📋 コピー'; }, 2000);
  });
}

function copyAllBaseup(text) {
  navigator.clipboard.writeText(text).then(() => {
    alert('全項目をクリップボードにコピーしました。\nメモ帳等に貼り付けて参照しながらExcelに入力できます。');
  }).catch(() => alert('コピーに失敗しました。各項目を個別にコピーしてください。'));
}

/* ═══════════════════════════════════════════════════════
   定例報告の年度保存
═══════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════
   TREC_KIJUN グローバル定義
   施設基準ごとのタブ・様式・フィールド定義
═══════════════════════════════════════════════════════ */
const TREC_KIJUN = {
  // 【令和8年改定】歯初診（様式27）・外感染2（様式27）の定例報告は廃止のため削除
  '歯外在ベⅠ': {
    tabLabel:     'ベースアップ評価料',
    formLabel:    '歯科外来・在宅ベースアップ評価料',
    submitMethod: '⚠ 専用メール提出（郵送不可）',
    note:         '計画書：算定開始前月末まで（専用メール添付）／ 実績報告書：毎年8月末',
    dlPdf:  'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/baseup.html',
    fields: [
      { id:'sep1',        label:'── 賃金改善計画書（算定開始前月末・専用メール添付）──', type:'label' },
      { id:'plan_year',   label:'対象年度',     type:'text', placeholder:'例：令和7年度' },
      { id:'plan_date',   label:'提出日',       type:'date' },
      { id:'plan_mail',   label:'メール送付先', type:'text', placeholder:'例：baseup-hyoukaryou27@mhlw.go.jp' },
      { id:'plan_taisho', label:'対象職員数',   type:'text', placeholder:'例：常勤3名、非常勤2名' },
      { id:'plan_chin',   label:'賃上げ計画額', type:'text', placeholder:'例：月額2,000円/人' },
      { id:'sep2',        label:'── 賃金改善実績報告書（毎年8月末提出）──', type:'label' },
      { id:'jisseki_date',label:'提出日',       type:'date' },
      { id:'jisseki_mail',label:'メール送付先', type:'text', placeholder:'例：baseup-hyoukaryou27@mhlw.go.jp' },
      { id:'jisseki_chin',label:'賃上げ実績額', type:'text', placeholder:'例：月額2,100円/人（実績）' },
      { id:'biko',        label:'備考',         type:'textarea', placeholder:'送付確認番号・特記事項など' },
    ],
  },
  // 【令和8年改定】外感染2（様式27）の定例報告は廃止
};

/* ═══════════════════════════════════════════════════════
   定例報告データの読み書き（施設基準ごとに独立）
   localStorage key: teirei_{abbr}  例: teirei_歯初診
═══════════════════════════════════════════════════════ */
function loadTeireiByAbbr(abbr) {
  return JSON.parse(localStorage.getItem(`teirei_${abbr}`) || '[]');
}
function saveTeireiByAbbr(abbr, recs) {
  localStorage.setItem(`teirei_${abbr}`, JSON.stringify(recs));
}
// 後方互換：古いteirei_recordsキーも読めるようにしておく
function loadTeireiRecords() {
  return JSON.parse(localStorage.getItem('teirei_records') || '[]');
}
function saveTeireiRecords(recs) {
  localStorage.setItem('teirei_records', JSON.stringify(recs));
}

/* ═══════════════════════════════════════════════════════
   モーダル開閉・タブ管理
═══════════════════════════════════════════════════════ */
let _trecActiveAbbr = '';

// abbr を指定すると該当タブを最初から開く
function openTeireiRecModal(initialAbbr) {
  const y = new Date().getFullYear();
  document.getElementById('trec-modal-title').textContent = `${y}年度 定例報告の記録を保存`;
  document.getElementById('trec-modal-year').textContent  = `令和${y - 2018}年度（${y}年8月1日現在）`;

  // 台帳にある報告対象の施設基準を抽出
  const reportAbbrs = entries
    .filter(e => TREC_KIJUN[e.abbr])
    .map(e => e.abbr);

  const tabBar = document.getElementById('trec-tab-bar');
  const tabContent = document.getElementById('trec-tab-content');

  if (reportAbbrs.length === 0) {
    tabBar.innerHTML = '';
    tabContent.innerHTML = '<p style="color:var(--text2);font-size:12px;padding:12px 0">報告書提出が必要な施設基準が台帳にありません。</p>';
  } else {
    const firstAbbr = (initialAbbr && reportAbbrs.includes(initialAbbr))
      ? initialAbbr : reportAbbrs[0];
    _trecActiveAbbr = firstAbbr;

    tabBar.innerHTML = reportAbbrs.map(abbr => `
      <button id="trec-tab-${abbr}" onclick="switchTrecTab('${abbr}')"
        style="padding:7px 16px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;
               border:2px solid ${abbr===firstAbbr?'var(--accent)':'var(--border2)'};
               background:${abbr===firstAbbr?'var(--accent)':'var(--bg2)'};
               color:${abbr===firstAbbr?'#fff':'var(--text2)'};transition:all .15s">
        ${TREC_KIJUN[abbr].tabLabel}
      </button>`).join('');

    renderTrecTabContent(firstAbbr);
  }

  window._trecFiles = [];
  renderTrecFileList();
  document.getElementById('trec-status').value    = 'submitted';
  document.getElementById('trec-sent-date').value = '';
  document.getElementById('trec-dest').value      = '関東信越厚生局東京事務所';
  document.getElementById('trec-memo').value      = '';

  // 右パネル：選択中タブの過去記録を表示
  if (_trecActiveAbbr) refreshRefPanel(_trecActiveAbbr);

  document.getElementById('teirei-rec-overlay').classList.add('open');
}

function switchTrecTab(abbr) {
  _trecActiveAbbr = abbr;
  Object.keys(TREC_KIJUN).forEach(a => {
    const btn = document.getElementById(`trec-tab-${a}`);
    if (!btn) return;
    const active = a === abbr;
    btn.style.background  = active ? 'var(--accent)' : 'var(--bg2)';
    btn.style.color        = active ? '#fff' : 'var(--text2)';
    btn.style.borderColor  = active ? 'var(--accent)' : 'var(--border2)';
  });
  renderTrecTabContent(abbr);
  refreshRefPanel(abbr);  // 右パネルも切替
}

function renderTrecTabContent(abbr) {
  const def = TREC_KIJUN[abbr];
  if (!def) return;
  const dlBtns = [
    def.dlPdf   ? `<a href="${def.dlPdf}"   target="_blank" style="display:inline-flex;align-items:center;gap:5px;padding:5px 12px;background:var(--blue-bg);border:1px solid #bfdbfe;border-radius:5px;font-size:11px;color:var(--accent);text-decoration:none">📄 様式PDF ↗</a>` : '',
    def.dlExcel ? `<a href="${def.dlExcel}" target="_blank" style="display:inline-flex;align-items:center;gap:5px;padding:5px 12px;background:var(--blue-bg);border:1px solid #bfdbfe;border-radius:5px;font-size:11px;color:var(--accent);text-decoration:none">📊 様式Excel ↗</a>` : '',
    def.dlWord  ? `<a href="${def.dlWord}"  target="_blank" style="display:inline-flex;align-items:center;gap:5px;padding:5px 12px;background:var(--blue-bg);border:1px solid #bfdbfe;border-radius:5px;font-size:11px;color:var(--accent);text-decoration:none">📝 様式Word ↗</a>` : '',
  ].filter(Boolean).join('');

  document.getElementById('trec-tab-content').innerHTML = `
    <div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:14px">
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--accent)">${def.formLabel}</div>
          <div style="font-size:11px;color:var(--text2);margin-top:2px">提出方法：${def.submitMethod}</div>
          ${def.note ? `<div style="font-size:11px;color:var(--yellow);margin-top:3px">⚠ ${def.note}</div>` : ''}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${dlBtns}</div>
      </div>
      ${def.fields.map(f => `
        <div class="fr">
          <div class="fl">${f.label}</div>
          ${f.type==='radio'
            ? f.options.map((o,i)=>`<label style="display:flex;align-items:center;gap:6px;font-size:12px;margin-bottom:4px;cursor:pointer">
                <input type="radio" name="trec_${abbr}_${f.id}" value="${o}" ${i===0?'checked':''} style="accent-color:var(--accent)"> ${o}
              </label>`).join('')
            : f.type==='textarea'
              ? `<textarea class="fta" id="trec_${abbr}_${f.id}" placeholder="${f.placeholder||''}" style="min-height:60px"></textarea>`
              : `<input type="${f.type}" class="fi" id="trec_${abbr}_${f.id}" placeholder="${f.placeholder||''}">`
          }
        </div>`).join('')}
    </div>`;
}

// 右パネルを選択中タブの過去記録で更新
function refreshRefPanel(abbr) {
  const recs = loadTeireiByAbbr(abbr);
  const sel  = document.getElementById('trec-ref-year');
  if (!sel) return;
  sel.innerHTML = `<option value="">── ${TREC_KIJUN[abbr]?.tabLabel||abbr}の過去記録を選択 ──</option>`
    + recs.sort((a,b)=>b.year-a.year)
          .map(r=>`<option value="${r.id}">${r.nengo||r.year+'年度'}（${r.sentDate||'日付未記録'}）</option>`).join('');

  document.getElementById('trec-ref-panel').innerHTML =
    recs.length === 0
      ? `<div style="color:var(--text3);text-align:center;padding:30px 0;font-size:12px">${TREC_KIJUN[abbr]?.tabLabel||abbr}の記録はまだありません。<br>今年保存すると来年表示されます。</div>`
      : '<div style="color:var(--text2);font-size:12px;text-align:center;padding:20px 0">↑ 年度を選ぶと内容が表示されます<br><span style="font-size:11px;color:var(--text3)">📋ボタンでコピーできます</span></div>';
}

// 右パネルに選択年度の記録を表示（コピペ用）
function loadTrecRefYear(id) {
  const panel = document.getElementById('trec-ref-panel');
  if (!id) {
    panel.innerHTML = '<div style="color:var(--text3);font-size:12px;text-align:center;padding:30px 0">年度を選択してください</div>';
    return;
  }
  // タブに合わせた abbr から記録を取得
  const _abbr = _trecActiveAbbr || '';
  const recs = _abbr ? loadTeireiByAbbr(_abbr) : loadTeireiRecords();
  const rec  = recs.find(r => r.id === id);
  if (!rec) return;

  const statusLabel = { submitted:'📮 提出済み', pending:'⏳ 準備中', unnecessary:'✅ 提出不要' };
  const files = rec.files || [];

  // コピーしやすいプレーンテキスト形式で表示
  let memoText = rec.memo || '';

  // fields から補完
  const fieldLines = Object.entries(rec.fields || {})
    .filter(([,v]) => v)
    .map(([k,v]) => `${k.replace(/^trec_[^_]+_/,'').replace(/_/g,' ')}：${v}`)
    .join('\n');

  panel.innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:10px">
      <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px">
        ${rec.nengo||rec.year+'年度'}
        <span style="font-size:11px;font-weight:400;color:var(--text2);margin-left:8px">${statusLabel[rec.status]||''}</span>
        ${rec.sentDate?`<span style="font-size:11px;color:var(--text3);margin-left:8px">郵送：${rec.sentDate.replace(/-/g,'/')}</span>`:''}
      </div>
      <div style="font-size:10px;color:var(--text3);margin-bottom:4px">届出件数：${rec.entries_snapshot.length}件　添付：${files.length}件</div>
    </div>

    ${fieldLines ? `
    <div style="margin-bottom:10px">
      <div style="font-size:11px;font-weight:600;color:var(--text2);margin-bottom:5px">報告内容</div>
      <div style="position:relative">
        <pre id="trec-ref-fields" style="background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:10px 36px 10px 12px;font-size:12px;font-family:var(--font);color:var(--text);white-space:pre-wrap;word-break:break-all;line-height:1.8;margin:0">${fieldLines}</pre>
        <button onclick="copyRefText('trec-ref-fields')" title="コピー"
          style="position:absolute;top:6px;right:6px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:3px 8px;cursor:pointer;font-size:10px;color:var(--text2)">📋</button>
      </div>
    </div>` : ''}

    ${memoText ? `
    <div style="margin-bottom:10px">
      <div style="font-size:11px;font-weight:600;color:var(--text2);margin-bottom:5px">メモ・備考</div>
      <div style="position:relative">
        <pre id="trec-ref-memo" style="background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:10px 36px 10px 12px;font-size:12px;font-family:var(--font);color:var(--text);white-space:pre-wrap;word-break:break-all;line-height:1.8;margin:0">${memoText.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>
        <button onclick="copyRefText('trec-ref-memo')" title="コピー"
          style="position:absolute;top:6px;right:6px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:3px 8px;cursor:pointer;font-size:10px;color:var(--text2)">📋</button>
      </div>
    </div>` : ''}

    ${files.length > 0 ? `
    <div>
      <div style="font-size:11px;font-weight:600;color:var(--text2);margin-bottom:5px">添付ファイル</div>
      <div style="display:flex;flex-direction:column;gap:4px">
        ${files.map(f=>`
          <button onclick="downloadTrecFile('${rec.id}','${f.name}')"
            style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:var(--bg2);border:1px solid var(--border);border-radius:5px;font-size:11px;color:var(--accent);cursor:pointer;font-family:var(--font);text-align:left">
            ${f.name.endsWith('.pdf')?'📄':f.name.match(/\.xlsx?$/)?'📊':'📝'}
            ${f.name}
            <span style="margin-left:auto;font-size:10px;color:var(--text3)">↓ DL</span>
          </button>`).join('')}
      </div>
    </div>` : ''}

    <div style="margin-top:12px;padding:8px 10px;background:var(--yellow-bg);border:1px solid #fde68a;border-radius:6px;font-size:11px;color:var(--yellow)">
      ⚠ 様式の内容は毎年変わる可能性があります。厚生局サイトで最新様式を確認してから記入してください。
    </div>`;
}

// テキストをクリップボードにコピー
function copyRefText(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  navigator.clipboard.writeText(el.innerText||el.textContent).then(() => {
    const btn = el.nextElementSibling;
    if (btn) { btn.textContent = '✓'; setTimeout(() => btn.textContent = '📋', 1500); }
  }).catch(() => {
    // fallback: テキストを選択
    const range = document.createRange();
    range.selectNode(el);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  });
}

function saveTeireiRecord() {
  const abbr = _trecActiveAbbr;
  if (!abbr) { alert('保存する施設基準が選択されていません'); return; }

  const y    = new Date().getFullYear();
  const recs = loadTeireiByAbbr(abbr);

  const record = {
    id:               String(Date.now()),
    abbr,
    year:             y,
    nengo:            `令和${y - 2018}年度`,
    savedAt:          new Date().toISOString(),
    status:           document.getElementById('trec-status').value,
    sentDate:         document.getElementById('trec-sent-date').value,
    dest:             document.getElementById('trec-dest').value,
    memo:             document.getElementById('trec-memo').value,
    entries_snapshot: JSON.parse(JSON.stringify(entries)),
    fields:           {},
    files:            window._trecFiles || [],
  };

  // 現在表示中タブのフォーム値を収集
  document.querySelectorAll(`[id^="trec_${abbr}_"]`).forEach(el => {
    record.fields[el.id] = el.value;
  });
  document.querySelectorAll(`[name^="trec_${abbr}_"]`).forEach(radio => {
    if (radio.checked) record.fields[radio.name] = radio.value;
  });

  // 同年度が既存なら上書き確認
  const existing = recs.findIndex(r => r.year === y);
  if (existing > -1) {
    if (!confirm(`${TREC_KIJUN[abbr].tabLabel}：${y}年度の記録は既にあります。上書きしますか？`)) return;
    recs[existing] = record;
  } else {
    recs.unshift(record);
  }

  saveTeireiByAbbr(abbr, recs);
  window._trecFiles = [];
  renderTrecFileList();
  refreshRefPanel(abbr);

  const area = document.getElementById('teirei-history-area');
  if (area && area.style.display === 'block') renderTeireiHistoryArea();

  alert(`✅ ${TREC_KIJUN[abbr].tabLabel}：${record.nengo}の記録を保存しました。\n\n他の施設基準の記録はタブを切り替えて保存してください。`);
}

// ファイル添付処理
function addTrecFiles(event) {
  const files = Array.from(event.target.files);
  window._trecFiles = window._trecFiles || [];

  const readers = files.map(file => new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => resolve({
      name: file.name,
      size: file.size,
      type: file.type,
      data: e.target.result, // base64
    });
    reader.readAsDataURL(file);
  }));

  Promise.all(readers).then(results => {
    window._trecFiles.push(...results);
    renderTrecFileList();
  });
  event.target.value = '';
}

function renderTrecFileList() {
  const list = window._trecFiles || [];
  const el   = document.getElementById('trec-file-list');
  if (!el) return;
  el.innerHTML = list.map((f, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--bg2);border:1px solid var(--border);border-radius:5px;font-size:12px">
      <span>${f.name.endsWith('.pdf')?'📄':f.name.match(/\.xlsx?$/)?'📊':'📝'}</span>
      <span style="flex:1;color:var(--text)">${f.name}</span>
      <span style="color:var(--text3);font-size:10px;font-family:var(--mono)">${(f.size/1024).toFixed(0)}KB</span>
      <button onclick="removeTrecFile(${i})" style="background:none;border:none;cursor:pointer;color:var(--red);font-size:13px;padding:0">✕</button>
    </div>`).join('');
}

function removeTrecFile(i) {
  window._trecFiles = (window._trecFiles||[]).filter((_,j)=>j!==i);
  renderTrecFileList();
}

function showTeireiHistory() {
  const area = document.getElementById('teirei-history-area');
  if (area.style.display === 'block') { area.style.display = 'none'; return; }
  renderTeireiHistoryArea();
  area.style.display = 'block';
}

function renderTeireiHistoryArea() {
  const area = document.getElementById('teirei-history-area');
  // 全施設基準の記録を結合して年度降順で表示
  const allRecs = Object.keys(TREC_KIJUN).flatMap(abbr =>
    loadTeireiByAbbr(abbr).map(r => ({ ...r, abbr }))
  ).concat(loadTeireiRecords())  // 旧データも表示
   .sort((a,b) => b.year - a.year || new Date(b.savedAt)-new Date(a.savedAt));
  const recs = allRecs;

  const statusIcon  = { submitted:'📮', pending:'⏳', unnecessary:'✅' };
  const statusLabel = { submitted:'提出済み', pending:'準備中', unnecessary:'提出不要' };
  const statusCls   = { submitted:'bg', pending:'by', unnecessary:'bg' };

  if (recs.length === 0) {
    area.innerHTML = '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:14px;font-size:12px;color:var(--text2)">保存された定例報告の記録はありません。</div>';
    return;
  }

  area.innerHTML = `
    <div style="font-size:13px;font-weight:700;margin-bottom:12px">📂 過去の定例報告記録</div>
    ${recs.map(r => {
      const st  = r.status || 'submitted';
      const files = r.files || [];
      return `
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:10px;box-shadow:var(--shadow)">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:10px">
            <strong style="font-size:15px">${r.nengo||r.year+'年度'}</strong>
            <span class="badge ${statusCls[st]||'bgr'}">${statusIcon[st]||''} ${statusLabel[st]||st}</span>
            ${r.sentDate?`<span class="mono" style="font-size:11px;color:var(--text2)">郵送：${r.sentDate.replace(/-/g,'/')}</span>`:''}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn btn-ghost" style="font-size:11px;padding:4px 10px" onclick="openTeireiRecModal();setTimeout(()=>{const s=document.getElementById('trec-ref-year');if(s){s.value='${r.id}';loadTrecRefYear('${r.id}')}},150)">📋 参照して今年の記録を作成</button>
            <button class="btn btn-ghost" style="font-size:11px;padding:4px 10px" onclick="printTeireiDetail('${r.id}')">🖨 印刷</button>
            <button class="btn btn-danger" style="font-size:11px;padding:4px 8px" onclick="deleteTeireiRecord('${r.id}')">🗑</button>
          </div>
        </div>

        <!-- 記録内容サマリー -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:${files.length>0?'12px':'0'}">
          <div style="background:var(--bg3);border-radius:6px;padding:8px 10px;border:1px solid var(--border)">
            <div style="font-size:10px;color:var(--text3);font-family:var(--mono);margin-bottom:3px">届出件数</div>
            <div style="font-size:14px;font-weight:700">${r.entries_snapshot.length}件</div>
          </div>
          <div style="background:var(--bg3);border-radius:6px;padding:8px 10px;border:1px solid var(--border)">
            <div style="font-size:10px;color:var(--text3);font-family:var(--mono);margin-bottom:3px">添付ファイル</div>
            <div style="font-size:14px;font-weight:700">${files.length}件</div>
          </div>
          <div style="background:var(--bg3);border-radius:6px;padding:8px 10px;border:1px solid var(--border)">
            <div style="font-size:10px;color:var(--text3);font-family:var(--mono);margin-bottom:3px">保存日時</div>
            <div style="font-size:11px;font-weight:500">${new Date(r.savedAt).toLocaleString('ja',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</div>
          </div>
        </div>

        <!-- 添付ファイル一覧 -->
        ${files.length > 0 ? `
        <div style="margin-top:8px">
          <div style="font-size:11px;color:var(--text3);margin-bottom:6px;font-family:var(--mono)">添付ファイル</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${files.map(f=>`
              <button onclick="downloadTrecFile('${r.id}','${f.name}')"
                style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;background:var(--blue-bg);border:1px solid #bfdbfe;border-radius:5px;font-size:11px;color:var(--accent);cursor:pointer;font-family:var(--font)">
                ${f.name.endsWith('.pdf')?'📄':f.name.match(/\.xlsx?$/)?'📊':'📝'}
                ${f.name}
                <span style="font-size:9px;color:var(--text3)">↓</span>
              </button>`).join('')}
          </div>
        </div>` : ''}

        ${r.memo?`<div style="margin-top:10px;font-size:11px;color:var(--text2);padding:6px 10px;background:var(--bg3);border-radius:5px;border:1px solid var(--border)">📝 ${r.memo}</div>`:''}
      </div>`;
    }).join('')}`;
}

// 今年にコピー（昨年の内容を今年のフォームに転記）
function copyTeireiRecord(id) {
  const recs = loadTeireiRecords();
  const src  = recs.find(r => r.id === id);
  if (!src) return;

  const y = new Date().getFullYear();
  if (!confirm(`${src.nengo||src.year+'年度'}の内容を${y}年度にコピーして編集しますか？\n（保存ボタンを押すまで上書きされません）`)) return;

  // フォームを開いてから値を転記
  openTeireiRecModal();

  // 少し待ってからフォームに値をセット
  setTimeout(() => {
    // ステータス・日付・メモ
    const st = document.getElementById('trec-status');
    if(st) st.value = src.status || 'submitted';
    const sd = document.getElementById('trec-sent-date');
    if(sd) sd.value = ''; // 今年の日付はリセット
    const memo = document.getElementById('trec-memo');
    if(memo) memo.value = src.memo || '';

    // 報告内容フォームの値
    Object.entries(src.fields || {}).forEach(([k, v]) => {
      const el = document.getElementById(k);
      if (el) {
        el.value = v;
      } else {
        // ラジオボタン
        const radio = document.querySelector(`[name="${k}"][value="${v}"]`);
        if (radio) radio.checked = true;
      }
    });

    // ファイルは引き継がない（新年度は新しく添付）
    window._trecFiles = [];
    renderTrecFileList();
  }, 100);
}

// ファイルダウンロード
function downloadTrecFile(recId, fileName) {
  const recs = loadTeireiRecords();
  const rec  = recs.find(r => r.id === recId);
  if (!rec) return;
  const file = (rec.files || []).find(f => f.name === fileName);
  if (!file) return;
  const a = document.createElement('a');
  a.href = file.data;
  a.download = file.name;
  a.click();
}

function printTeireiDetail(id, abbr) {
  const recs = abbr ? loadTeireiByAbbr(abbr) : loadTeireiRecords();
  const rec  = recs.find(r => r.id === id);
  if (!rec) return;

  const statusLabel = { submitted:'提出済み', pending:'準備中', unnecessary:'提出不要' };
  const fieldRows = Object.entries(rec.fields || {})
    .filter(([,v]) => v)
    .map(([k,v]) => `<tr><td style="color:#666;font-size:11px;width:40%">${k.replace(/^trec_[^_]+_/,'').replace(/_/g,' ')}</td><td>${v}</td></tr>`)
    .join('');
  const snapRows = rec.entries_snapshot.map(e =>
    `<tr><td>${e.name}</td><td>${e.abbr||''}</td><td>${e.number||''}</td></tr>`
  ).join('');

  const w = window.open('','_blank');
  w.document.write(`<html><head><meta charset="UTF-8"><title>${rec.nengo||rec.year+'年度'} 定例報告記録</title>
  <style>body{font-family:'Noto Sans JP',sans-serif;font-size:12px;padding:24px}
  h2{font-size:15px;margin-bottom:3px}h3{font-size:12px;margin:14px 0 6px;border-left:3px solid #2563eb;padding-left:8px}
  p{font-size:10px;color:#666;margin-bottom:10px}
  table{width:100%;border-collapse:collapse;margin-bottom:12px}
  th,td{border:1px solid #ddd;padding:5px 8px;font-size:11px}th{background:#f5f5f5;font-weight:600}
  .chip{display:inline-block;background:#eff6ff;border:1px solid #bfdbfe;border-radius:4px;padding:2px 8px;font-size:10px;color:#2563eb}</style>
</head><body>
  <h2>定例報告 記録 — ${rec.nengo||rec.year+'年度'}</h2>
  <p>保存日時：${new Date(rec.savedAt).toLocaleString('ja')}　提出先：${rec.dest||'関東信越厚生局東京事務所'}
  ${rec.sentDate?`　郵送日：${rec.sentDate.replace(/-/g,'/')}`:''}
  　ステータス：${statusLabel[rec.status]||rec.status||'—'}
  ${rec.memo?`<br>メモ：${rec.memo}`:''}</p>
  ${fieldRows?`<h3>報告内容</h3><table><thead><tr><th>項目</th><th>記録内容</th></tr></thead><tbody>${fieldRows}</tbody></table>`:''}
  <h3>届出台帳スナップショット（${rec.entries_snapshot.length}件）</h3>
  <table><thead><tr><th>施設基準名</th><th>略称</th><th>受理番号</th></tr></thead><tbody>${snapRows}</tbody></table>
  ${rec.files&&rec.files.length>0?`<h3>添付ファイル（${rec.files.length}件）</h3><ul>${rec.files.map(f=>`<li>${f.name}（${(f.size/1024).toFixed(0)}KB）</li>`).join('')}</ul>`:''}
  </body></html>`);
  w.print();
}

function deleteTeireiRecord(id, abbr) {
  if (!confirm('この記録を削除しますか？')) return;
  if (abbr) {
    saveTeireiByAbbr(abbr, loadTeireiByAbbr(abbr).filter(r=>r.id!==id));
  } else {
    saveTeireiRecords(loadTeireiRecords().filter(r=>r.id!==id));
  }
  renderTeireiHistoryArea();
}


/* ═══════════════════════════════════════════════════════
   届出・変更履歴（台帳ルート）
   localStorage key: kijun_hist_{entryId}
═══════════════════════════════════════════════════════ */

function loadKijunHist(entryId) {
  return JSON.parse(localStorage.getItem(`kijun_hist_${entryId}`) || '[]');
}
function saveKijunHistData(entryId, list) {
  localStorage.setItem(`kijun_hist_${entryId}`, JSON.stringify(list));
}

function renderKijunHist(entryId) {
  const list = loadKijunHist(entryId)
    .sort((a,b) => new Date(b.date) - new Date(a.date));
  if (list.length === 0) {
    return '<div style="font-size:11px;color:var(--text3);padding:6px 0">記録なし。「＋ 記録を追加」から届出・変更内容を記録できます。</div>';
  }
  return list.map(r => `
    <div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);align-items:flex-start">
      <div style="flex-shrink:0;text-align:right;min-width:72px">
        <div class="mono" style="font-size:11px;color:var(--text2)">${r.date?r.date.replace(/-/g,'/'):'—'}</div>
      </div>
      <div style="flex:1">
        <div style="font-size:12px;font-weight:600;color:var(--text)">${r.title||'変更記録'}</div>
        ${r.number?`<div class="mono" style="font-size:10px;color:var(--text3);margin-top:1px">${r.number}</div>`:''}
        ${r.juyoken?`<span class="badge ${r.juyoken==='充足'?'bg':'br'}" style="font-size:10px;margin-top:3px;display:inline-block">${r.juyoken==='充足'?'✓ 充足':'✕ 未充足'}</span>`:''}
        ${r.memo?`<div style="font-size:11px;color:var(--text2);margin-top:3px">${r.memo}</div>`:''}
      </div>
      <button onclick="deleteKijunHist(${entryId},'${r.id}')"
        style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:12px;padding:0;flex-shrink:0">✕</button>
    </div>`).join('');
}

function openKijunHistModal(entryId) {
  const e = entries.find(x => x.id === entryId);
  if (!e) return;
  document.getElementById('kijun-hist-title').textContent = `${e.abbr||e.name} — 届出・変更を記録`;
  document.getElementById('kijun-hist-entry-id').value = entryId;
  document.getElementById('kijun-hist-rec-id').value   = '';
  document.getElementById('kh-title').value  = '';
  document.getElementById('kh-date').value   = new Date().toISOString().slice(0,10);
  document.getElementById('kh-number').value = e.number || '';
  document.getElementById('kh-memo').value   = '';
  document.querySelector('[name="kh-juyoken"][value="充足"]').checked = true;
  document.getElementById('kijun-hist-overlay').classList.add('open');
}

function saveKijunHist() {
  const entryId = +document.getElementById('kijun-hist-entry-id').value;
  const recId   = document.getElementById('kijun-hist-rec-id').value;
  const title   = document.getElementById('kh-title').value.trim();
  const date    = document.getElementById('kh-date').value;
  if (!title) { alert('変更内容を入力してください'); return; }

  const list = loadKijunHist(entryId);
  const rec = {
    id:       recId || String(Date.now()),
    title,
    date,
    number:   document.getElementById('kh-number').value.trim(),
    juyoken:  document.querySelector('[name="kh-juyoken"]:checked')?.value || '充足',
    memo:     document.getElementById('kh-memo').value.trim(),
    savedAt:  new Date().toISOString(),
  };
  const idx = list.findIndex(r => r.id === recId);
  if (idx > -1) list[idx] = rec; else list.unshift(rec);
  saveKijunHistData(entryId, list);

  closeOverlay('kijun-hist-overlay');
  // 詳細パネルの履歴を再描画
  const el = document.getElementById(`kijun-hist-${entryId}`);
  if (el) el.innerHTML = renderKijunHist(entryId);
}

function deleteKijunHist(entryId, recId) {
  if (!confirm('この記録を削除しますか？')) return;
  const list = loadKijunHist(entryId).filter(r => r.id !== recId);
  saveKijunHistData(entryId, list);
  const el = document.getElementById(`kijun-hist-${entryId}`);
  if (el) el.innerHTML = renderKijunHist(entryId);
}


/* ── PDF URL 自動生成（東京都歯科） ── */


/* ── ワンクリック自動取込 ── */

/* ═══════════════════════════════════════════════════════
   新規届出サポート
═══════════════════════════════════════════════════════ */

const SHINKI_OFFICIAL_LINKS = {
  r08Basic: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/kihon_shinryo_r08.html',
  r08Special: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html',
  r06Basic: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/kihon_shinryo_r06.html',
  r06Special: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r06.html',
  withdrawal: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/shisetsu_kijun.html',
  electronic: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/chousa/denshishinsei_00001.html',
  office: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/gyomu/bu_ka/jimusho.html'
};

function getShinkiPrimaryPage(def){
  const url = String(def?.sourcePage || def?.yoshiki?.[0]?.url || '');
  if(url.includes('tokukei_shinryo')) return SHINKI_OFFICIAL_LINKS.r08Special;
  if(url.includes('kihon_shinryo')) return SHINKI_OFFICIAL_LINKS.r08Basic;
  return def?.category === 'basic' ? SHINKI_OFFICIAL_LINKS.r08Basic : SHINKI_OFFICIAL_LINKS.r08Special;
}

function getShinkiPastPage(def){
  const url = String(def?.sourcePage || def?.yoshiki?.[0]?.url || '');
  if(url.includes('tokukei_shinryo')) return SHINKI_OFFICIAL_LINKS.r06Special;
  if(url.includes('kihon_shinryo')) return SHINKI_OFFICIAL_LINKS.r06Basic;
  return def?.category === 'basic' ? SHINKI_OFFICIAL_LINKS.r06Basic : SHINKI_OFFICIAL_LINKS.r06Special;
}

const ELECTRONIC_DENTAL_DX_MASTER = {
  ryakusho: '（歯医DX1・歯医DX2）',
  name: '電子的歯科診療情報連携体制整備加算',
  category: 'basic',
  score: '加算1: 初診時9点 / 加算2: 初診時4点 / 再診時: 月1回2点',
  scoreItems: [
    { label: '電子的歯科診療情報連携体制整備加算1', value: '初診時 9点' },
    { label: '電子的歯科診療情報連携体制整備加算2', value: '初診時 4点' },
    { label: '再診時', value: '月1回 2点' }
  ],
  summary: '令和8年度診療報酬改定で新設。医療情報取得加算および医療DX推進体制整備加算を整理・再編した、歯科初診料・再診料に係る施設基準。オンライン資格確認、診療情報の取得・活用、医療DX推進体制、明細書無償交付、ウェブサイト掲示等の体制を評価する。',
  prereq: [],
  isNew: true,
  newNote: '🆕【令和8年度改定に伴う新規届出事項】令和6年度の医療DX推進体制整備加算を届け出ている医療機関でも、令和8年6月1日以降に算定する場合は改めて届出が必要です。',
  requirements: [
    '対象は歯科 初診料・再診料',
    '受理番号は歯医DX1または歯医DX2',
    '施設基準通知は別添1 1の8',
    '届出様式は様式1の6',
    'オンライン資格確認、診療情報の取得・活用、医療DX推進体制、明細書無償交付、ウェブサイト掲示等の体制を整備',
  ],
  note: '施設基準の届出情報と算定点数情報を混同しないよう、点数は歯科初診時の加算1・加算2と再診時を分けて確認してください。',
  yoshiki: [
    {label:'🔍 基本診療料の届出一覧（関東信越厚生局）', url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/kihon_shinryo_r08.html', keyword:'歯医DX'},
  ],
  sourcePage: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/kihon_shinryo_r08.html',
  flow: ['歯医DX1または歯医DX2の区分を確認','オンライン資格確認・診療情報活用・掲示等の体制を整備','様式1の6を記載して厚生局へ届出','令和6年度の医療DX推進体制整備加算から自動移行しないため、令和8年6月1日以降の算定には改めて届出'],
};

const SHINKI_MASTER = {

  /* ════════════════════════════════
     基本診療料
  ════════════════════════════════ */

  '歯初診': {
    ryakusho: '（歯初診）',
    name: '初診料（歯科）の注1に掲げる基準',
    category: 'basic',
    score: '院内感染防止対策の評価（歯科診療の基盤）',
    summary: '院内感染防止対策を実施している歯科診療所として届出する基礎的施設基準。外安全1・外感染1の前提条件。',
    prereq: [],
    requirements: [
      '院内感染防止対策に係る研修を4年に1回以上受講した常勤歯科医師が1名以上',
      '職員を対象とした院内感染防止対策の院内研修等を実施',
      '院内感染防止対策を実施している旨の院内掲示・ウェブサイト掲載',
      '年1回、実施状況等について様式2の7により厚生局長に報告',
    ],
    note: '研修はオンライン・e-learningでも可。歯科医師会主催の講習会が活用できます。',
    yoshiki: [
      {label:'🔍 基本診療料の届出一覧（関東信越厚生局）', url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/kihon_shinryo_r08.html', keyword:'歯初診'},
    ],
    sourcePage: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/kihon_shinryo_r08.html',
    flow: ['院内感染防止対策研修を受講','院内掲示・ウェブサイト掲載を準備','様式2の6を記載して厚生局へ郵送','受理後、翌月1日から算定可'],
  },

  '外安全１': {
    ryakusho: '（外安全１）',
    name: '歯科外来診療医療安全対策加算1',
    category: 'basic',
    score: '初診時12点・再診時2点（加算）',
    summary: '医療安全対策の体制を整えた歯科診療所に算定できる加算。歯初診の届出が前提。',
    prereq: ['歯初診'],
    requirements: [
      '医療安全対策に係る研修を修了した常勤歯科医師が1名以上',
      '歯科医師が複数名、または歯科医師1名以上と歯科衛生士1名以上の配置',
      '医療安全管理者が配置されていること',
      'AED・パルスオキシメーター・酸素・血圧計・救急蘇生セットの設置',
      '緊急時の連携医療機関との事前連携体制',
      '歯科ヒヤリ・ハット事例収集等事業への登録またはインシデント報告体制の整備',
      '院内掲示・ウェブサイト掲載',
    ],
    note: '医療安全研修は歯科医師会等主催の講習会で受講可。AED等の設備投資が必要です。',
    yoshiki: [
      {label:'🔍 基本診療料の届出一覧（関東信越厚生局）', url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/kihon_shinryo_r08.html', keyword:'外安全1'},
    ],
    sourcePage: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/kihon_shinryo_r08.html',
    flow: ['歯初診の届出（未届の場合）','医療安全研修を受講','AED等の設備を整備','医療安全管理者を選任','ヒヤリ・ハット事業に登録','様式4を記載して厚生局へ郵送'],
  },

  '外安全２': {
    ryakusho: '（外安全２）',
    name: '歯科外来診療医療安全対策加算2',
    category: 'basic',
    score: '医療安全対策の体制を評価',
    summary: '歯科外来診療における医療安全対策の体制を評価する施設基準。令和8年度の基本診療料ページで様式を確認してください。',
    prereq: ['歯初診'],
    requirements: [
      '歯初診の施設基準の届出を行っていること',
      '歯科外来診療における医療安全対策の体制を整備',
      '届出様式は令和8年度の基本診療料ページで確認',
    ],
    note: '外安全1とは要件・区分が異なります。提出前に公式一覧ページで最新要件を確認してください。',
    yoshiki: [
      {label:'🔍 基本診療料の届出一覧（関東信越厚生局）', url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/kihon_shinryo_r08.html', keyword:'外安全2'},
    ],
    sourcePage: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/kihon_shinryo_r08.html',
    flow: ['歯初診の届出（未届の場合）','医療安全対策の体制を整備','様式4の1の2を記載して厚生局へ届出'],
  },

  '外感染１': {
    ryakusho: '（外感染１）',
    name: '歯科外来診療感染対策加算1',
    category: 'basic',
    score: '初診時12点・再診時2点（加算）',
    summary: '院内感染防止対策の体制を整えた歯科診療所に算定できる加算。歯初診の届出が前提。',
    prereq: ['歯初診'],
    requirements: [
      '歯初診の施設基準の届出を行っていること',
      '院内感染管理者が配置されていること',
      '歯科用吸引装置（口腔外バキューム）がユニット毎に設置',
      '歯科医師複数名、または歯科医師1名以上と歯科衛生士（院内感染研修修了者）1名以上',
    ],
    note: '口腔外バキュームの設置が必須。外安全1と同時に申請する診療所が多い。',
    yoshiki: [
      {label:'🔍 基本診療料の届出一覧（関東信越厚生局）', url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/kihon_shinryo_r08.html', keyword:'外感染1'},
    ],
    sourcePage: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/kihon_shinryo_r08.html',
    flow: ['歯初診の届出（未届の場合）','院内感染管理者を選任','口腔外バキュームを設置','様式4を記載して厚生局へ郵送'],
  },

  '外感染２': {
    ryakusho: '（外感染２）',
    name: '歯科外来診療感染対策加算2',
    category: 'basic',
    score: '感染対策の体制を評価',
    summary: '歯科外来診療における感染対策の体制を評価する施設基準。令和8年度の基本診療料ページで様式を確認してください。',
    prereq: ['歯初診'],
    requirements: [
      '歯初診の施設基準の届出を行っていること',
      '歯科外来診療における感染対策の体制を整備',
      '届出様式は令和8年度の基本診療料ページで確認',
    ],
    note: '外感染1とは要件・区分が異なります。提出前に公式一覧ページで最新要件を確認してください。',
    yoshiki: [
      {label:'🔍 基本診療料の届出一覧（関東信越厚生局）', url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/kihon_shinryo_r08.html', keyword:'外感染2'},
    ],
    sourcePage: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/kihon_shinryo_r08.html',
    flow: ['歯初診の届出（未届の場合）','感染対策の体制を整備','様式4を記載して厚生局へ届出'],
  },

  '口管強': {
    ryakusho: '（口管強）',
    name: '小児口腔機能管理料の注3に規定する口腔管理体制強化加算',
    category: 'special',
    score: 'う蝕・歯周・口腔機能等の各種加算で高い点数を算定可能',
    summary: 'かかりつけ歯科医機能を評価する加算。継続的な口腔管理・訪問診療・歯周安定期治療等の実績が必要。令和6年改定で「か強診」から現在の名称に変更済み。',
    prereq: ['歯初診','外安全１','外感染１'],
    requirements: [
      '外安全1・外感染1の施設基準の届出を行っていること',
      '歯科医師1名以上・歯科衛生士1名以上が配置',
      '過去1年間に歯科訪問診療料（1〜5）の算定実績',
      '過去1年間に歯周病安定期治療の算定患者が30人以上',
      'エナメル質初期う蝕・根面う蝕の継続管理等に係る研修修了',
      '小児の心身の特性に関する研修修了',
      '院内掲示・ウェブサイト掲載',
    ],
    note: '令和6年改定で「か強診」から名称変更済み。令和8年改定では口腔機能実地指導料（新設）との関係が要確認。厚生局告示で最新要件を確認のこと。',
    yoshiki: [
      {label:'🔍 特掲診療料の届出一覧（関東信越厚生局）', url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html', keyword:'口管強'},
    ],
    sourcePage: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html',
    flow: ['外安全1・外感染1の届出（未届の場合）','訪問診療・歯周安定期治療の実績を積む','追加研修を受講','様式17の2を記載して厚生局へ郵送'],
  },

  '医療ＤＸ': {
    ryakusho: '（医療ＤＸ）',
    name: '医療DX推進体制整備加算（令和8年6月廃止・再編）',
    category: 'basic',
    score: '令和8年6月改定で廃止',
    summary: '令和8年6月改定で廃止・再編されました。後継として「電子的歯科診療情報連携体制整備加算」が新設されています。既に届出している施設は厚生局の案内に従い対応してください。',
    prereq: [],
    abolished: true,
    abolishNote: '🚫【令和8年6月廃止・再編】医療DX推進体制整備加算は廃止され、「電子的歯科診療情報連携体制整備加算」として一新されました。新設された加算の届出が必要です。',
    requirements: [
      '【廃止】令和8年6月以降は「電子的歯科診療情報連携体制整備加算」として新規届出が必要',
    ],
    note: '🚫 令和8年6月廃止・再編。新設の「電子的歯科診療情報連携体制整備加算」（略称：電子的歯科連携）を参照のこと。',
    yoshiki: [
      {label:'🔍 基本診療料の届出一覧（関東信越厚生局）', url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/kihon_shinryo_r08.html', keyword:'医療ＤＸ'},
    ],
    sourcePage: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/kihon_shinryo_r08.html',
    flow: ['電子資格確認の導入','マイナ保険証の利用促進','電子処方箋の導入','様式1の6を記載して厚生局へ郵送'],
  },

  '歯情報通信': {
    ryakusho: '（歯情報通信）',
    name: '初診料（歯科）の注16及び再診料（歯科）の注12に掲げる基準（オンライン診療）',
    category: 'basic',
    score: '歯科でのオンライン診療が算定可能',
    summary: '電話やビデオ通話等を用いたオンライン診療を実施できる施設基準。',
    prereq: ['歯初診'],
    requirements: [
      'オンライン診療の実施に関する手順書を作成',
      '情報通信機器の利用に関する十分な体制を整備',
      '緊急時に対面診療できる体制または連携医療機関を確保',
      '院内掲示・ウェブサイト掲載',
    ],
    note: 'スマートフォンやPCのビデオ通話で対応可能な場合もあります。',
    yoshiki: [
      {label:'🔍 基本診療料の届出一覧（関東信越厚生局）', url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/kihon_shinryo_r08.html', keyword:'歯情報通信'},
    ],
    sourcePage: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/kihon_shinryo_r08.html',
    flow: ['オンライン診療の手順書を作成','通信環境を整備','様式4の3を記載して厚生局へ郵送'],
  },

  /* ════════════════════════════════
     特掲診療料 ─ 管理料・全身管理
  ════════════════════════════════ */

  '機安歯': {
    ryakusho: '（機安歯）',
    name: '医療機器安全管理料（歯科）',
    category: 'special',
    score: '医療機器安全管理料（歯科）：100点',
    summary: '歯科用医療機器の安全管理体制を評価する施設基準。保守点検計画の整備が必要。',
    prereq: [],
    requirements: [
      '医療機器の安全管理を行うにつき十分な体制が整備されていること',
      '医療機器安全管理責任者（常勤の歯科医師または歯科衛生士等）が配置されていること',
      '医療機器の保守点検に関する計画を作成・管理していること',
    ],
    note: '多くの歯科診療所で届出可能。要件が比較的満たしやすい施設基準です。',
    yoshiki: [
      {label:'🔍 特掲診療料の届出一覧（関東信越厚生局）', url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html', keyword:'機安歯'},
    ],
    sourcePage: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html',
    flow: ['医療機器安全管理責任者を選任','保守点検計画を作成','届出書を記載して厚生局へ郵送'],
  },

  '医管': {
    ryakusho: '（医管）',
    name: '歯科治療時医療管理料',
    category: 'special',
    score: '歯科治療時医療管理料：65点',
    summary: '糖尿病・高血圧・心臓病等の全身疾患を有する患者に対して、全身状態を管理しながら歯科治療を行う場合に算定。',
    prereq: ['外安全１'],
    requirements: [
      '十分な経験を有する常勤歯科医師が治療前・中・後の全身状態を管理する体制',
      '常勤歯科医師が複数名、または常勤歯科医師1名以上と常勤歯科衛生士（または看護師）1名以上',
      'パルスオキシメーター・酸素供給装置・救急蘇生セットを有すること',
      '緊急時に対応できる医療機関との連携体制',
    ],
    note: '外安全1の体制に加えて酸素供給装置が必要。全身疾患患者が多い診療所に有用。',
    yoshiki: [
      {label:'🔍 特掲診療料の届出一覧（関東信越厚生局）', url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html', keyword:'医管'},
    ],
    sourcePage: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html',
    flow: ['外安全1の届出（未届の場合）','酸素供給装置等の設備を整備','様式を記載して厚生局へ郵送'],
  },

  '在歯管': {
    ryakusho: '（在歯管）',
    name: '在宅患者歯科治療時医療管理料',
    category: 'special',
    score: '在宅患者歯科治療時医療管理料：150点',
    summary: '訪問診療の患者で全身疾患を有する者に対して、全身状態を管理しながら歯科治療を行う場合に算定。',
    prereq: ['医管'],
    requirements: [
      '歯科治療時医療管理料（医管）の届出を行っていること',
      '訪問診療の実績があること',
      'パルスオキシメーター・酸素供給装置等の携行が可能な体制',
    ],
    note: '訪問診療を積極的に行っている診療所向け。医管の届出が前提となります。',
    yoshiki: [
      {label:'🔍 特掲診療料の届出一覧（関東信越厚生局）', url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html', keyword:'在歯管'},
    ],
    sourcePage: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html',
    flow: ['医管の届出（未届の場合）','訪問診療の開始','携行用の医療機器を準備','様式を記載して厚生局へ郵送'],
  },

  /* ════════════════════════════════
     特掲診療料 ─ 在宅・訪問
  ════════════════════════════════ */

  '歯訪診': {
    ryakusho: '（歯訪診）',
    name: '歯科訪問診療料の注13に規定する基準',
    category: 'special',
    score: '歯科訪問診療料（高い点数）が算定可能',
    summary: '訪問患者割合が95%未満の歯科診療所が届出することで、高い点数の歯科訪問診療料が算定できる。',
    prereq: ['歯初診'],
    requirements: [
      '歯初診の届出を行っていること',
      '直近1か月に訪問診療と外来診療を提供した患者のうち訪問患者の割合が95%未満',
    ],
    note: '訪問診療を開始した診療所が最初に届出する施設基準。在支歯より要件が少ない。',
    yoshiki: [
      {label:'🔍 特掲診療料の届出一覧（関東信越厚生局）', url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html', keyword:'歯訪診'},
    ],
    sourcePage: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html',
    flow: ['訪問診療を開始（患者割合95%未満を確認）','歯初診の届出（未届の場合）','届出書を記載して厚生局へ郵送'],
  },

  '在支歯': {
    ryakusho: '（歯援診１）（歯援診２）',
    name: '在宅療養支援歯科診療所1・2',
    category: 'basic',
    score: '歯科訪問診療料のより高い点数・各種加算が算定可能',
    summary: '在宅医療を積極的に担う歯科診療所として届出する施設基準。訪問診療の実績と連携体制が必要。毎年8月の定例報告が義務。',
    prereq: ['歯初診','外安全１','外感染１'],
    requirements: [
      '外安全1・外感染1の届出を行っていること',
      '過去1年間に歯科訪問診療料1・2を合計15回以上算定（在支歯1の場合）',
      '高齢者の心身の特性・口腔機能管理等に係る研修修了の常勤歯科医師が1名以上',
      '歯科衛生士が1名以上配置',
      '24時間対応できる連絡体制（担当歯科医の氏名・診療可能日等を文書提供）',
      '後方支援機能を有する別の医療機関との連携体制',
      '多職種連携（地域ケア会議等への年1回以上出席、または施設職員への技術的助言等）',
      '毎年8月に様式18の2で定例報告',
    ],
    note: '在支歯1と在支歯2では要件が異なります。訪問診療の実績を積んでから届出します。',
    yoshiki: [
      {label:'🔍 特掲診療料の届出一覧（関東信越厚生局）', url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html', keyword:'歯援診'},
    ],
    sourcePage: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html',
    flow: ['訪問診療の実績を積む（年15回以上）','高齢者対応研修を受講','連携体制を整備','届出書を記載して郵送','毎年8月に定例報告（様式18の2）'],
  },

  '歯地連': {
    ryakusho: '（歯地連）',
    name: '地域医療連携体制加算',
    category: 'special',
    score: '地域医療連携体制加算として算定',
    summary: '医科医療機関・他の歯科医療機関との連携体制を持つ診療所に算定できる加算。',
    prereq: ['在支歯'],
    requirements: [
      '在宅療養支援歯科診療所の届出を行っていること',
      '医科医療機関との連携体制があること',
      '他の歯科医療機関からの患者紹介を受ける体制があること',
    ],
    note: '在支歯の届出が前提となります。',
    yoshiki: [
      {label:'🔍 特掲診療料の届出一覧（関東信越厚生局）', url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html', keyword:'歯地連'},
    ],
    sourcePage: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html',
    flow: ['在支歯の届出（未届の場合）','医科・歯科連携体制を整備','届出書を記載して厚生局へ郵送'],
  },

  '在宅ＤＸ': {
    ryakusho: '（在宅ＤＸ）',
    name: '在宅医療DX情報活用加算（歯科訪問診療）',
    category: 'special',
    score: '歯科訪問診療料の注20に規定する在宅医療DX情報活用加算：10点',
    summary: '訪問診療時にマイナンバーカードを用いて医療情報を取得・活用する体制を評価する加算。',
    prereq: ['歯訪診','電子的歯科連携'],
    requirements: [
      '歯科訪問診療料の施設基準の届出を行っていること',
      '電子的歯科診療情報連携体制整備加算の届出を行っていること',
      '訪問診療時にオンライン資格確認等による情報取得・活用が可能な体制',
    ],
    note: '医療DX加算と訪問診療施設基準の両方が前提。令和6年度改定の新加算。',
    yoshiki: [
      {label:'🔍 特掲診療料の届出一覧（関東信越厚生局）', url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html', keyword:'在宅ＤＸ'},
    ],
    sourcePage: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html',
    flow: ['医療ＤＸ・歯訪診の届出（未届の場合）','訪問時のオンライン資格確認体制を整備','届出書を記載して厚生局へ郵送'],
  },

  /* ════════════════════════════════
     特掲診療料 ─ 検査
  ════════════════════════════════ */

  '咀嚼能力': {
    ryakusho: '（咀嚼能力）（咀嚼機能１）（咀嚼機能２）',
    name: '有床義歯咀嚼機能検査1・2（咀嚼能力検査含む）',
    category: 'special',
    score: '有床義歯咀嚼機能検査1イ：200点、1ロ：80点、2イ：60点',
    summary: '義歯の咀嚼機能を客観的に評価する検査の施設基準。義歯の効果判定や口腔機能低下症の診断に使用。',
    prereq: [],
    abolished: false,
    abolishNote: '⚠️【令和8年6月改定・要確認】咀嚼能力測定に係る施設基準が廃止され、算定要件（機器保有等）に変更された可能性があります。届出不要になる場合は本マスタから削除予定。告示内容を確認のこと。',
    requirements: [
      '歯科補綴治療に係る専門の知識及び3年以上の経験を有する歯科医師が1名以上',
      '【1のイ】歯科用下顎運動測定器（非接触型）を有すること',
      '【1のロ・咀嚼能力検査】咀嚼能率測定用グルコース分析装置を有すること',
      '【2のイ】咀嚼能力測定装置を有すること',
    ],
    note: '⚠️ 令和8年6月改定で施設基準届出が不要になる可能性あり。グルコース分析装置（ガムテスト用機器）は比較的安価。改定後の要件を厚生局告示で要確認。',
    yoshiki: [
      {label:'🔍 特掲診療料の届出一覧（関東信越厚生局）', url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html', keyword:'咀嚼'},
    ],
    sourcePage: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html',
    flow: ['測定機器を準備','3年以上の経験を有する歯科医師を確認','様式38の1の2を記載して厚生局へ郵送'],
  },

  '咬合圧': {
    ryakusho: '（咬合圧）',
    name: '有床義歯咀嚼機能検査2のロ及び咬合圧検査',
    category: 'special',
    score: '咬合圧検査：60点',
    summary: '令和8年度改定で施設基準の届出対象としては廃止されました。点数・算定項目そのものは残っており、算定要件を満たせば算定可能です。',
    prereq: [],
    abolished: true,
    facilityStandardAbolished: true,
    abolishNote: '令和8年度改定で施設基準届出は廃止され、届出様式の対象ではなくなりました。点数・算定項目は残るため、算定要件・経過措置は公式告示・通知で確認してください。',
    requirements: [
      '歯科補綴治療に係る専門の知識及び3年以上の経験を有する歯科医師が1名以上',
      '咬合圧測定用の歯科用咬合力計を有すること',
      '令和8年度以降は新規届出ではなく、算定要件を満たしているかを確認すること',
    ],
    note: '施設基準の届出対象としては廃止されましたが、検査そのものが算定不可になったわけではありません。届出書作成ではなく、公式告示・通知で算定要件を確認してください。',
    yoshiki: [
      {label:'🔍 特掲診療料の届出一覧（関東信越厚生局）', url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html', keyword:'咬合圧'},
    ],
    sourcePage: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html',
    flow: ['令和8年度の公式告示・通知を確認','咬合圧測定装置と経験要件を確認','届出様式ではなく算定要件・経過措置の扱いを確認'],
  },

  '口細菌': {
    ryakusho: '（口菌検）',
    name: '口腔細菌定量検査',
    category: 'special',
    score: '口腔細菌定量検査：130点',
    summary: '令和8年度改定で施設基準の届出対象としては廃止されました。点数・算定項目そのものは残っており、算定要件を満たせば算定可能です。',
    prereq: [],
    abolished: true,
    facilityStandardAbolished: true,
    abolishNote: '令和8年度改定で施設基準届出は廃止され、届出様式の対象ではなくなりました。点数・算定項目は残るため、算定要件・経過措置は公式告示・通知で確認してください。',
    requirements: [
      '口腔細菌定量分析装置（ルシパック等）を有すること（届出は不要）',
      '令和8年度以降は新規届出ではなく、算定要件を満たしているかを確認すること',
    ],
    note: '施設基準の届出対象としては廃止されましたが、検査そのものが算定不可になったわけではありません。届出書作成ではなく、公式告示・通知で算定要件を確認してください。',
    yoshiki: [
      {label:'🔍 特掲診療料の届出一覧（関東信越厚生局）', url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html', keyword:'口菌検'},
    ],
    sourcePage: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html',
    flow: ['令和8年度の公式告示・通知を確認','口腔細菌定量分析装置の保有状況を確認','届出様式ではなく算定要件・経過措置の扱いを確認'],
  },

  '歯画診': {
    ryakusho: '（歯画１）（歯画２）',
    name: '歯科画像診断管理加算1・2',
    category: 'special',
    score: '歯科画像診断管理加算1：50点、加算2：180点',
    summary: 'デジタル画像診断の管理体制を評価する加算。歯科用CTや口腔内カメラ等を用いた画像診断の質を担保する。',
    prereq: [],
    requirements: [
      '【加算1】画像診断を専ら担当する常勤の歯科医師が配置されていること',
      '【加算2】5年以上の経験を持ち専従する常勤歯科医師、デジタル画像診断装置の設置',
      '画像診断に関する記録・管理体制があること',
    ],
    note: '加算2は大病院・専門機関向け。一般診療所は加算1から検討。',
    yoshiki: [
      {label:'🔍 特掲診療料の届出一覧（関東信越厚生局）', url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html', keyword:'歯画'},
    ],
    sourcePage: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html',
    flow: ['担当歯科医師の確認','デジタル画像診断装置の整備','届出書を記載して厚生局へ郵送'],
  },

  /* ════════════════════════════════
     特掲診療料 ─ 補綴・技工
  ════════════════════════════════ */

  '歯ＣＡＤ': {
    ryakusho: '（歯ＣＡＤ）',
    name: 'CAD/CAM冠及びCAD/CAMインレー',
    category: 'special',
    score: '各種補綴物の保険算定が可能',
    summary: 'CAD/CAM装置を用いた歯冠補綴物の保険算定が可能になる届出。令和8年6月改定で全大臼歯（小臼歯含む全歯）へ拡大、材料区分が整理された。装置の届出番号等の記載が必要。',
    prereq: [],
    requirements: [
      '歯科補綴治療に係る専門の知識及び3年以上の経験を有する歯科医師が1名以上',
      'CAD/CAM装置（承認済み医療機器）を有すること、または連携歯科技工所が有すること',
      '使用するCAD/CAM装置の医療機器製造販売届出番号・製品名を届出書に記載',
    ],
    note: '院内に技工士がいない場合は連携技工所を通じた届出が可能。',
    yoshiki: [
      {label:'🔍 特掲診療料の届出一覧（関東信越厚生局）', url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html', keyword:'歯ＣＡＤ'},
    ],
    sourcePage: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html',
    flow: ['使用するCAD/CAM装置の情報を確認','届出書に装置情報を記載','厚生局へ郵送'],
  },

  '光印象': {
    ryakusho: '（光印象）',
    name: '光学印象・光学印象歯科技工士連携加算',
    category: 'special',
    score: '光学印象：各歯の印象採得料に代えて算定、連携加算：50点',
    summary: 'デジタル印象採得装置（口腔内スキャナー等）を用いてCAD/CAMインレー製作のための印象を行う施設基準。',
    prereq: ['歯ＣＡＤ'],
    requirements: [
      'CAD/CAM冠・CAD/CAMインレーの届出を行っていること',
      '歯科補綴治療に係る専門の知識及び3年以上の経験を有する歯科医師が1名以上',
      'デジタル印象採得装置（口腔内スキャナー等）を有すること',
      '【連携加算の場合】院内に歯科技工士が配置されていること',
    ],
    note: '口腔内スキャナーがあればCAD/CAMインレーの印象をデジタルで行える。精度向上と患者負担軽減が期待できます。',
    yoshiki: [
      {label:'🔍 特掲診療料の届出一覧（関東信越厚生局）', url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html', keyword:'光印象'},
    ],
    sourcePage: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html',
    flow: ['歯ＣＡＤの届出（未届の場合）','口腔内スキャナーを準備','院内技工士の配置（連携加算の場合）','届出書を記載して厚生局へ郵送'],
  },

  '歯技連１': {
    ryakusho: '（歯技連１）（歯技連２）',
    name: '歯科技工士連携加算1・2 および 光学印象歯科技工士連携加算',
    category: 'special',
    score: '歯科技工士連携加算1：60点、加算2：300点',
    summary: '院内に歯科技工士を配置し、義歯製作時に歯科医師と歯科技工士が協力する体制を評価する施設基準。',
    prereq: [],
    requirements: [
      '常勤の歯科技工士を配置（または非常勤で常勤相当の時間を確保）',
      '歯科技工室および歯科技工に必要な機器・施設を有すること',
      '患者の求めに応じて迅速に有床義歯の修理・床裏装を行う体制',
      '迅速に有床義歯の修理等を行う体制がある旨を院内掲示',
    ],
    note: '院内技工士を配置する診療所向け。加算2は義歯の口腔内調整等を行う場合に算定。',
    yoshiki: [
      {label:'🔍 特掲診療料の届出一覧（関東信越厚生局）', url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html', keyword:'歯技連'},
    ],
    sourcePage: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html',
    flow: ['歯科技工士を採用・配置','歯科技工室を整備','院内掲示を準備','届出書を記載して厚生局へ郵送'],
  },

  '歯技工': {
    ryakusho: '（歯技工）',
    name: '歯科技工加算1・2',
    category: 'special',
    score: '歯科技工加算1・2として算定',
    summary: '院内に歯科技工士を配置し、有床義歯を修理する体制を評価する施設基準。歯技連と異なり義歯修理に特化。',
    prereq: [],
    requirements: [
      '常勤の歯科技工士を配置していること',
      '歯科技工室および歯科技工に必要な機器・施設を有すること',
      '患者の求めに応じて迅速に有床義歯の修理・床裏装を行う体制',
      '院内掲示していること',
    ],
    note: '歯技連1と要件が重複する部分が多い。義歯患者が多い診療所向け。',
    yoshiki: [
      {label:'🔍 特掲診療料の届出一覧（関東信越厚生局）', url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html', keyword:'歯技工'},
    ],
    sourcePage: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html',
    flow: ['歯科技工士を採用・配置','歯科技工室を整備','院内掲示を準備','届出書を記載して厚生局へ郵送'],
  },

  '補管': {
    ryakusho: '（補管）',
    name: 'クラウン・ブリッジ維持管理料（補綴物維持管理料）',
    category: 'special',
    score: '補綴物の2年間維持管理が算定可能',
    summary: '歯冠補綴物（クラウン・ブリッジ）を装着した患者に対して2年間の維持管理を行うことを約束して届出する施設基準。',
    prereq: [],
    requirements: [
      '補綴物の維持管理を2年間行うことを院内掲示し、患者に説明する体制',
      '補綴物製作に関する記録を適切に保管していること',
    ],
    note: '要件が少なく届出しやすい施設基準。多くの歯科診療所で取得可能。',
    yoshiki: [
      {label:'🔍 特掲診療料の届出一覧（関東信越厚生局）', url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html', keyword:'補管'},
    ],
    sourcePage: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html',
    flow: ['院内掲示の準備','届出書を記載','厚生局へ郵送'],
  },

  /* ════════════════════════════════
     特掲診療料 ─ 外科・精密治療
  ════════════════════════════════ */

  '手顕微加': {
    ryakusho: '（手顕微加）',
    name: '手術用顕微鏡加算（根管治療）',
    category: 'special',
    score: '根管治療時の加算として算定',
    summary: '手術用顕微鏡を用いた根管治療に対する加算の施設基準。歯科用CTと顕微鏡を組み合わせて使用。',
    prereq: [],
    requirements: [
      '手術用顕微鏡を用いた治療に係る専門の知識及び3年以上の経験を有する歯科医師が1名以上',
      '手術用顕微鏡が設置されていること',
      '歯科用3次元エックス線断層撮影装置（歯科用CT）を有すること',
    ],
    note: '手術用顕微鏡と歯科用CT（CBCT）の両方が必要。保存科・根管治療に力を入れる診療所向け。',
    yoshiki: [
      {label:'🔍 特掲診療料の届出一覧（関東信越厚生局）', url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html', keyword:'手顕微加'},
    ],
    sourcePage: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html',
    flow: ['手術用顕微鏡・歯科用CTを設置','3年以上の経験を有する歯科医師を確認','届出書を記載して厚生局へ郵送'],
  },

  '根切顕微': {
    ryakusho: '（根切顕微）',
    name: '歯根端切除手術の注3（顕微鏡使用加算）',
    category: 'special',
    score: '歯根端切除手術の所定点数に加算',
    summary: '手術用顕微鏡を用いた歯根端切除手術を行う場合の加算施設基準。',
    prereq: ['手顕微加'],
    requirements: [
      '手術用顕微鏡加算の届出を行っていること',
      '歯科用3次元エックス線断層撮影装置（歯科用CT）を有すること',
      '手術用顕微鏡を有すること',
    ],
    note: '手顕微加の届出があれば追加要件は少ない。',
    yoshiki: [
      {label:'🔍 特掲診療料の届出一覧（関東信越厚生局）', url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html', keyword:'根切顕微'},
    ],
    sourcePage: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html',
    flow: ['手顕微加の届出（未届の場合）','届出書を記載して厚生局へ郵送'],
  },

  'ＧＴＲ': {
    ryakusho: '（ＧＴＲ）',
    name: '歯周組織再生誘導手術（GTR法）',
    category: 'special',
    score: 'GTR法（2,400点）',
    summary: '歯周組織再生誘導法（GTR）の施設基準。メンブレンを使用した歯周組織の再生治療を保険で行える。',
    prereq: [],
    requirements: [
      '歯周病治療に係る専門の知識及び3年以上の経験を有する歯科医師が1名以上',
    ],
    note: '歯周外科の経験がある歯科医師が必要。歯周病への再生療法で保険対応できる。',
    yoshiki: [
      {label:'🔍 特掲診療料の届出一覧（関東信越厚生局）', url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html', keyword:'ＧＴＲ'},
    ],
    sourcePage: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html',
    flow: ['3年以上の歯周病治療経験を有する歯科医師を確認','届出書を記載して厚生局へ郵送'],
  },

  '口腔粘膜': {
    ryakusho: '（口腔粘膜）',
    name: '口腔粘膜処置',
    category: 'special',
    score: '口腔粘膜処置：60点',
    summary: '口腔粘膜疾患（口内炎等）に対してレーザー等による処置を行う施設基準。',
    prereq: [],
    requirements: [
      '口腔粘膜処置を行うにつき十分な体制が整備されていること',
      '口腔内レーザー照射装置等を有すること',
    ],
    note: 'CO2レーザーやEr:YAGレーザー等が対象機器として使用される場合が多い。',
    yoshiki: [
      {label:'🔍 特掲診療料の届出一覧（関東信越厚生局）', url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html', keyword:'口腔粘膜'},
    ],
    sourcePage: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html',
    flow: ['レーザー機器を準備','届出書を記載して厚生局へ郵送'],
  },

  'う蝕無痛': {
    ryakusho: '（う蝕無痛）',
    name: 'う蝕歯無痛的窩洞形成加算',
    category: 'special',
    score: 'う蝕歯無痛的窩洞形成加算：60点',
    summary: 'レーザー照射または無痛的窩洞形成装置を用いてう蝕除去を行う場合の加算。',
    prereq: [],
    requirements: [
      '無痛的窩洞形成を行うにつき十分な体制が整備されていること',
      '無痛的窩洞形成装置（Er:YAGレーザー等）を有すること',
    ],
    note: 'Er:YAGレーザーが主に使用される。小児や歯科恐怖症の患者への低侵襲治療として有用。',
    yoshiki: [
      {label:'🔍 特掲診療料の届出一覧（関東信越厚生局）', url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html', keyword:'う蝕無痛'},
    ],
    sourcePage: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html',
    flow: ['無痛的窩洞形成装置を準備','届出書を記載して厚生局へ郵送'],
  },

  /* ════════════════════════════════
     特掲診療料 ─ 令和8年6月新設
  ════════════════════════════════ */

  '口腔機能実地': {
    ryakusho: '（口腔機能実地）',
    name: '口腔機能実地指導料',
    category: 'special',
    score: '口腔機能実地指導料：100点（月1回）',
    summary: '口腔機能管理を行う歯科診療所が届出する新設施設基準（令和8年6月新設）。口管強の前提要件となる。歯科衛生士による専門的口腔機能管理を評価。',
    prereq: ['歯初診'],
    isNew: true,
    newNote: '🆕【令和8年6月新設】旧「口腔機能管理体制」から新設された施設基準。口管強の届出に必要。',
    requirements: [
      '歯科医師1名以上・歯科衛生士1名以上が配置',
      '口腔機能管理を行うにつき十分な体制を有していること',
      '口腔機能実地指導を実施する歯科用ユニットが確保されていること',
      '院内掲示・ウェブサイト掲載',
    ],
    note: '令和8年6月改定で新設。口管強を算定している診療所が新たに届出が必要な施設基準。様式番号は厚生局告示で要確認。',
    yoshiki: [
      {label:'🔍 特掲診療料の届出一覧（関東信越厚生局）', url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html', keyword:'口腔機能実地'},
    ],
    sourcePage: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html',
    flow: ['口腔機能実地指導を実施するユニットを確保','歯科衛生士の配置確認','届出書を記載して厚生局へ郵送','口管強の届出（維持の場合は継続届出不要だが要件確認）'],
  },

  '三次元プリント義歯': {
    ryakusho: '（3次元プリント義歯）',
    name: '3次元プリント有床義歯',
    category: 'special',
    score: '3次元プリント有床義歯（1装置につき）：4,000点',
    summary: '3次元プリンター（CAD/CAM）を用いて製作した有床義歯の施設基準（令和8年6月新設）。高点数の新設補綴項目。',
    prereq: [],
    isNew: true,
    newNote: '🆕【令和8年6月新設】4,000点の高点数。3次元プリント技術を用いた有床義歯製作に係る施設基準。',
    requirements: [
      '3次元プリント有床義歯の製作に係る3次元歯科用CAD/CAMシステムを有していること',
      '3次元プリント有床義歯に関する適切な施設・設備を有すること',
      '当該義歯の製作に係る適切な技術を有する歯科医師または歯科技工士が配置されていること',
    ],
    note: '令和8年6月新設。4,000点と高点数。3次元CAD/CAM装置の整備が前提。届出様式は厚生局告示で確認のこと。',
    yoshiki: [
      {label:'🔍 特掲診療料の届出一覧（関東信越厚生局）', url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html', keyword:'3次元プリント'},
    ],
    sourcePage: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html',
    flow: ['3次元CAD/CAMシステムの導入','歯科技工士の配置確認','届出書を記載して厚生局へ郵送'],
  },

  '特別管理加算': {
    ryakusho: '（特別管理加算）',
    name: '特別管理加算（歯科疾患管理料）',
    category: 'special',
    score: '特別管理加算：要確認（厚生局告示で確認のこと）',
    summary: '歯科疾患管理料に係る特別管理加算として令和8年6月改定で新設された施設基準。詳細要件は厚生局告示で確認のこと。',
    prereq: [],
    isNew: true,
    newNote: '🆕【令和8年6月新設】歯科疾患管理料に関連する新設施設基準。',
    requirements: [
      '要件の詳細は厚生局告示・通知で確認のこと（令和8年6月施行）',
    ],
    note: '令和8年6月新設。届出様式・詳細要件は厚生局告示で要確認。',
    yoshiki: [
      {label:'🔍 特掲診療料の届出一覧（関東信越厚生局）', url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html', keyword:'特別管理加算'},
    ],
    sourcePage: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html',
    flow: ['要件を厚生局告示で確認','届出書を記載して厚生局へ郵送'],
  },

  '歯科麻酔': {
    ryakusho: '（歯科麻酔）',
    name: '歯科吸入麻酔 又は 歯科静脈麻酔（Ⅱ）',
    category: 'special',
    score: '要確認（厚生局告示で確認のこと）',
    summary: '歯科吸入麻酔または歯科静脈麻酔（Ⅱ）に係る令和8年6月改定で新設された施設基準。麻酔に関する専門的な体制が必要。',
    prereq: [],
    isNew: true,
    newNote: '🆕【令和8年6月新設】歯科麻酔に関する新設施設基準。',
    requirements: [
      '歯科麻酔に係る十分な体制が整備されていること',
      '要件の詳細は厚生局告示・通知で確認のこと（令和8年6月施行）',
    ],
    note: '令和8年6月新設。届出様式・詳細要件は厚生局告示で要確認。',
    yoshiki: [
      {label:'🔍 特掲診療料の届出一覧（関東信越厚生局）', url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html', keyword:'歯科麻酔'},
    ],
    sourcePage: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html',
    flow: ['麻酔体制の整備','要件を厚生局告示で確認','届出書を記載して厚生局へ郵送'],
  },

  '歯技工所ベースアップ': {
    ryakusho: '（歯技工所ベースアップ）',
    name: '歯科技工所ベースアップ支援料',
    category: 'other',
    score: '要確認（厚生局告示で確認のこと）',
    summary: '歯科技工所の技工士の賃金改善を支援するための令和8年6月改定で新設された施設基準。歯科技工所との連携体制が必要。',
    prereq: [],
    isNew: true,
    newNote: '🆕【令和8年6月新設】歯科技工所の技工士賃上げを支援する新設施設基準。',
    requirements: [
      '連携する歯科技工所の技工士の賃金改善を実施すること',
      '要件の詳細は厚生局告示・通知で確認のこと（令和8年6月施行）',
    ],
    note: '令和8年6月新設。院内技工士ではなく外部歯科技工所の賃上げ支援が目的。届出様式・詳細要件は厚生局告示で要確認。',
    yoshiki: [
      {label:'🔍 特掲診療料の届出一覧（関東信越厚生局）', url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html', keyword:'歯科技工所'},
    ],
    sourcePage: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html',
    flow: ['連携歯科技工所の賃上げ計画を確認','要件を厚生局告示で確認','届出書を記載して厚生局へ郵送'],
  },

  '電子的歯科連携': {
    ...ELECTRONIC_DENTAL_DX_MASTER,
  },

  '歯医DX1': {
    ...ELECTRONIC_DENTAL_DX_MASTER,
    ryakusho: '（歯医DX1）',
    score: '電子的歯科診療情報連携体制整備加算1: 初診時9点 / 再診時: 月1回2点',
  },

  '歯医DX2': {
    ...ELECTRONIC_DENTAL_DX_MASTER,
    ryakusho: '（歯医DX2）',
    score: '電子的歯科診療情報連携体制整備加算2: 初診時4点 / 再診時: 月1回2点',
  },

  /* ════════════════════════════════
     特掲診療料 ─ 賃上げ
  ════════════════════════════════ */

  '歯外在ベⅠ': {
    ryakusho: '（歯外在ベⅠ）',
    name: '歯科外来・在宅ベースアップ評価料（Ⅰ）',
    category: 'special',
    score: '初診時10点・再診時2点・歯科訪問診療時41点',
    summary: '対象職員（歯科衛生士・歯科技工士等）の賃金改善を実施している歯科診療所に算定できる加算。算定収入は全額賃上げに充てることが条件。',
    prereq: [],
    requirements: [
      '対象職員（歯科医師を除く医療従事者）が常勤換算で1名以上勤務',
      '賃金改善計画書を作成し、算定開始前月末までに専用メールアドレスへ添付送付',
      'ベースアップ評価料による算定収入を対象職員の賃上げに充てること',
      '毎年8月に賃金改善実績報告書（様式98）を厚生局へメール提出',
    ],
    note: '届出・計画書はいずれも専用メールアドレスへ添付送付（郵送不可）。計画書は算定開始前月末が期限。ファイル名に医療機関コードを含める必要あり。',
    yoshiki: [
      {label:'🔍 ベースアップ評価料の届出ページ（関東信越厚生局）', url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/baseup.html', keyword:'歯科外来'},
    ],
    sourcePage: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/baseup.html',
    flow: ['対象職員の賃上げ計画を作成','届出様式（Excel）をDLして記入','専用メールアドレスへExcelファイルを送付','受理後、翌月1日から算定','毎年6月に計画書・8月に実績報告書を提出'],
  },

  '歯外在ベⅠ注': {
    ryakusho: '（歯外在ベⅠ注）',
    name: '歯科外来・在宅ベースアップ評価料（Ⅰ）の注5',
    category: 'special',
    score: 'ベースアップ評価料の注加算',
    summary: '歯科外来・在宅ベースアップ評価料（Ⅰ）に係る注加算。専用Excel様式や実績報告書の確認が必要。',
    prereq: [],
    requirements: ['様式95を確認','様式98の対象有無を確認','提出方法・メール提出要否を公式ページで確認'],
    note: 'ベースアップ評価料は、専用Excel様式やメール提出が必要となる場合があります。提出方法・様式は公式ページで必ず確認してください。',
    yoshiki: [
      {label:'🔍 ベースアップ評価料の届出ページ（関東信越厚生局）', url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/baseup.html', keyword:'歯科外来'},
    ],
    sourcePage: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/baseup.html',
    flow: ['対象区分を確認','様式95・様式98を確認','専用Excel様式を作成','公式ページ記載の提出方法で届出'],
  },

  '歯外在ベⅡ': {
    ryakusho: '（歯外在ベⅡ）',
    name: '歯科外来・在宅ベースアップ評価料（Ⅱ）',
    category: 'special',
    score: '区分に応じたベースアップ評価料',
    summary: '歯科外来・在宅ベースアップ評価料（Ⅱ）に係る施設基準。令和8年度改定対応では再届出や専用Excel様式の確認が必要。',
    prereq: [],
    requirements: ['様式96を確認','賃金改善計画を作成','提出方法・メール提出要否を公式ページで確認'],
    note: 'ベースアップ評価料は、専用Excel様式やメール提出が必要となる場合があります。提出方法・様式は公式ページで必ず確認してください。',
    yoshiki: [
      {label:'🔍 ベースアップ評価料の届出ページ（関東信越厚生局）', url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/baseup.html', keyword:'歯科外来'},
    ],
    sourcePage: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/baseup.html',
    flow: ['対象区分を確認','様式96を確認','専用Excel様式を作成','公式ページ記載の提出方法で届出'],
  },

  '歯外在ベⅡ注': {
    ryakusho: '（歯外在ベⅡ注）',
    name: '歯科外来・在宅ベースアップ評価料（Ⅱ）の注5及び注6',
    category: 'special',
    score: 'ベースアップ評価料の注加算',
    summary: '歯科外来・在宅ベースアップ評価料（Ⅱ）に係る注加算。専用Excel様式や実績報告書の確認が必要。',
    prereq: [],
    requirements: ['様式96を確認','様式98の対象有無を確認','提出方法・メール提出要否を公式ページで確認'],
    note: 'ベースアップ評価料は、専用Excel様式やメール提出が必要となる場合があります。提出方法・様式は公式ページで必ず確認してください。',
    yoshiki: [
      {label:'🔍 ベースアップ評価料の届出ページ（関東信越厚生局）', url:'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/baseup.html', keyword:'歯科外来'},
    ],
    sourcePage: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/baseup.html',
    flow: ['対象区分を確認','様式96・様式98を確認','専用Excel様式を作成','公式ページ記載の提出方法で届出'],
  },

};

// カテゴリ順・表示グループ
const SHINKI_GROUPS = [
  { label:'🏥 基本診療料（歯科）', abbrs:['歯初診','外安全１','外安全２','外感染１','外感染２','歯情報通信','歯医DX1','歯医DX2'] },
  { label:'🏠 在宅・訪問診療', abbrs:['歯訪診','在支歯','歯地連','在宅ＤＸ'] },
  { label:'💊 管理料・全身管理', abbrs:['口管強','機安歯','医管','在歯管'] },
  { label:'🔬 検査・機能評価', abbrs:['咀嚼能力','歯画診'] },
  { label:'🦷 補綴・技工', abbrs:['歯ＣＡＤ','光印象','歯技連１','歯技工','補管'] },
  { label:'🔭 外科・精密治療', abbrs:['手顕微加','根切顕微','ＧＴＲ'] },
  { label:'💡 処置・その他', abbrs:['口腔粘膜','う蝕無痛'] },
  { label:'🆕 令和8年6月新設（施設基準）', abbrs:['口腔機能実地','三次元プリント義歯','特別管理加算','歯科麻酔','歯技工所ベースアップ'] },
  { label:'💰 賃上げ', abbrs:['歯外在ベⅠ','歯外在ベⅠ注','歯外在ベⅡ','歯外在ベⅡ注'] },
  { label:'🚫 令和8年で廃止・再編された施設基準', abbrs:['医療ＤＸ','咬合圧','口細菌'] },
];

let _shinkiSelected = null;
let _shinkiListScrollTop = 0;

function isFacilityStandardAbolished(def){
  return Boolean(def?.facilityStandardAbolished);
}

function isShinkiNewFacility(def){
  return Boolean(def?.isNew || def?.revisionStatus?.isNew || (Array.isArray(def?.statusBadges) && def.statusBadges.includes('new')));
}

function renderShinki(){
  const savedListScrollTop = _shinkiListScrollTop || 0;
  const alreadyHave = new Set(entries.map(e => e.abbr));
  if(alreadyHave.has('歯医DX1') || alreadyHave.has('歯医DX2')) alreadyHave.add('電子的歯科連携');

  let html = `
    <div id="shinki-layout" style="display:grid;grid-template-columns:240px 1fr;gap:16px;height:calc(100vh - 120px);overflow:hidden">
      <!-- 左：施設基準リスト -->
      <div id="shinki-list-col" style="overflow-y:auto;border:1px solid var(--border);border-radius:10px;background:var(--bg2)">
        <div style="padding:12px 14px;border-bottom:1px solid var(--border);font-size:12px;font-weight:700;color:var(--text2)">
          取得したい施設基準を選択
        </div>`;

  SHINKI_GROUPS.forEach(grp => {
    html += `<div style="padding:8px 14px 4px;font-size:11px;font-weight:700;color:var(--text3)">${grp.label}</div>`;
    grp.abbrs.forEach(abbr => {
      const def = SHINKI_MASTER[abbr];
      if(!def) return;
      const have = alreadyHave.has(abbr);
      const isSelected = _shinkiSelected === abbr;
      const facilityAbolished = isFacilityStandardAbolished(def);
      const isNewFacility = isShinkiNewFacility(def);
      html += `
        <div onclick="selectShinki('${abbr}')" style="
          padding:10px 14px;cursor:pointer;border-left:3px solid ${isSelected?'var(--accent)':'transparent'};
          background:${isSelected?'var(--blue-bg)':have?'var(--green-bg)':'transparent'};
          transition:all .12s;display:flex;align-items:center;justify-content:space-between;gap:6px"
          onmouseover="if('${abbr}'!==_shinkiSelected)this.style.background='var(--bg3)'"
          onmouseout="this.style.background='${isSelected?'var(--blue-bg)':have?'var(--green-bg)':'transparent'}'">
          <div>
            <div style="font-size:12px;font-weight:600;color:var(--text);display:flex;align-items:center;gap:5px;flex-wrap:wrap">
              <span>${abbr}</span>
              ${isNewFacility ? '<span class="shinki-new-badge">新</span>' : ''}
            </div>
            <div style="font-size:10px;color:var(--text3);margin-top:1px">${def.score.split('・')[0]}</div>
          </div>
          ${facilityAbolished
            ? '<span class="badge bpu" style="font-size:9px;flex-shrink:0">令和8年 施設基準廃止</span>'
            : have ? '<span class="badge bg" style="font-size:9px;flex-shrink:0">届出済</span>' : ''}
        </div>`;
    });
  });

  html += `</div>
      <!-- 右：詳細 -->
      <div id="shinki-detail" style="overflow-y:auto;min-height:0">
        <div class="empty" style="height:100%">
          <div class="ei">🆕</div>
          <p>左のリストから施設基準を選択すると<br>取得要件・届出様式・手順が表示されます</p>
        </div>
      </div>
    </div>`;

  document.getElementById('shinki-body').innerHTML = html;
  if(_shinkiSelected) showShinkiDetail(_shinkiSelected);
  requestAnimationFrame(()=>{
    const list=document.getElementById('shinki-list-col');
    if(list) list.scrollTop=savedListScrollTop;
  });
}

function selectShinki(abbr){
  const list=document.getElementById('shinki-list-col');
  if(list) _shinkiListScrollTop=list.scrollTop;
  _shinkiSelected = abbr;
  renderShinki();
}

function normalizeFacilityFormKey(abbr){
  return String(abbr||'')
    .replace(/１/g,'1')
    .replace(/２/g,'2')
    .replace(/３/g,'3')
    .replace(/４/g,'4')
    .replace(/５/g,'5')
    .trim();
}

function getFacilityFormLinkR08(abbr){
  if(typeof FACILITY_FORM_LINKS_R08 === 'undefined') return null;
  return FACILITY_FORM_LINKS_R08[abbr] || FACILITY_FORM_LINKS_R08[normalizeFacilityFormKey(abbr)] || null;
}

function renderOfficialFormButton(url,label,kind){
  if(!url) return '';
  const cls = kind === 'editable' ? 'facility-form-link editable' : kind === 'page' ? 'facility-form-link page' : kind === 'other' ? 'facility-form-link other' : 'facility-form-link pdf';
  return `<a class="${cls}" href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
}

function renderFacilityFormGroup(title,forms,kind){
  const buttons=forms
    .filter(f=>f?.url)
    .map(f=>renderOfficialFormButton(f.url, `${f.label}を開く`, kind))
    .join('');
  if(!buttons) return '';
  return `<div class="facility-form-group">
    <div class="facility-form-group-title">${title}</div>
    <div class="facility-form-actions">${buttons}</div>
  </div>`;
}

function renderFacilityFormSection(abbr, def){
  const link = getFacilityFormLinkR08(abbr) || {
    receiptCode: abbr,
    name: def?.name || abbr,
    officialCategory: def?.category === 'basic' ? 'basic' : 'tokukei',
    officialListUrl: getShinkiPrimaryPage(def),
    officialPageUrl: getShinkiPrimaryPage(def),
    officialItemNumber: '',
    noticeRef: '',
    searchKeywords: [abbr, def?.name].filter(Boolean),
    forms: [],
    note: 'この施設基準の直接様式リンクは未登録です。',
    missingReason: '公式ページ上の該当ファイルを確認してください。',
    lastChecked: ''
  };
  const forms = Array.isArray(link.forms) ? link.forms : [];
  const pdfForms = forms.filter(f=>f?.url && f.type === 'pdf');
  const editableForms = forms.filter(f=>f?.url && ['word','excel'].includes(f.type));
  const otherForms = forms.filter(f=>f?.url && !['pdf','word','excel'].includes(f.type));
  const hasDirect = forms.some(f=>f?.url);
  const officialPageUrl = link.officialListUrl || link.officialPageUrl || getShinkiPrimaryPage(def);
  const relatedPage = link.relatedPageUrl && link.relatedPageUrl !== officialPageUrl
    ? renderOfficialFormButton(link.relatedPageUrl, '関連公式ページで確認', 'page')
    : '';
  const formSummary = forms.length
    ? forms.map(f=>f.label.replace(/を開く$/,'')).join(' / ')
    : (link.missingReason || '公式一覧ページで確認');
  const searchKeywords = Array.isArray(link.searchKeywords) && link.searchKeywords.length
    ? link.searchKeywords.join('、')
    : [abbr, link.name].filter(Boolean).join('、');
  if(isFacilityStandardAbolished(def) || link.directFormStatus === 'abolished'){
    return `
    <div class="facility-form-section facility-form-section-abolished">
      <div class="facility-form-head">
        <div>
          <div class="facility-form-title">届出様式</div>
          <div class="facility-form-note">令和8年度改定で施設基準届出は廃止されました。新規届出用のPDF / Word / Excel様式ではなく、算定要件・経過措置を公式告示・通知で確認してください。</div>
        </div>
      </div>
      <div class="facility-form-meta">
        <div><span>届出区分</span><strong>特掲診療料</strong></div>
        <div><span>受理番号</span><strong>令和8年で届出対象外</strong></div>
        <div><span>通知</span><strong>公式告示・通知で確認</strong></div>
        <div><span>様式</span><strong>新規届出用様式なし</strong></div>
      </div>
      <div class="facility-form-caution">施設基準の届出対象としては廃止されましたが、点数・算定項目そのものは残っています。要件を満たせば算定可能なため、算定要件を公式情報で確認してください。</div>
      <div class="facility-form-group">
        <div class="facility-form-group-title">公式確認ページ</div>
        <div class="facility-form-actions">${renderOfficialFormButton(officialPageUrl, '令和8年度 特掲診療料の届出一覧で確認', 'page')}${relatedPage}</div>
      </div>
      <div class="facility-form-search">
        <strong>様式の探し方</strong>
        1. 令和8年度 特掲診療料の届出一覧または公式通知ページを開く<br>
        2. Ctrl + Fで「${searchKeywords}」を検索する<br>
        3. 届出様式ではなく、算定要件・経過措置・廃止項目の扱いを確認する
      </div>
    </div>`;
  }
  return `
    <div class="facility-form-section">
      <div class="facility-form-head">
        <div>
          <div class="facility-form-title">届出様式</div>
          <div class="facility-form-note">様式は関東信越厚生局の公式ファイルを開きます。掲載内容が変更される場合があるため、提出前には必ず公式一覧ページも確認してください。</div>
        </div>
      </div>
      <div class="facility-form-meta">
        <div><span>届出区分</span><strong>${link.officialCategory === 'basic' ? '基本診療料' : '特掲診療料'}</strong></div>
        <div><span>受理番号</span><strong>${link.receiptCode || abbr}</strong></div>
        <div><span>通知</span><strong>${link.noticeRef || '公式一覧ページで確認'}</strong></div>
        <div><span>様式</span><strong>${formSummary}</strong></div>
      </div>
      ${link.note ? `<div class="facility-form-caution">${link.note}</div>` : ''}
      ${hasDirect ? `
        ${renderFacilityFormGroup('PDFファイル',pdfForms,'pdf')}
        ${renderFacilityFormGroup('Word / Excelファイル',editableForms,'editable')}
        ${renderFacilityFormGroup('その他ファイル',otherForms,'other')}
      ` : `
        <div class="facility-form-empty">${link.missingReason || '公式ページ上に該当する直接様式ファイルが確認できませんでした。公式一覧ページで最新の掲載状況を確認してください。'}</div>
      `}
      <div class="facility-form-group">
        <div class="facility-form-group-title">公式一覧ページ</div>
        <div class="facility-form-actions">${renderOfficialFormButton(officialPageUrl, '公式一覧ページで確認', 'page')}${relatedPage}</div>
      </div>
      <div class="facility-form-search">
        <strong>様式の探し方</strong>
        公式一覧ページを開いたあと、Ctrl + Fで「${searchKeywords}」を検索してください。
      </div>
    </div>`;
}

function showShinkiDetail(abbr){
  const def = SHINKI_MASTER[abbr];
  if(!def) return;
  const alreadyHave = new Set(entries.map(e => e.abbr));
  if(alreadyHave.has('歯医DX1') || alreadyHave.has('歯医DX2')) alreadyHave.add('電子的歯科連携');
  const have = alreadyHave.has(abbr);
  const facilityAbolished = isFacilityStandardAbolished(def);
  const isNewFacility = isShinkiNewFacility(def);

  // 前提条件の充足確認
  const prereqStatus = def.prereq.map(p => ({
    abbr: p,
    name: SHINKI_MASTER[p]?.name || p,
    ok: alreadyHave.has(p)
  }));
  const allPrereqOk = prereqStatus.every(p => p.ok);
  const primaryPage = getShinkiPrimaryPage(def);
  const pastPage = getShinkiPastPage(def);
  const actionLinks = [
    { label: '施設基準に係る辞退届', url: SHINKI_OFFICIAL_LINKS.withdrawal },
    { label: '保険医療機関等電子申請・届出システム', url: SHINKI_OFFICIAL_LINKS.electronic },
    { label: '届出先（事務所・指導監査課）', url: SHINKI_OFFICIAL_LINKS.office }
  ];

  const el = document.getElementById('shinki-detail');
  if(!el) return;

  el.innerHTML = `
    <div style="padding:4px 0 16px">
      <!-- ヘッダー -->
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:18px 20px;margin-bottom:14px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div>
            <div style="font-size:11px;font-family:var(--mono);color:var(--text2);margin-bottom:4px">${abbr}</div>
            <div style="font-size:17px;font-weight:700;color:var(--text);margin-bottom:6px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span>${def.name}</span>
              ${isNewFacility ? '<span class="shinki-new-badge shinki-new-badge-lg">令和8年新設</span>' : ''}
            </div>
            <div style="font-size:12px;color:var(--text2)">${def.summary}</div>
            <div style="margin-top:8px;font-size:11px;color:var(--accent);font-weight:700">令和8年度改定モードを標準にしています</div>
          </div>
          ${facilityAbolished
            ? '<span class="badge bpu" style="font-size:11px;padding:5px 12px;flex-shrink:0">令和8年 施設基準廃止</span>'
            : have
              ? '<span class="badge bg" style="font-size:11px;padding:5px 12px;flex-shrink:0">✓ 届出済み</span>'
              : '<span class="badge by" style="font-size:11px;padding:5px 12px;flex-shrink:0">未届出</span>'}
        </div>
        ${def.scoreItems ? `
          <div style="margin-top:12px;padding:10px 12px;background:var(--blue-bg);border-radius:6px;font-size:12px;color:var(--accent);font-weight:600">
            <div style="margin-bottom:6px">💰 算定点数</div>
            ${def.scoreItems.map(item => `
              <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:4px 0;border-top:1px solid #bfdbfe">
                <span>${item.label}</span>
                <strong style="white-space:nowrap">${item.value}</strong>
              </div>
            `).join('')}
          </div>
        ` : `
          <div style="margin-top:12px;padding:8px 12px;background:var(--blue-bg);border-radius:6px;font-size:12px;color:var(--accent);font-weight:600">
            💰 算定点数：${def.score}
          </div>
        `}
      </div>

      ${prereqStatus.length > 0 ? `
      <!-- 前提条件 -->
      <div style="background:var(--bg2);border:1px solid ${allPrereqOk?'#a7f3d0':'#fde68a'};border-radius:10px;padding:16px 18px;margin-bottom:14px">
        <div style="font-size:13px;font-weight:700;margin-bottom:10px;color:var(--text)">
          📋 先に届出が必要な施設基準
        </div>
        ${prereqStatus.map(p => `
          <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
            <span style="font-size:16px">${p.ok ? '✅' : '⬜'}</span>
            <div style="flex:1">
              <span class="badge bb" style="font-size:10px;margin-right:6px">${p.abbr}</span>
              <span style="font-size:11px;color:var(--text2)">${p.name}</span>
            </div>
            ${p.ok
              ? '<span style="font-size:11px;color:var(--green);font-weight:600">届出済み ✓</span>'
              : `<button class="btn btn-ghost" style="font-size:10px;padding:3px 8px" onclick="selectShinki('${p.abbr}')">確認する</button>`
            }
          </div>`).join('')}
        ${!allPrereqOk ? `<div style="margin-top:10px;font-size:11px;color:var(--yellow);font-weight:600">⚠ 未届出の前提条件があります。先に上記の届出を行ってください。</div>` : ''}
      </div>` : ''}

      <!-- 取得要件 -->
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:16px 18px;margin-bottom:14px">
        <div style="font-size:13px;font-weight:700;margin-bottom:12px;color:var(--text)">${facilityAbolished ? '✅ 算定要件の確認' : '✅ 施設基準の取得要件'}</div>
        ${def.requirements.map((r,i) => `
          <div style="display:flex;align-items:flex-start;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
            <div style="background:var(--accent);color:#fff;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;margin-top:1px">${i+1}</div>
            <div style="font-size:12px;color:var(--text);line-height:1.7">${r}</div>
          </div>`).join('')}
        ${def.note ? `<div style="margin-top:10px;font-size:11px;color:var(--text2);background:var(--bg3);border-radius:5px;padding:8px 10px">💡 ${def.note}</div>` : ''}
        ${facilityAbolished && def.abolishNote ? `<div style="margin-top:10px;font-size:11px;color:#9a3412;background:#fff7ed;border:1px solid #fed7aa;border-radius:5px;padding:8px 10px">${def.abolishNote}</div>` : ''}
      </div>

      ${renderFacilityFormSection(abbr, def)}

      <!-- 関連手続きリンク -->
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:16px 18px;margin-bottom:14px">
        <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px">🔗 関連手続きリンク</div>
        <a href="${primaryPage}" target="_blank" rel="noopener noreferrer"
           style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--blue-bg);border:1px solid #bfdbfe;border-radius:8px;text-decoration:none;color:var(--accent);font-size:12px;font-weight:600;margin-bottom:8px">
          令和8年度 ${primaryPage.includes('kihon') ? '基本診療料' : '特掲診療料'}の届出一覧
          <span style="margin-left:auto;font-size:10px;flex-shrink:0">↗ 開く</span>
        </a>
        ${facilityAbolished ? '' : actionLinks.map(link => `
          <a href="${link.url}" target="_blank" rel="noopener noreferrer"
             style="display:flex;align-items:center;gap:8px;padding:9px 14px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;text-decoration:none;color:var(--text2);font-size:12px;font-weight:600;margin-bottom:8px">
            ${link.label}
            <span style="margin-left:auto;font-size:10px;flex-shrink:0">↗ 開く</span>
          </a>
        `).join('')}
        <details style="margin-top:4px">
          <summary style="cursor:pointer;font-size:11px;color:var(--text3);font-weight:700">過年度参照（令和6年度）</summary>
          <a href="${pastPage}" target="_blank" rel="noopener noreferrer"
             style="display:flex;align-items:center;gap:8px;padding:9px 14px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;text-decoration:none;color:var(--text2);font-size:12px;font-weight:600;margin-top:8px">
            令和6年度 ${pastPage.includes('kihon') ? '基本診療料' : '特掲診療料'}の届出一覧
            <span style="margin-left:auto;font-size:10px;flex-shrink:0">↗ 開く</span>
          </a>
        </details>
      </div>

      <!-- 届出の流れ -->
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:16px 18px;margin-bottom:14px">
        <div style="font-size:13px;font-weight:700;margin-bottom:12px;color:var(--text)">${facilityAbolished ? '📋 確認の流れ' : '📋 届出の流れ'}</div>
        ${def.flow.map((step,i) => `
          <div style="display:flex;align-items:flex-start;gap:10px;padding:6px 0${i<def.flow.length-1?';border-bottom:1px solid var(--border)':''}">
            <div style="background:${i===def.flow.length-1?'var(--green)':'var(--bg3)'};border:1px solid ${i===def.flow.length-1?'var(--green)':'var(--border2)'};color:${i===def.flow.length-1?'#fff':'var(--text2)'};border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0">
              ${i+1}
            </div>
            <div style="font-size:12px;color:var(--text);line-height:1.7;padding-top:2px">${step}</div>
          </div>`).join('')}
      </div>

      <!-- 届出後の注意 -->
      <div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:12px 14px;font-size:11px;color:var(--text2);line-height:1.8">
        ${facilityAbolished ? `
          <strong style="color:var(--text)">📮 届出不要化と算定確認</strong><br>
          令和8年度改定後は施設基準届出の対象ではありません。既存台帳に登録がある場合でも、この画面から自動削除・上書きは行いません。<br>
          点数・算定項目そのものは残っているため、装置や経験要件などの算定要件を満たしているか公式告示・通知で確認してください。
        ` : `
          <strong style="color:var(--text)">📮 届出方法と算定開始</strong><br>
          届出は管轄の地方厚生局事務所へ郵送が原則です（東京都の場合：関東信越厚生局東京事務所）。電子申請が可能な届出は「保険医療機関等電子申請・届出システム」を確認してください。<br>
          各月の末日までに受理された場合は翌月1日から算定可能（月の最初の開庁日に受理された場合は当月1日から）。<br>
          受理後、受理番号が通知されます。届出台帳に登録してください。
        `}
      </div>
    </div>`;
}

function renderDeadline(){
  const dl=[
    // ── 令和8年度 厚生局関連期限 ──
    {name:'令和8年度改定 施設基準 届出受付開始',date:'2026-05-07',cat:'厚生局',status:'green',note:'改定対応の新規・変更届出の受付開始日。様式は厚生局サイトで確認のこと。'},
    {name:'ベースアップ評価料 改定対応届出（5月31日送付・6月1日必着）',date:'2026-05-31',cat:'厚生局',status:'red',note:'5月31日までに送付し6月1日必着・受理で6月1日算定可。申請時に賃金改善計画書の添付不要。'},
    {name:'ベースアップ評価料 賃金改善計画書（令和8年度・6月算定開始なら5月末期限）',date:'2026-05-31',cat:'厚生局',status:'red',note:'算定開始前月末までに専用メールアドレスへ添付送付（郵送不可）。6月算定開始なら5月末が期限。未提出の場合は翌月から算定不可。'},
    {name:'令和8年度改定 施設基準 施行日',date:'2026-06-01',cat:'厚生局',status:'green',note:'令和8年6月1日から新点数・新施設基準が施行。新設項目の届出はこの日以降算定可。'},
    {name:'ベースアップ評価料 中間報告書（令和8年度新規算定施設のみ）',date:'2026-08-31',cat:'厚生局',status:'yellow',note:'令和8年度から新規に算定を開始した施設のみ対象。継続算定施設は実績報告書を提出。'},
    {name:'ベースアップ評価料 実績報告書（継続算定施設・令和7年度分）',date:'2026-08-31',cat:'厚生局',status:'yellow',note:'令和7年度以前から継続算定している施設は前年分実績報告書を提出。'},
    {name:'施設基準 定例報告（令和8年度・8月1日現在）',date:'2026-08-31',cat:'厚生局',status:'green',note:'在支歯（様式18の2）・ベースアップ（様式98）が対象。8月1日現在で自己点検し8月末までに提出。'},
  ].sort((a,b)=>new Date(a.date)-new Date(b.date));
  document.getElementById('deadline-body').innerHTML=`<div class="tw"><table>
    <thead><tr><th>届出・手続き名</th><th>提出先</th><th>期限</th><th>状態</th></tr></thead>
    <tbody>${dl.map(d=>`<tr>
      <td>
        <div class="kn">${d.name}</div>
        ${d.note?`<div style="font-size:10px;color:var(--text2);margin-top:3px">${d.note}</div>`:''}
      </td>
      <td><span class="badge bgr">${d.cat}</span></td>
      <td>${dlFmt(d.date)}</td>
      <td>${d.status==='red'?'<span class="badge br">要対応</span>':d.status==='yellow'?'<span class="badge by">準備中</span>':'<span class="badge bg">対応済</span>'}</td>
    </tr>`).join('')}</tbody></table></div>`;
}

/* ═══ CSV ═══ */
function exportCSV(){
  const h=['施設基準名','略称','受理番号','算定開始','カテゴリ','状態','改定影響','定例報告','メモ'];
  const rows=entries.map(e=>[e.name,e.abbr,e.number,e.date,CL[e.category],{green:'要件充足',yellow:'要確認',red:'要対応'}[e.status],{none:'変更なし',reapply:'再届出必要',check:'要件確認',grace:'経過措置中',expire:'廃止'}[e.kaitei],TEIREI_ROW[e.abbr]||'自己点検のみ',e.memo]);
  const csv=[h,...rows].map(r=>r.map(v=>`"${v||''}"`).join(',')).join('\n');
  const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'})),download:`施設基準台帳_${new Date().toISOString().slice(0,10)}.csv`});
  a.click();
}

/* ═══════════════════════════════════════════════
   PDF IMPORT — 修正版パーサー
   
   PDFの構造:
   [施設基準リスト] [日付リスト] [住所] [項番 医療機関番号 医療機関名]
   
   ※ 施設基準は「次の医療機関の番号の直前」にある
   ※ 番号の「前」のブロックを取得する必要がある
═══════════════════════════════════════════════ */
async function openImport(){
  if(window.ExcelImport && typeof ExcelImport.openOfficialDatasetModal === 'function'){
    await ExcelImport.openOfficialDatasetModal({ mode: 'initial' });
    return;
  }
  openManualPdfImport();
}
function openManualPdfImport(){
  resetImport();
  closeOverlay('official-dataset-overlay');
  document.getElementById('import-overlay').classList.add('open');
}
function resetImport(){
  pdfPages=[];pdfPageItems=[];parsedImport=[];
  window._parsedClinicName='';
  window._lastPdfSearchResult=null;
  document.getElementById('imp-step1').style.display='block';
  document.getElementById('imp-step2').style.display='none';
  document.getElementById('imp-step3').style.display='none';
  document.getElementById('imp-prog').style.display='none';
  document.getElementById('imp-exec-wrap').style.display='none';
  document.getElementById('imp-demo-btn').style.display='none';
  document.getElementById('clinic-found').classList.remove('show');
  document.getElementById('med-id').value='';
  document.getElementById('plog').innerHTML='';
  document.getElementById('prog-fill').style.width='0';
  setIS(1);
}

const dz=document.getElementById('drop-zone');
const pdfFileInput=document.getElementById('fi-pdf');
dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('over')});
dz.addEventListener('dragleave',()=>dz.classList.remove('over'));
dz.addEventListener('drop',e=>{
  e.preventDefault();
  dz.classList.remove('over');
  handleSelectedPdfFile(e.dataTransfer.files[0],'drop');
});

function openPdfFileDialog(){
  if(!pdfFileInput)return;
  pdfFileInput.value='';
  pdfFileInput.click();
}

function handleSelectedPdfFile(file, source='unknown') {
  if (!file) return;

  const isPdf =
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf');

  if (!isPdf) {
    alert('PDFファイルを選択してください');
    if(pdfFileInput) pdfFileInput.value='';
    return;
  }

  addLog(`PDF選択元: ${source}`,'i');
  processPdf(file);
  if(pdfFileInput) pdfFileInput.value='';
}

async function handlePdf(ev){
  handleSelectedPdfFile(ev.target.files[0],'file-picker');
}

async function processPdf(file){
  showProg();addLog(`ファイル: ${file.name} (${(file.size/1024).toFixed(0)}KB)`,'i');
  setProg(10,'PDF.jsで解析中...');
  try{
    const buf=await file.arrayBuffer();
    const pdf=await pdfjsLib.getDocument({data:buf}).promise;
    addLog(`総ページ数: ${pdf.numPages}ページ`,'i');
    pdfPages=[];
    pdfPageItems=[];
    for(let i=1;i<=pdf.numPages;i++){
      const pg=await pdf.getPage(i);
      const ct=await pg.getTextContent();
      pdfPageItems.push(ct.items.map(item => ({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width,
        height: item.height
      })));
      pdfPages.push(ct.items.map(x=>x.str).join(' '));
      setProg(Math.round(10+i/pdf.numPages*80),`ページ解析中 ${i}/${pdf.numPages}`);
    }
    setProg(95,'テキスト抽出完了');
    addLog(`${pdf.numPages}ページ 抽出完了`,'ok');
    addLog(`座標付きテキスト item を ${pdfPageItems.length}ページ分保存しました`,'i');
    setTimeout(()=>{setProg(100,'完了 ✓');addLog('医療機関番号を入力してください','ok');document.getElementById('imp-step2').style.display='block';setIS(2);document.getElementById('med-id').focus();},400);
  }catch(err){
    // fake workerのエラーは無視（処理は正常に継続される）
    if(String(err.message).includes('fake worker') || String(err.message).includes('blob')) return;
    addLog(`エラー: ${err.message}`,'e');
  }
}

function findFirstMatchIndex(fullText, patterns){
  for(const pattern of patterns){
    const idx=fullText.indexOf(pattern);
    if(idx!==-1)return{idx,pattern};
  }
  return null;
}

function findNextMedicalNumberMatch(text){
  const nextReg=/\d{1,5}\s+\d{2},\d{4},\d{1}|\d{2},\d{4},\d{1}/g;
  const m=nextReg.exec(text);
  if(!m)return null;
  return{
    raw:m[0],
    index:m.index,
    absoluteIndex:m.index,
    medicalNumber:(m[0].match(/\d{2},\d{4},\d{1}/)||[''])[0]
  };
}

function findStopTokenIndex(text){
  const stopTokens=['〒','届出受理医療機関名簿','全医療機関出力','作成','頁','（','医療機関所在地','所在地','電話番号','病床数','受理番号','算定開始年月日','備考'];
  let best=-1;
  stopTokens.forEach(token=>{
    const idx=text.indexOf(token);
    if(idx!==-1 && (best===-1 || idx<best))best=idx;
  });
  return best;
}

function extractClinicNameFromArea(nameArea){
  const detail={
    rawArea:nameArea,
    normalizedArea:'',
    failure:'',
    trimmedArea:''
  };
  if(!nameArea || !nameArea.trim()){
    detail.failure='対象医療機関番号の直後に医院名候補がありませんでした';
    return{ok:false,clinicName:'',detail};
  }

  const contaminatedReg=/\d{2},\d{4},\d{1}|\d{7}/;
  if(contaminatedReg.test(nameArea)){
    detail.failure='医院名候補に別の医療機関番号が混入しています';
    return{ok:false,clinicName:'',detail};
  }

  let normalized=nameArea
    .replace(/[\r\n\t]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
  detail.normalizedArea=normalized;

  const stopIdx=findStopTokenIndex(normalized);
  if(stopIdx!==-1)normalized=normalized.slice(0,stopIdx).trim();

  normalized=normalized.replace(/^(?:項番\s*)?/, '').trim();
  normalized=normalized.replace(/([\u3040-\u30ff\u3400-\u9fff])\s+(?=[\u3040-\u30ff\u3400-\u9fff])/g,'$1');
  normalized=normalized.replace(/\s+/g,' ').trim();
  detail.trimmedArea=normalized;

  if(!normalized){
    detail.failure='医院名候補が空になりました';
    return{ok:false,clinicName:'',detail};
  }
  if(contaminatedReg.test(normalized)){
    detail.failure='医院名候補に別の医療機関番号が含まれています';
    return{ok:false,clinicName:'',detail};
  }

  const nameMatch=normalized.match(/^(.+?)(?=\s*$)/);
  const clinicName=nameMatch?nameMatch[1].trim():'';
  if(!clinicName){
    detail.failure='医院名を抽出できませんでした';
    return{ok:false,clinicName:'',detail};
  }
  if(contaminatedReg.test(clinicName)){
    detail.failure='抽出した医院名に医療機関番号が混入しています';
    return{ok:false,clinicName:'',detail};
  }

  return{ok:true,clinicName,detail};
}

function findClinicByMedicalCode(fullText, rawCode){
  const patterns=buildPatterns(rawCode);
  const hit=findFirstMatchIndex(fullText, patterns);
  if(!hit){
    return{
      ok:false,
      rawCode,
      patterns,
      failure:'番号が見つかりませんでした'
    };
  }

  const targetIdx=hit.idx;
  const usedPattern=hit.pattern;
  const targetEnd=targetIdx+usedPattern.length;
  const trailingText=fullText.slice(targetEnd);
  const nextMatchLocal=findNextMedicalNumberMatch(trailingText);
  const nextMatch=nextMatchLocal
    ? {...nextMatchLocal, absoluteIndex:targetEnd+nextMatchLocal.index}
    : null;
  const nameArea=nextMatch
    ? fullText.slice(targetEnd, nextMatch.absoluteIndex)
    : fullText.slice(targetEnd, Math.min(fullText.length, targetEnd+300));
  const extracted=extractClinicNameFromArea(nameArea);
  const matchedMedicalNumber=(usedPattern.match(/\d{2},\d{4},\d{1}/)||[])[0]||usedPattern;

  if(!extracted.ok){
    return{
      ok:false,
      rawCode,
      patterns,
      targetIdx,
      targetEnd,
      usedPattern,
      matchedMedicalNumber,
      nextMatch,
      nameArea,
      failure:extracted.detail.failure,
      detail:extracted.detail
    };
  }

  return{
    ok:true,
    rawCode,
    patterns,
    targetIdx,
    targetEnd,
    usedPattern,
    matchedMedicalNumber,
    nextMatch,
    nameArea,
    clinicName:extracted.clinicName,
    detail:extracted.detail
  };
}

function showImportClinicResult(result, count){
  document.getElementById('cf-name').textContent=result.clinicName;
  document.getElementById('cf-name').style.color='var(--text)';
  document.getElementById('cf-detail').textContent=`入力番号: ${result.rawCode}　|　一致番号: ${result.matchedMedicalNumber}　|　抽出名: ${result.clinicName}　|　施設基準: ${count}件`;
  document.getElementById('clinic-found').classList.add('show');
}

function stopPdfSearchWithError(message, detailLines=[]){
  window._parsedClinicName='';
  window._lastPdfSearchResult=null;
  parsedImport=[];
  document.getElementById('imp-step3').style.display='none';
  document.getElementById('imp-exec-wrap').style.display='none';
  document.getElementById('clinic-found').classList.remove('show');
  addLog(message,'e');
  detailLines.filter(Boolean).forEach(line=>addLog(line,'w'));
  alert(message);
}

function doSearch(){
  const raw=document.getElementById('med-id').value.trim();
  if(!raw){alert('番号を入力してください');return;}
  if(!pdfPages.length){alert('先にPDFを読み込んでください');return;}

  const fullText=pdfPages.join('\n');
  const patterns=buildPatterns(raw);
  addLog(`検索パターン: ${patterns.join(' / ')}`,'i');

  // ─── PDFテキスト構造の解説 ───
  // このPDFをPDF.jsで抽出すると、各医療機関のデータは以下の順で出現する:
  //
  // [ページヘッダー]
  // （施設基準A）第XXXXX号（施設基準B）第XXXXX号...  ← N番目の施設基準リスト
  // 令和X年Y月Z日 令和X年Y月Z日...                   ← N番目の日付リスト
  // 〒XXX-XXXX 住所 電話番号
  // N 医療機関番号 医療機関名                          ← N番目の番号・名称
  // （施設基準A）第XXXXX号...                          ← N+1番目の施設基準リスト ← 自院番号の直後！
  // ...
  // 〒XXX-XXXX 住所
  // N+1 [自院の医療機関番号] 自院名称                  ← 自院番号
  // （施設基準A）第XXXXX号...                          ← N+2番目（次の医療機関）
  //
  // つまり: 自院番号(N+1)を見つけたら、
  //         直前の医療機関番号(N)の直後〜自院番号(N+1)直前が自院の施設基準ブロック

  // デバッグ: 実際に試したパターンを表示
  addLog(`試行したパターン: ${patterns.join(' / ')}`,'i');
  addLog(`全文字数: ${fullText.length}文字`,'i');
  // 最初の200文字を表示（PDFの構造確認用）
  if(fullText.length > 0){
    addLog(`PDF冒頭: "${fullText.slice(0,100).replace(/\n/g,' ')}"`,'i');
  }

  const clinicResult=findClinicByMedicalCode(fullText, raw);
  if(!clinicResult.ok){
    if(clinicResult.failure!=='番号が見つかりませんでした'){
      stopPdfSearchWithError(
        '医院名の抽出に失敗しました。PDFの表構造が想定と異なる可能性があります',
        [
          `入力番号: ${raw}`,
          `一致番号: ${clinicResult.matchedMedicalNumber||'—'}`,
          `原因: ${clinicResult.failure||'不明'}`,
        ]
      );
      return;
    }
    addLog(`番号 ${raw} が見つかりませんでした`,'e');
    addLog('※ 関東信越厚生局サイトからダウンロードした東京都の歯科PDFかご確認ください','w');
    document.getElementById('imp-demo-btn').style.display='inline-flex';
    alert('番号が見つかりませんでした。\n\n【ご確認ください】\n・関東信越厚生局サイトからダウンロードした\n　「東京都 ＞ 歯科」のPDFですか？\n・医療機関番号は7桁で正しく入力されていますか？\n\n※「デモデータで試す」ボタンで動作確認できます。');
    return;
  }
  const targetIdx=clinicResult.targetIdx;
  const usedPattern=clinicResult.usedPattern;
  addLog(`発見: 位置=${targetIdx}, パターン="${usedPattern}"`,'ok');
  addLog(`一致した医療機関番号: ${clinicResult.matchedMedicalNumber}`,'ok');
  addLog(`抽出された医療機関名: ${clinicResult.clinicName}`,'ok');
  if(clinicResult.nextMatch){
    addLog(`次の医療機関番号境界: ${clinicResult.nextMatch.raw}`,'i');
  }else{
    addLog('次の医療機関番号は見つからなかったため、末尾側の限定範囲で判定しました','w');
  }

  // Step2: 自院番号の直前テキストで「直前の医療機関番号」を探す
  // 医療機関番号のパターン: 数字2桁,数字4桁,数字1桁 または 7桁連続
  const beforeTarget=fullText.slice(0, targetIdx);
  const medNumReg=/\d{2},\d{4},\d{1}/g;
  const prevNums=[...beforeTarget.matchAll(medNumReg)];

  let blockStart=0;
  if(prevNums.length>0){
    // 直前の医療機関番号の位置+その番号の長さ = ブロック開始
    const lastMatch=prevNums[prevNums.length-1];
    blockStart=lastMatch.index+lastMatch[0].length;
    addLog(`直前の番号: "${lastMatch[0]}" (位置=${lastMatch.index})`,'i');
  } else {
    // 見つからない場合は郵便番号で境界を探す
    const zipReg=/〒\d{3}[－\-]\d{4}/g;
    const zips=[...beforeTarget.matchAll(zipReg)];
    if(zips.length>0){
      blockStart=zips[zips.length-1].index;
      addLog(`郵便番号境界を使用: 位置=${blockStart}`,'i');
    } else {
      blockStart=Math.max(0,targetIdx-3000);
      addLog(`境界未検出 - 直前3000文字を使用`,'w');
    }
  }

  const kijunBlock=fullText.slice(blockStart, targetIdx);
  addLog(`抽出ブロック: ${kijunBlock.length}文字`,'i');
  addLog(`ブロック冒頭: "${kijunBlock.slice(0,80).replace(/\n/g,' ')}"`,'i');
  addLog(`医院名判定範囲: "${clinicResult.nameArea.slice(0,120).replace(/\n/g,'↵')}"`,'i');
  window._parsedClinicName = clinicResult.clinicName;
  window._lastPdfSearchResult = clinicResult;

  // Step4: 施設基準を解析
  parsedImport=parseKijunBlock(kijunBlock);
  addLog(`${parsedImport.length}件の施設基準を抽出`,'ok');

  if(parsedImport.length===0){
    addLog('施設基準が0件でした。ブロック境界を調整して再試行します...','w');
    // フォールバック: ブロックを広げて再試行
    const widerBlock=fullText.slice(Math.max(0,blockStart-500), targetIdx);
    parsedImport=parseKijunBlock(widerBlock);
    addLog(`拡張再試行: ${parsedImport.length}件`,'w');
  }

  if(parsedImport.length===0){
    stopPdfSearchWithError(
      '施設基準データが取得できませんでした。誤った医院を表示せず処理を停止しました。',
      [
        `入力番号: ${clinicResult.rawCode}`,
        `一致番号: ${clinicResult.matchedMedicalNumber}`,
        `抽出名: ${clinicResult.clinicName}`,
        'PDFの形式が想定と異なるか、対象PDFではない可能性があります。'
      ]
    );
    document.getElementById('imp-demo-btn').style.display='inline-flex';
    return;
  }

  showImportClinicResult(clinicResult, parsedImport.length);
  renderImportResult();
  document.getElementById('imp-step3').style.display='block';
  document.getElementById('imp-exec-wrap').style.display='flex';
  document.getElementById('imp-count').textContent=parsedImport.length;
  setIS(3);
}

function buildPatterns(id){
  // 7桁 "3441680" → PDF内の表記パターンを複数生成
  const p=[];
  p.push(id); // そのまま
  if(id.length===7){
    // XX,XXXX,X 形式
    p.push(`${id.slice(0,2)},${id.slice(2,6)},${id.slice(6)}`);
    // スペース区切り
    p.push(`${id.slice(0,2)} ${id.slice(2,6)} ${id.slice(6)}`);
  }
  // 先頭ゼロ除去など
  if(id.startsWith('0') && id.length===7){
    const noZ=id.slice(1);
    p.push(noZ);
    p.push(`${noZ.slice(0,1)},${noZ.slice(1,5)},${noZ.slice(5)}`);
  }
  return p;
}

function parseKijunBlock(block){
  // 施設基準: （略称）第NNNNNN号 のパターン
  // 略称は全角・半角混在、1〜15文字
  const kReg=/（([^）\n]{1,15})）第(\d{2,7})号/g;
  // 日付: 元号+年月日（スペースあり・なし両対応）
  const dReg=/(令和|平成|昭和)\s{0,2}(\d{1,2})\s{0,2}年\s{0,2}(\d{1,2})\s{0,2}月\s{0,2}(\d{1,2})\s{0,2}日/g;

  const km=[...block.matchAll(kReg)];
  const dm=[...block.matchAll(dReg)];

  addLog(`  施設基準パターン: ${km.length}件, 日付パターン: ${dm.length}件`,'i');

  return km.map((m,i)=>{
    const abbr=m[1].trim();
    const num=`第${m[2]}号`;
    const master=KM[abbr];
    let date='';
    if(dm[i]){
      const[,era,y,mo,da]=dm[i];
      const ad=era==='令和'?+y+2018:era==='平成'?+y+1988:+y+1925;
      date=`${ad}-${String(mo).padStart(2,'0')}-${String(da).padStart(2,'0')}`;
    }
    const needsReport=['在支歯','歯外在ベⅠ','歯外在ベⅡ'];
    // ── 令和8年6月改定 自動影響判定マップ ──────────────────────────
    const KAITEI_DEFAULT = {
      // 🔴 再届出必要
      '歯外在ベⅠ':  { kaitei:'reapply', status:'red',    memo:'令和8年改定で施設基準届出が必要（5月7日受付開始・5月31日送付期限（6月1日必着））。賃金改善計画書は算定開始前月末までに専用メールアドレスへ添付送付（6月算定開始なら5月末が期限）。8月報告は継続施設＝前年分実績報告、新規施設＝中間報告。' },
      '歯外在ベⅡ':  { kaitei:'reapply', status:'red',    memo:'令和8年改定で施設基準届出が必要（5月7日受付開始・5月31日送付期限（6月1日必着））。賃金改善計画書は算定開始前月末までに専用メールアドレスへ添付送付（6月算定開始なら5月末が期限）。8月報告は継続施設＝前年分実績報告、新規施設＝中間報告。' },
      // 🟡 要件確認必要
      '口管強':      { kaitei:'check',   status:'yellow', memo:'口腔機能実地指導料（令和8年6月新設）との関係要確認。要件への影響は厚生局告示で確認のこと。' },
      '歯ＣＡＤ':   { kaitei:'check',   status:'yellow', memo:'令和8年6月改定で全大臼歯に拡大・材料区分変更。様式変更の有無を厚生局に確認のこと。' },
      '医療ＤＸ':   { kaitei:'expire',  status:'red',    memo:'令和8年6月改定で廃止・再編。後継は「電子的歯科診療情報連携体制整備加算」（新設）。既届出施設は厚生局の案内に従い対応要確認。' },
      '咀嚼能力':   { kaitei:'check',   status:'yellow', memo:'令和8年6月改定で施設基準が廃止→算定要件化の可能性あり。届出不要になる場合は辞退届不要。厚生局告示を要確認。' },
      '咬合圧':     { kaitei:'check',   status:'yellow', memo:'令和8年6月改定で施設基準が廃止→算定要件化の可能性あり。届出不要になる場合は辞退届不要。厚生局告示を要確認。' },
      '外安全１':   { kaitei:'check',   status:'yellow', memo:'令和8年改定で様式変更あり。要件充足を再確認のこと。' },
      '外感染１':   { kaitei:'check',   status:'yellow', memo:'令和8年改定で要件変更あり。院内感染管理者配置等を再確認のこと。' },
      // 🔵 経過措置中
      '歯初診':     { kaitei:'grace',   status:'yellow', memo:'令和8年改定で様式27の定例報告が廃止。施設基準自体は継続。' },
      // ❌ 廃止・統合
      '口細菌':     { kaitei:'check',   status:'yellow', memo:'令和8年6月改定で施設基準の届出が不要になりました。廃止届は不要。装置があれば引き続き算定可能です。' },
    };
    // ─────────────────────────────────────────────────────────────
    const kd = KAITEI_DEFAULT[abbr] || { kaitei:'none', status:'green', memo:'' };
    return{id:Date.now()+i,name:master?master.n:`施設基準（${abbr}）`,abbr,number:num,date,category:master?master.c:'other',status:kd.status,kaitei:kd.kaitei,nextCheck:needsReport.includes(abbr)?'2025-08-29':'',memo:kd.memo,isKnown:!!master};
  });
}

function renderImportResult(){
  const known=parsedImport.filter(e=>e.isKnown).length;
  document.getElementById('imp-chips').innerHTML=`<span class="chip chip-b">合計 ${parsedImport.length}件</span><span class="chip chip-g">認識済 ${known}件</span>${parsedImport.length-known>0?`<span class="chip chip-y">未登録略称 ${parsedImport.length-known}件</span>`:''}`;
  document.getElementById('imp-tbody').innerHTML=parsedImport.map(e=>`<tr>
    <td><div class="kn" style="font-size:11px">${e.name}${!e.isKnown?'<span style="color:var(--yellow);font-size:10px;margin-left:6px">⚠未登録</span>':''}</div></td>
    <td><span class="badge bb">${e.abbr}</span></td>
    <td><span class="mono">${e.number}</span></td>
    <td><span class="mono">${e.date||'—'}</span></td>
    <td><span class="badge bgr">${CL[e.category]}</span></td>
  </tr>`).join('');
}

function loadDemoData(){
  // デモデータもKAITEI_DEFAULTで自動影響判定
  const KAITEI_DEFAULT_DEMO = {
    '歯外在ベⅠ':  { kaitei:'reapply', status:'red',    memo:'令和8年改定で施設基準届出が必要（5月7日受付開始・5月31日送付期限（6月1日必着））。賃金改善計画書は算定開始前月末までに専用メールアドレスへ添付送付（6月算定開始なら5月末が期限）。8月報告は継続施設＝前年分実績報告、新規施設＝中間報告。' },
    '口管強':      { kaitei:'check',   status:'yellow', memo:'口腔機能実地指導料（令和8年6月新設）との関係要確認。要件への影響は厚生局告示で確認のこと。' },
    '歯ＣＡＤ':   { kaitei:'check',   status:'yellow', memo:'令和8年6月改定で全大臼歯に拡大・材料区分変更。様式変更の有無を厚生局に確認のこと。' },
    '医療ＤＸ':   { kaitei:'expire',  status:'red',    memo:'令和8年6月改定で廃止・再編。後継は「電子的歯科診療情報連携体制整備加算」（新設）。既届出施設は厚生局の案内に従い対応要確認。' },
    '外安全１':   { kaitei:'check',   status:'yellow', memo:'令和8年改定で様式変更あり。要件充足を再確認のこと。' },
    '外感染１':   { kaitei:'check',   status:'yellow', memo:'令和8年改定で要件変更あり。院内感染管理者配置等を再確認のこと。' },
    '歯初診':     { kaitei:'grace',   status:'yellow', memo:'令和8年改定で様式27の定例報告が廃止。施設基準自体は継続。' },
    '口細菌':     { kaitei:'check',   status:'yellow', memo:'令和8年6月改定で施設基準の届出が不要になりました。廃止届は不要。装置があれば引き続き算定可能です。' },
  };
  const dk = (abbr) => KAITEI_DEFAULT_DEMO[abbr] || { kaitei:'none', status:'green', memo:'' };
  parsedImport=[
    {id:Date.now()+1,name:'歯科点数表の初診料の注1（院内感染防止対策）',abbr:'歯初診',number:'第305505号',date:'2018-06-01',category:'basic',...dk('歯初診'),nextCheck:'',isKnown:true},
    {id:Date.now()+2,name:'歯科外来診療医療安全対策加算1（外安全1）',abbr:'外安全１',number:'第615983号',date:'2024-10-01',category:'basic',...dk('外安全１'),nextCheck:'',isKnown:true},
    {id:Date.now()+3,name:'歯科外来診療感染対策加算1（外感染1）',abbr:'外感染１',number:'第615982号',date:'2024-10-01',category:'basic',...dk('外感染１'),nextCheck:'',isKnown:true},
    {id:Date.now()+4,name:'CAD/CAM冠・CAD/CAMインレー',abbr:'歯ＣＡＤ',number:'第268552号',date:'2015-04-01',category:'special',...dk('歯ＣＡＤ'),nextCheck:'',isKnown:true},
    {id:Date.now()+5,name:'医療DX推進体制整備加算',abbr:'医療ＤＸ',number:'第610058号',date:'2024-07-01',category:'basic',...dk('医療ＤＸ'),nextCheck:'',isKnown:true},
    {id:Date.now()+6,name:'補綴物維持管理料',abbr:'補管',number:'第6617号',date:'1996-04-01',category:'other',...dk('補管'),nextCheck:'',isKnown:true},
  ];
  document.getElementById('cf-name').textContent='〇〇歯科医院（デモデータ）';
  document.getElementById('cf-detail').textContent=`デモデータ | ${parsedImport.length}件`;
  document.getElementById('clinic-found').classList.add('show');
  renderImportResult();
  document.getElementById('imp-step3').style.display='block';
  document.getElementById('imp-exec-wrap').style.display='flex';
  document.getElementById('imp-count').textContent=parsedImport.length;
  setIS(3);
}

function testPdfImportCases(){
  if(!pdfPages.length){
    addLog('testPdfImportCases: 先にPDFを読み込んでください','w');
    return[];
  }
  const fullText=pdfPages.join('\n');
  const cases=[
    {code:'3440435', expect:'山本歯科医院', reject:'国立市歯科医師会さくら休日歯科診療所'},
    {code:'3440609', expect:'松田歯科医院', reject:'ナカゾエ歯科'},
    {code:'3440583', expect:'国立市歯科医師会さくら休日歯科診療所'},
    {code:'3440666', expect:'ナカゾエ歯科'},
  ];
  const results=cases.map(testCase=>{
    const result=findClinicByMedicalCode(fullText, testCase.code);
    const pass=!!result.ok
      && result.clinicName===testCase.expect
      && (!testCase.reject || result.clinicName!==testCase.reject);
    return{
      code:testCase.code,
      expected:testCase.expect,
      actual:result.clinicName||'',
      matchedMedicalNumber:result.matchedMedicalNumber||'',
      pass,
      failure:result.failure||''
    };
  });
  const passed=results.filter(r=>r.pass).length;
  addLog(`testPdfImportCases: ${passed}/${results.length}件 合格`,'i');
  console.table(results);
  return results;
}

function doImport(mode){
  if(!parsedImport.length)return;
  let count=0;
  if(mode==='replace'){
    parsedImport.forEach((e,i)=>{e.id=i+1;});
    entries=[...parsedImport];
    count=parsedImport.length;
  } else {
    const existing=new Set(entries.map(e=>e.abbr));
    const newItems=parsedImport.filter(e=>!existing.has(e.abbr));
    const maxId=entries.length?Math.max(...entries.map(e=>e.id||0)):0;
    newItems.forEach((e,i)=>{e.id=maxId+i+1;});
    entries.push(...newItems);
    count=newItems.length;
  }
  save();render();

  // PDFから取得した医療機関名を確認・保存
  const parsedName = window._parsedClinicName || '';
  if(parsedName && parsedName.length > 1){
    // 取得した名前を必ず表示して確認させる（医療機関番号の入力ミス検知にも使える）
    const currentName = localStorage.getItem('clinic_name') || '';
    const msg = `PDFから取得した医院名：\n\n「${parsedName}」\n\n` +
      (currentName && currentName !== '○○歯科医院'
        ? `現在の設定：「${currentName}」\n\n` : '') +
      `この名前で医院名を設定しますか？\n（「キャンセル」を押すと現在の設定を維持します）`;
    // スマホのconfirm()非対応に備えてモーダル方式に変更
    showClinicNameConfirm(parsedName);
  } else {
    // 名前が取得できなかった場合もモーダルで通知
    showInfoModal('医院名を自動取得できませんでした', 'インポート後、右上の医院名をクリックして手動で入力してください。');
  }

  closeOverlay('import-overlay');resetImport();
  document.getElementById('suc-n').textContent=count;
  document.getElementById('success-fl').classList.add('show');
  setIS(4,true);
}

function showProg(){document.getElementById('imp-prog').style.display='block';}
function setProg(pct,label){
  document.getElementById('prog-fill').style.width=pct+'%';
  document.getElementById('prog-pct').textContent=pct+'%';
  if(label)document.getElementById('prog-label').textContent=label;
}
function addLog(msg,type='i'){
  if(String(msg).includes('fake worker')||String(msg).includes('Setting up')||String(msg).includes('blob-request')) return;
  const log=document.getElementById('plog');
  const d=document.createElement('div');
  d.className=type;d.textContent=`[${new Date().toLocaleTimeString('ja',{hour12:false})}] ${msg}`;
  log.appendChild(d);log.scrollTop=log.scrollHeight;showProg();
}
function setIS(n,done=false){
  for(let i=1;i<=4;i++){const el=document.getElementById(`imp-s${i}`);el.classList.remove('active','done');if(i<n)el.classList.add('done');else if(i===n)el.classList.add(done?'done':'active');}
}

/* ═══ UTILS ═══ */
function closeOverlay(id){document.getElementById(id).classList.remove('open');}
document.querySelectorAll('.overlay').forEach(el=>{el.addEventListener('click',function(e){if(e.target===this)this.classList.remove('open');});});
document.addEventListener('click',function(e){
  const menu=document.getElementById('settings-menu');
  if(menu && !menu.contains(e.target)) closeSettingsMenu();
});
function editClinicName(){
  // スマホでpromptが動かない場合のためモーダル方式に変更
  const existing = document.getElementById('clinic-edit-modal');
  if(existing) existing.remove();
  const profile = typeof getClinicProfile === 'function' ? getClinicProfile() : { medicalInstitutionNumber: '' };
  const medicalInstitutionNumber = profile && profile.medicalInstitutionNumber ? profile.medicalInstitutionNumber : '';
  const modal = document.createElement('div');
  modal.id = 'clinic-edit-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="background:var(--bg);border-radius:14px;padding:24px;width:100%;max-width:360px;box-shadow:0 8px 32px rgba(0,0,0,.2)">
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:16px">⚙ 医院情報の設定</div>
      <div style="font-size:11px;color:var(--text3);line-height:1.8;margin-bottom:12px">医院名と医療機関コードを保存しておくと、「施設基準の更新」で自院データを自動確認しやすくなります。</div>
      <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:6px">医院名</div>
      <input id="clinic-edit-input" type="text" value="${clinicName}"
        style="width:100%;padding:10px 12px;border:1.5px solid var(--accent);border-radius:8px;font-size:14px;font-family:var(--font);background:var(--bg2);color:var(--text);box-sizing:border-box;margin-bottom:16px"
        placeholder="例：くにたち石田歯科">
      <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:6px">医療機関コード（任意）</div>
      <input id="clinic-medical-id-input" type="text" value="${medicalInstitutionNumber}"
        style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;font-size:14px;font-family:var(--font);background:var(--bg2);color:var(--text);box-sizing:border-box;margin-bottom:8px"
        placeholder="例：0117093" inputmode="numeric" maxlength="7" oninput="this.value=this.value.replace(/[^0-9]/g,'')">
      <div style="font-size:11px;color:var(--text3);line-height:1.7;margin-bottom:16px">7桁の医療機関コードを保存すると、最新データ確認時に自動で使います。</div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button onclick="document.getElementById('clinic-edit-modal').remove()"
          style="padding:8px 18px;border:1px solid var(--border);border-radius:8px;background:var(--bg3);font-family:var(--font);font-size:13px;cursor:pointer">キャンセル</button>
        <button onclick="saveClinicName()"
          style="padding:8px 18px;border:none;border-radius:8px;background:var(--accent);color:#fff;font-family:var(--font);font-size:13px;font-weight:700;cursor:pointer">保存</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  setTimeout(()=>document.getElementById('clinic-edit-input').focus(),100);
}

function showClinicNameConfirm(parsedName) {
  const existing = document.getElementById('clinic-confirm-modal');
  if(existing) existing.remove();
  const currentName = localStorage.getItem('clinic_name') || '';
  const modal = document.createElement('div');
  modal.id = 'clinic-confirm-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="background:var(--bg);border-radius:14px;padding:24px;width:100%;max-width:380px;box-shadow:0 8px 32px rgba(0,0,0,.25)">
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:12px">📄 PDFから医院名を取得しました</div>
      <div style="background:var(--blue-bg);border:1px solid #bfdbfe;border-radius:8px;padding:12px;margin-bottom:12px;font-size:14px;font-weight:700;color:var(--accent);text-align:center">
        「${parsedName}」
      </div>
      ${currentName && currentName !== '○○歯科医院'
        ? `<div style="font-size:11px;color:var(--text3);margin-bottom:12px">現在の設定：「${currentName}」</div>` : ''}
      <div style="font-size:12px;color:var(--text2);margin-bottom:16px;line-height:1.7">
        この名前で医院名を設定しますか？<br>
        <span style="color:var(--text3)">※番号の入力ミス検知にもご活用ください</span>
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="document.getElementById('clinic-confirm-modal').remove()"
          style="flex:1;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--bg3);font-family:var(--font);font-size:13px;cursor:pointer">
          キャンセル
        </button>
        <button onclick="applyClinicName('${parsedName}')"
          style="flex:1;padding:10px;border:none;border-radius:8px;background:var(--accent);color:#fff;font-family:var(--font);font-size:13px;font-weight:700;cursor:pointer">
          この名前で設定
        </button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

function applyClinicName(name) {
  clinicName = name;
  localStorage.setItem('clinic_name', name);
  updateClinicPill();
  const modal = document.getElementById('clinic-confirm-modal');
  if(modal) modal.remove();
}

function showInfoModal(title, message) {
  const existing = document.getElementById('info-modal');
  if(existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'info-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="background:var(--bg);border-radius:14px;padding:24px;width:100%;max-width:360px;box-shadow:0 8px 32px rgba(0,0,0,.25)">
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:12px">${title}</div>
      <div style="font-size:13px;color:var(--text2);line-height:1.8;margin-bottom:16px">${message}</div>
      <button onclick="document.getElementById('info-modal').remove()"
        style="width:100%;padding:10px;border:none;border-radius:8px;background:var(--accent);color:#fff;font-family:var(--font);font-size:13px;font-weight:700;cursor:pointer">OK</button>
    </div>`;
  document.body.appendChild(modal);
}
function saveClinicName(){
  const n = document.getElementById('clinic-edit-input').value.trim();
  const medicalIdInput = document.getElementById('clinic-medical-id-input');
  const medicalInstitutionNumber = medicalIdInput ? medicalIdInput.value.trim() : '';
  if(n){
    clinicName = n;
    localStorage.setItem('clinic_name', n);
    updateClinicPill();
  }
  if(typeof saveClinicProfile === 'function'){
    saveClinicProfile({ medicalInstitutionNumber });
  }
  const modal = document.getElementById('clinic-edit-modal');
  if(modal) modal.remove();
}

/* ─── INIT ─── */
ensureAdminStorageInitialized();
updateClinicPill();
renderAdminSecurityStatus();

// バージョンバッジを表示
(function(){
  const el=document.getElementById('ver-badge');
  if(el) el.textContent=`ver.${APP_VERSION} · ${APP_DATE}`;
})();

render();

// 講習会バッジ初期更新
(function(){
  const list=JSON.parse(localStorage.getItem('koushu_list')||'[]');
  const now=new Date();
  const hasAlert=list.some(r=>{
    if(!r.expire)return false;
    return Math.floor((new Date(r.expire)-now)/86400000)<180;
  });
  const b=document.getElementById('koushu-badge');
  if(b)b.style.display=hasAlert?'inline-block':'none';
})();

// ── バージョンチェック（GitHub Gist から version.json を取得）──
// ※ Gist URLは先生がGitHubにJSONを置いた後に差し替えてください
// 現在はスキップ（URLが未設定のため）
(async function checkVersion(){
  const VERSION_JSON_URL = ''; // 例: 'https://gist.githubusercontent.com/.../version.json'
  if(!VERSION_JSON_URL) return; // URL未設定なら何もしない
  try{
    const res=await fetch(VERSION_JSON_URL+'?t='+Date.now());
    if(!res.ok)return;
    const data=await res.json();
    if(!data.version)return;

    // バージョン比較（単純な文字列比較）
    if(data.version > APP_VERSION){
      const banner=document.getElementById('update-banner');
      const msg=document.getElementById('update-msg');
      const link=document.getElementById('update-link');
      if(banner&&msg){
        msg.textContent=`ver.${data.version}（${data.date||''}）が公開されています。${data.changes||''}`;
        if(link&&data.url) link.href=data.url;
        banner.style.display='flex';
      }
    }
  }catch(e){
    // ネットワークエラーは無視
  }
})();

