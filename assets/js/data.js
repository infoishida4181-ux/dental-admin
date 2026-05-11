// 本番環境：コンソール出力を完全無効化（一般ユーザーへの表示防止）
console.warn  = function(){};
console.error = function(){};
console.log   = function(){};
console.info  = function(){};

// PDF.js Worker設定
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

/* ═══ MASTER DATA ═══ */
const KM = {
  '歯初診':{n:'歯科点数表の初診料の注1（院内感染防止対策）',c:'basic'},
  '外安全１':{n:'歯科外来診療医療安全対策加算1（外安全1）',c:'basic'},
  '外安全２':{n:'歯科外来診療医療安全対策加算2（外安全2）',c:'basic'},
  '外感染１':{n:'歯科外来診療感染対策加算1（外感染1）',c:'basic'},
  '外感染２':{n:'歯科外来診療感染対策加算2（外感染2）',c:'basic'},
  '外感染３':{n:'歯科外来診療感染対策加算3（外感染3）',c:'basic'},
  '口管強':{n:'口腔管理体制強化加算（口管強）',c:'special'},
  '歯訪診':{n:'歯科訪問診療料（施設基準）',c:'special'},
  '在支歯':{n:'在宅療養支援歯科診療所',c:'special'},
  '在推進':{n:'在宅歯科医療推進加算',c:'basic'},
  '歯地連':{n:'歯科地域連携体制加算',c:'basic'},
  '医療ＤＸ':{n:'医療DX推進体制整備加算',c:'basic'},
  '電子的歯科連携':{n:'電子的歯科診療情報連携体制整備加算',c:'basic'},
  '歯医DX1':{n:'電子的歯科診療情報連携体制整備加算1',c:'basic'},
  '歯医DX2':{n:'電子的歯科診療情報連携体制整備加算2',c:'basic'},
  '病初診':{n:'病院初診料（歯科）',c:'basic'},
  '医管':{n:'歯科治療総合医療管理料',c:'special'},
  '在歯管':{n:'在宅患者歯科治療時医療管理料',c:'special'},
  '歯援診１':{n:'歯科診療特別対応加算1',c:'special'},
  '歯援診２':{n:'歯科診療特別対応加算2',c:'special'},
  '歯援病':{n:'歯科在宅療養支援病院',c:'special'},
  '咀嚼機能１':{n:'咀嚼機能検査1',c:'special'},
  '咀嚼機能２':{n:'咀嚼機能検査2',c:'special'},
  '咀嚼能力':{n:'咀嚼能力測定',c:'special'},
  '咬合圧':{n:'咬合圧検査',c:'special'},
  '精密触覚':{n:'精密触覚機能検査',c:'special'},
  '歯筋電図':{n:'歯科用筋電図検査',c:'special'},
  '口菌検':{n:'口腔細菌定量検査',c:'special'},
  '歯リハ２':{n:'歯科口腔リハビリテーション料2',c:'special'},
  '歯技連１':{n:'歯科技工士連携加算1',c:'special'},
  '歯技連２':{n:'歯科技工士連携加算2',c:'special'},
  '歯特連':{n:'歯科特定疾患療養管理料連携加算',c:'special'},
  '光印象':{n:'光学印象歯科技工士連携加算',c:'special'},
  '歯ＣＡＤ':{n:'CAD/CAM冠・CAD/CAMインレー',c:'special'},
  '歯技工':{n:'歯科技工加算',c:'special'},
  '手顕微加':{n:'手術用顕微鏡加算',c:'special'},
  '根切顕微':{n:'歯根端切除術顕微鏡加算',c:'special'},
  'ＧＴＲ':{n:'GTR法（再生誘導法）',c:'special'},
  '人工歯根':{n:'インプラント（人工歯根）',c:'special'},
  '歯顎移':{n:'顎骨移植術',c:'special'},
  '歯顎人工':{n:'顎骨インプラント',c:'special'},
  '手術歯根':{n:'歯根端切除術',c:'special'},
  'う蝕無痛':{n:'う蝕無痛的窩洞形成加算',c:'special'},
  '口腔粘膜':{n:'口腔粘膜処置',c:'special'},
  '手光機':{n:'手術用光学機器等加算',c:'special'},
  '歯麻管':{n:'歯科麻酔管理料',c:'special'},
  '歯画１':{n:'歯科画像診断管理加算1',c:'special'},
  '歯画２':{n:'歯科画像診断管理加算2',c:'special'},
  '遠画':{n:'遠隔画像診断',c:'special'},
  '酸単':{n:'酸蝕歯単純修復加算',c:'special'},
  '歯外在ベⅠ':{n:'歯科外来在宅ベースアップ評価料（Ⅰ）',c:'other'},
  '歯外在ベⅡ':{n:'歯科外来在宅ベースアップ評価料（Ⅱ）',c:'other'},
  '補管':{n:'補綴物維持管理料',c:'other'},
  '矯診':{n:'歯科矯正診断料',c:'other'},
  '顎診':{n:'顎口腔機能診断料',c:'other'},
  '口病診１':{n:'口腔病変部評価料1',c:'other'},
  '１７５':{n:'保険外併用療養費（特別療養環境）',c:'other'},
  '食':{n:'食事療養・生活療養',c:'other'},
  '一般入院':{n:'一般病棟入院基本料',c:'other'},
  'せん妄ケア':{n:'せん妄ハイリスク患者ケア加算',c:'other'},
  '地歯入院':{n:'地域歯科診療支援病院入院加算',c:'other'},
  '外後発使':{n:'外来後発医薬品使用体制加算',c:'other'},
  'Ｃ・Ｍ':{n:'医科歯科併設施設基準',c:'other'},
};
const ABBR_MAP={'歯科点数表の初診料の注1（院内感染防止対策）':'歯初診','歯科外来診療医療安全対策加算1（外安全1）':'外安全１','歯科外来診療感染対策加算1（外感染1）':'外感染１','口腔管理体制強化加算（口管強）':'口管強','歯科訪問診療料（施設基準）':'歯訪診','CAD/CAM冠・CAD/CAMインレー':'歯ＣＡＤ','歯科治療総合医療管理料':'医管','歯科技工士連携加算1':'歯技連１','歯科技工士連携加算2':'歯技連２','光学印象歯科技工士連携加算':'光印象','医療DX推進体制整備加算':'医療ＤＸ','電子的歯科診療情報連携体制整備加算':'歯医DX1','電子的歯科診療情報連携体制整備加算1':'歯医DX1','電子的歯科診療情報連携体制整備加算2':'歯医DX2','歯科外来在宅ベースアップ評価料（Ⅰ）':'歯外在ベⅠ','在宅療養支援歯科診療所':'在支歯','補綴物維持管理料':'補管','手術用顕微鏡加算':'手顕微加','GTR法（再生誘導法）':'ＧＴＲ','咀嚼能力測定':'咀嚼能力','咬合圧検査':'咬合圧'};
const CL={basic:'基本診療料',special:'特掲診療料',other:'その他'};
const SB={green:'<span class="badge bg"><span class="dot dg"></span>要件充足</span>',yellow:'<span class="badge by"><span class="dot dy"></span>要確認</span>',red:'<span class="badge br"><span class="dot dr"></span>要対応</span>'};
const KB={none:'<span class="badge bgr">変更なし</span>',reapply:'<span class="badge br">再届出必要</span>',check:'<span class="badge by">要件確認</span>',grace:'<span class="badge bb">経過措置中</span>',expire:'<span class="badge bpu">廃止・統合</span>'};

/* ═══ STATE ═══ */
let entries=JSON.parse(localStorage.getItem('shisetsu_kijun')||'[]');
let clinicName=localStorage.getItem('clinic_name')||'○○歯科医院';
const CLINIC_PROFILE_KEY='clinic_profile_v1';
const LAST_MEDICAL_ID_KEY='last_medical_institution_number_v1';
const OFFICIAL_LAST_MEDICAL_ID_KEY='official_dataset_last_medical_id_v1';
const OFFICIAL_DATASET_KEY='official_dataset_cache_v1';
const OFFICIAL_MANIFEST_META_KEY='official_dataset_manifest_meta_v1';
let clinicProfile=loadStoredJson(CLINIC_PROFILE_KEY,{medicalInstitutionNumber:''});
let officialDataset=loadStoredJson(OFFICIAL_DATASET_KEY,null);
let officialManifestMeta=loadStoredJson(OFFICIAL_MANIFEST_META_KEY,null);
let fStat='all', fCatV='all';
let pdfPages=[], pdfPageItems=[], parsedImport=[];
const ADMIN_PASS_HASH_KEY='admin_passphrase_hash_v1';
const ADMIN_PASS_DEFAULT_KEY='admin_passphrase_default_v1';
const ADMIN_PASS_UPDATED_AT_KEY='admin_passphrase_updated_at_v1';
const ADMIN_SESSION_KEY='admin_mode_active_v1';
const ADMIN_LAST_VIEW_KEY='admin_last_member_view_v1';
const ADMIN_DEFAULT_PASSPHRASE='admin-2026';
const ADMIN_DEFAULT_PASS_HASH='sha256:dea0eb2bfaf38042753851289edacfa858ce5117d17bc8bb6814dbce7119daaa';
let currentView='daichou';
let lastMemberView=sessionStorage.getItem(ADMIN_LAST_VIEW_KEY)||'daichou';

const FACILITY_OFFICIAL_LINKS_R08 = {
  basic: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/kihon_shinryo_r08.html',
  tokukei: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/shido_kansa/shitei_kijun/tokukei_shinryo_r08.html',
  baseup: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/shinsei/baseup.html'
};
const FACILITY_FILE_BASE_R08 = 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/';
function facilityFileR08(path){ return path ? (path.startsWith('http') ? path : FACILITY_FILE_BASE_R08 + path.replace(/^\/kantoshinetsu\//,'')) : ''; }
function facilityLink(label,type,path){ return { label, type, url: facilityFileR08(path) }; }
function facilityRecord(receiptCode,name,officialCategory,officialItemNumber,noticeRef,forms,searchKeywords,note='',missingReason=''){
  const officialListUrl = officialCategory === 'basic' ? FACILITY_OFFICIAL_LINKS_R08.basic : FACILITY_OFFICIAL_LINKS_R08.tokukei;
  return { facilityKey: receiptCode, receiptCode, name, category: officialCategory, officialCategory, officialListUrl, officialPageUrl: officialListUrl, officialItemNumber, noticeRef, searchKeywords, forms, note, missingReason, lastChecked: '2026-05-11' };
}
const BASEUP_FORM_NOTE = 'ベースアップ評価料は、専用Excel様式やメール提出が必要となる場合があります。提出方法・様式は公式ページで必ず確認してください。';
const FACILITY_FORM_LINKS_R08 = {
  '歯初診': facilityRecord('歯初診','初診料（歯科）の注1に掲げる基準','basic','1-16','別添1 2の7',[facilityLink('別添7（歯初診）PDF','pdf','r8-1-016.pdf'),facilityLink('様式2の6 PDF','pdf','r8-k02-6.pdf'),facilityLink('別添7（歯初診）Word','word','r8-1-016.docx'),facilityLink('様式2の6 Word','word','r8-k02-6.docx')],['歯初診','初診料（歯科）','様式2の6']),
  '外安全1': facilityRecord('外安全1','歯科外来診療医療安全対策加算1','basic','1-18','別添1 4',[facilityLink('別添7（外安全1）PDF','pdf','r8-1-018.pdf'),facilityLink('様式4 PDF','pdf','r8-k04.pdf'),facilityLink('別添7（外安全1）Word','word','r8-1-018.docx'),facilityLink('様式4 Word','word','r8-k04.docx')],['外安全1','医療安全対策加算1','様式4']),
  '外安全2': facilityRecord('外安全2','歯科外来診療医療安全対策加算2','basic','1-19','別添1 4',[facilityLink('別添7（外安全2）PDF','pdf','r8-1-019.pdf'),facilityLink('様式4の1の2 PDF','pdf','r8-k04-1-2.pdf'),facilityLink('別添7（外安全2）Word','word','r8-1-019.docx'),facilityLink('様式4の1の2 Word','word','r8-k04-1-2.docx')],['外安全2','医療安全対策加算2','様式4の1の2']),
  '外感染1': facilityRecord('外感染1','歯科外来診療感染対策加算1','basic','1-20','別添1 4の2',[facilityLink('別添7（外感染1）PDF','pdf','r8-1-020.pdf'),facilityLink('様式4 PDF','pdf','r8-k04.pdf'),facilityLink('別添7（外感染1）Word','word','r8-1-020.docx'),facilityLink('様式4 Word','word','r8-k04.docx')],['外感染1','感染対策加算1','様式4']),
  '外感染2': facilityRecord('外感染2','歯科外来診療感染対策加算2','basic','1-21','別添1 4の2',[facilityLink('別添7（外感染2）PDF','pdf','r8-1-021.pdf'),facilityLink('様式4 PDF','pdf','r8-k04.pdf'),facilityLink('別添7（外感染2）Word','word','r8-1-021.docx'),facilityLink('様式4 Word','word','r8-k04.docx')],['外感染2','感染対策加算2','様式4']),
  '歯情報通信': facilityRecord('歯情報通信','初診料（歯科）の注16及び再診料（歯科）の注13に掲げる基準','basic','1-25','別添1 5の2',[facilityLink('別添7（歯情報通信）PDF','pdf','r8-1-025.pdf'),facilityLink('様式4の3 PDF','pdf','r8-k04-3.pdf'),facilityLink('別添7（歯情報通信）Word','word','r8-1-025.docx'),facilityLink('様式4の3 Word','word','r8-k04-3.docx')],['歯情報通信','情報通信','様式4の3']),
  '歯医DX1': facilityRecord('歯医DX1','電子的歯科診療情報連携体制整備加算1','basic','1-8','別添1 1の8',[facilityLink('別添7（歯医DX1）PDF','pdf','r8-1-008.pdf'),facilityLink('様式1の6 PDF','pdf','r8-k01-6.pdf'),facilityLink('別添7（歯医DX1）Word','word','r8-1-008.docx'),facilityLink('様式1の6 Excel','excel','r8-k01-6.xlsx')],['歯医DX1','電子的歯科診療情報連携体制整備加算1','様式1の6'],'令和6年度の医療DX推進体制整備加算を届け出ていても、令和8年6月1日以降に算定する場合は改めて届出が必要です。'),
  '歯医DX2': facilityRecord('歯医DX2','電子的歯科診療情報連携体制整備加算2','basic','1-8-2','別添1 1の8',[facilityLink('別添7（歯医DX2）PDF','pdf','r8-1-008-2.pdf'),facilityLink('様式1の6 PDF','pdf','r8-k01-6.pdf'),facilityLink('別添7（歯医DX2）Word','word','r8-1-008-2.docx'),facilityLink('様式1の6 Excel','excel','r8-k01-6.xlsx')],['歯医DX2','電子的歯科診療情報連携体制整備加算2','様式1の6'],'令和6年度の医療DX推進体制整備加算を届け出ていても、令和8年6月1日以降に算定する場合は改めて届出が必要です。'),
  '医療ＤＸ': facilityRecord('医療ＤＸ','医療DX推進体制整備加算（令和8年6月廃止・再編）','basic','1-8','別添1 1の8',[facilityLink('後継 別添7（歯医DX1）PDF','pdf','r8-1-008.pdf'),facilityLink('後継 様式1の6 PDF','pdf','r8-k01-6.pdf'),facilityLink('後継 別添7（歯医DX1）Word','word','r8-1-008.docx'),facilityLink('後継 様式1の6 Excel','excel','r8-k01-6.xlsx')],['医療DX','歯医DX','電子的歯科'],'令和8年度は廃止・再編のため、後継の電子的歯科診療情報連携体制整備加算の様式を表示します。'),
  '機安歯': facilityRecord('機安歯','医療機器安全管理料（歯科）','tokukei','2-86','別添1 12の2',[facilityLink('別添2（機安歯）PDF','pdf','r8-2-086.pdf'),facilityLink('様式15 PDF','pdf','r8-t15.pdf'),facilityLink('別添2（機安歯）Word','word','r8-2-086.docx'),facilityLink('様式15 Word','word','r8-t15.docx')],['機安歯','医療機器安全管理料（歯科）','様式15']),
  '医管': facilityRecord('医管','歯科治療時医療管理料','tokukei','2-88','別添1 13',[facilityLink('別添2（医管）PDF','pdf','r8-2-088.pdf'),facilityLink('様式17 PDF','pdf','r8-t17.pdf'),facilityLink('別添2（医管）Word','word','r8-2-088.docx'),facilityLink('様式17 Word','word','r8-t17.docx')],['医管','歯科治療時医療管理料','様式17']),
  '口管強': facilityRecord('口管強','小児口腔機能管理料の注5に規定する口腔管理体制強化加算','tokukei','2-89','別添1 13の2',[facilityLink('別添2（口管強）PDF','pdf','r8-2-089.pdf'),facilityLink('様式17の2 PDF','pdf','r8-t17-2.pdf'),facilityLink('別添2（口管強）Word','word','r8-2-089.docx'),facilityLink('様式17の2 Word','word','r8-t17-2.docx')],['口管強','口腔管理体制強化加算','様式17の2']),
  '特別管理加算': facilityRecord('特管','特別管理加算','tokukei','2-90','別添1 13の3',[facilityLink('別添2（特管）PDF','pdf','r8-2-090.pdf'),facilityLink('様式17の3 PDF','pdf','r8-t17-3.pdf'),facilityLink('別添2（特管）Word','word','r8-2-090.docx'),facilityLink('様式17の3 Excel','excel','r8-t17-3.xlsx')],['特管','特別管理加算','様式17の3']),
  '口腔機能実地': facilityRecord('口実地','口腔機能実地指導料','tokukei','2-91','別添1 13の4',[facilityLink('別添2（口実地）PDF','pdf','r8-2-091.pdf'),facilityLink('様式17の4 PDF','pdf','r8-t17-4.pdf'),facilityLink('別添2（口実地）Word','word','r8-2-091.docx'),facilityLink('様式17の4 Excel','excel','r8-t17-4.xlsx')],['口実地','口腔機能実地指導料','様式17の4']),
  '在支歯': facilityRecord('歯援診1・2','在宅療養支援歯科診療所1・2','tokukei','2-92 / 2-93','別添1 14',[facilityLink('別添2（歯援診1）PDF','pdf','r8-2-092.pdf'),facilityLink('別添2（歯援診2）PDF','pdf','r8-2-093.pdf'),facilityLink('様式18 PDF','pdf','r8-t18.pdf'),facilityLink('別添2（歯援診1）Word','word','r8-2-092.docx'),facilityLink('別添2（歯援診2）Word','word','r8-2-093.docx'),facilityLink('様式18 Excel','excel','r8-t18.xlsx')],['歯援診','在宅療養支援歯科診療所','様式18']),
  '在歯管': facilityRecord('在歯管','在宅患者歯科治療時医療管理料','tokukei','2-101','別添1 14の3',[facilityLink('別添2（在歯管）PDF','pdf','r8-2-101.pdf'),facilityLink('様式17 PDF','pdf','r8-t17.pdf'),facilityLink('別添2（在歯管）Word','word','r8-2-101.docx'),facilityLink('様式17 Word','word','r8-t17.docx')],['在歯管','在宅患者歯科治療時医療管理料','様式17']),
  '在宅ＤＸ': facilityRecord('在宅DX','在宅医療DX情報活用加算','tokukei','2-103','別添1 14の5',[facilityLink('別添2（在宅DX）PDF','pdf','r8-2-103.pdf'),facilityLink('様式11の6 PDF','pdf','r8-t11-6.pdf'),facilityLink('別添2（在宅DX）Word','word','r8-2-103.docx'),facilityLink('様式11の6 Excel','excel','r8-t11-6.xlsx')],['在宅DX','在宅医療DX','様式11の6']),
  '歯地連': facilityRecord('歯地連','地域医療連携体制加算','tokukei','2-132','別添1 17',[facilityLink('別添2（歯地連）PDF','pdf','r8-2-132.pdf'),facilityLink('様式21 PDF','pdf','r8-t21.pdf'),facilityLink('別添2（歯地連）Word','word','r8-2-132.docx'),facilityLink('様式21 Word','word','r8-t21.docx')],['歯地連','地域医療連携体制加算','様式21']),
  '歯訪診': facilityRecord('歯訪診','歯科訪問診療料の注16に規定する基準','tokukei','2-133','別添1 17の1の2',[facilityLink('別添2（歯訪診）PDF','pdf','r8-2-133.pdf'),facilityLink('様式21の3の2 PDF','pdf','r8-t21-3-2.pdf'),facilityLink('別添2（歯訪診）Word','word','r8-2-133.docx'),facilityLink('様式21の3の2 Word','word','r8-t21-3-2.docx')],['歯訪診','歯科訪問診療料の注16','様式21の3の2']),
  '咀嚼能力': facilityRecord('咀嚼機能','有床義歯咀嚼機能検査','tokukei','2-184','別添1 29の5',[facilityLink('別添2（咀嚼機能）PDF','pdf','r8-2-184.pdf'),facilityLink('様式38の1の2 PDF','pdf','r8-t38-1-2.pdf'),facilityLink('別添2（咀嚼機能）Word','word','r8-2-184.docx'),facilityLink('様式38の1の2 Excel','excel','r8-t38-1-2.xlsx')],['咀嚼機能','有床義歯咀嚼機能検査','様式38の1の2']),
  '咬合圧': facilityRecord('咬合圧','咬合圧検査','tokukei','','',[],['咬合圧','咬合圧検査'],'令和8年度改定で施設基準届出は廃止。算定要件は公式告示・通知で確認してください。','廃止・再編のため直接様式なし'),
  '口細菌': facilityRecord('口細菌','口腔細菌定量検査','tokukei','','',[],['口細菌','口腔細菌定量検査'],'令和8年度改定で施設基準届出は廃止。算定要件は公式告示・通知で確認してください。','廃止・再編のため直接様式なし'),
  '歯画診': facilityRecord('歯画1・2','歯科画像診断管理加算1・2','tokukei','2-191 / 2-192','別添1 31',[facilityLink('別添2（歯画1）PDF','pdf','r8-2-191.pdf'),facilityLink('別添2（歯画2）PDF','pdf','r8-2-192.pdf'),facilityLink('様式33 PDF','pdf','r8-t33.pdf'),facilityLink('別添2（歯画1）Word','word','r8-2-191.docx'),facilityLink('別添2（歯画2）Word','word','r8-2-192.docx'),facilityLink('様式33 Word','word','r8-t33.docx')],['歯画','歯科画像診断管理加算','様式33']),
  '手顕微加': facilityRecord('手顕微加','手術用顕微鏡加算','tokukei','2-295','別添1 57の4の4',[facilityLink('別添2（手顕微加）PDF','pdf','r8-2-295.pdf'),facilityLink('様式49の8 PDF','pdf','r8-t49-8.pdf'),facilityLink('別添2（手顕微加）Word','word','r8-2-295.docx'),facilityLink('様式49の8 Word','word','r8-t49-8.docx')],['手顕微加','手術用顕微鏡加算','様式49の8']),
  '口腔粘膜': facilityRecord('口腔粘膜','口腔粘膜処置','tokukei','2-296','別添1 57の4の5',[facilityLink('別添2（口腔粘膜）PDF','pdf','r8-2-296.pdf'),facilityLink('様式49の9 PDF','pdf','r8-t49-9.pdf'),facilityLink('別添2（口腔粘膜）Word','word','r8-2-296.docx'),facilityLink('様式49の9 Word','word','r8-t49-9.docx')],['口腔粘膜','口腔粘膜処置','様式49の9']),
  'う蝕無痛': facilityRecord('う蝕無痛','う蝕歯無痛的窩洞形成加算','tokukei','2-297','別添1 57の5',[facilityLink('別添2（う蝕無痛）PDF','pdf','r8-2-297.pdf'),facilityLink('様式50 PDF','pdf','r8-t50.pdf'),facilityLink('別添2（う蝕無痛）Word','word','r8-2-297.docx'),facilityLink('様式50 Word','word','r8-t50.docx')],['う蝕無痛','う蝕歯無痛的窩洞形成加算','様式50']),
  '歯技連１': facilityRecord('歯技連1','歯科技工士連携加算1','tokukei','2-298','別添1 57の5の2',[facilityLink('別添2（歯技連1）PDF','pdf','r8-2-298.pdf'),facilityLink('様式50の2の2 PDF','pdf','r8-t50-2-2.pdf'),facilityLink('別添2（歯技連1）Word','word','r8-2-298.docx'),facilityLink('様式50の2の2 Excel','excel','r8-t50-2-2.xlsx')],['歯技連1','歯科技工士連携加算1','様式50の2の2']),
  '光印象': facilityRecord('光印象','光学印象','tokukei','2-300','別添1 57の5の4',[facilityLink('別添2（光印象）PDF','pdf','r8-2-300.pdf'),facilityLink('様式50の2 PDF','pdf','r8-t50-2.pdf'),facilityLink('別添2（光印象）Word','word','r8-2-300.docx'),facilityLink('様式50の2 Word','word','r8-t50-2.docx')],['光印象','光学印象','様式50の2']),
  '歯ＣＡＤ': facilityRecord('歯CAD','CAD／CAM冠及びCAD／CAMインレー','tokukei','2-301','別添1 57の6',[facilityLink('別添2（歯CAD）PDF','pdf','r8-2-301.pdf'),facilityLink('様式50の2 PDF','pdf','r8-t50-2.pdf'),facilityLink('別添2（歯CAD）Word','word','r8-2-301.docx'),facilityLink('様式50の2 Word','word','r8-t50-2.docx')],['歯CAD','CAD/CAM','様式50の2']),
  '三次元プリント義歯': facilityRecord('3DFD','3次元プリント有床義歯','tokukei','2-302','別添1 57の7',[facilityLink('別添2（3DFD）PDF','pdf','r8-2-302.pdf'),facilityLink('様式50の3の2 PDF','pdf','r8-t50-3-2.pdf'),facilityLink('別添2（3DFD）Word','word','r8-2-302.docx'),facilityLink('様式50の3の2 Excel','excel','r8-t50-3-2.xlsx')],['3DFD','3次元プリント有床義歯','様式50の3の2']),
  '歯技工': facilityRecord('歯技工','歯科技工加算1及び2','tokukei','2-303','別添1 57の7の2',[facilityLink('別添2（歯技工）PDF','pdf','r8-2-303.pdf'),facilityLink('様式50の3 PDF','pdf','r8-t50-3.pdf'),facilityLink('別添2（歯技工）Word','word','r8-2-303.docx'),facilityLink('様式50の3 Word','word','r8-t50-3.docx')],['歯技工','歯科技工加算','様式50の3']),
  'ＧＴＲ': facilityRecord('GTR','歯周組織再生誘導手術','tokukei','2-538','別添1 80の6',[facilityLink('別添2（GTR）PDF','pdf','r8-2-538.pdf'),facilityLink('様式74 PDF','pdf','r8-t74.pdf'),facilityLink('別添2（GTR）Word','word','r8-2-538.docx'),facilityLink('様式74 Word','word','r8-t74.docx')],['GTR','歯周組織再生誘導手術','様式74']),
  '根切顕微': facilityRecord('根切顕微','歯根端切除手術の注3','tokukei','2-541','別添1 80の9',[facilityLink('別添2（根切顕微）PDF','pdf','r8-2-541.pdf'),facilityLink('様式49の8 PDF','pdf','r8-t49-8.pdf'),facilityLink('別添2（根切顕微）Word','word','r8-2-541.docx'),facilityLink('様式49の8 Word','word','r8-t49-8.docx')],['根切顕微','歯根端切除手術','様式49の8']),
  '歯科麻酔': facilityRecord('歯麻酔2','歯科吸入麻酔又は歯科静脈麻酔（2）','tokukei','2-551','別添1 81の5',[facilityLink('別添2（歯麻酔2）PDF','pdf','r8-2-551.pdf'),facilityLink('様式75の5 PDF','pdf','r8-t75-5.pdf'),facilityLink('別添2（歯麻酔2）Word','word','r8-2-551.docx'),facilityLink('様式75の5 Excel','excel','r8-t75-5.xlsx')],['歯麻酔2','歯科吸入麻酔','様式75の5']),
  '補管': facilityRecord('補管','クラウン・ブリッジ維持管理料','tokukei','2-580','別添1 85',[facilityLink('別添2（補管）PDF','pdf','r8-2-580.pdf'),facilityLink('様式81 PDF','pdf','r8-t81.pdf'),facilityLink('別添2（補管）Word','word','r8-2-580.docx'),facilityLink('様式81 Word','word','r8-t81.docx')],['補管','クラウン・ブリッジ維持管理料','様式81']),
  '歯外在ベⅠ': facilityRecord('歯外在ベⅠ','歯科外来・在宅ベースアップ評価料（Ⅰ）','tokukei','2-611','別添1 106の2',[facilityLink('別添2（歯外在ベⅠ）PDF','pdf','r8-2-611.pdf'),facilityLink('様式95 PDF','pdf','r8-t95.pdf'),facilityLink('賃金改善計画書 Excel（歯科診療所）','excel','000399374.xlsx'),facilityLink('賃金改善計画書 記載例PDF（歯科診療所）','pdf','000399380.pdf')],['歯外在ベⅠ','様式95','賃金改善計画書'],BASEUP_FORM_NOTE + ' 要再届出。'),
  '歯外在ベⅠ注': facilityRecord('歯外在ベⅠ注','歯科外来・在宅ベースアップ評価料（Ⅰ）の注5','tokukei','2-612','別添1 106の2',[facilityLink('別添2（歯外在ベⅠ注）PDF','pdf','r8-2-612.pdf'),facilityLink('様式95 PDF','pdf','r8-t95.pdf'),facilityLink('様式98 PDF','pdf','r8-t98.pdf'),facilityLink('賃金改善計画書 Excel（歯科診療所）','excel','000399374.xlsx'),facilityLink('賃金改善計画書 記載例PDF（歯科診療所）','pdf','000399380.pdf')],['歯外在ベⅠ注','様式95','様式98','賃金改善計画書'],BASEUP_FORM_NOTE + ' 新規届出。'),
  '歯外在ベⅡ': facilityRecord('歯外在ベⅡ','歯科外来・在宅ベースアップ評価料（Ⅱ）（1～24）','tokukei','2-613','別添1 106の3',[facilityLink('別添2（歯外在ベⅡ）PDF','pdf','r8-2-613.pdf'),facilityLink('様式96 PDF','pdf','r8-t96.pdf'),facilityLink('賃金改善計画書 Excel（歯科診療所・従来版）','excel','000399375.xlsx'),facilityLink('賃金改善計画書 記載例PDF（歯科診療所）','pdf','000399383.pdf')],['歯外在ベⅡ','様式96','賃金改善計画書'],BASEUP_FORM_NOTE + ' 要再届出。'),
  '歯外在ベⅡ注': facilityRecord('歯外在ベⅡ注','歯科外来・在宅ベースアップ評価料（Ⅱ）の注5及び注6','tokukei','2-614','別添1 106の3',[facilityLink('別添2（歯外在ベⅡ注）PDF','pdf','r8-2-614.pdf'),facilityLink('様式96 PDF','pdf','r8-t96.pdf'),facilityLink('様式98 PDF','pdf','r8-t98.pdf'),facilityLink('賃金改善計画書 Excel（歯科診療所・従来版）','excel','000399375.xlsx'),facilityLink('賃金改善計画書 記載例PDF（歯科診療所）','pdf','000399383.pdf')],['歯外在ベⅡ注','様式96','様式98','賃金改善計画書'],BASEUP_FORM_NOTE + ' 新規届出。'),
  '歯技工所ベースアップ': facilityRecord('歯技ベ','歯科技工所ベースアップ支援料','tokukei','2-616','別添1 108',[facilityLink('別添2（歯技ベ）PDF','pdf','r8-2-616.pdf'),facilityLink('様式101 PDF','pdf','r8-t101.pdf'),facilityLink('厚生労働省 歯科技工所ベースアップ様式案内','other','https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000188411_00053.html#歯科技工所についてはこちら')],['歯技ベ','歯科技工所ベースアップ','様式101'],BASEUP_FORM_NOTE)
};
['歯外在ベⅠ','歯外在ベⅠ注','歯外在ベⅡ','歯外在ベⅡ注','歯技工所ベースアップ'].forEach(key=>{
  FACILITY_FORM_LINKS_R08[key].relatedPageUrl = FACILITY_OFFICIAL_LINKS_R08.baseup;
});
['咬合圧','口細菌'].forEach(key=>{
  FACILITY_FORM_LINKS_R08[key].directFormStatus = 'abolished';
});
FACILITY_FORM_LINKS_R08['外安全１'] = FACILITY_FORM_LINKS_R08['外安全1'];
FACILITY_FORM_LINKS_R08['外安全２'] = FACILITY_FORM_LINKS_R08['外安全2'];
FACILITY_FORM_LINKS_R08['外感染１'] = FACILITY_FORM_LINKS_R08['外感染1'];
FACILITY_FORM_LINKS_R08['外感染２'] = FACILITY_FORM_LINKS_R08['外感染2'];

// デフォルトデータ（くにたち石田歯科・開発用初期値）
const DEFAULT_ENTRIES=[
  {id:1, name:'歯科点数表の初診料の注1（院内感染防止対策）',abbr:'歯初診',  number:'第305505号', date:'2018-06-01',category:'basic',  status:'green', kaitei:'none',    memo:''},
  {id:2, name:'歯科外来診療医療安全対策加算1（外安全1）',    abbr:'外安全１', number:'第615983号', date:'2024-10-01',category:'basic',  status:'yellow',kaitei:'reapply', memo:'令和6年改定で外来環1から再編。'},
  {id:3, name:'歯科外来診療感染対策加算1（外感染1）',        abbr:'外感染１', number:'第615982号', date:'2024-10-01',category:'basic',  status:'yellow',kaitei:'check',   memo:'院内感染管理者の配置要件を確認すること'},
  {id:4, name:'口腔管理体制強化加算（口管強）',              abbr:'口管強',   number:'第312007号', date:'2019-09-01',category:'special',status:'yellow',kaitei:'check',   memo:'口腔機能実地指導料（令和8年6月新設）との関係要確認。'},
  {id:5, name:'CAD/CAM冠・CAD/CAMインレー',                  abbr:'歯ＣＡＤ', number:'第268552号', date:'2015-04-01',category:'special',status:'green', kaitei:'none',    memo:''},
  {id:6, name:'歯科治療総合医療管理料',                      abbr:'医管',     number:'第180101号', date:'2006-04-01',category:'special',status:'green', kaitei:'none',    memo:''},
  {id:7, name:'歯科外来在宅ベースアップ評価料（Ⅰ）',        abbr:'歯外在ベⅠ',number:'第611349号', date:'2024-06-01',category:'special',status:'red',   kaitei:'reapply', memo:'令和8年度改定で再届出必要。'},
  {id:8, name:'補綴物維持管理料',                            abbr:'補管',     number:'第6617号',   date:'1996-04-01',category:'special',status:'green', kaitei:'none',    memo:''},
  {id:9, name:'医療DX推進体制整備加算',abbr:'医療ＤＸ',number:'第610058号',date:'2024-07-01',category:'basic',status:'red',kaitei:'expire',memo:'令和8年6月廃止・再編。電子的歯科診療情報連携体制整備加算への移行が必要。'},
];

// entriesが空（初回起動 or データ消去後）の場合はデフォルトデータをセット
if(!entries || !entries.length){
  entries=DEFAULT_ENTRIES.map(e=>({...e}));
  save();
}
function save(){localStorage.setItem('shisetsu_kijun',JSON.stringify(entries));}
function loadStoredJson(key,fallback){
  try{
    const raw=localStorage.getItem(key);
    return raw?JSON.parse(raw):fallback;
  }catch{
    return fallback;
  }
}
function normalizeStoredMedicalInstitutionNumber(value){
  if(value==null) return '';
  const digits=String(value).trim().replace(/\.0+$/,'').replace(/[^\d]/g,'');
  if(!digits) return '';
  return digits.padStart(7,'0');
}
function getClinicProfile(){
  if(!clinicProfile || typeof clinicProfile!=='object'){
    clinicProfile={medicalInstitutionNumber:''};
  }
  return clinicProfile;
}
function setLastMedicalInstitutionNumber(value){
  const normalized=normalizeStoredMedicalInstitutionNumber(value);
  if(normalized) localStorage.setItem(LAST_MEDICAL_ID_KEY,normalized);
  else localStorage.removeItem(LAST_MEDICAL_ID_KEY);
  return normalized;
}
function getLastMedicalInstitutionNumber(){
  return normalizeStoredMedicalInstitutionNumber(localStorage.getItem(LAST_MEDICAL_ID_KEY)||'');
}
function setOfficialDatasetLastMedicalInstitutionNumber(value){
  const normalized=normalizeStoredMedicalInstitutionNumber(value);
  if(normalized) localStorage.setItem(OFFICIAL_LAST_MEDICAL_ID_KEY,normalized);
  else localStorage.removeItem(OFFICIAL_LAST_MEDICAL_ID_KEY);
  if(normalized) setLastMedicalInstitutionNumber(normalized);
  return normalized;
}
function getOfficialDatasetLastMedicalInstitutionNumber(){
  return normalizeStoredMedicalInstitutionNumber(localStorage.getItem(OFFICIAL_LAST_MEDICAL_ID_KEY)||'');
}
function saveClinicProfile(profile){
  const current=getClinicProfile();
  clinicProfile={
    ...current,
    ...(profile&&typeof profile==='object'?profile:{})
  };
  clinicProfile.medicalInstitutionNumber=normalizeStoredMedicalInstitutionNumber(clinicProfile.medicalInstitutionNumber);
  localStorage.setItem(CLINIC_PROFILE_KEY,JSON.stringify(clinicProfile));
  if(clinicProfile.medicalInstitutionNumber){
    setLastMedicalInstitutionNumber(clinicProfile.medicalInstitutionNumber);
  }
  return clinicProfile;
}
function saveOfficialDataset(data){
  officialDataset=data||null;
  if(data)localStorage.setItem(OFFICIAL_DATASET_KEY,JSON.stringify(data));
  else localStorage.removeItem(OFFICIAL_DATASET_KEY);
}
function saveOfficialManifestMeta(meta){
  officialManifestMeta=meta||null;
  if(meta)localStorage.setItem(OFFICIAL_MANIFEST_META_KEY,JSON.stringify(meta));
  else localStorage.removeItem(OFFICIAL_MANIFEST_META_KEY);
}
function resetToDefault(){
  if(!confirm('台帳をデフォルトデータに戻します。\n現在のデータは消えます。よろしいですか？\n\n（先にデータ管理からバックアップを取ってください）')) return;
  entries=DEFAULT_ENTRIES.map(e=>({...e}));
  save();
  render();
  alert('デフォルトデータに戻しました。');
}

// 定例報告が必要な施設基準と様式番号（台帳表示用）
// 【令和8年改定】歯初診（様式27）・外感染2の定例報告は廃止
const TEIREI_ROW = {
  '在支歯':    '番号9 様式18の2',
  '歯外在ベⅠ':'番号10 様式98(mail)',
  '歯外在ベⅡ':'番号10 様式98(mail)',
};

/* ═══════════════════════════════════════════════════════
   データ管理（エクスポート・インポート）
   バージョン更新時のデータ引き継ぎに使用
═══════════════════════════════════════════════════════ */

const APP_VERSION = '3.1.0';
const APP_DATE    = '2026-03-18';

// エクスポート対象のlocalStorageキー一覧
const DATA_KEYS = {
  shisetsu_kijun:    '届出台帳',
  clinic_profile_v1: '医院情報',
  last_medical_institution_number_v1: '直近の医療機関コード',
  official_dataset_last_medical_id_v1: '更新確認に使った医療機関コード',
  official_dataset_cache_v1: '公式配布データセット',
  official_dataset_manifest_meta_v1: '公式データセット更新情報',
  teirei_records:    '定例報告記録（旧）',
  'teirei_歯初診':   '定例報告：歯初診',
  'teirei_歯外在ベⅠ':'定例報告：ベースアップ',
  'teirei_在支歯':   '定例報告：在支歯',
  'teirei_外感染２': '定例報告：外感染2',
  koushu_list:       '講習会履歴',
  clinic_name:       '医院名',
};

function openDataMgr() {
  // データ件数サマリーを更新
  const lines = Object.entries(DATA_KEYS).map(([key, label]) => {
    const raw = localStorage.getItem(key);
    if (!raw) return `<div>・${label}：<span style="color:var(--text3)">なし</span></div>`;
    try {
      const parsed = JSON.parse(raw);
      const count  = Array.isArray(parsed) ? `${parsed.length}件` : `登録済`;
      return `<div>・${label}：<strong style="color:var(--text)">${count}</strong></div>`;
    } catch {
      return `<div>・${label}：<strong style="color:var(--text)">登録済</strong></div>`;
    }
  });
  document.getElementById('data-summary').innerHTML = lines.join('');
  document.getElementById('data-mgr-overlay').classList.add('open');
}

function exportAllData() {
  const payload = {
    _meta: {
      appVersion:  APP_VERSION,
      exportedAt:  new Date().toISOString(),
      clinicName:  localStorage.getItem('clinic_name') || '',
      description: '歯科行政管理システム バックアップデータ',
    },
  };
  // 固定キーを収集
  Object.keys(DATA_KEYS).forEach(key => {
    const raw = localStorage.getItem(key);
    if (raw) {
      try { payload[key] = JSON.parse(raw); }
      catch { payload[key] = raw; }
    }
  });
  // 届出・変更履歴（動的キー）を収集
  const histKeys = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('kijun_hist_')) {
      try { histKeys[key] = JSON.parse(localStorage.getItem(key)); }
      catch {}
    }
  }
  if (Object.keys(histKeys).length > 0) payload._kijun_hist = histKeys;

  const json     = JSON.stringify(payload, null, 2);
  const blob     = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const dateStr  = new Date().toISOString().slice(0, 10);
  const clinic   = (localStorage.getItem('clinic_name') || '歯科').replace(/\s/g, '_');
  const filename = `dental-admin_backup_${clinic}_${dateStr}.json`;

  const a = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importAllData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const payload = JSON.parse(e.target.result);

      // メタ情報チェック
      if (!payload._meta) {
        alert('このファイルは歯科行政管理システムのバックアップではありません。');
        return;
      }

      const exportedClinic  = payload._meta.clinicName  || '不明';
      const exportedVersion = payload._meta.appVersion  || '不明';
      const exportedAt      = payload._meta.exportedAt
        ? new Date(payload._meta.exportedAt).toLocaleString('ja')
        : '不明';

      if (!confirm(
        `以下のバックアップデータをインポートします。\n\n` +
        `医院名：${exportedClinic}\n` +
        `エクスポート日時：${exportedAt}\n` +
        `バージョン：${exportedVersion}\n\n` +
        `現在のデータはすべて上書きされます。よろしいですか？`
      )) {
        event.target.value = '';
        return;
      }

      // 固定キーをlocalStorageに書き込み
      let restored = 0;
      Object.keys(DATA_KEYS).forEach(key => {
        if (payload[key] !== undefined) {
          localStorage.setItem(key, JSON.stringify(payload[key]));
          restored++;
        }
      });
      // 届出・変更履歴（動的キー）を復元
      if (payload._kijun_hist) {
        Object.entries(payload._kijun_hist).forEach(([key, val]) => {
          localStorage.setItem(key, JSON.stringify(val));
          restored++;
        });
      }

      // グローバル変数を再ロード
      entries    = JSON.parse(localStorage.getItem('shisetsu_kijun') || '[]');
      clinicName = localStorage.getItem('clinic_name') || '○○歯科医院';
      updateClinicPill();

      render();
      closeOverlay('data-mgr-overlay');
      event.target.value = '';

      alert(`✅ インポート完了\n${restored}種類のデータを復元しました。\n\n・届出台帳：${entries.length}件`);

    } catch(err) {
      alert(`インポートに失敗しました。\n正しいJSONファイルを選択してください。\n\n${err.message}`);
      event.target.value = '';
    }
  };
  reader.readAsText(file, 'utf-8');
}


function switchTrecTab(abbr) {
  _trecActiveAbbr = abbr;
  Object.keys(TREC_KIJUN).forEach(a => {
    const btn = document.getElementById(`trec-tab-${a}`);
    if (!btn) return;
    const active = a === abbr;
    btn.style.background  = active ? 'var(--accent)' : 'var(--bg2)';
    btn.style.color       = active ? '#fff' : 'var(--text2)';
    btn.style.borderColor = active ? 'var(--accent)' : 'var(--border2)';
  });
  renderTrecTabContent(abbr);
}

function renderTrecTabContent(abbr) {
  const def = TREC_KIJUN[abbr];
  if (!def) return;
  const dlBtns = [
    def.dlPdf   ? `<a href="${def.dlPdf}"   target="_blank" style="display:inline-flex;align-items:center;gap:5px;padding:5px 12px;background:var(--blue-bg);border:1px solid #bfdbfe;border-radius:5px;font-size:11px;color:var(--accent);text-decoration:none;font-family:var(--font)">📄 様式PDF ↗</a>` : '',
    def.dlExcel ? `<a href="${def.dlExcel}" target="_blank" style="display:inline-flex;align-items:center;gap:5px;padding:5px 12px;background:var(--blue-bg);border:1px solid #bfdbfe;border-radius:5px;font-size:11px;color:var(--accent);text-decoration:none;font-family:var(--font)">📊 様式Excel ↗</a>` : '',
    def.dlWord  ? `<a href="${def.dlWord}"  target="_blank" style="display:inline-flex;align-items:center;gap:5px;padding:5px 12px;background:var(--blue-bg);border:1px solid #bfdbfe;border-radius:5px;font-size:11px;color:var(--accent);text-decoration:none;font-family:var(--font)">📝 様式Word ↗</a>` : '',
  ].filter(Boolean).join('');
  const tc = document.getElementById('trec-tab-content');
  if (!tc) return;
  tc.innerHTML = `
    <div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:14px">
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--accent)">${def.formLabel}</div>
          <div style="font-size:11px;color:var(--text2);margin-top:2px">提出方法：<strong>${def.submitMethod}</strong></div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${dlBtns}</div>
      </div>
      ${def.fields.map(f => `
        <div class="fr">
          <div class="fl">${f.label}</div>
          ${f.type === 'radio'
            ? f.options.map((o,i) => `<label style="display:flex;align-items:center;gap:6px;font-size:12px;margin-bottom:4px;cursor:pointer">
                <input type="radio" name="trec_${abbr}_${f.id}" value="${o}" ${i===0?'checked':''} style="accent-color:var(--accent)"> ${o}
              </label>`).join('')
            : f.type === 'label'
              ? `<div style="font-size:11px;font-weight:700;color:var(--text3);padding:6px 0;border-top:1px solid var(--border);margin-top:4px">${f.label}</div>`
              : f.type === 'textarea'
              ? `<textarea class="fta" id="trec_${abbr}_${f.id}" placeholder="${f.placeholder||''}" style="min-height:60px"></textarea>`
              : `<input type="${f.type}" class="fi" id="trec_${abbr}_${f.id}" placeholder="${f.placeholder||''}">`
          }
        </div>`).join('')}
    </div>`;
}
