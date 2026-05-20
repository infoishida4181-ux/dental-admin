/* ベースアップ評価料 賃上げシミュレーター MVP
 * 従業員・給与データは端末メモリまたは暗号化済みデータのみで扱う。
 */
const BASEUP_POINT_MASTER_STORAGE_KEY = 'baseup_point_master_v1';
const BASEUP_RATE_MASTER_STORAGE_KEY = 'baseup_rate_master_v1';

function buildBaseup2Rows(status, firstOrVisitPoints, revisitPoints, memo){
  return firstOrVisitPoints.map((points, index) => {
    const category = index + 1;
    return {
      id:`r08-ii-${status}-${category}`,
      fiscalYear:'令和8年度',
      feeType:'ii',
      sectionName:`歯科外来・在宅ベースアップ評価料（Ⅱ）${category}`,
      category,
      calculationStatus:status,
      firstVisit:points,
      revisit:revisitPoints[index],
      homeVisitOther:points,
      homeVisitSame:points,
      monthlyAdditional:0,
      annualAdditional:0,
      startDate:'2026-06-01',
      endDate:'2027-05-31',
      memo,
      officialUrl:'',
      sourceNote:memo
    };
  });
}

const BASEUP_POINT_MASTER_DEFAULT = [
  { id:'r08-i-normal', fiscalYear:'令和8年度', feeType:'i', sectionName:'評価料Ⅰ', calculationStatus:'normal', firstVisit:21, revisit:4, homeVisitOther:0, homeVisitSame:0, monthlyAdditional:0, annualAdditional:0, startDate:'2026-06-01', endDate:'', memo:'令和8年度 評価料Ⅰ 通常', officialUrl:'' },
  { id:'r08-i-continuous', fiscalYear:'令和8年度', feeType:'i', sectionName:'評価料Ⅰ', calculationStatus:'continuous', firstVisit:31, revisit:6, homeVisitOther:0, homeVisitSame:0, monthlyAdditional:0, annualAdditional:0, startDate:'2026-06-01', endDate:'', memo:'令和8年度 評価料Ⅰ 継続的賃上げ等', officialUrl:'' },
  ...buildBaseup2Rows('normal', [8,16,24,32,40,48,56,64,72,80,88,96], [1,2,3,4,5,6,7,8,9,10,11,12], '令和8年度歯科診療報酬点数表'),
  ...buildBaseup2Rows('continuous', [16,24,40,56,64,80,96,104,120,136,144,160], [2,3,5,7,8,10,12,13,15,17,18,20], '令和8年度歯科診療報酬点数表 注5')
];

const BASEUP_RATE_MASTER_DEFAULT = {
  fiscalYear:'令和8年度',
  kyokaiKenpoTokyo:4.925,
  tokyoDentalHealth:4.85,
  otherHealth:4.925,
  pension:9.15,
  childCareSupport:0.115,
  childCareContribution:0.36,
  employment:0.85,
  workersComp:0.3,
  care:0,
  memo:'概算初期値。年度や制度により変わるため手動修正してください。'
};

const BASEUP_CALCULATOR_DEFAULT_STATE = {
  clinic: {
    businessType: 'corporation',
    calculationStatus: 'normal',
    feeType: 'i',
    fiscalYear: '令和8年度',
    bonusPlanType: 'none',
    bonusMonths: [],
    bonusMemo: ''
  },
  counts: {
    firstVisit3m: 0,
    revisit3m: 0,
    homeVisitOther3m: 0,
    homeVisitSame3m: 0
  },
  points: {
    firstVisit: 21,
    revisit: 4,
    homeVisitOther: 0,
    homeVisitSame: 0,
    manualOverride: false,
    detailsOpen: false,
    pointMasterId: 'r08-i-normal'
  },
  fee2: {
    sectionName: '歯科外来・在宅ベースアップ評価料（Ⅱ）1',
    category: 1,
    firstOrVisitPoints: 8,
    revisitPoints: 1,
    monthlyAdditional: 0,
    annualAdditional: 0,
    manualOverride: false,
    pointMasterId: 'r08-ii-normal-1'
  },
  rates: { ...BASEUP_RATE_MASTER_DEFAULT },
  allocation: {
    method: 'hours',
    safety: 'standard',
    showOnlyTargets: true,
    includeCommutingAllowanceForBaseAmount: true,
    includeCommutingAllowanceForSalaryProportion: false,
    includeCommutingAllowanceForSocialInsuranceEstimate: true,
    wageAllocationPolicy: 'monthlyFocused',
    monthlyAllocationRate: 100,
    bonusAllocationMethod: 'monthlyRaise',
    roundingUnit: 100,
    roundingMethod: 'floor'
  },
  reference: {
    mode: 'today',
    customDate: ''
  },
  meta: {
    allocationDirty: false,
    lastAppliedAt: ''
  },
  staff: []
};

let baseupCalcState = structuredClone(BASEUP_CALCULATOR_DEFAULT_STATE);

function baseupClone(value){
  return JSON.parse(JSON.stringify(value));
}

function baseupYen(value){
  const n = Number(value || 0);
  return `${Math.round(n).toLocaleString()} 円`;
}

function baseupNumber(value){
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function baseupSafetyRate(key){
  return { safe:0.9, standard:0.97, aggressive:1 }[key] || 0.97;
}

function baseupRoundingUnit(state=baseupCalcState){
  const unit = baseupNumber(state.allocation?.roundingUnit);
  return unit > 0 ? unit : 100;
}

function baseupRoundAmount(value, unit=100, method='floor'){
  const n = Number(value || 0);
  if(!Number.isFinite(n) || n <= 0) return 0;
  if(method === 'ceil') return Math.ceil(n / unit) * unit;
  if(method === 'round') return Math.round(n / unit) * unit;
  return Math.floor(n / unit) * unit;
}

function baseupBonusPlanCount(state=baseupCalcState){
  const type = state.clinic?.bonusPlanType || 'none';
  if(type === 'once') return 1;
  if(type === 'twice') return 2;
  if(type === 'three') return 3;
  if(type === 'other') return Math.max(1, (state.clinic?.bonusMonths || []).filter(Boolean).length);
  return 0;
}

function baseupHasBonusPlan(state=baseupCalcState){
  return baseupBonusPlanCount(state) > 0;
}

function baseupMonthLabel(month){
  const n = Number(month);
  return n >= 1 && n <= 12 ? `${n}月` : '支給月未設定';
}

function baseupBonusInstallments(total, state=baseupCalcState){
  const count = baseupBonusPlanCount(state);
  if(!count || !baseupNumber(total)) return [];
  const months = (state.clinic?.bonusMonths || []).slice(0, count);
  const base = Math.floor(baseupNumber(total) / count);
  let allocated = 0;
  return Array.from({ length: count }, (_, index) => {
    const amount = index === count - 1 ? baseupNumber(total) - allocated : base;
    allocated += amount;
    return { month: months[index] || '', label: baseupMonthLabel(months[index]), amount };
  });
}

function normalizeBaseupPointMasterRows(rows){
  const list = Array.isArray(rows) ? rows : [];
  const byId = new Map();
  BASEUP_POINT_MASTER_DEFAULT.forEach(row => byId.set(row.id, baseupClone(row)));
  list.forEach((row, index) => {
    const id = row.id || `custom-${index+1}`;
    byId.set(id, { ...row, id });
  });
  return Array.from(byId.values());
}

function readBaseupPointMaster(){
  try{
    const saved = JSON.parse(localStorage.getItem(BASEUP_POINT_MASTER_STORAGE_KEY) || 'null');
    return Array.isArray(saved) && saved.length ? normalizeBaseupPointMasterRows(saved) : baseupClone(BASEUP_POINT_MASTER_DEFAULT);
  }catch(_err){
    return baseupClone(BASEUP_POINT_MASTER_DEFAULT);
  }
}

function hasBaseupPointMasterOverride(){
  return Boolean(localStorage.getItem(BASEUP_POINT_MASTER_STORAGE_KEY));
}

function writeBaseupPointMaster(master){
  localStorage.setItem(BASEUP_POINT_MASTER_STORAGE_KEY, JSON.stringify(master));
}

function clearBaseupPointMasterOverride(){
  localStorage.removeItem(BASEUP_POINT_MASTER_STORAGE_KEY);
}

function readBaseupRateMaster(){
  try{
    const saved = JSON.parse(localStorage.getItem(BASEUP_RATE_MASTER_STORAGE_KEY) || 'null');
    return saved ? { ...BASEUP_RATE_MASTER_DEFAULT, ...saved } : baseupClone(BASEUP_RATE_MASTER_DEFAULT);
  }catch(_err){
    return baseupClone(BASEUP_RATE_MASTER_DEFAULT);
  }
}

function hasBaseupRateMasterOverride(){
  return Boolean(localStorage.getItem(BASEUP_RATE_MASTER_STORAGE_KEY));
}

function writeBaseupRateMaster(master){
  localStorage.setItem(BASEUP_RATE_MASTER_STORAGE_KEY, JSON.stringify({ ...BASEUP_RATE_MASTER_DEFAULT, ...master }));
}

function clearBaseupRateMasterOverride(){
  localStorage.removeItem(BASEUP_RATE_MASTER_STORAGE_KEY);
}

function baseupCalculationStatusKey(status){
  if(status === 'specialContinue' || status === 'continue' || status === 'continuous') return 'continuous';
  if(status === 'other') return 'other';
  return 'normal';
}

function findBaseupPointMasterRow(state=baseupCalcState){
  const master = readBaseupPointMaster();
  const statusKey = baseupCalculationStatusKey(state.clinic.calculationStatus);
  return master.find(row => row.fiscalYear === state.clinic.fiscalYear && row.feeType === 'i' && row.calculationStatus === statusKey)
    || master.find(row => row.fiscalYear === state.clinic.fiscalYear && row.feeType === 'i')
    || master[0]
    || null;
}

function getBaseupFee2MasterRows(state=baseupCalcState){
  const year = state.clinic.fiscalYear;
  const statusKey = baseupCalculationStatusKey(state.clinic.calculationStatus);
  return readBaseupPointMaster().filter(row => {
    if(row.feeType !== 'ii') return false;
    if(year && row.fiscalYear && row.fiscalYear !== year) return false;
    if(row.calculationStatus && row.calculationStatus !== statusKey) return false;
    return true;
  }).sort((a,b) => baseupNumber(a.category) - baseupNumber(b.category));
}

function findBaseupFee2MasterRow(state=baseupCalcState){
  const rows = getBaseupFee2MasterRows(state);
  return rows.find(row => row.id === state.fee2.pointMasterId)
    || rows.find(row => row.sectionName === state.fee2.sectionName)
    || rows[0]
    || null;
}

function applyBaseupFee2MasterToState(){
  if(baseupCalcState.clinic.feeType !== 'i-ii') return;
  const row = findBaseupFee2MasterRow(baseupCalcState);
  if(!row) return;
  baseupCalcState.fee2.sectionName = row.sectionName || baseupCalcState.fee2.sectionName || '';
  baseupCalcState.fee2.category = baseupNumber(row.category);
  baseupCalcState.fee2.firstOrVisitPoints = baseupNumber(row.firstVisit || row.firstOrVisitPoints);
  baseupCalcState.fee2.revisitPoints = baseupNumber(row.revisit || row.revisitPoints);
  baseupCalcState.fee2.monthlyAdditional = 0;
  baseupCalcState.fee2.annualAdditional = 0;
  baseupCalcState.fee2.manualOverride = false;
  baseupCalcState.fee2.pointMasterId = row.id;
}

function getBaseupFee2UsageLabel(){
  const row = findBaseupFee2MasterRow(baseupCalcState);
  if(!row){
    return {
      row:null,
      source:'未登録',
      resourceLabel:'評価料Ⅱ区分マスタが未登録です',
      hasResource:false,
      hasPoints:false,
      message:'評価料Ⅱ区分マスタが未登録です'
    };
  }
  const annual = baseupNumber(row.annualAdditional);
  const monthly = baseupNumber(row.monthlyAdditional);
  const firstOrVisit = baseupNumber(row.firstVisit || row.firstOrVisitPoints);
  const revisit = baseupNumber(row.revisit || row.revisitPoints);
  const hasPoints = firstOrVisit > 0 || revisit > 0;
  const hasResource = annual > 0 || monthly > 0;
  const resourceLabel = '選択した区分の点数から年間原資を自動計算します';
  return {
    row,
    source:hasBaseupPointMasterOverride() ? 'この端末の手動上書き' : '公式初期マスタ',
    resourceLabel,
    hasResource,
    hasPoints,
    firstOrVisit,
    revisit,
    message:`評価料Ⅱ：${row.sectionName || row.id}を使用中`
  };
}

function getBaseupPointMasterUsageLabel(state=baseupCalcState){
  const row = findBaseupPointMasterRow(state);
  const statusLabel = baseupCalculationStatusKey(state.clinic.calculationStatus) === 'continuous'
    ? '継続的賃上げ等'
    : '通常';
  const sourceLabel = hasBaseupPointMasterOverride() ? 'この端末の手動上書き' : '公式初期マスタ';
  const pointLabel = row ? `初診${baseupNumber(row.firstVisit)}点・再診${baseupNumber(row.revisit)}点` : '点数未設定';
  return {
    row,
    statusLabel,
    sourceLabel,
    pointLabel,
    message: `${state.clinic.fiscalYear}・${statusLabel}の点数マスタを使用中（${pointLabel}）`,
    overridden: hasBaseupPointMasterOverride()
  };
}

function getBaseupRateMasterUsageLabel(){
  return {
    sourceLabel: hasBaseupRateMasterOverride() ? 'この端末で手動修正されています' : '令和8年度の初期料率マスタを使用中',
    overridden: hasBaseupRateMasterOverride()
  };
}

function applyBaseupPointMasterToState(force=false){
  if(baseupCalcState.points.manualOverride && !force) return;
  const row = findBaseupPointMasterRow(baseupCalcState);
  if(!row) return;
  baseupCalcState.points.firstVisit = baseupNumber(row.firstVisit);
  baseupCalcState.points.revisit = baseupNumber(row.revisit);
  baseupCalcState.points.homeVisitOther = baseupNumber(row.homeVisitOther);
  baseupCalcState.points.homeVisitSame = baseupNumber(row.homeVisitSame);
  baseupCalcState.points.pointMasterId = row.id;
  if(force) baseupCalcState.points.manualOverride = false;
}

function applyBaseupRateMasterToState(){
  baseupCalcState.rates = { ...BASEUP_RATE_MASTER_DEFAULT, ...readBaseupRateMaster(), fiscalYear:baseupCalcState.clinic.fiscalYear };
}

function getBaseupFiscalYearRange(fiscalYearLabel){
  const match = String(fiscalYearLabel || '').match(/令和(\d+)年度/);
  const reiwa = match ? Number(match[1]) : 8;
  const startYear = 2018 + reiwa;
  return {
    start:`${startYear}-04-01`,
    end:`${startYear + 1}-03-31`
  };
}

function getBaseupReferenceDate(state=baseupCalcState){
  const range = getBaseupFiscalYearRange(state.clinic.fiscalYear);
  if(state.reference?.mode === 'fiscalStart') return range.start;
  if(state.reference?.mode === 'fiscalEnd') return range.end;
  if(state.reference?.mode === 'custom' && state.reference.customDate) return state.reference.customDate;
  return typeof getCurrentReferenceDate === 'function' ? getCurrentReferenceDate() : new Date().toISOString().slice(0,10);
}

function baseupSalaryTotal(staff, includeCommuting=true){
  const hasSplit = ['baseSalary','fixedMonthlyAllowance','commutingAllowance','otherMonthlyAllowance']
    .some(key => staff?.[key] !== undefined && baseupNumber(staff[key]) > 0);
  if(!hasSplit) return baseupNumber(staff?.monthlySalary);
  return baseupNumber(staff.baseSalary)
    + baseupNumber(staff.fixedMonthlyAllowance)
    + (includeCommuting ? baseupNumber(staff.commutingAllowance) : 0)
    + baseupNumber(staff.otherMonthlyAllowance);
}

function baseupSalaryForProportion(staff, state=baseupCalcState){
  return baseupSalaryTotal(staff, state.allocation.includeCommutingAllowanceForSalaryProportion === true);
}

function baseupSalaryForWageBase(staff, state=baseupCalcState){
  return baseupSalaryTotal(staff, state.allocation.includeCommutingAllowanceForBaseAmount !== false);
}

function baseupSocialInsuranceAnnualBase(annualRaise, staff, state=baseupCalcState){
  return baseupNumber(annualRaise);
}

function baseupEmployeeToStaff(employee){
  const birthDateIso = employee.birthDateIso || (typeof employeeBirthInfo === 'function' ? employeeBirthInfo(employee).iso : '');
  const ageMode = employee.ageJudgementMode || (birthDateIso ? 'auto' : 'manual');
  const manualCare = employee.manualCareInsuranceTarget === true || employee.careAge === true;
  const autoCare = birthDateIso && typeof isCareInsuranceAgeOnDate === 'function'
    ? isCareInsuranceAgeOnDate(birthDateIso, getBaseupReferenceDate())
    : null;
  const eligibility = typeof getBaseupEligibility === 'function'
    ? getBaseupEligibility(employee, getBaseupReferenceDate())
    : { eligible: employee.baseupTarget !== false, reason: employee.baseupTarget !== false ? '対象職員' : '手動で対象外' };
  const baseSalary = baseupNumber(employee.baseSalary !== undefined ? employee.baseSalary : employee.monthlySalary);
  const fixedMonthlyAllowance = baseupNumber(employee.fixedMonthlyAllowance);
  const commutingAllowance = baseupNumber(employee.commutingAllowance);
  const otherMonthlyAllowance = baseupNumber(employee.otherMonthlyAllowance);
  const monthlySalary = baseupSalaryTotal({ baseSalary, fixedMonthlyAllowance, commutingAllowance, otherMonthlyAllowance, monthlySalary:employee.monthlySalary });
  return {
    id: employee.employeeId,
    sourceEmployeeId: employee.employeeId,
    selected: eligibility.eligible,
    alias: employee.displayName || employee.employeeId,
    jobType: employee.jobType || 'other',
    workerRoleForBaseup: employee.workerRoleForBaseup || 'worker',
    employmentType: employee.employmentType || 'other',
    weeklyHours: baseupNumber(employee.weeklyHours),
    baseSalary,
    fixedMonthlyAllowance,
    commutingAllowance,
    otherMonthlyAllowance,
    monthlySalary,
    monthlySalaryTotal: monthlySalary,
    annualBonus: baseupNumber(employee.annualBonus),
    bonusEligible: employee.bonusEligible !== false,
    bonusAllocationEligible: employee.bonusAllocationEligible !== false,
    plannedAnnualBonus: baseupNumber(employee.plannedAnnualBonus !== undefined ? employee.plannedAnnualBonus : employee.annualBonus),
    useBonusAllocation: employee.useBonusAllocation !== false,
    socialInsurance: employee.socialInsurance === true,
    insuranceType: employee.healthInsuranceType || 'none',
    pension: employee.pension === true,
    employmentInsurance: employee.employmentInsurance === true,
    workersComp: employee.workersComp !== false,
    birthDateIso,
    ageJudgementMode: ageMode,
    manualCareInsuranceTarget: manualCare,
    careAge: ageMode === 'auto' && autoCare !== null ? autoCare : manualCare,
    childCareSupport: employee.childCareSupport || 'auto',
    childCareContribution: employee.childCareContribution || 'auto',
    baseupTarget: eligibility.eligible,
    baseupEligibilityReason: eligibility.reason,
    desiredMonthlyRaise: 0,
    desiredBonusAllocation: 0,
    temporaryOverride: false
  };
}

function loadBaseupStaffFromEmployeeMaster(options={}){
  const employees = typeof getEmployeeMasterForBaseup === 'function' ? getEmployeeMasterForBaseup() : [];
  const existing = new Map((baseupCalcState.staff || []).map(staff => [staff.sourceEmployeeId || staff.id, staff]));
  baseupCalcState.staff = employees
    .map(employee => {
      const mapped = baseupEmployeeToStaff(employee);
      const prev = existing.get(employee.employeeId);
      return prev ? {
        ...mapped,
        ...prev,
        ...mapped,
        selected: mapped.baseupTarget !== false && prev.selected !== false,
        desiredMonthlyRaise: prev.desiredMonthlyRaise || 0,
        desiredBonusAllocation: prev.desiredBonusAllocation || 0,
        temporaryOverride: prev.temporaryOverride || false
      } : mapped;
    });
}

function ensureBaseupStaff(){
  if(!baseupCalcState.staff.length && typeof hasUnlockedEmployeeMaster === 'function' && hasUnlockedEmployeeMaster()){
    loadBaseupStaffFromEmployeeMaster();
  }
}

function getBaseupStaffEligibility(staff, state=baseupCalcState){
  if(['ownerOfficer','contractor','excluded'].includes(staff.workerRoleForBaseup)){
    const label = typeof employeeWorkerRoleLabel === 'function' ? employeeWorkerRoleLabel(staff.workerRoleForBaseup) : '対象外の立場';
    return { eligible:false, reason:label };
  }
  if(['doctor','dentist'].includes(staff.jobType)){
    const age = baseupStaffAge(staff, state);
    const title = staff.jobType === 'dentist' ? '歯科医師' : '医師';
    if(age === null) return { eligible:false, reason:`${title}の年齢未判定` };
    if(age >= 40) return { eligible:false, reason:`40歳以上の${title}` };
    if(staff.baseupTarget === false) return { eligible:false, reason:'手動で対象外' };
    return { eligible:true, reason:`40歳未満の勤務${title}` };
  }
  if(staff.baseupTarget === false) return { eligible:false, reason:'手動で対象外' };
  return { eligible:true, reason:staff.baseupEligibilityReason || '対象職員' };
}

function getBaseupSelectedStaff(state){
  return (state.staff || []).filter(staff => staff.selected !== false && getBaseupStaffEligibility(staff, state).eligible);
}

function getBaseupAnnualCounts(state){
  return {
    firstVisit: state.counts.firstVisit3m / 3 * 12,
    revisit: state.counts.revisit3m / 3 * 12,
    homeVisitOther: state.counts.homeVisitOther3m / 3 * 12,
    homeVisitSame: state.counts.homeVisitSame3m / 3 * 12
  };
}

function calculateBaseupResources(state, volumeFactor=1){
  const annualCounts = getBaseupAnnualCounts(state);
  const fee1 = (
    state.points.firstVisit * 10 * annualCounts.firstVisit +
    state.points.revisit * 10 * annualCounts.revisit +
    state.points.homeVisitOther * 10 * annualCounts.homeVisitOther +
    state.points.homeVisitSame * 10 * annualCounts.homeVisitSame
  ) * volumeFactor;
  const fee2Usage = state.clinic.feeType === 'i-ii' ? getBaseupFee2UsageLabel() : null;
  const fee2FirstOrVisitPoints = baseupNumber(fee2Usage?.firstOrVisit || state.fee2.firstOrVisitPoints);
  const fee2RevisitPoints = baseupNumber(fee2Usage?.revisit || state.fee2.revisitPoints);
  const annualVisit = annualCounts.homeVisitOther + annualCounts.homeVisitSame;
  const fee2 = state.clinic.feeType === 'i-ii'
    ? (
      fee2FirstOrVisitPoints * 10 * annualCounts.firstVisit +
      fee2FirstOrVisitPoints * 10 * annualVisit +
      fee2RevisitPoints * 10 * annualCounts.revisit
    ) * volumeFactor
    : 0;
  const annualTotal = fee1 + fee2;
  return {
    annualCounts,
    annualVisit,
    fee1,
    fee2,
    fee2FirstOrVisitPoints,
    fee2RevisitPoints,
    fee2SectionName: fee2Usage?.row?.sectionName || state.fee2.sectionName || '',
    annualTotal,
    monthlyAverage: annualTotal / 12,
    distributable: annualTotal * baseupSafetyRate(state.allocation.safety)
  };
}

function baseupHealthRate(staff, rates){
  if(!staff.socialInsurance) return 0;
  if(['none','dentalKokuho','municipalKokuho'].includes(staff.insuranceType)) return 0;
  if(staff.insuranceType === 'tokyoDentalHealth') return rates.tokyoDentalHealth / 100;
  if(staff.insuranceType === 'otherHealth') return rates.otherHealth / 100;
  return rates.kyokaiKenpoTokyo / 100;
}

function baseupIsChildCareSupportTarget(staff){
  if(staff.childCareSupport === 'yes') return true;
  if(staff.childCareSupport === 'no') return false;
  return staff.socialInsurance && !['none','dentalKokuho','municipalKokuho'].includes(staff.insuranceType);
}

function baseupIsChildCareContributionTarget(staff){
  if(staff.childCareContribution === 'yes') return true;
  if(staff.childCareContribution === 'no') return false;
  return staff.socialInsurance && staff.pension;
}

function calculateBaseupBenefitCost(annualRaise, staff, rates, state=baseupCalcState){
  const benefitBase = baseupSocialInsuranceAnnualBase(annualRaise, staff, state);
  const laborBase = benefitBase;
  const health = benefitBase * baseupHealthRate(staff, rates);
  const careMonths = baseupCareInsuranceMonths(staff, state);
  const care = staff.socialInsurance && careMonths > 0 ? benefitBase * (careMonths / 12) * (rates.care / 100) : 0;
  const pension = staff.socialInsurance && staff.pension ? benefitBase * (rates.pension / 100) : 0;
  const childCareSupport = staff.socialInsurance && baseupIsChildCareSupportTarget(staff) ? benefitBase * (rates.childCareSupport / 100) : 0;
  const childCareContribution = staff.socialInsurance && staff.pension && baseupIsChildCareContributionTarget(staff) ? benefitBase * (rates.childCareContribution / 100) : 0;
  const employment = staff.employmentInsurance ? laborBase * (rates.employment / 100) : 0;
  const workersComp = staff.workersComp ? laborBase * (rates.workersComp / 100) : 0;
  const total = health + care + pension + childCareSupport + childCareContribution + employment + workersComp;
  return { health, care, pension, childCareSupport, childCareContribution, employment, workersComp, total };
}

function baseupMonthlyAllocationRate(state=baseupCalcState){
  if(!baseupHasBonusPlan(state)) return 1;
  const rate = baseupNumber(state.allocation?.monthlyAllocationRate);
  return Math.max(0, Math.min(100, rate || 100)) / 100;
}

function baseupCanReceiveBonusAllocation(staff, state=baseupCalcState){
  return baseupHasBonusPlan(state)
    && staff.bonusEligible !== false
    && staff.bonusAllocationEligible !== false
    && staff.useBonusAllocation !== false;
}

function baseupDistributionWeights(staff, method, state=baseupCalcState, monthlyRaises=[]){
  if(method === 'salary') return staff.map(s => baseupSalaryForProportion(s, state));
  if(method === 'hours') return staff.map(s => baseupNumber(s.weeklyHours));
  if(method === 'monthlyRaise') return staff.map((_, index) => baseupNumber(monthlyRaises[index]));
  return staff.map(() => 1);
}

function baseupAllocateAnnualAmounts(staff, annualPool, method, state=baseupCalcState, monthlyRaises=[]){
  if(!staff.length) return [];
  if(method === 'manual') return staff.map(s => baseupNumber(s.desiredMonthlyRaise) * 12);
  const weights = baseupDistributionWeights(staff, method, state, monthlyRaises);
  const totalWeight = weights.reduce((sum, value) => sum + baseupNumber(value), 0);
  return staff.map((_, index) => totalWeight ? annualPool * (baseupNumber(weights[index]) / totalWeight) : annualPool / staff.length);
}

function baseupAllocateBonusAmounts(staff, bonusPool, method, state=baseupCalcState, monthlyRaises=[]){
  if(!staff.length || !baseupNumber(bonusPool)) return staff.map(() => 0);
  if(method === 'manual') return staff.map(s => baseupNumber(s.desiredBonusAllocation));
  const weights = baseupDistributionWeights(staff, method, state, monthlyRaises);
  const totalWeight = weights.reduce((sum, value) => sum + baseupNumber(value), 0);
  return staff.map((_, index) => totalWeight ? bonusPool * (baseupNumber(weights[index]) / totalWeight) : bonusPool / staff.length);
}

function baseupEmployerBurdenRate(staff, state=baseupCalcState){
  return calculateBaseupBenefitCost(10000, staff, state.rates, state).total / 10000;
}

function baseupAllocateCostFrames(staff, totalCostLimit, method, state=baseupCalcState){
  if(!staff.length) return [];
  if(method === 'manual') return staff.map(s => {
    const wageBody = baseupNumber(s.desiredMonthlyRaise) * 12 + baseupNumber(s.desiredBonusAllocation);
    return wageBody * (1 + baseupEmployerBurdenRate(s, state));
  });
  const weights = baseupDistributionWeights(staff, method, state);
  const totalWeight = weights.reduce((sum, value) => sum + baseupNumber(value), 0);
  return staff.map((_, index) => totalWeight ? totalCostLimit * (baseupNumber(weights[index]) / totalWeight) : totalCostLimit / staff.length);
}

function baseupCareInsuranceMonths(staff, state=baseupCalcState){
  if(!staff.socialInsurance || ['none','dentalKokuho','municipalKokuho'].includes(staff.insuranceType)) return 0;
  if(staff.birthDateIso && staff.ageJudgementMode !== 'manual' && typeof calculateCareInsuranceMonthsInFiscalYear === 'function'){
    const range = getBaseupFiscalYearRange(state.clinic.fiscalYear);
    const months = calculateCareInsuranceMonthsInFiscalYear(staff.birthDateIso, range.start, range.end);
    return months === null ? 0 : months;
  }
  return staff.careAge ? 12 : 0;
}

function baseupStaffAge(staff, state=baseupCalcState){
  if(!staff.birthDateIso || typeof calculateAgeOnDate !== 'function') return null;
  return calculateAgeOnDate(staff.birthDateIso, getBaseupReferenceDate(state));
}

function baseupEmployerRate(staff, rates){
  return calculateBaseupBenefitCost(1, staff, rates).total;
}

function calculateBaseupEligibilitySummary(state=baseupCalcState){
  return (state.staff || []).reduce((summary, staff) => {
    const wage = baseupSalaryForWageBase(staff, state);
    const isDoctor = staff.jobType === 'doctor';
    const isDentist = staff.jobType === 'dentist';
    const age = baseupStaffAge(staff, state);
    if(staff.workerRoleForBaseup === 'ownerOfficer') summary.ownerOfficerCount += 1;
    if(staff.workerRoleForBaseup === 'contractor') summary.contractorCount += 1;
    const eligibility = getBaseupStaffEligibility(staff, state);
    if(eligibility.eligible){
      summary.eligibleCount += 1;
      summary.eligibleMonthlyWageTotal += wage;
    }
    if(isDoctor && age !== null && age < 40 && staff.workerRoleForBaseup === 'worker') summary.under40DoctorCount += 1;
    if(isDentist && age !== null && age < 40 && staff.workerRoleForBaseup === 'worker') summary.under40DentistCount += 1;
    if((isDoctor || isDentist) && !eligibility.eligible) summary.excludedDoctorDentistCount += 1;
    return summary;
  }, {
    eligibleCount:0,
    eligibleMonthlyWageTotal:0,
    under40DoctorCount:0,
    under40DentistCount:0,
    excludedDoctorDentistCount:0,
    ownerOfficerCount:0,
    contractorCount:0
  });
}

function calculateBaseupAllocation(state, volumeFactor=1){
  const resources = calculateBaseupResources(state, volumeFactor);
  const staff = getBaseupSelectedStaff(state);
  const totalCostLimit = resources.distributable;
  const monthlyRate = baseupMonthlyAllocationRate(state);
  const bonusStaff = staff.filter(s => baseupCanReceiveBonusAllocation(s, state));
  let monthlyRaises = [];
  if(!staff.length){
    return { resources, staffRows: [], totalCostLimit, monthlyPool:0, bonusPool:0, totalMonthlyAnnualRaise:0, totalBonusAllocation:0, totalRaise:0, totalEmployerCost:0, totalCost:0, balance:resources.annualTotal, costLimitBalance:totalCostLimit, judgment:'計算不可', comment:'従業員情報管理で従業員を登録し、試算に使う職員を1人以上選択してください。' };
  }
  const unit = baseupRoundingUnit(state);
  const roundMethod = state.allocation.roundingMethod || 'floor';
  const costFrames = baseupAllocateCostFrames(staff, totalCostLimit, state.allocation.method, state);
  const draftRows = staff.map((s, idx) => {
    const burdenRate = baseupEmployerBurdenRate(s, state);
    const totalCostFrame = costFrames[idx] || 0;
    const wageBodyLimit = state.allocation.method === 'manual'
      ? baseupNumber(s.desiredMonthlyRaise) * 12 + baseupNumber(s.desiredBonusAllocation)
      : totalCostFrame / (1 + burdenRate);
    const canBonus = baseupCanReceiveBonusAllocation(s, state);
    const effectiveMonthlyRate = canBonus ? monthlyRate : 1;
    const monthlyAnnualRaw = wageBodyLimit * effectiveMonthlyRate;
    const monthlyRaise = state.allocation.method === 'manual'
      ? baseupNumber(s.desiredMonthlyRaise)
      : baseupRoundAmount(monthlyAnnualRaw / 12, unit, roundMethod);
    const monthlyAnnualRaise = monthlyRaise * 12;
    const bonusRaw = canBonus && monthlyRate < 1 ? Math.max(0, wageBodyLimit - monthlyAnnualRaise) : 0;
    return { staff:s, burdenRate, totalCostFrame, wageBodyLimit, monthlyRaise, monthlyAnnualRaise, bonusRaw, canBonus };
  });
  const bonusAmountsById = new Map();
  const bonusPool = draftRows.reduce((sum, row) => sum + (row.canBonus ? row.bonusRaw : 0), 0);
  if(state.allocation.bonusAllocationMethod === 'manual'){
    draftRows.forEach(row => bonusAmountsById.set(row.staff.id, row.canBonus ? baseupNumber(row.staff.desiredBonusAllocation) : 0));
  }else{
    const redistributed = baseupAllocateBonusAmounts(
      bonusStaff,
      bonusPool,
      state.allocation.bonusAllocationMethod || 'monthlyRaise',
      state,
      staff.map((s, index) => draftRows[index]?.monthlyRaise || 0)
    ).map(value => baseupRoundAmount(value, unit, roundMethod));
    bonusStaff.forEach((s, index) => bonusAmountsById.set(s.id, redistributed[index] || 0));
  }
  monthlyRaises = draftRows.map(row => row.monthlyRaise);
  const monthlyPool = draftRows.reduce((sum,row)=>sum + row.monthlyAnnualRaise,0);
  const staffRows = staff.map((s,idx)=>{
    const draft = draftRows[idx];
    const monthlyRaise = draft?.monthlyRaise || 0;
    const monthlyAnnualRaise = monthlyRaise * 12;
    const bonusAllocation = bonusAmountsById.get(s.id) || 0;
    const annualRaise = monthlyAnnualRaise + bonusAllocation;
    const benefitCosts = calculateBaseupBenefitCost(annualRaise, s, state.rates, state);
    const totalCost = annualRaise + benefitCosts.total;
    const notes = [];
    if(!baseupSalaryTotal(s)) notes.push('月額給与未入力');
    if(s.socialInsurance && !s.insuranceType) notes.push('保険種別未選択');
    if(state.allocation.method === 'manual' && !baseupNumber(s.desiredMonthlyRaise)) notes.push('希望額未入力');
    if((state.allocation.method === 'manual' || state.allocation.bonusAllocationMethod === 'manual') && baseupHasBonusPlan(state) && s.useBonusAllocation !== false && !baseupNumber(s.desiredBonusAllocation)) notes.push('賞与等配分未入力');
    if(!baseupCanReceiveBonusAllocation(s, state) && bonusPool > 0) notes.push('賞与配分対象外');
    if(s.temporaryOverride) notes.push('試算内で一時上書き');
    const careMonths = baseupCareInsuranceMonths(s, state);
    const age = baseupStaffAge(s, state);
    return { staff:s, monthlyRaise, monthlyAnnualRaise, bonusAllocation, bonusInstallments:baseupBonusInstallments(bonusAllocation, state), annualRaise, employerCost:benefitCosts.total, benefitCosts, employerBurdenRate:draft?.burdenRate || 0, totalCostFrame:draft?.totalCostFrame || 0, wageBodyLimit:draft?.wageBodyLimit || 0, careMonths, age, totalCost, notes };
  });
  const totalMonthlyAnnualRaise = staffRows.reduce((sum,r)=>sum + r.monthlyAnnualRaise,0);
  const totalBonusAllocation = staffRows.reduce((sum,r)=>sum + r.bonusAllocation,0);
  const totalRaise = totalMonthlyAnnualRaise + totalBonusAllocation;
  const totalEmployerCost = staffRows.reduce((sum,r)=>sum + r.employerCost,0);
  const totalCost = totalRaise + totalEmployerCost;
  const balance = resources.annualTotal - totalCost;
  const costLimitBalance = totalCostLimit - totalCost;
  const down10Resources = calculateBaseupResources(state, 0.9);
  const down10Balance = down10Resources.annualTotal - totalCost;
  let judgment = '安全圏';
  let comment = '原資内に収まるよう、法定福利費込みの総コスト上限から月額ベースアップ額を自動調整しました。';
  if(!staff.length){
    judgment = '計算不可';
    comment = '試算に使う職員を1人以上選択してください。';
  }else if(costLimitBalance < -1){
    judgment = '不足リスクあり';
    comment = '現在の設定では、安全率をかけた総コスト上限を超過しています。手入力額、丸め方法、配分率を見直してください。';
  }else if(down10Balance < 0){
    judgment = '注意';
    comment = '現状では原資内に収まりますが、算定回数が10％減少すると不足する可能性があります。年度途中で再確認することを推奨します。';
  }
  return { resources, staffRows, totalCostLimit, monthlyPool, bonusPool, totalMonthlyAnnualRaise, totalBonusAllocation, totalRaise, totalEmployerCost, totalCost, balance, costLimitBalance, judgment, comment };
}

function validateBaseupState(state){
  const warnings = [];
  ['firstVisit3m','revisit3m','homeVisitOther3m','homeVisitSame3m'].forEach(key=>{
    if(Number(state.counts[key]) < 0) warnings.push('算定回数は0以上で入力してください。');
  });
  ['firstVisit','revisit','homeVisitOther','homeVisitSame'].forEach(key=>{
    if(Number(state.points[key]) < 0) warnings.push('点数は0以上で入力してください。');
  });
  const selectedStaff = getBaseupSelectedStaff(state);
  if(!selectedStaff.length) warnings.push('試算に使う職員を1人以上選択してください。');
  if(typeof hasUnlockedEmployeeMaster === 'function' && !hasUnlockedEmployeeMaster()) warnings.push('従業員情報管理で暗号化データを開くか、従業員を登録してください。');
  selectedStaff.forEach(s=>{
    if(!baseupSalaryTotal(s)) warnings.push(`${s.alias || '職員'} の月額給与が未入力です。`);
    if(s.socialInsurance && !s.insuranceType) warnings.push(`${s.alias || '職員'} の保険種別を選択してください。`);
    if(state.allocation.method === 'manual' && !baseupNumber(s.desiredMonthlyRaise)) warnings.push(`${s.alias || '職員'} の希望ベースアップ月額が未入力です。`);
    if((state.allocation.method === 'manual' || state.allocation.bonusAllocationMethod === 'manual') && baseupHasBonusPlan(state) && s.useBonusAllocation !== false && !baseupNumber(s.desiredBonusAllocation)) warnings.push(`${s.alias || '職員'} の希望賞与等配分額が未入力です。`);
  });
  if(!baseupHasBonusPlan(state) && baseupNumber(state.allocation.monthlyAllocationRate) < 100) warnings.push('賞与支給予定なしのため、賞与等配分は0円になります。月額配分率100%を推奨します。');
  if(state.clinic.feeType === 'i-ii'){
    const fee2Usage = getBaseupFee2UsageLabel();
    if(!fee2Usage.row) warnings.push('評価料Ⅱの区分マスタが未登録です。管理者モードで区分・点数・追加原資を登録してください。');
    else if(!fee2Usage.hasPoints) warnings.push('選択された評価料Ⅱ区分には点数が未登録です。管理者マスタを確認してください。');
    if(!state.fee2.pointMasterId) warnings.push('評価料Ⅱの区分を選択してください。');
    if(state.fee2.manualOverride) warnings.push('この評価料Ⅱの点数は点数マスタから手動変更されています。');
  }
  if(state.points.manualOverride){
    warnings.push('公式点数マスタから手動変更されています。提出前に公式情報で確認してください。');
  }
  return [...new Set(warnings)];
}

function collectBaseupSimulationData(){
  if(typeof syncBaseupStateFromForm === 'function') syncBaseupStateFromForm();
  return baseupClone(baseupCalcState);
}

function applyBaseupSimulationData(data){
  baseupCalcState = baseupClone({ ...BASEUP_CALCULATOR_DEFAULT_STATE, ...data });
  baseupCalcState.clinic = { ...BASEUP_CALCULATOR_DEFAULT_STATE.clinic, ...(data.clinic||{}) };
  baseupCalcState.counts = { ...BASEUP_CALCULATOR_DEFAULT_STATE.counts, ...(data.counts||{}) };
  baseupCalcState.points = { ...BASEUP_CALCULATOR_DEFAULT_STATE.points, ...(data.points||{}) };
  baseupCalcState.fee2 = { ...BASEUP_CALCULATOR_DEFAULT_STATE.fee2, ...(data.fee2||{}) };
  baseupCalcState.rates = { ...BASEUP_RATE_MASTER_DEFAULT, ...(data.rates||{}) };
  baseupCalcState.allocation = { ...BASEUP_CALCULATOR_DEFAULT_STATE.allocation, ...(data.allocation||{}) };
  baseupCalcState.reference = { ...BASEUP_CALCULATOR_DEFAULT_STATE.reference, ...(data.reference||{}) };
  baseupCalcState.staff = Array.isArray(data.staff) ? data.staff : [];
  renderBaseupCalculator();
}

function resetBaseupMastersToDefault(){
  if(!confirm('ベースアップ評価料の点数・保険料率マスタを初期値に戻しますか？')) return;
  clearBaseupPointMasterOverride();
  clearBaseupRateMasterOverride();
  applyBaseupRateMasterToState();
  applyBaseupPointMasterToState(true);
  applyBaseupFee2MasterToState();
  renderAdminBaseupMasterManager();
  if(typeof renderBaseupCalculator === 'function') renderBaseupCalculator();
}

function clearBaseupMasterLocalOverrides(){
  if(!confirm('この端末の点数・料率マスタ手動上書きを削除し、アプリ初期マスタに戻しますか？')) return;
  clearBaseupPointMasterOverride();
  clearBaseupRateMasterOverride();
  applyBaseupRateMasterToState();
  applyBaseupPointMasterToState(true);
  applyBaseupFee2MasterToState();
  renderAdminBaseupMasterManager();
  if(typeof renderBaseupCalculator === 'function') renderBaseupCalculator();
}

function renderAdminBaseupMasterManager(){
  const el = document.getElementById('admin-baseup-master-manager');
  if(!el) return;
  const points = readBaseupPointMaster();
  const rates = readBaseupRateMaster();
  const pointStatus = hasBaseupPointMasterOverride() ? 'この端末の手動上書き' : '公式初期マスタ';
  const rateStatus = hasBaseupRateMasterOverride() ? 'この端末の手動上書き' : '公式初期マスタ';
  el.innerHTML = `
    <div class="employee-vault-alert" style="margin-bottom:12px">
      この画面で変更した点数・料率は、この端末内のローカル設定として保存されます。会員全体へ自動配信されるものではありません。<br>
      会員全体へ反映する場合は、アプリ本体の初期マスタを更新して再配布・再デプロイする必要があります。<br>
      給与情報・従業員情報とは異なり、点数・料率マスタには個人情報は含まれません。
    </div>
    <div class="employee-status" style="margin-bottom:12px">
      <span class="badge ${hasBaseupPointMasterOverride()?'by':'bg'}">点数マスタ: ${pointStatus}</span>
      <span class="badge ${hasBaseupRateMasterOverride()?'by':'bg'}">料率マスタ: ${rateStatus}</span>
    </div>
    <div class="employee-actions" style="margin-top:0;margin-bottom:12px">
      <button class="btn btn-secondary" type="button" onclick="saveAdminBaseupMasters()">マスタを保存</button>
      <button class="btn btn-ghost" type="button" onclick="addAdminBaseupPointRow('ii')">評価料Ⅱ区分を追加</button>
      <button class="btn btn-ghost" type="button" onclick="resetBaseupMastersToDefault()">初期マスタに戻す</button>
      <button class="btn btn-ghost" type="button" onclick="clearBaseupMasterLocalOverrides()">この端末の手動上書きを削除</button>
    </div>
    <div class="employee-vault-alert" style="margin-bottom:12px">
      評価料Ⅱの区分・点数は公式資料確認後に管理者マスタへ登録してください。不確かな点数は固定値として登録しないでください。
    </div>
    <div class="tw"><table class="admin-form-audit-table">
      <thead><tr><th>年度</th><th>評価料</th><th>区分番号</th><th>区分名</th><th>算定状況</th><th>初診・訪問</th><th>再診</th><th>訪問 同一建物以外</th><th>訪問 同一建物</th><th>適用開始</th><th>適用終了</th><th>メモ</th><th>公式確認</th></tr></thead>
      <tbody>${points.map((row,index)=>`<tr data-baseup-point-row="${index}" data-baseup-point-id="${row.id || `custom-${index+1}`}">
        <td><input class="fi" data-point-field="fiscalYear" value="${row.fiscalYear||''}"></td>
        <td><select class="fs" data-point-field="feeType"><option value="i" ${row.feeType==='i'?'selected':''}>評価料Ⅰ</option><option value="ii" ${row.feeType==='ii'?'selected':''}>評価料Ⅱ</option></select></td>
        <td><input class="fi" type="number" min="0" data-point-field="category" value="${row.category||''}"></td>
        <td><input class="fi" data-point-field="sectionName" value="${row.sectionName||''}"></td>
        <td><select class="fs" data-point-field="calculationStatus"><option value="normal" ${row.calculationStatus==='normal'?'selected':''}>通常</option><option value="continuous" ${row.calculationStatus==='continuous'?'selected':''}>継続的賃上げ等</option><option value="other" ${row.calculationStatus==='other'?'selected':''}>その他</option></select></td>
        <td><input class="fi" type="number" min="0" data-point-field="firstVisit" value="${row.firstVisit||0}"></td>
        <td><input class="fi" type="number" min="0" data-point-field="revisit" value="${row.revisit||0}"></td>
        <td><input class="fi" type="number" min="0" data-point-field="homeVisitOther" value="${row.homeVisitOther||0}"></td>
        <td><input class="fi" type="number" min="0" data-point-field="homeVisitSame" value="${row.homeVisitSame||0}"></td>
        <td><input class="fi" type="date" data-point-field="startDate" value="${row.startDate||''}"></td>
        <td><input class="fi" type="date" data-point-field="endDate" value="${row.endDate||''}"></td>
        <td><input class="fi" data-point-field="memo" value="${row.memo||''}"></td>
        <td><input class="fi" data-point-field="officialUrl" value="${row.officialUrl||''}"></td>
      </tr>`).join('')}</tbody>
    </table></div>
    <div class="employee-grid" style="margin-top:14px">
      ${['kyokaiKenpoTokyo','tokyoDentalHealth','otherHealth','pension','childCareSupport','childCareContribution','employment','workersComp','care'].map(key=>`
        <label><span>${{
          kyokaiKenpoTokyo:'協会けんぽ東京 健康保険%',
          tokyoDentalHealth:'東京都歯科健保 健康保険%',
          otherHealth:'その他健保組合 健康保険%',
          pension:'厚生年金%',
          childCareSupport:'子ども・子育て支援金%',
          childCareContribution:'子ども・子育て拠出金%',
          employment:'雇用保険%',
          workersComp:'労災保険%',
          care:'介護保険%'
        }[key]}</span><input class="fi" type="number" min="0" step="0.001" data-rate-field="${key}" value="${rates[key] ?? 0}"></label>
      `).join('')}
      <label style="grid-column:1/-1"><span>料率メモ</span><input class="fi" data-rate-field="memo" value="${rates.memo||''}"></label>
    </div>
  `;
}

function saveAdminBaseupMasters(){
  const rows = [];
  document.querySelectorAll('[data-baseup-point-row]').forEach(row => {
    const rec = { id:row.dataset.baseupPointId || `custom-${rows.length+1}` };
    row.querySelectorAll('[data-point-field]').forEach(el => {
      rec[el.dataset.pointField] = el.type === 'number' ? baseupNumber(el.value) : el.value;
    });
    rows.push(rec);
  });
  const rateMaster = { ...readBaseupRateMaster() };
  document.querySelectorAll('[data-rate-field]').forEach(el => {
    rateMaster[el.dataset.rateField] = el.type === 'number' ? baseupNumber(el.value) : el.value;
  });
  writeBaseupPointMaster(rows.length ? rows : baseupClone(BASEUP_POINT_MASTER_DEFAULT));
  writeBaseupRateMaster(rateMaster);
  applyBaseupRateMasterToState();
  applyBaseupPointMasterToState(true);
  applyBaseupFee2MasterToState();
  if(typeof showAppToast === 'function') showAppToast('ベースアップ評価料の点数・保険料率マスタを保存しました。', 'success');
  if(typeof renderBaseupCalculator === 'function') renderBaseupCalculator();
}

function collectAdminBaseupPointRows(){
  const rows = [];
  document.querySelectorAll('[data-baseup-point-row]').forEach(row => {
    const rec = { id:row.dataset.baseupPointId || `custom-${rows.length+1}` };
    row.querySelectorAll('[data-point-field]').forEach(el => {
      rec[el.dataset.pointField] = el.type === 'number' ? baseupNumber(el.value) : el.value;
    });
    rows.push(rec);
  });
  return rows;
}

function addAdminBaseupPointRow(feeType='ii'){
  const rows = collectAdminBaseupPointRows();
  rows.push({
    id:`custom-${Date.now()}`,
    fiscalYear:'令和8年度',
    feeType,
    sectionName:feeType === 'ii' ? '新しい評価料Ⅱ区分' : '評価料Ⅰ',
    category:feeType === 'ii' ? 13 : '',
    calculationStatus:feeType === 'ii' ? 'other' : 'normal',
    firstVisit:0,
    revisit:0,
    homeVisitOther:0,
    homeVisitSame:0,
    monthlyAdditional:0,
    annualAdditional:0,
    startDate:'',
    endDate:'',
    memo:feeType === 'ii' ? '公式資料確認後に区分・点数・追加原資を登録してください。' : '',
    officialUrl:''
  });
  writeBaseupPointMaster(rows);
  renderAdminBaseupMasterManager();
  if(typeof showAppToast === 'function') showAppToast('評価料Ⅱ区分の入力行を追加しました。必要事項を入力してマスタを保存してください。', 'success');
}
