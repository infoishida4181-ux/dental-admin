/* ベースアップ評価料 賃上げシミュレーター MVP UI */
function baseupOption(value,label,current){
  return `<option value="${value}" ${value===current?'selected':''}>${label}</option>`;
}

function baseupMonthOptions(current){
  return Array.from({ length:12 }, (_, i) => baseupOption(String(i + 1), `${i + 1}月`, String(current || ''))).join('');
}

function baseupInput(path,value,type='number',extra=''){
  const defaultAttrs = type === 'number' ? `min="0" ${extra.includes('step=') ? '' : 'step="1"'}` : '';
  return `<input class="fi baseup-input" data-baseup-path="${path}" type="${type}" value="${value ?? ''}" ${defaultAttrs} ${extra}>`;
}

function baseupOccupationShortLabel(jobType){
  return {
    dentist:'Dr',
    doctor:'医師',
    dentalHygienist:'DH',
    dentalAssistant:'DA',
    reception:'受付',
    office:'事務',
    dentalTechnician:'DT',
    other:'その他'
  }[jobType] || (typeof employeeJobTypeLabel === 'function' ? employeeJobTypeLabel(jobType) : jobType || 'その他');
}

function baseupAllocationMethodLabel(value){
  return {
    equal:'全員一律',
    hours:'勤務時間比例',
    salary:'給与比例',
    manual:'手入力'
  }[value] || value || '未設定';
}

function baseupSafetyLabel(value){
  return {
    safe:'安全側90%',
    standard:'標準97%',
    aggressive:'攻め100%'
  }[value] || value || '未設定';
}

function baseupWagePolicyLabel(value){
  return {
    monthlyFocused:'月額中心',
    monthlyAndBonus:'月額＋賞与併用',
    bonusAdjustment:'賞与で調整',
    manual:'手入力'
  }[value] || value || '未設定';
}

function baseupBonusAllocationMethodLabel(value){
  return {
    monthlyRaise:'月額比例',
    equal:'全員一律',
    hours:'勤務時間比例',
    salary:'給与比例',
    manual:'手入力'
  }[value] || value || '未設定';
}

function baseupLastAppliedLabel(){
  const appliedAt = baseupCalcState.meta?.lastAppliedAt;
  if(!appliedAt) return '未反映';
  const date = new Date(appliedAt);
  if(Number.isNaN(date.getTime())) return '未反映';
  return date.toLocaleString('ja-JP', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
}

function baseupIsAllocationPath(path){
  return Boolean(path && (path.startsWith('allocation.') || path === 'clinic.bonusPlanType' || path === 'clinic.bonusMemo'));
}

function baseupMarkAllocationDirty(){
  baseupCalcState.meta = { ...(baseupCalcState.meta || {}), allocationDirty:true };
}

function baseupApplyAllocationSettings(){
  syncBaseupStateFromForm();
  baseupCalcState.meta = {
    ...(baseupCalcState.meta || {}),
    allocationDirty:false,
    lastAppliedAt:new Date().toISOString()
  };
  renderBaseupCalculator();
  if(typeof showAppToast === 'function') showAppToast('試算に反映しました。','success');
}

function syncBaseupStateFromForm(){
  document.querySelectorAll('[data-baseup-path]').forEach(el=>{
    const path = el.dataset.baseupPath.split('.');
    let target = baseupCalcState;
    path.slice(0,-1).forEach(part=>{ target = target[part]; });
    const key = path[path.length-1];
    if(el.type === 'checkbox') target[key] = el.checked;
    else if(['includeCommutingAllowanceForBaseAmount','includeCommutingAllowanceForSalaryProportion','includeCommutingAllowanceForSocialInsuranceEstimate'].includes(key)) target[key] = el.value === 'true';
    else if(el.type === 'number') target[key] = baseupNumber(el.value);
    else target[key] = el.value;
  });
  const monthInputs = [...document.querySelectorAll('[data-baseup-bonus-month-index]')];
  if(monthInputs.length){
    baseupCalcState.clinic.bonusMonths = monthInputs
      .sort((a,b)=>Number(a.dataset.baseupBonusMonthIndex) - Number(b.dataset.baseupBonusMonthIndex))
      .map(el => el.value)
      .filter(Boolean);
  }else if(baseupCalcState.clinic.bonusPlanType === 'none'){
    baseupCalcState.clinic.bonusMonths = [];
  }
  document.querySelectorAll('[data-staff-id]').forEach(row=>{
    const staff = baseupCalcState.staff.find(s=>s.id===row.dataset.staffId);
    if(!staff) return;
    row.querySelectorAll('[data-staff-field]').forEach(el=>{
      const key = el.dataset.staffField;
      if(['selected','socialInsurance','pension','employmentInsurance','workersComp','careAge','baseupTarget'].includes(key)) staff[key] = el.type === 'checkbox' ? el.checked : el.value === 'true';
      else if(['weeklyHours','monthlySalary','baseSalary','fixedMonthlyAllowance','commutingAllowance','otherMonthlyAllowance','annualBonus','plannedAnnualBonus','desiredMonthlyRaise','desiredBonusAllocation'].includes(key)) staff[key] = baseupNumber(el.value);
      else if(['bonusEligible','bonusAllocationEligible','useBonusAllocation'].includes(key)) staff[key] = el.value === 'true';
      else staff[key] = el.value;
    });
    staff.monthlySalary = baseupSalaryTotal(staff);
    staff.monthlySalaryTotal = staff.monthlySalary;
  });
}

function renderBaseupCalculator(){
  ensureBaseupStaff();
  applyBaseupPointMasterToState();
  const root = document.getElementById('baseup-calculator-root');
  if(!root) return;
  const result = calculateBaseupAllocation(baseupCalcState);
  const warnings = validateBaseupState(baseupCalcState);
  const unlocked = typeof hasUnlockedEmployeeMaster === 'function' && hasUnlockedEmployeeMaster();
  root.innerHTML = `
    <section class="baseup-calc-card">
      <div class="baseup-calc-title">医院情報</div>
      <div class="baseup-form-grid">
        <label><span>事業形態</span><select class="fs baseup-input" data-baseup-path="clinic.businessType">${baseupOption('corporation','法人',baseupCalcState.clinic.businessType)}${baseupOption('sole','個人事業主',baseupCalcState.clinic.businessType)}</select></label>
        <label><span>評価料Ⅰの算定状況</span><select class="fs baseup-input baseup-master-trigger" data-baseup-path="clinic.calculationStatus">${baseupOption('normal','通常',baseupCalculationStatusKey(baseupCalcState.clinic.calculationStatus))}${baseupOption('continuous','継続的賃上げ等',baseupCalculationStatusKey(baseupCalcState.clinic.calculationStatus))}${baseupOption('other','その他・手動設定',baseupCalculationStatusKey(baseupCalcState.clinic.calculationStatus))}</select></label>
        <label><span>算定する評価料</span><select class="fs baseup-input" data-baseup-path="clinic.feeType">${baseupOption('i','ベースアップ評価料Ⅰのみ',baseupCalcState.clinic.feeType)}${baseupOption('i-ii','ベースアップ評価料Ⅰ＋Ⅱ',baseupCalcState.clinic.feeType)}</select></label>
        <label><span>計算対象年度</span>${baseupInput('clinic.fiscalYear',baseupCalcState.clinic.fiscalYear,'text','data-master-trigger="1"')}</label>
        <label><span>年齢判定基準日</span><select class="fs baseup-input" data-baseup-path="reference.mode">${baseupOption('today','今日',baseupCalcState.reference.mode)}${baseupOption('fiscalStart','計算対象年度の開始日',baseupCalcState.reference.mode)}${baseupOption('fiscalEnd','計算対象年度の終了日',baseupCalcState.reference.mode)}${baseupOption('custom','任意日',baseupCalcState.reference.mode)}</select></label>
        ${baseupCalcState.reference.mode === 'custom' ? `<label><span>任意基準日</span>${baseupInput('reference.customDate',baseupCalcState.reference.customDate,'date')}</label>` : ''}
        <label><span>賞与支給予定</span><select class="fs baseup-input" data-baseup-path="clinic.bonusPlanType">${baseupOption('none','なし',baseupCalcState.clinic.bonusPlanType)}${baseupOption('once','年1回',baseupCalcState.clinic.bonusPlanType)}${baseupOption('twice','年2回',baseupCalcState.clinic.bonusPlanType)}${baseupOption('three','年3回',baseupCalcState.clinic.bonusPlanType)}${baseupOption('other','その他',baseupCalcState.clinic.bonusPlanType)}</select></label>
        ${renderBaseupBonusMonthInputs()}
        ${baseupCalcState.clinic.bonusPlanType === 'other' ? `<label><span>賞与メモ</span>${baseupInput('clinic.bonusMemo',baseupCalcState.clinic.bonusMemo || '','text','placeholder="例：夏季・冬季・決算賞与など"')}</label>` : ''}
      </div>
      <div class="baseup-print-note" style="margin-top:10px">年齢判定基準日：${getBaseupReferenceDate(baseupCalcState)}。介護保険判定は令和年度内の対象月数で概算します。</div>
    </section>

    <section class="baseup-calc-card">
      <div class="baseup-calc-title">算定回数入力 <small>3か月分から月平均・年間見込みを計算</small></div>
      <div class="baseup-form-grid">
        <label><span>過去3か月の初診数</span>${baseupInput('counts.firstVisit3m',baseupCalcState.counts.firstVisit3m)}</label>
        <label><span>過去3か月の再診数</span>${baseupInput('counts.revisit3m',baseupCalcState.counts.revisit3m)}</label>
        <label><span>訪問診療 同一建物以外</span>${baseupInput('counts.homeVisitOther3m',baseupCalcState.counts.homeVisitOther3m)}</label>
        <label><span>訪問診療 同一建物居住者等</span>${baseupInput('counts.homeVisitSame3m',baseupCalcState.counts.homeVisitSame3m)}</label>
      </div>
      ${renderBaseupCountPreview()}
    </section>

    ${renderBaseupPointSection()}
    ${baseupCalcState.clinic.feeType==='i-ii'?renderBaseupFee2Section():''}
    ${renderBaseupEmployeeSection(result, unlocked)}
    ${renderBaseupRateAndAllocationSection()}
    ${renderBaseupResultSection(result,warnings)}
    ${renderBaseupScenarioSection(result)}
    <section class="baseup-calc-card baseup-print-note">
      この試算結果は、公式届出様式や賃金改善計画書の内容を保証するものではありません。最終的な届出、給与規程、賃金台帳、社会保険料の取扱いについては、厚生労働省・地方厚生局の公式資料、給与計算ソフト、顧問社労士等で確認してください。
    </section>
  `;
  bindBaseupCalculatorEvents();
}

function renderBaseupBonusMonthInputs(){
  const count = baseupBonusPlanCount(baseupCalcState);
  if(!count) return '';
  const months = baseupCalcState.clinic.bonusMonths || [];
  return Array.from({ length:count }, (_, index) => {
    const fallback = count === 1 ? 12 : count === 2 ? [6,12][index] : [6,10,12][index];
    return `<label><span>賞与支給月${index + 1}</span><select class="fs baseup-input" data-baseup-bonus-month-index="${index}">${baseupMonthOptions(months[index] || fallback)}</select></label>`;
  }).join('');
}

function renderBaseupCountPreview(){
  const counts = getBaseupAnnualCounts(baseupCalcState);
  return `<div class="baseup-count-preview">
    <div><span>初診 月平均</span><strong>${Math.round(counts.firstVisit/12).toLocaleString()} 回</strong><small>年間 ${Math.round(counts.firstVisit).toLocaleString()} 回</small></div>
    <div><span>再診 月平均</span><strong>${Math.round(counts.revisit/12).toLocaleString()} 回</strong><small>年間 ${Math.round(counts.revisit).toLocaleString()} 回</small></div>
    <div><span>訪問 同一建物以外</span><strong>${Math.round(counts.homeVisitOther/12).toLocaleString()} 回/月</strong><small>年間 ${Math.round(counts.homeVisitOther).toLocaleString()} 回</small></div>
    <div><span>訪問 同一建物</span><strong>${Math.round(counts.homeVisitSame/12).toLocaleString()} 回/月</strong><small>年間 ${Math.round(counts.homeVisitSame).toLocaleString()} 回</small></div>
  </div>`;
}

function renderBaseupPointSection(){
  const usage = getBaseupPointMasterUsageLabel(baseupCalcState);
  const row = usage.row;
  return `<section class="baseup-calc-card">
    <div class="baseup-calc-title-row">
      <div class="baseup-calc-title" style="margin-bottom:0">点数設定 <small>点数マスタから自動反映・手動修正可</small></div>
      <div class="baseup-inline-actions">
        <button class="btn btn-ghost baseup-no-print" type="button" id="baseup-toggle-point-details">${baseupCalcState.points.detailsOpen?'詳細設定を閉じる':'詳細設定を開く'}</button>
        <button class="btn btn-ghost baseup-no-print" type="button" id="baseup-restore-master-points">点数マスタの値に戻す</button>
      </div>
    </div>
    <div class="employee-status">
      <span class="baseup-source-pill">${usage.message}</span>
      <span class="badge ${usage.overridden?'by':'bg'}">現在使用中：${usage.sourceLabel}</span>
      <span class="badge bg">この点数は管理者マスタから自動反映されています</span>
    </div>
    ${baseupCalcState.points.manualOverride ? '<div class="baseup-warning-list" style="margin-top:10px">この点数は点数マスタから手動変更されています。</div>' : ''}
    ${baseupCalcState.points.detailsOpen ? `<div class="baseup-form-grid" style="margin-top:12px">
      <label><span>初診点数</span>${baseupInput('points.firstVisit',baseupCalcState.points.firstVisit,'number','data-point-input="1"')}</label>
      <label><span>再診点数</span>${baseupInput('points.revisit',baseupCalcState.points.revisit,'number','data-point-input="1"')}</label>
      <label><span>訪問 同一建物以外</span>${baseupInput('points.homeVisitOther',baseupCalcState.points.homeVisitOther,'number','data-point-input="1"')}</label>
      <label><span>訪問 同一建物居住者等</span>${baseupInput('points.homeVisitSame',baseupCalcState.points.homeVisitSame,'number','data-point-input="1"')}</label>
    </div>` : `<div class="baseup-point-summary">
      <div><span>評価料Ⅰ</span><strong>初診${baseupNumber(baseupCalcState.points.firstVisit)}点・再診${baseupNumber(baseupCalcState.points.revisit)}点</strong></div>
      <div><span>訪問診療</span><strong>同一建物以外${baseupNumber(baseupCalcState.points.homeVisitOther)}点・同一建物${baseupNumber(baseupCalcState.points.homeVisitSame)}点</strong></div>
    </div>`}
  </section>`;
}

function renderBaseupFee2Section(){
  const rows = getBaseupFee2MasterRows(baseupCalcState);
  const currentRow = findBaseupFee2MasterRow(baseupCalcState);
  const usage = getBaseupFee2UsageLabel();
  const options = rows.length
    ? rows.map(row => baseupOption(row.id, `区分${row.category || ''}：初診・訪問 ${baseupNumber(row.firstVisit)}点／再診 ${baseupNumber(row.revisit)}点`, currentRow?.id || baseupCalcState.fee2.pointMasterId)).join('')
    : '';
  const pointSummary = currentRow
    ? `初診・訪問${baseupNumber(currentRow.firstVisit)}点・再診${baseupNumber(currentRow.revisit)}点`
    : '点数未登録';
  const result = calculateBaseupResources(baseupCalcState);
  return `<section class="baseup-calc-card">
    <div class="baseup-calc-title">ベースアップ評価料Ⅱ</div>
    <div class="baseup-warning-list">評価料Ⅱを算定する場合は、届出済みまたは届出予定の区分を選択してください。選択した区分に応じて、評価料Ⅱの点数と年間原資を自動計算します。区分が分からない場合は、届出様式または地方厚生局へ提出する内容を確認してください。</div>
    ${rows.length ? `<div class="baseup-form-grid baseup-compact-grid">
      <label><span>評価料Ⅱの区分</span><select class="fs baseup-input baseup-fee2-trigger" data-baseup-path="fee2.pointMasterId">${options}</select></label>
    </div>` : '<div class="baseup-warning-list">評価料Ⅱの区分マスタが未登録です。管理者モードで区分・点数・追加原資を登録してください。</div>'}
    <div class="employee-status" style="margin-top:10px">
      <span class="baseup-source-pill">${usage.message}</span>
      <span class="badge bg">選択区分の点数から年間原資を自動計算</span>
      <span class="badge bgr">${pointSummary}</span>
    </div>
    ${currentRow?.memo ? `<div class="baseup-print-note" style="margin-top:8px">メモ：${currentRow.memo}</div>` : ''}
    ${currentRow?.officialUrl ? `<div class="baseup-print-note" style="margin-top:4px">公式確認：${currentRow.officialUrl}</div>` : ''}
    ${!usage.hasPoints && currentRow ? '<div class="baseup-warning-list" style="margin-top:10px">選択された評価料Ⅱ区分には点数が未登録です。管理者マスタを確認してください。</div>' : ''}
    <div class="baseup-point-summary">
      <div><span>評価料Ⅱ 区分</span><strong>${currentRow?.sectionName || '未選択'}</strong></div>
      <div><span>初診・訪問点数</span><strong>${baseupNumber(result.fee2FirstOrVisitPoints)} 点</strong></div>
      <div><span>再診点数</span><strong>${baseupNumber(result.fee2RevisitPoints)} 点</strong></div>
      <div><span>評価料Ⅱ 年間原資</span><strong>${baseupYen(result.fee2)}</strong></div>
    </div>
    ${baseupCalcState.fee2.manualOverride ? '<div class="baseup-warning-list" style="margin-top:10px">この評価料Ⅱの点数は点数マスタから手動変更されています。</div>' : ''}
  </section>`;
}

function renderBaseupEmployeeSection(result, unlocked){
  const targetCount = baseupCalcState.staff.filter(s=>getBaseupStaffEligibility(s, baseupCalcState).eligible).length;
  const selectedCount = getBaseupSelectedStaff(baseupCalcState).length;
  const eligibilitySummary = calculateBaseupEligibilitySummary(baseupCalcState);
  const excludedCount = Math.max(0, baseupCalcState.staff.length - targetCount);
  const visibleStaff = baseupCalcState.allocation.showOnlyTargets
    ? baseupCalcState.staff.filter(s => getBaseupStaffEligibility(s, baseupCalcState).eligible)
    : baseupCalcState.staff;
  return `<section class="baseup-calc-card">
    <div class="baseup-calc-title-row">
      <div>
        <div class="baseup-calc-title" style="margin-bottom:2px">従業員マスタ連携 <small>試算対象者を選択</small></div>
        <div class="baseup-print-note" style="margin:0">この画面では、ベースアップ試算に使う対象職員を確認します。給与・社保などの詳細情報は従業員情報管理画面で編集してください。必要な場合のみ、職員ごとの詳細を開いて確認できます。</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary baseup-no-print" type="button" id="baseup-load-employees">従業員マスタを読み込む</button>
        <button class="btn btn-ghost baseup-no-print" type="button" onclick="nav('employees')">従業員情報を開く</button>
      </div>
    </div>
    <div class="baseup-action-note baseup-no-print">従業員情報管理で登録した職員を、この試算に読み込みます。</div>
    <div class="baseup-summary-grid baseup-employee-summary">
      <div><span>登録済み従業員</span><strong>${baseupCalcState.staff.length.toLocaleString()} 人</strong></div>
      <div><span>ベースアップ対象</span><strong>${targetCount.toLocaleString()} 人</strong></div>
      <div><span>試算対象</span><strong>${selectedCount.toLocaleString()} 人</strong></div>
      <div><span>対象職員の月額賃金総額</span><strong>${baseupYen(eligibilitySummary.eligibleMonthlyWageTotal)}</strong></div>
      <div><span>40歳未満の勤務歯科医師</span><strong>${eligibilitySummary.under40DentistCount.toLocaleString()} 人</strong></div>
      <div><span>対象外職員</span><strong>${excludedCount.toLocaleString()} 人</strong></div>
    </div>
    <details class="baseup-detail-summary baseup-no-print">
      <summary>詳細サマリーを表示</summary>
      <div class="baseup-summary-grid">
        <div><span>マスタ状態</span><strong>${unlocked ? '展開中' : '未展開'}</strong></div>
        <div><span>40歳未満の勤務医師</span><strong>${eligibilitySummary.under40DoctorCount.toLocaleString()} 人</strong></div>
        <div><span>対象外の医師・歯科医師</span><strong>${eligibilitySummary.excludedDoctorDentistCount.toLocaleString()} 人</strong></div>
        <div><span>経営者・役員</span><strong>${eligibilitySummary.ownerOfficerCount.toLocaleString()} 人</strong></div>
        <div><span>業務委託</span><strong>${eligibilitySummary.contractorCount.toLocaleString()} 人</strong></div>
      </div>
    </details>
    <div class="baseup-warning-list" style="margin-top:12px">評価料Ⅱの区分自動提案は未実装です。届出済みまたは届出予定の区分を選択してください。</div>
    <label class="baseup-check baseup-no-print" style="margin-top:12px"><input type="checkbox" id="baseup-show-targets-only" ${baseupCalcState.allocation.showOnlyTargets?'checked':''}> ベースアップ対象者のみ表示する</label>
    ${baseupCalcState.staff.length ? `<div class="baseup-staff-list">${visibleStaff.map((s,idx)=>renderBaseupStaffRow(s,idx,result.staffRows.find(r=>r.staff.id===s.id))).join('')}</div>` : '<div class="employee-empty">従業員情報管理で従業員を登録し、暗号化データを開いてください。従業員0人の状態では計算できません。</div>'}
  </section>`;
}

function renderBaseupStaffRow(staff,idx,result){
  const eligibility = getBaseupStaffEligibility(staff, baseupCalcState);
  const monthlyTotal = baseupSalaryTotal(staff);
  const proportionSalary = baseupSalaryForProportion(staff, baseupCalcState);
  const roleLabel = typeof employeeWorkerRoleLabel === 'function' ? employeeWorkerRoleLabel(staff.workerRoleForBaseup) : staff.workerRoleForBaseup;
  const jobLabel = typeof employeeJobTypeLabel === 'function' ? employeeJobTypeLabel(staff.jobType) : staff.jobType;
  const jobShortLabel = baseupOccupationShortLabel(staff.jobType);
  return `<div class="baseup-staff-row" data-staff-id="${staff.id}">
    <div class="baseup-staff-compact">
      <label class="baseup-staff-check baseup-no-print"><input type="checkbox" data-staff-field="selected" ${staff.selected!==false?'checked':''}> 試算</label>
      <div class="baseup-staff-main">
        <strong>${staff.alias || `職員${idx+1}`}</strong>
        <small><span title="${jobLabel}">${jobShortLabel}</span> / ${result?.age ?? '年齢未判定'} / ${roleLabel}</small>
      </div>
      <div class="baseup-staff-status">
        <span class="badge ${eligibility.eligible?'bb':'bgr'}">${eligibility.eligible?'対象':'対象外'}</span>
      </div>
      <div class="baseup-staff-wage">
        <span>月額賃金</span>
        <strong>${baseupYen(monthlyTotal)}</strong>
      </div>
      <div class="baseup-staff-reason">${eligibility.eligible ? '—' : `理由：${eligibility.reason}`}</div>
      <div class="baseup-staff-actions baseup-no-print">
        <select class="fs" data-staff-field="baseupTarget" aria-label="対象／対象外">${baseupOption(true,'対象',staff.baseupTarget)}${baseupOption(false,'対象外',staff.baseupTarget)}</select>
        <button class="btn btn-ghost" type="button" onclick="nav('employees')">従業員情報を編集</button>
      </div>
    </div>
    <details class="baseup-staff-details baseup-no-print">
      <summary>詳細を見る・一時修正</summary>
      <div class="baseup-detail-grid">
        <div><span>表示名</span><input class="fi" data-staff-field="alias" value="${staff.alias || ''}"></div>
        <div><span>職種</span><select class="fs" data-staff-field="jobType">${baseupOption('dentist','歯科医師',staff.jobType)}${baseupOption('doctor','医師',staff.jobType)}${baseupOption('dentalHygienist','歯科衛生士',staff.jobType)}${baseupOption('dentalAssistant','歯科助手',staff.jobType)}${baseupOption('reception','受付',staff.jobType)}${baseupOption('office','事務',staff.jobType)}${baseupOption('dentalTechnician','歯科技工士',staff.jobType)}${baseupOption('other','その他',staff.jobType)}</select></div>
        <div><span>対象判定上の立場</span><select class="fs" data-staff-field="workerRoleForBaseup">${baseupOption('worker','勤務者',staff.workerRoleForBaseup)}${baseupOption('ownerOfficer','経営者・役員',staff.workerRoleForBaseup)}${baseupOption('contractor','業務委託',staff.workerRoleForBaseup)}${baseupOption('excluded','対象外',staff.workerRoleForBaseup)}</select></div>
        <div><span>雇用形態</span><select class="fs" data-staff-field="employmentType">${baseupOption('fulltime','常勤',staff.employmentType)}${baseupOption('parttime','非常勤',staff.employmentType)}${baseupOption('hourly','パート',staff.employmentType)}${baseupOption('casual','アルバイト',staff.employmentType)}${baseupOption('other','その他',staff.employmentType)}</select></div>
        <div><span>週勤務時間</span><input class="fi" type="number" min="0" data-staff-field="weeklyHours" value="${staff.weeklyHours}"></div>
        <div><span>基本給</span><input class="fi" type="number" min="0" data-staff-field="baseSalary" value="${staff.baseSalary || 0}"></div>
        <div><span>固定手当</span><input class="fi" type="number" min="0" data-staff-field="fixedMonthlyAllowance" value="${staff.fixedMonthlyAllowance || 0}"></div>
        <div><span>通勤手当</span><input class="fi" type="number" min="0" data-staff-field="commutingAllowance" value="${staff.commutingAllowance || 0}"></div>
        <div><span>その他手当</span><input class="fi" type="number" min="0" data-staff-field="otherMonthlyAllowance" value="${staff.otherMonthlyAllowance || 0}"></div>
        <div><span>社保加入</span><select class="fs" data-staff-field="socialInsurance">${baseupOption(true,'あり',staff.socialInsurance)}${baseupOption(false,'なし',staff.socialInsurance)}</select></div>
        <div><span>保険種別</span><select class="fs" data-staff-field="insuranceType">${baseupOption('kyokaiTokyo','協会けんぽ 東京',staff.insuranceType)}${baseupOption('tokyoDentalHealth','東京都歯科健康保険組合',staff.insuranceType)}${baseupOption('otherHealth','その他健保組合',staff.insuranceType)}${baseupOption('dentalKokuho','歯科医師国保',staff.insuranceType)}${baseupOption('municipalKokuho','市町村国保',staff.insuranceType)}${baseupOption('none','社保なし',staff.insuranceType)}</select></div>
        <div><span>厚生年金</span><select class="fs" data-staff-field="pension">${baseupOption(true,'あり',staff.pension)}${baseupOption(false,'なし',staff.pension)}</select></div>
        <div><span>雇用保険</span><select class="fs" data-staff-field="employmentInsurance">${baseupOption(true,'あり',staff.employmentInsurance)}${baseupOption(false,'なし',staff.employmentInsurance)}</select></div>
        <div><span>労災</span><select class="fs" data-staff-field="workersComp">${baseupOption(true,'はい',staff.workersComp)}${baseupOption(false,'いいえ',staff.workersComp)}</select></div>
        <div><span>介護保険判定</span><select class="fs" data-staff-field="ageJudgementMode">${baseupOption('auto','生年月日から自動判定',staff.ageJudgementMode)}${baseupOption('manual','手動判定',staff.ageJudgementMode)}</select></div>
        <div><span>手動時の介護保険</span><select class="fs" data-staff-field="careAge">${baseupOption(true,'対象',staff.careAge)}${baseupOption(false,'対象外',staff.careAge)}</select></div>
        <div><span>子育て支援金</span><select class="fs" data-staff-field="childCareSupport">${baseupOption('auto','自動判定',staff.childCareSupport)}${baseupOption('yes','はい',staff.childCareSupport)}${baseupOption('no','いいえ',staff.childCareSupport)}</select></div>
        <div><span>子育て拠出金</span><select class="fs" data-staff-field="childCareContribution">${baseupOption('auto','自動判定',staff.childCareContribution)}${baseupOption('yes','はい',staff.childCareContribution)}${baseupOption('no','いいえ',staff.childCareContribution)}</select></div>
        <div><span>希望ベースアップ月額</span><input class="fi" type="number" min="0" data-staff-field="desiredMonthlyRaise" value="${staff.desiredMonthlyRaise}"></div>
        <div><span>賞与対象</span><select class="fs" data-staff-field="bonusEligible">${baseupOption(true,'対象',staff.bonusEligible)}${baseupOption(false,'対象外',staff.bonusEligible)}</select></div>
        <div><span>賞与配分対象</span><select class="fs" data-staff-field="bonusAllocationEligible">${baseupOption(true,'対象',staff.bonusAllocationEligible)}${baseupOption(false,'対象外',staff.bonusAllocationEligible)}</select></div>
        <div><span>年間賞与予定額</span><input class="fi" type="number" min="0" data-staff-field="plannedAnnualBonus" value="${staff.plannedAnnualBonus || staff.annualBonus || 0}"></div>
        <div><span>賞与配分</span><select class="fs" data-staff-field="useBonusAllocation">${baseupOption(true,'行う',staff.useBonusAllocation)}${baseupOption(false,'行わない',staff.useBonusAllocation)}</select></div>
        ${(baseupCalcState.allocation.method === 'manual' || baseupCalcState.allocation.bonusAllocationMethod === 'manual') ? `<div><span>希望賞与等配分額</span><input class="fi" type="number" min="0" data-staff-field="desiredBonusAllocation" value="${staff.desiredBonusAllocation || 0}"></div>` : ''}
      </div>
      <div class="baseup-detail-note">月額給与合計 ${baseupYen(monthlyTotal)} / 給与比例に使う額 ${baseupYen(proportionSalary)} / 介護保険 ${result?.careMonths ?? 0}か月</div>
      <button class="btn btn-ghost baseup-apply-employee-overrides-inline" type="button">一時上書きを従業員情報へ反映</button>
    </details>
    <div class="baseup-staff-mini">毎月 ${baseupYen(result?.monthlyRaise || 0)}、賞与等 ${baseupYen(result?.bonusAllocation || 0)}、年間賃上げ ${baseupYen(result?.annualRaise || 0)}、年間総コスト ${baseupYen(result?.totalCost || 0)}</div>
  </div>`;
}

function renderBaseupRateAndAllocationSection(){
  return `${renderBaseupRateSection()}${renderBaseupAllocationSection()}`;
}

function renderBaseupRateSection(){
  const rateUsage = getBaseupRateMasterUsageLabel();
  return `<section class="baseup-calc-card">
    <div class="baseup-calc-title">保険料率・法定福利費設定 <small>年度別マスタ反映・概算・手動修正可</small></div>
    <div class="employee-status" style="margin-bottom:10px">
      <span class="baseup-source-pill">${rateUsage.sourceLabel}</span>
      <span class="badge ${rateUsage.overridden?'by':'bg'}">現在使用中：${rateUsage.overridden?'この端末の手動上書き':'公式初期マスタ'}</span>
    </div>
    <div class="baseup-warning-list">保険料率は年度・制度・加入先により変わるため、必ず最新の料率を確認してください。</div>
    <div class="baseup-form-grid">
      <label><span>協会けんぽ東京 健康保険 事業主負担%</span>${baseupInput('rates.kyokaiKenpoTokyo',baseupCalcState.rates.kyokaiKenpoTokyo,'number','step="0.001"')}</label>
      <label><span>東京都歯科健保 事業主負担%</span>${baseupInput('rates.tokyoDentalHealth',baseupCalcState.rates.tokyoDentalHealth,'number','step="0.001"')}</label>
      <label><span>その他健保組合 事業主負担%</span>${baseupInput('rates.otherHealth',baseupCalcState.rates.otherHealth,'number','step="0.001"')}</label>
      <label><span>厚生年金 事業主負担%</span>${baseupInput('rates.pension',baseupCalcState.rates.pension,'number','step="0.001"')}</label>
      <label><span>子ども・子育て支援金%</span>${baseupInput('rates.childCareSupport',baseupCalcState.rates.childCareSupport,'number','step="0.001"')}</label>
      <label><span>子ども・子育て拠出金%</span>${baseupInput('rates.childCareContribution',baseupCalcState.rates.childCareContribution,'number','step="0.001"')}</label>
      <label><span>雇用保険 事業主負担%</span>${baseupInput('rates.employment',baseupCalcState.rates.employment,'number','step="0.001"')}</label>
      <label><span>労災保険 事業主負担%</span>${baseupInput('rates.workersComp',baseupCalcState.rates.workersComp,'number','step="0.001"')}</label>
      <label><span>介護保険 事業主負担%</span>${baseupInput('rates.care',baseupCalcState.rates.care,'number','step="0.001"')}</label>
    </div>
  </section>`;
}

function renderBaseupAllocationSection(){
  const dirty = Boolean(baseupCalcState.meta?.allocationDirty);
  return `<section class="baseup-calc-card baseup-allocation-settings-card">
    <div class="baseup-calc-title-row">
      <div>
        <div class="baseup-calc-title" style="margin-bottom:2px">賃上げ配分設定</div>
        <div class="baseup-print-note" style="margin:0">ここでは、原資を対象職員へどのように配分するかを設定します。設定を変更した場合は、試算結果に反映してください。</div>
      </div>
      <div class="baseup-apply-box baseup-no-print">
        <span class="badge ${dirty ? 'by' : 'bg'}">${dirty ? '未反映の変更あり' : '反映済み'}</span>
        <button class="btn btn-primary ${dirty ? 'baseup-apply-button-pulse' : ''}" type="button" id="baseup-apply-allocation-settings">この設定で試算に反映</button>
      </div>
    </div>
    ${dirty ? '<div class="baseup-warning-list">配分設定が変更されています。試算に反映してください。</div>' : ''}
    <div class="baseup-setting-subtitle">1. 原資の安全率</div>
    <div class="baseup-form-grid baseup-compact-grid">
      <label><span>安全率</span><select class="fs baseup-input" data-baseup-path="allocation.safety">${baseupOption('safe','安全側：年間原資の90％以内',baseupCalcState.allocation.safety)}${baseupOption('standard','標準：年間原資の97％以内',baseupCalcState.allocation.safety)}${baseupOption('aggressive','攻め：年間原資の100％以内',baseupCalcState.allocation.safety)}</select></label>
    </div>
    <div class="baseup-setting-subtitle">2. 対象職員への配分方式</div>
    <div class="baseup-form-grid baseup-compact-grid">
      <label><span>配分方式</span><select class="fs baseup-input" data-baseup-path="allocation.method">${baseupOption('equal','全員一律',baseupCalcState.allocation.method)}${baseupOption('hours','勤務時間比例',baseupCalcState.allocation.method)}${baseupOption('salary','給与比例',baseupCalcState.allocation.method)}${baseupOption('manual','手入力',baseupCalcState.allocation.method)}</select></label>
    </div>
    <div class="baseup-setting-subtitle">3. 月額と賞与等の配分</div>
    <div class="baseup-form-grid baseup-compact-grid">
      <label><span>賃上げ配分方針</span><select class="fs baseup-input" data-baseup-path="allocation.wageAllocationPolicy">${baseupOption('monthlyFocused','月額ベースアップ中心',baseupCalcState.allocation.wageAllocationPolicy)}${baseupOption('monthlyAndBonus','月額＋賞与併用',baseupCalcState.allocation.wageAllocationPolicy)}${baseupOption('bonusAdjustment','月額を最小限にして賞与で調整',baseupCalcState.allocation.wageAllocationPolicy)}${baseupOption('manual','手入力',baseupCalcState.allocation.wageAllocationPolicy)}</select></label>
      <label><span>月額配分率（%）</span>${baseupInput('allocation.monthlyAllocationRate',baseupCalcState.allocation.monthlyAllocationRate,'number','max="100" step="1" list="baseup-monthly-rate-options"')}<datalist id="baseup-monthly-rate-options"><option value="100"><option value="90"><option value="80"><option value="70"><option value="50"></datalist></label>
      <label><span>賞与等配分方式</span><select class="fs baseup-input" data-baseup-path="allocation.bonusAllocationMethod">${baseupOption('monthlyRaise','月額ベースアップ額に比例',baseupCalcState.allocation.bonusAllocationMethod)}${baseupOption('equal','全員一律',baseupCalcState.allocation.bonusAllocationMethod)}${baseupOption('hours','勤務時間比例',baseupCalcState.allocation.bonusAllocationMethod)}${baseupOption('salary','給与比例',baseupCalcState.allocation.bonusAllocationMethod)}${baseupOption('manual','手入力',baseupCalcState.allocation.bonusAllocationMethod)}</select></label>
    </div>
    <div class="baseup-setting-subtitle">4. 端数処理</div>
    <div class="baseup-form-grid baseup-compact-grid">
      <label><span>端数丸め</span><select class="fs baseup-input" data-baseup-path="allocation.roundingUnit">${baseupOption(10,'10円単位',baseupNumber(baseupCalcState.allocation.roundingUnit))}${baseupOption(100,'100円単位',baseupNumber(baseupCalcState.allocation.roundingUnit))}${baseupOption(1000,'1,000円単位',baseupNumber(baseupCalcState.allocation.roundingUnit))}</select></label>
      <label><span>丸め方法</span><select class="fs baseup-input" data-baseup-path="allocation.roundingMethod">${baseupOption('floor','切り捨て',baseupCalcState.allocation.roundingMethod)}${baseupOption('round','四捨五入',baseupCalcState.allocation.roundingMethod)}${baseupOption('ceil','切り上げ',baseupCalcState.allocation.roundingMethod)}</select></label>
    </div>
    <div class="baseup-setting-subtitle">5. 通勤手当の扱い</div>
    <div class="baseup-form-grid baseup-compact-grid">
      <label><span>賃金改善算定基礎額に通勤手当</span><select class="fs baseup-input" data-baseup-path="allocation.includeCommutingAllowanceForBaseAmount">${baseupOption(true,'含める',baseupCalcState.allocation.includeCommutingAllowanceForBaseAmount)}${baseupOption(false,'含めない',baseupCalcState.allocation.includeCommutingAllowanceForBaseAmount)}</select></label>
      <label><span>給与比例配分に通勤手当</span><select class="fs baseup-input" data-baseup-path="allocation.includeCommutingAllowanceForSalaryProportion">${baseupOption(true,'含める',baseupCalcState.allocation.includeCommutingAllowanceForSalaryProportion)}${baseupOption(false,'含めない',baseupCalcState.allocation.includeCommutingAllowanceForSalaryProportion)}</select></label>
      <label><span>法定福利費概算に通勤手当</span><select class="fs baseup-input" data-baseup-path="allocation.includeCommutingAllowanceForSocialInsuranceEstimate">${baseupOption(true,'含める',baseupCalcState.allocation.includeCommutingAllowanceForSocialInsuranceEstimate)}${baseupOption(false,'含めない',baseupCalcState.allocation.includeCommutingAllowanceForSocialInsuranceEstimate)}</select></label>
    </div>
    <div class="baseup-print-note" style="margin-top:10px">通勤手当は制度・計算目的により扱いが異なる場合があります。必要に応じて社労士または加入先に確認してください。</div>
    <div class="baseup-warning-list" style="margin-top:10px">賞与等への配分は、基本給等の引上げに連動するものとして扱えるか、賃金規程・給与計算方法・社労士確認が必要です。業績連動賞与をベースアップ評価料の使途として扱えるとは限りません。</div>
  </section>`;
}

function renderBaseupResultSection(result,warnings){
  const judgeCls = result.judgment==='安全圏'?'bg':result.judgment==='注意'?'by':'br';
  return `<section class="baseup-calc-card baseup-result-section">
    <div class="baseup-calc-title">計算結果 <small>概算</small></div>
    ${warnings.length?`<div class="baseup-warning-list">${warnings.map(w=>`<div>${w}</div>`).join('')}</div>`:''}
    ${renderBaseupAppliedSettingsSummary()}
    <div class="baseup-summary-grid">
      <div><span>評価料Ⅰ 年間原資</span><strong>${baseupYen(result.resources.fee1)}</strong></div>
      <div><span>評価料Ⅱ 年間原資</span><strong>${baseupYen(result.resources.fee2)}</strong></div>
      <div><span>年間総原資</span><strong>${baseupYen(result.resources.annualTotal)}</strong></div>
      <div><span>安全率</span><strong>${Math.round(baseupSafetyRate(baseupCalcState.allocation.safety) * 100)}%</strong></div>
      <div><span>年間総コスト上限</span><strong>${baseupYen(result.totalCostLimit)}</strong></div>
      <div><span>月額ベースアップ配分</span><strong>${baseupYen(result.totalMonthlyAnnualRaise)}</strong></div>
      <div><span>賞与等配分</span><strong>${baseupYen(result.totalBonusAllocation)}</strong></div>
      <div><span>法定福利費概算</span><strong>${baseupYen(result.totalEmployerCost)}</strong></div>
      <div><span>年間総コスト</span><strong>${baseupYen(result.totalCost)}</strong></div>
      <div><span>余剰</span><strong class="${result.costLimitBalance<0?'baseup-negative':'baseup-positive'}">${baseupYen(result.costLimitBalance)}</strong></div>
      <div><span>判定</span><strong><span class="badge ${judgeCls}">${result.judgment}</span></strong></div>
    </div>
    <div class="baseup-allocation-bar" aria-label="月額ベースアップと賞与等配分の比率">
      <span style="width:${result.totalRaise ? Math.max(0, Math.min(100, result.totalMonthlyAnnualRaise / result.totalRaise * 100)) : 100}%">月額</span>
      <b style="width:${result.totalRaise ? Math.max(0, Math.min(100, result.totalBonusAllocation / result.totalRaise * 100)) : 0}%">賞与等</b>
    </div>
    <div class="baseup-judgment-comment">${result.comment}</div>
    <div class="baseup-print-note">余剰は、端数調整・安全率・丸め処理により残った金額です。翌年度繰越や追加調整の検討に使えます。</div>
    <div class="baseup-print-note">本シミュレーターでは、医院内の賃上げ方針を検討するために、月額ベースアップ分と賞与等配分分を概算表示しています。賞与等への配分は、賃金規程・給与計算・社労士確認を前提とした概算です。</div>
    ${renderBaseupStaffResultTable(result)}
    ${renderBaseupDebugDetails(result)}
  </section>`;
}

function renderBaseupAppliedSettingsSummary(){
  const dirty = Boolean(baseupCalcState.meta?.allocationDirty);
  return `<div class="baseup-applied-settings ${dirty ? 'is-dirty' : ''}">
    <div>
      <span>現在の試算</span>
      <strong>${baseupAllocationMethodLabel(baseupCalcState.allocation.method)}／${baseupSafetyLabel(baseupCalcState.allocation.safety)}／${baseupWagePolicyLabel(baseupCalcState.allocation.wageAllocationPolicy)}／月額配分${baseupNumber(baseupCalcState.allocation.monthlyAllocationRate)}％／賞与等は${baseupBonusAllocationMethodLabel(baseupCalcState.allocation.bonusAllocationMethod)}</strong>
    </div>
    <div>
      <span>最終反映</span>
      <strong>${baseupLastAppliedLabel()}</strong>
    </div>
    ${dirty ? '<p>配分設定が変更されています。「この設定で試算に反映」を押して反映済みにしてください。</p>' : ''}
  </div>`;
}

function renderBaseupDebugDetails(result){
  return `<details class="baseup-detail-summary baseup-no-print">
    <summary>計算詳細を表示</summary>
    <div class="baseup-detail-grid">
      <div><span>年間総原資</span><strong>${baseupYen(result.resources.annualTotal)}</strong></div>
      <div><span>安全率</span><strong>${Math.round(baseupSafetyRate(baseupCalcState.allocation.safety) * 100)}%</strong></div>
      <div><span>総コスト上限</span><strong>${baseupYen(result.totalCostLimit)}</strong></div>
      <div><span>対象職員数</span><strong>${baseupCalcState.staff.filter(s=>getBaseupStaffEligibility(s, baseupCalcState).eligible).length}人</strong></div>
      <div><span>試算対象職員数</span><strong>${result.staffRows.length}人</strong></div>
      ${result.staffRows.map(r=>`<div><span>${r.staff.alias} 総コスト枠</span><strong>${baseupYen(r.totalCostFrame)}</strong><small>負担率 約${(r.employerBurdenRate*100).toFixed(2)}% / 賃上げ本体 ${baseupYen(r.annualRaise)} / 法定福利費 ${baseupYen(r.employerCost)}</small></div>`).join('')}
    </div>
  </details>`;
}

function renderBaseupStaffResultTable(result){
  return `<div class="baseup-staff-result-cards">
    ${result.staffRows.map(r=>{
      const eligibility = getBaseupStaffEligibility(r.staff, baseupCalcState);
      const bonusText = r.bonusInstallments.length
        ? r.bonusInstallments.map(item => `${item.label} ${baseupYen(item.amount)}`).join(' / ')
        : (baseupHasBonusPlan(baseupCalcState) ? '賞与等配分 0円' : '賞与支給予定なし');
      return `<article class="baseup-staff-result-card">
        <div class="baseup-staff-result-head">
          <div><strong>${r.staff.alias}</strong><small title="${typeof employeeJobTypeLabel === 'function' ? employeeJobTypeLabel(r.staff.jobType) : r.staff.jobType}">${baseupOccupationShortLabel(r.staff.jobType)} / ${eligibility.eligible ? '対象' : '対象外'}</small></div>
          <span class="badge ${eligibility.eligible?'bb':'bgr'}">${eligibility.eligible?'対象':'対象外'}</span>
        </div>
        <div class="baseup-pay-result-grid">
          <div class="baseup-pay-result-main"><span>毎月</span><strong>+${baseupYen(r.monthlyRaise)}</strong></div>
          <div class="baseup-pay-result-main"><span>賞与等</span><strong>+${baseupYen(r.bonusAllocation)}</strong></div>
          <div><span>年間月額分</span><strong>${baseupYen(r.monthlyAnnualRaise)}</strong></div>
          <div><span>年間賃上げ合計</span><strong>${baseupYen(r.annualRaise)}</strong></div>
          <div><span>法定福利費概算</span><strong>${baseupYen(r.employerCost)}</strong></div>
          <div><span>年間総コスト</span><strong>${baseupYen(r.totalCost)}</strong></div>
        </div>
        <div class="baseup-bonus-installments">${bonusText}</div>
        <details class="baseup-staff-details baseup-no-print">
          <summary>法定福利費など詳細</summary>
          <div class="baseup-detail-grid">
            <div><span>健康保険</span><strong>${baseupYen(r.benefitCosts.health)}</strong></div>
            <div><span>介護保険</span><strong>${baseupYen(r.benefitCosts.care)}</strong></div>
            <div><span>厚生年金</span><strong>${baseupYen(r.benefitCosts.pension)}</strong></div>
            <div><span>子育て支援金</span><strong>${baseupYen(r.benefitCosts.childCareSupport)}</strong></div>
            <div><span>子育て拠出金</span><strong>${baseupYen(r.benefitCosts.childCareContribution)}</strong></div>
            <div><span>雇用保険</span><strong>${baseupYen(r.benefitCosts.employment)}</strong></div>
            <div><span>労災保険</span><strong>${baseupYen(r.benefitCosts.workersComp)}</strong></div>
            <div><span>介護保険対象月数</span><strong>${r.careMonths}か月</strong></div>
          </div>
          <div class="baseup-detail-note">対象外理由：${eligibility.eligible ? '—' : eligibility.reason} / 備考：${r.notes.join(' / ') || '—'}</div>
        </details>
      </article>`;
    }).join('')}
  </div>`;
}

function renderBaseupScenarioSection(result){
  const scenarios = [['患者数20％減',0.8],['患者数10％減',0.9],['現状',1],['患者数10％増',1.1]];
  return `<section class="baseup-calc-card">
    <div class="baseup-calc-title">患者数変動シミュレーション</div>
    <div class="tw"><table><thead><tr><th>シナリオ</th><th>年間原資</th><th>総コスト上限</th><th>月額配分合計</th><th>賞与等配分</th><th>法定福利費</th><th>余剰</th><th>現推奨額維持時</th></tr></thead>
    <tbody>${scenarios.map(([label,factor])=>{
      const scenario = calculateBaseupAllocation(baseupCalcState,factor);
      const keepBalance = scenario.resources.annualTotal - result.totalCost;
      return `<tr><td>${label}</td><td>${baseupYen(scenario.resources.annualTotal)}</td><td>${baseupYen(scenario.totalCostLimit)}</td><td>${baseupYen(scenario.totalMonthlyAnnualRaise)}</td><td>${baseupYen(scenario.totalBonusAllocation)}</td><td>${baseupYen(scenario.totalEmployerCost)}</td><td class="${scenario.costLimitBalance<0?'baseup-negative':'baseup-positive'}">${baseupYen(scenario.costLimitBalance)}</td><td class="${keepBalance<0?'baseup-negative':'baseup-positive'}">${keepBalance<0?'不足':'原資内'} ${baseupYen(keepBalance)}</td></tr>`;
    }).join('')}</tbody></table></div>
  </section>`;
}

function bindBaseupCalculatorEvents(){
  document.querySelectorAll('.baseup-input,[data-staff-field]').forEach(el=>{
    el.addEventListener('change',()=>{
      if(el.dataset.pointInput) baseupCalcState.points.manualOverride = true;
      const changedPath = el.dataset.baseupPath || '';
      const changedStaffField = el.dataset.staffField || '';
      syncBaseupStateFromForm();
      if(
        baseupIsAllocationPath(changedPath) ||
        el.dataset.baseupBonusMonthIndex !== undefined ||
        ['bonusEligible','bonusAllocationEligible','useBonusAllocation','desiredBonusAllocation','baseupTarget'].includes(changedStaffField)
      ){
        baseupMarkAllocationDirty();
      }
      if(el.classList.contains('baseup-master-trigger') || el.dataset.masterTrigger){
        applyBaseupRateMasterToState();
        applyBaseupPointMasterToState(false);
      }
      if(baseupCalcState.clinic.feeType === 'i-ii' && el.dataset.baseupPath === 'clinic.feeType') applyBaseupFee2MasterToState();
      if(el.classList.contains('baseup-fee2-trigger')) {
        baseupCalcState.fee2.manualOverride = false;
        applyBaseupFee2MasterToState();
      }
      renderBaseupCalculator();
    });
  });
  document.getElementById('baseup-apply-allocation-settings')?.addEventListener('click',baseupApplyAllocationSettings);
  document.getElementById('baseup-toggle-point-details')?.addEventListener('click',()=>{
    syncBaseupStateFromForm();
    baseupCalcState.points.detailsOpen = !baseupCalcState.points.detailsOpen;
    renderBaseupCalculator();
  });
  document.getElementById('baseup-restore-master-points')?.addEventListener('click',()=>{
    syncBaseupStateFromForm();
    applyBaseupPointMasterToState(true);
    applyBaseupFee2MasterToState();
    renderBaseupCalculator();
  });
  document.getElementById('baseup-load-employees')?.addEventListener('click',()=>{
    syncBaseupStateFromForm();
    loadBaseupStaffFromEmployeeMaster();
    baseupCalcState.meta = {
      ...(baseupCalcState.meta || {}),
      allocationDirty:false,
      lastAppliedAt:new Date().toISOString()
    };
    if(typeof showAppToast === 'function') showAppToast('従業員マスタを読み込みました。','success');
    renderBaseupCalculator();
  });
  document.getElementById('baseup-apply-employee-overrides')?.addEventListener('click',()=>{
    syncBaseupStateFromForm();
    if(typeof updateEmployeeMasterFromBaseupStaff === 'function') updateEmployeeMasterFromBaseupStaff(baseupCalcState.staff);
  });
  document.querySelectorAll('.baseup-apply-employee-overrides-inline').forEach(button => {
    button.addEventListener('click',()=>{
      syncBaseupStateFromForm();
      if(typeof updateEmployeeMasterFromBaseupStaff === 'function') updateEmployeeMasterFromBaseupStaff(baseupCalcState.staff);
    });
  });
  document.getElementById('baseup-show-targets-only')?.addEventListener('change',event=>{
    syncBaseupStateFromForm();
    baseupCalcState.allocation.showOnlyTargets = event.target.checked;
    loadBaseupStaffFromEmployeeMaster({onlyTargets:event.target.checked});
    renderBaseupCalculator();
  });
}

function clearBaseupCalculator(){
  if(!confirm('入力中の試算内容をクリアします。暗号化保存していない内容は復元できません。')) return;
  baseupCalcState = baseupClone(BASEUP_CALCULATOR_DEFAULT_STATE);
  applyBaseupRateMasterToState();
  applyBaseupPointMasterToState(true);
  renderBaseupCalculator();
}
