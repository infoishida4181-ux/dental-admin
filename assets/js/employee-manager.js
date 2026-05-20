/* 従業員情報管理
 * 給与・労務情報はメモリまたは暗号化済みデータのみで扱う。
 */
const EMPLOYEE_VAULT_DB_NAME = 'dental_employee_secure_v1';
const EMPLOYEE_VAULT_STORE = 'encryptedVault';
const EMPLOYEE_VAULT_KEY = 'employee-master';
const EMPLOYEE_DATA_VERSION = '1.0.0';
const WAREKI_STARTS = {
  showa: { label:'昭和', offset:1925, start:'1926-12-25', end:'1989-01-07' },
  heisei: { label:'平成', offset:1988, start:'1989-01-08', end:'2019-04-30' },
  reiwa: { label:'令和', offset:2018, start:'2019-05-01', end:'' }
};

let employeeMasterState = {
  employees: [],
  unlocked: false,
  source: 'empty',
  updatedAt: '',
  lastOpenedAt: ''
};

function showAppToast(message, type='info'){
  let host = document.getElementById('app-toast-host');
  if(!host){
    host = document.createElement('div');
    host.id = 'app-toast-host';
    host.className = 'app-toast-host';
    document.body.appendChild(host);
  }
  const toast = document.createElement('div');
  toast.className = `app-toast app-toast-${type}`;
  toast.innerHTML = `<span>${message}</span><button type="button" aria-label="閉じる">×</button>`;
  host.appendChild(toast);
  const close = () => {
    toast.classList.add('is-hiding');
    setTimeout(() => toast.remove(), 220);
  };
  toast.querySelector('button').onclick = close;
  setTimeout(close, type === 'error' ? 6500 : 4600);
}

function employeeClone(value){
  return JSON.parse(JSON.stringify(value));
}

function employeeNextId(){
  const nums = employeeMasterState.employees
    .map(e => String(e.employeeId||'').match(/EMP-(\d+)/)?.[1])
    .filter(Boolean)
    .map(Number);
  const next = nums.length ? Math.max(...nums) + 1 : employeeMasterState.employees.length + 1;
  return `EMP-${String(next).padStart(4,'0')}`;
}

function createEmployeeRecord(index){
  return {
    employeeId: employeeNextId(),
    displayName: `職員${index}`,
    jobType: 'dentalHygienist',
    employmentType: 'fulltime',
    workerRoleForBaseup: 'worker',
    weeklyHours: 40,
    monthlySalary: 0,
    baseSalary: 0,
    fixedMonthlyAllowance: 0,
    commutingAllowance: 0,
    otherMonthlyAllowance: 0,
    monthlySalaryTotal: 0,
    hourlyWage: 0,
    annualBonus: 0,
    bonusEligible: true,
    bonusAllocationEligible: true,
    plannedAnnualBonus: 0,
    useBonusAllocation: true,
    birthDateEra: 'showa',
    birthDateEraYear: '',
    birthDateMonth: '',
    birthDateDay: '',
    birthDateIso: '',
    ageJudgementMode: 'auto',
    manualCareInsuranceTarget: false,
    joinedAt: '',
    retiredAt: '',
    baseupTarget: true,
    socialInsurance: true,
    healthInsuranceType: 'kyokaiTokyo',
    pension: true,
    employmentInsurance: true,
    workersComp: true,
    careAge: false,
    childCareSupport: 'auto',
    childCareContribution: 'auto',
    memo: ''
  };
}

function getCurrentReferenceDate(){
  return new Date().toISOString().slice(0,10);
}

function convertWarekiToIsoDate(era, eraYear, month, day){
  const info = WAREKI_STARTS[era];
  const y = Number(eraYear);
  const m = Number(month);
  const d = Number(day);
  if(!info || !y || !m || !d) return { iso:'', error:'' };
  const year = info.offset + y;
  const date = new Date(Date.UTC(year, m - 1, d));
  if(date.getUTCFullYear() !== year || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d){
    return { iso:'', error:'存在しない日付です。' };
  }
  const iso = `${year}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  if(iso > getCurrentReferenceDate()) return { iso, error:'未来日の生年月日は入力できません。' };
  if(info.start && iso < info.start) return { iso, error:`${info.label}の範囲外の日付です。` };
  if(info.end && iso > info.end) return { iso, error:`${info.label}の範囲外の日付です。` };
  return { iso, error:'' };
}

function calculateAgeOnDate(birthDateIso, referenceDateIso=getCurrentReferenceDate()){
  if(!birthDateIso || !referenceDateIso) return null;
  const birth = new Date(`${birthDateIso}T00:00:00Z`);
  const ref = new Date(`${referenceDateIso}T00:00:00Z`);
  if(Number.isNaN(birth.getTime()) || Number.isNaN(ref.getTime()) || birth > ref) return null;
  let age = ref.getUTCFullYear() - birth.getUTCFullYear();
  const refMd = (ref.getUTCMonth()+1) * 100 + ref.getUTCDate();
  const birthMd = (birth.getUTCMonth()+1) * 100 + birth.getUTCDate();
  if(refMd < birthMd) age -= 1;
  return age;
}

function addYearsMinusOneDay(dateIso, years){
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

function monthStart(date){
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(date, months){
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function isCareInsuranceAgeOnDate(birthDateIso, referenceDateIso=getCurrentReferenceDate()){
  const age = calculateAgeOnDate(birthDateIso, referenceDateIso);
  return age !== null && age >= 40 && age < 65;
}

function calculateCareInsuranceMonthsInFiscalYear(birthDateIso, fiscalYearStartIso, fiscalYearEndIso){
  if(!birthDateIso || !fiscalYearStartIso || !fiscalYearEndIso) return null;
  const start = monthStart(new Date(`${fiscalYearStartIso}T00:00:00Z`));
  const end = monthStart(new Date(`${fiscalYearEndIso}T00:00:00Z`));
  const endExclusive = addMonths(end, 1);
  const careStart = monthStart(addYearsMinusOneDay(birthDateIso, 40));
  const careEndExclusive = monthStart(addYearsMinusOneDay(birthDateIso, 65));
  let count = 0;
  for(let cursor = start; cursor < endExclusive; cursor = addMonths(cursor, 1)){
    if(cursor >= careStart && cursor < careEndExclusive) count += 1;
  }
  return count;
}

function employeeBirthInfo(employee, referenceDateIso=getCurrentReferenceDate()){
  const converted = convertWarekiToIsoDate(employee.birthDateEra, employee.birthDateEraYear, employee.birthDateMonth, employee.birthDateDay);
  const iso = converted.iso || employee.birthDateIso || '';
  const age = iso ? calculateAgeOnDate(iso, referenceDateIso) : null;
  const autoCare = iso ? isCareInsuranceAgeOnDate(iso, referenceDateIso) : null;
  return { iso, age, autoCare, error: converted.error };
}

function normalizeEmployeePayload(payload){
  const employees = Array.isArray(payload?.employees) ? payload.employees : [];
  return {
    version: payload?.version || EMPLOYEE_DATA_VERSION,
    updatedAt: payload?.updatedAt || new Date().toISOString(),
    employees: employees.map((employee, index) => {
      const defaults = createEmployeeRecord(index + 1);
      const merged = {
        ...defaults,
        ...employee,
        employeeId: employee.employeeId || `EMP-${String(index+1).padStart(4,'0')}`,
        displayName: employee.displayName || employee.alias || `職員${index+1}`,
        birthDateEra: employee.birthDateEra || 'showa',
        birthDateEraYear: employee.birthDateEraYear || '',
        birthDateMonth: employee.birthDateMonth || '',
        birthDateDay: employee.birthDateDay || '',
        birthDateIso: employee.birthDateIso || '',
        ageJudgementMode: employee.ageJudgementMode || (employee.birthDateIso ? 'auto' : 'manual'),
        manualCareInsuranceTarget: employee.manualCareInsuranceTarget === true,
        bonusEligible: employee.bonusEligible !== false,
        bonusAllocationEligible: employee.bonusAllocationEligible !== false,
        plannedAnnualBonus: employeeNumber(employee.plannedAnnualBonus !== undefined ? employee.plannedAnnualBonus : employee.annualBonus),
        useBonusAllocation: employee.useBonusAllocation !== false,
        workerRoleForBaseup: employee.workerRoleForBaseup || 'worker',
        baseupTarget: employee.baseupTarget !== false,
        workersComp: employee.workersComp !== false
      };
      const splitTotal = employeeSalaryTotal(merged);
      const hasSplitSalary = ['baseSalary','fixedMonthlyAllowance','commutingAllowance','otherMonthlyAllowance']
        .some(key => employee[key] !== undefined && employeeNumber(employee[key]) > 0);
      if(!hasSplitSalary && employee.monthlySalary !== undefined && employeeNumber(employee.monthlySalary) > 0){
        merged.baseSalary = employeeNumber(employee.monthlySalary);
        merged.fixedMonthlyAllowance = 0;
        merged.commutingAllowance = 0;
        merged.otherMonthlyAllowance = 0;
        merged.legacySalaryMigrated = true;
      }
      merged.monthlySalaryTotal = employeeSalaryTotal(merged);
      merged.monthlySalary = merged.monthlySalaryTotal || splitTotal || employeeNumber(employee.monthlySalary);
      return merged;
    })
  };
}

function getEmployeeSecurePayload(){
  return {
    version: EMPLOYEE_DATA_VERSION,
    updatedAt: new Date().toISOString(),
    employees: employeeClone(employeeMasterState.employees)
  };
}

function employeeJobTypeLabel(value){
  return {
    dentist:'歯科医師',
    doctor:'医師',
    dentalHygienist:'歯科衛生士',
    dentalAssistant:'歯科助手',
    reception:'受付',
    office:'事務',
    dentalTechnician:'歯科技工士',
    other:'その他'
  }[value] || value || 'その他';
}

function employeeWorkerRoleLabel(value){
  return {
    worker:'勤務者',
    ownerOfficer:'経営者・役員',
    contractor:'業務委託',
    excluded:'対象外'
  }[value] || value || '勤務者';
}

function employeeEmploymentLabel(value){
  return {
    fulltime:'常勤',
    parttime:'非常勤',
    hourly:'パート',
    casual:'アルバイト',
    other:'その他'
  }[value] || value || 'その他';
}

function employeeInsuranceLabel(value){
  return {
    kyokaiTokyo:'協会けんぽ 東京',
    tokyoDentalHealth:'東京都歯科健康保険組合',
    otherHealth:'その他健保組合',
    dentalKokuho:'歯科医師国保',
    municipalKokuho:'市町村国保',
    none:'社保なし'
  }[value] || value || '未選択';
}

function employeeBoolOption(value,label,current){
  return `<option value="${value}" ${String(value)===String(current)?'selected':''}>${label}</option>`;
}

function employeeOption(value,label,current){
  return `<option value="${value}" ${value===current?'selected':''}>${label}</option>`;
}

function employeeNumber(value){
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function employeeSalaryTotal(employee, includeCommuting=true){
  return employeeNumber(employee.baseSalary)
    + employeeNumber(employee.fixedMonthlyAllowance)
    + (includeCommuting ? employeeNumber(employee.commutingAllowance) : 0)
    + employeeNumber(employee.otherMonthlyAllowance);
}

function isDoctorOrDentist(employee){
  return ['doctor','dentist'].includes(employee?.jobType);
}

function isUnder40OnDate(employee, referenceDateIso=getCurrentReferenceDate()){
  const birth = employeeBirthInfo(employee, referenceDateIso);
  return birth.age !== null && birth.age < 40;
}

function isExcludedByRole(employee){
  return ['ownerOfficer','contractor','excluded'].includes(employee?.workerRoleForBaseup);
}

function getBaseupEligibility(employee, referenceDateIso=getCurrentReferenceDate()){
  if(isExcludedByRole(employee)){
    return { eligible:false, reason:employeeWorkerRoleLabel(employee.workerRoleForBaseup) };
  }
  if(isDoctorOrDentist(employee)){
    const birth = employeeBirthInfo(employee, referenceDateIso);
    const title = employee.jobType === 'dentist' ? '歯科医師' : '医師';
    if(birth.age === null) return { eligible:false, reason:`${title}の年齢未判定` };
    if(birth.age >= 40) return { eligible:false, reason:`40歳以上の${title}` };
    if(employee.baseupTarget === false) return { eligible:false, reason:'手動で対象外' };
    return { eligible:true, reason:`40歳未満の勤務${title}` };
  }
  if(employee.baseupTarget === false) return { eligible:false, reason:'手動で対象外' };
  return { eligible:true, reason:'対象職員' };
}

function employeeFormatIsoDate(iso){
  if(!iso) return '未入力';
  const [y,m,d] = iso.split('-');
  return `${y}年${m}月${d}日`;
}

function syncEmployeesFromForm(){
  document.querySelectorAll('[data-employee-id]').forEach(row => {
    const employee = employeeMasterState.employees.find(e => e.employeeId === row.dataset.employeeId);
    if(!employee) return;
    row.querySelectorAll('[data-employee-field]').forEach(el => {
      const key = el.dataset.employeeField;
      if(['weeklyHours','monthlySalary','baseSalary','fixedMonthlyAllowance','commutingAllowance','otherMonthlyAllowance','hourlyWage','annualBonus','plannedAnnualBonus','birthDateEraYear','birthDateMonth','birthDateDay'].includes(key)) employee[key] = employeeNumber(el.value) || '';
      else if(['baseupTarget','socialInsurance','pension','employmentInsurance','workersComp','careAge','manualCareInsuranceTarget','bonusEligible','bonusAllocationEligible','useBonusAllocation'].includes(key)) employee[key] = el.value === 'true';
      else employee[key] = el.value;
    });
    employee.monthlySalaryTotal = employeeSalaryTotal(employee);
    employee.monthlySalary = employee.monthlySalaryTotal;
    const birth = employeeBirthInfo(employee);
    employee.birthDateIso = birth.iso;
    if(employee.ageJudgementMode === 'auto' && birth.autoCare !== null){
      employee.careAge = birth.autoCare;
    }else if(employee.ageJudgementMode === 'manual'){
      employee.careAge = employee.manualCareInsuranceTarget === true;
    }
  });
}

function renderEmployees(){
  const body = document.getElementById('employees-body');
  if(!body) return;
  const employees = employeeMasterState.employees;
  const targetCount = employees.filter(e => getBaseupEligibility(e).eligible).length;
  body.innerHTML = `
    <div class="employee-shell">
      <section class="employee-card">
        <div class="employee-card-title">従業員情報の保存について</div>
        <div class="employee-note">
          従業員情報はこの端末内に暗号化して保存できます。歯科医師会、管理者、事務局、外部サーバーには送信されません。<br>
          生年月日は年齢・介護保険対象判定のために使用します。生年月日を含む従業員情報は、この端末内に暗号化保存され、外部には送信されません。<br>
          歯科医師・医師については、40歳未満の勤務者のみベースアップ評価料の対象として扱います。40歳以上、経営者・役員、業務委託は対象外です。<br>
          通勤手当は、月額賃金、社会保険・労働保険、賃上げ配分のいずれで見るかにより扱いが変わる場合があります。本アプリでは計算目的ごとに含める／含めないを切り替えられるようにしています。<br>
          この端末に暗号化保存した従業員情報は、現在開いているブラウザ・URLごとに保存されます。PC変更、ブラウザ変更、アプリURL変更時には自動では引き継がれません。<br>
          PC変更やURL変更に備えて、定期的に暗号化JSONバックアップを保存してください。暗号化JSONバックアップとパスワードは各医院の責任で管理してください。パスワードを忘れると復元できません。
        </div>
        <div class="employee-status">
          <span class="employee-source-pill">${employeeMasterState.unlocked ? '暗号化データ展開中' : '未展開'}</span>
          <span class="badge bgr">登録 ${employees.length}人</span>
          <span class="badge ${targetCount ? 'bb' : 'by'}">ベースアップ対象 ${targetCount}人</span>
        </div>
        <div class="employee-actions">
          <button class="btn btn-secondary" type="button" onclick="saveEmployeeVaultToDevice()">この端末に暗号化保存</button>
          <button class="btn btn-ghost" type="button" onclick="openEmployeeVaultFromDevice()">この端末の暗号化データを開く</button>
          <button class="btn btn-secondary" type="button" onclick="backupEmployeeVaultJson()">暗号化JSONとしてバックアップ</button>
          <label class="btn btn-ghost" for="employee-json-import-file">暗号化JSONを読み込む</label>
          <input id="employee-json-import-file" type="file" accept=".json,.employee-secure.json,application/json" hidden>
          <button class="btn btn-danger" type="button" onclick="clearEmployeeMaster()">従業員情報をクリア</button>
        </div>
        <div class="employee-vault-alert" style="margin-top:10px">端末内保存を使わず、暗号化JSONのバックアップと読み込みだけで運用することもできます。</div>
        <div class="employee-vault-alert" style="margin-top:8px">介護保険料の対象月数は概算です。実際の給与控除月や保険料徴収月は、加入先・給与計算方法・社労士確認に従ってください。</div>
      </section>

      <section class="employee-card employee-security-card">
        <div class="employee-card-title">保存方式の確認</div>
        <div class="employee-security-grid">
          <div><span>給与情報</span><strong>クラウド送信なし</strong></div>
          <div><span>従業員情報</span><strong>端末内暗号化保存</strong></div>
          <div><span>バックアップ</span><strong>暗号化JSON</strong></div>
          <div><span>パスワード</span><strong>保存しない</strong></div>
          <div><span>管理者・事務局</span><strong>閲覧不可</strong></div>
          <div><span>注意</span><strong>PCとバックアップ管理は各医院の責任</strong></div>
        </div>
      </section>

      <section class="employee-card">
        <div class="employee-row-head">
          <div>
            <div class="employee-card-title" style="margin-bottom:2px">従業員マスタ</div>
            <div class="employee-note">実名ではなく、職員1・職員2・DH1・受付1などの匿名名でも管理できます。</div>
          </div>
          <button class="btn btn-primary" type="button" onclick="addEmployeeRecord()">従業員を追加</button>
        </div>
        ${employees.length ? `<div class="employee-list">${employees.map(renderEmployeeRow).join('')}</div>` : '<div class="employee-empty">従業員はまだ登録されていません。「従業員を追加」から任意の人数を登録してください。</div>'}
      </section>
    </div>
  `;
  document.getElementById('employee-json-import-file')?.addEventListener('change', async event => {
    const file = event.target.files && event.target.files[0];
    if(!file) return;
    try{
      await importEmployeeVaultJson(file);
    }finally{
      event.target.value = '';
    }
  });
  document.querySelectorAll('[data-employee-field]').forEach(el => {
    el.addEventListener('change', () => {
      syncEmployeesFromForm();
      renderEmployees();
      if(typeof renderBaseupCalculator === 'function') renderBaseupCalculator();
    });
  });
}

function renderEmployeeRow(employee){
  const birth = employeeBirthInfo(employee);
  const eligibility = getBaseupEligibility(employee);
  const salaryTotal = employeeSalaryTotal(employee);
  const careAuto = birth.autoCare;
  const isAuto = employee.ageJudgementMode !== 'manual' && Boolean(birth.iso);
  const careLabel = isAuto
    ? `生年月日から自動判定：${careAuto ? '対象' : '対象外'}`
    : `手動判定：${employee.manualCareInsuranceTarget ? '対象' : '対象外'}`;
  const isoLabel = employeeFormatIsoDate(birth.iso);
  return `<div class="employee-row" data-employee-id="${employee.employeeId}">
    <div class="employee-row-head">
      <strong>${employee.displayName || employee.employeeId}</strong>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <span class="badge bgr">${employee.employeeId}</span>
        <button class="btn btn-ghost" type="button" onclick="removeEmployeeRecord('${employee.employeeId}')">削除</button>
      </div>
    </div>
    <div class="employee-grid">
      <label><span>表示名</span><input class="fi" data-employee-field="displayName" value="${employee.displayName||''}" placeholder="職員1 / DH1 / 受付1"></label>
      <label><span>職種</span><select class="fs" data-employee-field="jobType">${employeeOption('dentist','歯科医師',employee.jobType)}${employeeOption('doctor','医師',employee.jobType)}${employeeOption('dentalHygienist','歯科衛生士',employee.jobType)}${employeeOption('dentalAssistant','歯科助手',employee.jobType)}${employeeOption('reception','受付',employee.jobType)}${employeeOption('office','事務',employee.jobType)}${employeeOption('dentalTechnician','歯科技工士',employee.jobType)}${employeeOption('other','その他',employee.jobType)}</select></label>
      <label><span>雇用形態</span><select class="fs" data-employee-field="employmentType">${employeeOption('fulltime','常勤',employee.employmentType)}${employeeOption('parttime','非常勤',employee.employmentType)}${employeeOption('hourly','パート',employee.employmentType)}${employeeOption('casual','アルバイト',employee.employmentType)}${employeeOption('other','その他',employee.employmentType)}</select></label>
      <label><span>対象判定上の立場</span><select class="fs" data-employee-field="workerRoleForBaseup">${employeeOption('worker','勤務者',employee.workerRoleForBaseup)}${employeeOption('ownerOfficer','経営者・役員',employee.workerRoleForBaseup)}${employeeOption('contractor','業務委託',employee.workerRoleForBaseup)}${employeeOption('excluded','対象外',employee.workerRoleForBaseup)}</select></label>
      <label><span>週勤務時間</span><input class="fi" type="number" min="0" step="0.5" data-employee-field="weeklyHours" value="${employee.weeklyHours ?? 0}"></label>
      <div class="employee-pay-block">
        <span>月額給与内訳</span>
        <div class="employee-pay-grid">
          <label><span>基本給</span><input class="fi" type="number" min="0" data-employee-field="baseSalary" value="${employee.baseSalary ?? 0}"></label>
          <label><span>毎月固定手当</span><input class="fi" type="number" min="0" data-employee-field="fixedMonthlyAllowance" value="${employee.fixedMonthlyAllowance ?? 0}"></label>
          <label><span>通勤手当</span><input class="fi" type="number" min="0" data-employee-field="commutingAllowance" value="${employee.commutingAllowance ?? 0}"></label>
          <label><span>その他月額手当</span><input class="fi" type="number" min="0" data-employee-field="otherMonthlyAllowance" value="${employee.otherMonthlyAllowance ?? 0}"></label>
        </div>
        <div class="employee-pay-total">月額給与合計：${salaryTotal.toLocaleString()} 円</div>
        ${employee.legacySalaryMigrated ? '<div class="employee-birth-meta">既存の月額給与は基本給として移行されています。必要に応じて手当・通勤手当を分けてください。</div>' : ''}
      </div>
      <label><span>時給（任意）</span><input class="fi" type="number" min="0" data-employee-field="hourlyWage" value="${employee.hourlyWage ?? 0}"></label>
      <div class="employee-pay-block">
        <span>賞与設定</span>
        <div class="employee-pay-grid">
          <label><span>賞与対象</span><select class="fs" data-employee-field="bonusEligible">${employeeBoolOption(true,'対象',employee.bonusEligible)}${employeeBoolOption(false,'対象外',employee.bonusEligible)}</select></label>
          <label><span>賞与配分対象</span><select class="fs" data-employee-field="bonusAllocationEligible">${employeeBoolOption(true,'対象',employee.bonusAllocationEligible)}${employeeBoolOption(false,'対象外',employee.bonusAllocationEligible)}</select></label>
          <label><span>現在の年間賞与予定額</span><input class="fi" type="number" min="0" data-employee-field="plannedAnnualBonus" value="${employee.plannedAnnualBonus ?? employee.annualBonus ?? 0}"></label>
          <label><span>ベースアップ賞与配分</span><select class="fs" data-employee-field="useBonusAllocation">${employeeBoolOption(true,'行う',employee.useBonusAllocation)}${employeeBoolOption(false,'行わない',employee.useBonusAllocation)}</select></label>
        </div>
      </div>
      <div class="employee-birth-block">
        <span>生年月日（和暦）</span>
        <div class="employee-birth-grid">
          <select class="fs" data-employee-field="birthDateEra">${employeeOption('showa','昭和',employee.birthDateEra)}${employeeOption('heisei','平成',employee.birthDateEra)}${employeeOption('reiwa','令和',employee.birthDateEra)}</select>
          <input class="fi" type="number" min="1" data-employee-field="birthDateEraYear" value="${employee.birthDateEraYear || ''}" placeholder="年">
          <input class="fi" type="number" min="1" max="12" data-employee-field="birthDateMonth" value="${employee.birthDateMonth || ''}" placeholder="月">
          <input class="fi" type="number" min="1" max="31" data-employee-field="birthDateDay" value="${employee.birthDateDay || ''}" placeholder="日">
        </div>
        <div class="employee-birth-meta">
          <span>西暦：${isoLabel}</span>
          <span>現在年齢：${birth.age === null ? '未判定' : `${birth.age}歳`}</span>
          <span>介護保険：${careLabel}</span>
          ${birth.error ? `<span class="employee-birth-error">${birth.error}</span>` : ''}
        </div>
      </div>
      <label><span>入職日（任意）</span><input class="fi" type="date" data-employee-field="joinedAt" value="${employee.joinedAt || ''}"></label>
      <label><span>退職日（任意）</span><input class="fi" type="date" data-employee-field="retiredAt" value="${employee.retiredAt || ''}"></label>
      <label><span>ベースアップ評価料の対象</span><select class="fs" data-employee-field="baseupTarget">${employeeBoolOption(true,'対象',employee.baseupTarget)}${employeeBoolOption(false,'対象外',employee.baseupTarget)}</select></label>
      <div class="employee-eligibility-card">
        <span>対象判定</span>
        <strong class="${eligibility.eligible ? 'employee-ok' : 'employee-ng'}">${eligibility.eligible ? '対象' : '対象外'}</strong>
        <small>${eligibility.reason}</small>
      </div>
      <label><span>社保加入</span><select class="fs" data-employee-field="socialInsurance">${employeeBoolOption(true,'あり',employee.socialInsurance)}${employeeBoolOption(false,'なし',employee.socialInsurance)}</select></label>
      <label><span>健康保険種別</span><select class="fs" data-employee-field="healthInsuranceType">${employeeOption('kyokaiTokyo','協会けんぽ 東京',employee.healthInsuranceType)}${employeeOption('tokyoDentalHealth','東京都歯科健康保険組合',employee.healthInsuranceType)}${employeeOption('otherHealth','その他健保組合',employee.healthInsuranceType)}${employeeOption('dentalKokuho','歯科医師国保',employee.healthInsuranceType)}${employeeOption('municipalKokuho','市町村国保',employee.healthInsuranceType)}${employeeOption('none','社保なし',employee.healthInsuranceType)}</select></label>
      <label><span>厚生年金加入</span><select class="fs" data-employee-field="pension">${employeeBoolOption(true,'あり',employee.pension)}${employeeBoolOption(false,'なし',employee.pension)}</select></label>
      <label><span>雇用保険加入</span><select class="fs" data-employee-field="employmentInsurance">${employeeBoolOption(true,'あり',employee.employmentInsurance)}${employeeBoolOption(false,'なし',employee.employmentInsurance)}</select></label>
      <label><span>労災保険対象</span><select class="fs" data-employee-field="workersComp">${employeeBoolOption(true,'はい',employee.workersComp)}${employeeBoolOption(false,'いいえ',employee.workersComp)}</select></label>
      <label><span>介護保険判定</span><select class="fs" data-employee-field="ageJudgementMode">${employeeOption('auto','生年月日から自動判定',employee.ageJudgementMode)}${employeeOption('manual','年齢判定を手動上書き',employee.ageJudgementMode)}</select></label>
      <label><span>手動時の介護保険対象</span><select class="fs" data-employee-field="manualCareInsuranceTarget" ${isAuto ? 'disabled' : ''}>${employeeBoolOption(true,'対象',employee.manualCareInsuranceTarget)}${employeeBoolOption(false,'対象外',employee.manualCareInsuranceTarget)}</select></label>
      <label><span>子ども・子育て支援金対象</span><select class="fs" data-employee-field="childCareSupport">${employeeOption('auto','自動判定',employee.childCareSupport)}${employeeOption('yes','はい',employee.childCareSupport)}${employeeOption('no','いいえ',employee.childCareSupport)}</select></label>
      <label><span>子ども・子育て拠出金対象</span><select class="fs" data-employee-field="childCareContribution">${employeeOption('auto','自動判定',employee.childCareContribution)}${employeeOption('yes','はい',employee.childCareContribution)}${employeeOption('no','いいえ',employee.childCareContribution)}</select></label>
      <label style="grid-column:1/-1"><span>メモ（任意）</span><input class="fi" data-employee-field="memo" value="${employee.memo || ''}" placeholder="社労士確認メモなど"></label>
    </div>
  </div>`;
}

function addEmployeeRecord(){
  syncEmployeesFromForm();
  employeeMasterState.employees.push(createEmployeeRecord(employeeMasterState.employees.length + 1));
  employeeMasterState.unlocked = true;
  employeeMasterState.source = 'memory';
  renderEmployees();
  if(typeof renderBaseupCalculator === 'function') renderBaseupCalculator();
}

function removeEmployeeRecord(employeeId){
  if(!confirm('この従業員を一覧から削除します。暗号化保存またはバックアップするまで、保存済みデータには反映されません。')) return;
  syncEmployeesFromForm();
  employeeMasterState.employees = employeeMasterState.employees.filter(e => e.employeeId !== employeeId);
  renderEmployees();
  if(typeof renderBaseupCalculator === 'function') renderBaseupCalculator();
}

function clearEmployeeMaster(){
  if(!confirm('画面上の従業員情報をクリアします。端末内の暗号化保存データを削除するものではありません。')) return;
  employeeMasterState = { employees: [], unlocked: false, source: 'empty', updatedAt: '', lastOpenedAt: '' };
  renderEmployees();
  if(typeof renderBaseupCalculator === 'function') renderBaseupCalculator();
}

function showEmployeePasswordDialog(mode){
  return new Promise((resolve, reject) => {
    const existing = document.getElementById('employee-password-overlay');
    if(existing) existing.remove();
    const needsConfirm = mode === 'save' || mode === 'backup';
    const overlay = document.createElement('div');
    overlay.id = 'employee-password-overlay';
    overlay.className = 'overlay open';
    overlay.innerHTML = `
      <div class="modal" style="max-width:460px">
        <div class="mt">${needsConfirm ? '従業員情報を暗号化' : '従業員情報を開く'}</div>
        <div class="ms">パスワードは保存されません。忘れた場合、従業員情報を復元できません。</div>
        <div class="form-error" id="employee-password-error"></div>
        <div class="fr"><div class="fl">パスワード（8文字以上推奨）</div><input type="password" class="fi" id="employee-secure-password" autocomplete="new-password"></div>
        ${needsConfirm ? '<div class="fr"><div class="fl">パスワード確認</div><input type="password" class="fi" id="employee-secure-password-confirm" autocomplete="new-password"></div>' : ''}
        <div class="employee-vault-alert">この端末に暗号化して保存します。PC管理、パスワード管理、バックアップ管理は各医院の責任で行ってください。</div>
        <div class="mf">
          <button class="btn btn-ghost" id="employee-password-cancel" type="button">キャンセル</button>
          <button class="btn btn-primary" id="employee-password-ok" type="button">${needsConfirm ? '暗号化する' : '開く'}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const error = document.getElementById('employee-password-error');
    const close = () => overlay.remove();
    document.getElementById('employee-password-cancel').onclick = () => { close(); reject(new Error('キャンセルしました。')); };
    document.getElementById('employee-password-ok').onclick = () => {
      const password = document.getElementById('employee-secure-password').value;
      const confirmPassword = document.getElementById('employee-secure-password-confirm')?.value;
      if(!password || password.length < 8){
        error.textContent = 'パスワードは8文字以上を推奨します。';
        error.style.display = 'block';
        return;
      }
      if(needsConfirm && password !== confirmPassword){
        error.textContent = 'パスワードが一致しません。';
        error.style.display = 'block';
        return;
      }
      close();
      resolve(password);
    };
    setTimeout(() => document.getElementById('employee-secure-password')?.focus(), 0);
  });
}

function openEmployeeVaultDb(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(EMPLOYEE_VAULT_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if(!db.objectStoreNames.contains(EMPLOYEE_VAULT_STORE)) db.createObjectStore(EMPLOYEE_VAULT_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error('端末内の暗号化保管庫を開けませんでした。'));
  });
}

async function putEmployeeVaultObject(encryptedObject){
  const db = await openEmployeeVaultDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(EMPLOYEE_VAULT_STORE, 'readwrite');
    tx.objectStore(EMPLOYEE_VAULT_STORE).put(encryptedObject, EMPLOYEE_VAULT_KEY);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(new Error('端末内への暗号化保存に失敗しました。')); };
  });
}

async function getEmployeeVaultObject(){
  const db = await openEmployeeVaultDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(EMPLOYEE_VAULT_STORE, 'readonly');
    const req = tx.objectStore(EMPLOYEE_VAULT_STORE).get(EMPLOYEE_VAULT_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(new Error('端末内の暗号化データを読み込めませんでした。'));
    tx.oncomplete = () => db.close();
  });
}

async function saveEmployeeVaultToDevice(){
  syncEmployeesFromForm();
  if(!employeeMasterState.employees.length){
    showAppToast('保存する従業員情報がありません。', 'warn');
    return;
  }
  try{
    const password = await showEmployeePasswordDialog('save');
    const encrypted = await encryptSecureJsonPayload(getEmployeeSecurePayload(), password, SECURE_FEATURE_EMPLOYEE);
    await putEmployeeVaultObject(encrypted);
    employeeMasterState.unlocked = true;
    employeeMasterState.source = 'device';
    showAppToast('従業員情報をこの端末に暗号化保存しました。', 'success');
    renderEmployees();
  }catch(err){
    if(err.message !== 'キャンセルしました。') showAppToast(err.message || '暗号化保存に失敗しました。', 'error');
  }
}

async function openEmployeeVaultFromDevice(){
  try{
    const encrypted = await getEmployeeVaultObject();
    if(!encrypted){
      showAppToast('この端末に保存された従業員情報はありません。', 'warn');
      return;
    }
    const password = await showEmployeePasswordDialog('open');
    const payload = normalizeEmployeePayload(await decryptSecureJsonPayload(encrypted, password, [SECURE_FEATURE_EMPLOYEE]));
    employeeMasterState = { employees: payload.employees, unlocked: true, source: 'device', updatedAt: payload.updatedAt, lastOpenedAt: new Date().toISOString() };
    renderEmployees();
    if(typeof renderBaseupCalculator === 'function') renderBaseupCalculator();
    showAppToast('この端末の暗号化データを開きました。', 'success');
  }catch(err){
    if(err.message !== 'キャンセルしました。') showAppToast(err.message || '従業員情報を開けませんでした。', 'error');
  }
}

async function backupEmployeeVaultJson(){
  syncEmployeesFromForm();
  if(!employeeMasterState.employees.length){
    showAppToast('バックアップする従業員情報がありません。', 'warn');
    return;
  }
  try{
    const password = await showEmployeePasswordDialog('backup');
    const encrypted = await encryptSecureJsonPayload(getEmployeeSecurePayload(), password, SECURE_FEATURE_EMPLOYEE);
    const stamp = new Date().toISOString().slice(0,10).replace(/-/g,'');
    const blob = new Blob([JSON.stringify(encrypted,null,2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `employee-master-${stamp}.employee-secure.json`;
    a.click();
    URL.revokeObjectURL(url);
    showAppToast('暗号化JSONバックアップを作成しました。', 'success');
  }catch(err){
    if(err.message !== 'キャンセルしました。') showAppToast(err.message || '暗号化JSONの作成に失敗しました。', 'error');
  }
}

async function importEmployeeVaultJson(file){
  try{
    const text = await file.text();
    let encrypted;
    try{
      encrypted = JSON.parse(text);
    }catch(_err){
      throw new Error('ファイル形式が違います。');
    }
    const password = await showEmployeePasswordDialog('open');
    const payload = normalizeEmployeePayload(await decryptSecureJsonPayload(encrypted, password, [SECURE_FEATURE_EMPLOYEE]));
    employeeMasterState = { employees: payload.employees, unlocked: true, source: 'json', updatedAt: payload.updatedAt, lastOpenedAt: new Date().toISOString() };
    renderEmployees();
    if(typeof renderBaseupCalculator === 'function') renderBaseupCalculator();
    showAppToast('暗号化JSONから従業員情報を読み込みました。', 'success');
  }catch(err){
    if(err.message !== 'キャンセルしました。') showAppToast(err.message || '暗号化JSONを読み込めませんでした。', 'error');
  }
}

function getEmployeeMasterForBaseup(){
  return employeeMasterState.unlocked ? employeeClone(employeeMasterState.employees) : [];
}

function hasUnlockedEmployeeMaster(){
  return employeeMasterState.unlocked;
}

function updateEmployeeMasterFromBaseupStaff(staffRows){
  if(!employeeMasterState.unlocked){
    showAppToast('従業員情報を開いてから反映してください。', 'warn');
    return;
  }
  const rows = Array.isArray(staffRows) ? staffRows : [];
  rows.forEach(staff => {
    const employee = employeeMasterState.employees.find(e => e.employeeId === (staff.sourceEmployeeId || staff.id));
    if(!employee) return;
    employee.displayName = staff.alias || employee.displayName;
    employee.jobType = staff.jobType || employee.jobType;
    employee.workerRoleForBaseup = staff.workerRoleForBaseup || employee.workerRoleForBaseup || 'worker';
    employee.weeklyHours = baseupNumber(staff.weeklyHours);
    employee.baseSalary = baseupNumber(staff.baseSalary);
    employee.fixedMonthlyAllowance = baseupNumber(staff.fixedMonthlyAllowance);
    employee.commutingAllowance = baseupNumber(staff.commutingAllowance);
    employee.otherMonthlyAllowance = baseupNumber(staff.otherMonthlyAllowance);
    employee.monthlySalaryTotal = employeeSalaryTotal(employee);
    employee.monthlySalary = employee.monthlySalaryTotal;
    employee.annualBonus = baseupNumber(staff.annualBonus);
    employee.bonusEligible = staff.bonusEligible !== false;
    employee.bonusAllocationEligible = staff.bonusAllocationEligible !== false;
    employee.plannedAnnualBonus = baseupNumber(staff.plannedAnnualBonus);
    employee.useBonusAllocation = staff.useBonusAllocation !== false;
    employee.baseupTarget = staff.baseupTarget !== false;
    employee.socialInsurance = staff.socialInsurance === true;
    employee.healthInsuranceType = staff.insuranceType || employee.healthInsuranceType;
    employee.pension = staff.pension === true;
    employee.employmentInsurance = staff.employmentInsurance === true;
    employee.workersComp = staff.workersComp !== false;
    employee.careAge = staff.careAge === true;
    employee.childCareSupport = staff.childCareSupport || employee.childCareSupport;
    employee.childCareContribution = staff.childCareContribution || employee.childCareContribution;
  });
  employeeMasterState.source = 'memory';
  employeeMasterState.updatedAt = new Date().toISOString();
  renderEmployees();
  showAppToast('試算画面の一時上書きを従業員情報に反映しました。暗号化保存またはバックアップで保管してください。', 'success');
}
