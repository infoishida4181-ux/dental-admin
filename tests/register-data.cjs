const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path');
global.sax=require('../assets/vendor/sax/sax.js');
for(const m of ['regions','archive','convert'])require('../assets/js/register-'+m+'.js');
const root=path.resolve(__dirname,'..'),enc=new TextEncoder();
const bytes=async files=>new Uint8Array(await RegisterArchive.pack(files).arrayBuffer());
const filename='shisetsu_shika_r0811.zip';
const headers=['医療機関番号','都道府県名','区分','受理番号','算定開始年月日','備考（データ）','医療機関所在地（郵便番号）','受理記号','医療機関名称','都道府県コード','備考（見出し）','受理届出名称','医療機関所在地（住所）','電話番号'];
async function xlsx(pref,mutate,editXml=x=>x){
  const rows=[['[令和８年１０月１日 現在 ]令和８年１１月２日作成'],[],headers.slice(),['0000001',RegisterRegions.codes[pref],'歯科','第1号','令和8年6月1日','','','例','テスト',pref,'','試験基準','','']];
  mutate?.(rows);
  const xml='<worksheet><sheetData>'+rows.map((r,i)=>'<row r="'+(i+1)+'">'+r.map((v,j)=>'<c r="'+String.fromCharCode(65+j)+(i+1)+'" t="inlineStr"><is><t>'+v+'</t></is></c>').join('')+'</row>').join('')+'</sheetData></worksheet>';
  return bytes(new Map([['xl/worksheets/sheet1.xml',enc.encode(editXml(xml))]]));
}
async function main(){
  const source=new Map();
  for(const pref of RegisterRegions.kanto)source.set(pref+'r0811.xlsx',await xlsx(pref));
  const empty={manifestVersion:2,datasets:[]};
  const run=async(s,manifest=empty,load=()=>{throw Error('unexpected baseline');})=>RegisterConvert.convert(await bytes(s),filename,manifest,load,()=>{});
  const out=await run(source);
  const numeric=await xlsx('08',null,xml=>xml.replace('<c r="A4" t="inlineStr"><is><t>0000001</t></is></c>','<c r="A4"><v>1</v></c>')
    .replace('<c r="J4" t="inlineStr"><is><t>08</t></is></c>','<c r="J4" t="n"><v>8</v></c>')
    .replace('<t>テスト</t>','<t>テスト</t><rPh><t>ヨミ</t></rPh>'));
  const one=await RegisterConvert.workbook(numeric,'08','example.xlsx','r0811');
  assert.equal(one.recordsByClinic[0].clinicName,'テスト');
  assert.equal(one.recordsByClinic[0].medicalInstitutionNumber,'0000001');
  const {writeStage}=require('../tools/register-release.cjs');
  let renamed=false;
  await assert.rejects(writeStage('test-only',out.files,out.reports,'{}',{
    mkdir:async()=>{},writeFile:async f=>{if(f.endsWith('manifest.pending'))throw Error('ENOSPC');},rename:async()=>{renamed=true;}
  }),/ENOSPC/);
  assert.equal(renamed,false,'No completed staging manifest on quota failure');
  assert.equal(out.reports.length,10);
  const load=async meta=>RegisterRegions.verify(meta,new TextDecoder().decode(out.files.get(meta.file.slice(2))));
  for(const code of RegisterRegions.kanto){
    const meta=RegisterRegions.active(out.next,code), d=await load(meta);
    assert.equal(d.recordsByClinic[0].medicalInstitutionNumber,'0000001');assert.equal(d.prefectureCode,code);
    assert.equal(d.recordsByClinic[0].facilities[0].startDate,'2026/06/01');
  }
  const second=await run(source,out.next,load);
  assert(second.reports.every(r=>!r.added&&!r.removed&&!r.changed));
  const invalid=async mutate=>{
    const s=new Map(source);await mutate(s);await assert.rejects(run(s));
  };
  await invalid(s=>s.delete('08r0811.xlsx'));
  await invalid(s=>s.set('08secondr0811.xlsx',s.get('08r0811.xlsx')));
  await invalid(s=>s.set('../bad',new Uint8Array()));
  await invalid(s=>s.set('extra.txt',new Uint8Array()));
  await invalid(s=>s.set('08r0811.xlsx',s.get('09r0811.xlsx')));
  await invalid(async s=>s.set('08r0811.xlsx',await xlsx('08',r=>r[2][0]='未知の列')));
  await invalid(async s=>s.set('08r0811.xlsx',await xlsx('08',r=>r[3][0]='123x')));
  await invalid(s=>s.set('08r0811.xlsx',new Uint8Array(128)));
  await assert.rejects(run(source,out.next,async m=>({...await load(m),institutionCount:20})),/大幅減少/);
  await assert.rejects(run(source,out.next,async m=>({...await load(m),asOfDate:'2027-01-01'})),/基準日逆行/);
  await assert.rejects(run(source,out.next,()=>{throw Error('通信失敗');}),/通信失敗/);
  await assert.rejects(run(source,out.next,()=>null),/比較元/);
  await assert.rejects(RegisterRegions.verify(out.next.datasets[0],'{}'),/checksum/);
  const current=JSON.parse(await fs.readFile(path.join(root,'assets/data/manifest.json'),'utf8'));
  for(const c of RegisterRegions.kanto){
    const m=RegisterRegions.active(current,c),d=await RegisterRegions.verify(m,await fs.readFile(path.resolve(root,m.file),'utf8'));
    assert.equal(new Set(d.recordsByClinic.map(x=>x.medicalInstitutionNumber)).size,d.institutionCount);
    assert(d.recordsByClinic.every(x=>/^\d{7}$/.test(x.medicalInstitutionNumber)));
  }
  const old=JSON.parse(await fs.readFile(path.join(root,'assets/data/manifest-r0809.json'),'utf8'));
  assert(RegisterRegions.active(old,'13'));assert.equal(RegisterRegions.active(old,'08'),undefined);
  const vm=require('node:vm'),{execFileSync}=require('node:child_process');
  const legacy={};legacy.window=legacy;
  const oldScript=execFileSync('git',['show','726cf08935f94328f3633139b4b2f827bf168408:assets/js/import-excel.js'],{cwd:root,encoding:'utf8'});
  // Exercise the previous shipped reader, not the DOM-dependent page boot.
  vm.runInNewContext(oldScript.replace('ExcelImport.init();',''),legacy);
  const tokyo=current.datasets.find(x=>x.datasetId===current.activeDatasetId);
  const data=JSON.parse(await fs.readFile(path.resolve(root,tokyo.file),'utf8'));
  const sample=data.recordsByClinic[0];legacy.window.ExcelImport.validateOfficialDataset(data);
  assert.equal(legacy.window.ExcelImport.findInstitutionByCode(sample.medicalInstitutionNumber,data).length,sample.facilities.length);
  console.log('PASS: reordered headers, ten regions, matching numbers across regions, deterministic data, malformed ZIP/rows, omissions/duplicates, prior failures, all distribution files and legacy manifest');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
