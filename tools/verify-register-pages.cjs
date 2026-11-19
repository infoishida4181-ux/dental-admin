// Read-only, post-deployment checks. Fail on stale pointers or incomplete Pages builds.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
require('../assets/js/register-regions.js');
const root=path.resolve(__dirname,'..'),base=new URL('https://infoishida4181-ux.github.io/dental-admin/');
async function main(){
  const [mode,sha]=process.argv.slice(2);
  assert(['stage','live'].includes(mode)&&/^[0-9a-f]{40}$/.test(sha),'Usage: stage|live COMMIT_SHA');
  const manifest=JSON.parse(await fs.readFile(path.join(root,'assets/data/manifest.json'),'utf8'));
  async function get(file){const url=new URL(file,base);assert.equal(url.origin,base.origin);assert(url.pathname.startsWith(base.pathname));
    url.searchParams.set('release',sha);const r=await fetch(url,{redirect:'error'});if(!r.ok)throw Error(file+': HTTP '+r.status);return r.text();}
  const published=JSON.parse(await get('assets/data/manifest.json'));
  assert.deepEqual(published,mode==='live'?manifest:JSON.parse(await fs.readFile(path.join(root,'assets/data/manifest-r0809.json'),'utf8')),'Unexpected live manifest');
  for(const c of RegisterRegions.kanto){
    const meta=RegisterRegions.active(manifest,c);
    await RegisterRegions.verify(meta,await get(meta.file));
    console.log('PASS public dataset: '+c);
  }
  if(mode==='live'){
    const {chromium}=require('playwright');
    const browser=await chromium.launch({executablePath:process.env.TEST_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
    try{
      const page=await browser.newPage(),errors=[],requested=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('request',r=>{assert(['GET','HEAD'].includes(r.method()));const m=r.url().match(/prefectures\/(\d+)\//);if(m)requested.push(m[1]);});
      await page.goto(new URL('?release='+sha,base).href);assert(await page.evaluate(()=>window.dentalAppReady));
      assert.equal(await page.evaluate(()=>APP_VERSION),'3.2.0');
      assert.equal(requested.length,0);
      const ok=await page.evaluate(async()=>{
        const ledger=JSON.stringify(entries);
        editClinicName();document.getElementById('clinic-prefecture-input').value='09';await saveClinicName();
        await ExcelImport.openOfficialDatasetModal({mode:'update'});
        const c=officialDataset.recordsByClinic.find(x=>x.facilities.length);
        await ExcelImport.searchOfficialDatasetMedicalInstitution(c.medicalInstitutionNumber);
        return ExcelImport.isPreviewCurrent() && ExcelImport.lastOfficialCompareResult.ledgerRows.length>0 && JSON.stringify(entries)===ledger;
      });
      assert(ok);assert.deepEqual(requested,['09']);
      await page.evaluate(()=>{
        // Simulate a pre-regional Tokyo profile and cache, only in this disposable context.
        localStorage.setItem(CLINIC_PROFILE_KEY,JSON.stringify({medicalInstitutionNumber:'0117093'}));
        saveOfficialDataset({area:'tokyo',schemaVersion:'1.1.0',datasetId:'tokyo-dental-r0809',recordsByClinic:[]});
      });
      await page.reload();assert(await page.evaluate(()=>dentalAppReady));
      assert(await page.evaluate(async()=>{
        await ExcelImport.openOfficialDatasetModal({mode:'update'});
        return officialDataset.prefectureCode==='13' && ExcelImport.isPreviewCurrent() && ExcelImport.lastOfficialCompareResult.ledgerRows.length>0;
      }));
      assert.deepEqual(requested,['09','13']);assert.deepEqual(errors,[]);
      console.log('PASS public Chrome: isolated profile, Tochigi search, legacy Tokyo cache/profile upgrade, ledger unchanged');
    }finally{await browser.close();}
  }
}
main().catch(e=>{console.error(e.message.split('\n')[0]);process.exitCode=1;});
