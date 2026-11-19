// Actual drop event and Worker, loopback only. Never use an existing clinic profile.
const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
async function run(){
  const zip=process.argv[2];assert(zip,'Specify the official source ZIP');
  let adminBaseline=false;
  const server=http.createServer(async(req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname,filename=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!filename.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    try{const bytes=await fs.readFile(adminBaseline && pathname==='/assets/data/manifest.json'?path.join(process.argv[4],'assets/data/manifest.json'):filename);res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[path.extname(filename)]||'application/octet-stream'}).end(bytes);}
    catch{res.writeHead(404).end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  let browser;
  try{
    browser=await chromium.launch({executablePath:process.env.TEST_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
    const context=await browser.newContext();
    await context.route('https://**/*',r=>r.fulfill({body:'window.pdfjsLib={GlobalWorkerOptions:{}};',contentType:'text/javascript'}));
    const page=await context.newPage(),errors=[],regions=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{const m=r.url().match(/prefectures\/(\d+)\//);if(m)regions.push(m[1]);});
    await page.goto('http://127.0.0.1:'+server.address().port+'/');
    assert.equal(await page.evaluate(()=>window.dentalAppReady),true);
    const initial=await page.evaluate(()=>JSON.stringify(entries));
    assert.equal(regions.length,0);
    for(const view of ['daichou','kaitei','teirei','koushu']) await page.locator('[data-view="'+view+'"]').first().click();
    await page.evaluate(()=>editClinicName());
    await page.locator('#clinic-prefecture-input').selectOption('14');
    const other=await context.newPage();await other.goto(page.url());
    assert(await other.evaluate(()=>window.dentalAppReady));
    await page.evaluate(()=>saveClinicName());
    assert.equal(await page.evaluate(()=>ExcelImport.profileRegion()),'');
    await other.close();
    await page.evaluate(()=>saveClinicName());
    await page.evaluate(()=>ExcelImport.openOfficialDatasetModal({mode:'update'}));
    assert.deepEqual(regions,['14']);
    assert.equal(await page.evaluate(async()=>{
      const c=officialDataset.recordsByClinic.find(x=>x.facilities.length);
      await ExcelImport.searchOfficialDatasetMedicalInstitution(c.medicalInstitutionNumber);
      return ExcelImport.isPreviewCurrent() && ExcelImport.lastOfficialCompareResult.ledgerRows.length>0;
    }),true);
    await page.evaluate(()=>{closeOfficialDatasetModal();editClinicName();});
    await page.locator('#clinic-prefecture-input').selectOption('01');
    await page.evaluate(()=>saveClinicName());
    await page.evaluate(()=>ExcelImport.openOfficialDatasetModal({mode:'update'}));
    assert.match(await page.locator('#official-dataset-overlay').innerText(),/データ準備中/);
    assert.deepEqual(regions,['14']);
    assert.equal(await page.evaluate(()=>JSON.stringify(entries)),initial);
    await page.evaluate(async()=>{closeOfficialDatasetModal();requestAdminModeAccess();document.getElementById('admin-passphrase-input').value=ADMIN_DEFAULT_PASSPHRASE;await submitAdminPassphrase();
      const pick=document.createElement('input');pick.type='file';pick.id='test-source';document.body.appendChild(pick);});
    assert(await page.locator('#register-drop').isVisible());
    adminBaseline=Boolean(process.argv[4]);
    await page.locator('#test-source').setInputFiles(zip);
    const sampleMemory=async label=>{
      if(process.env.REGISTER_MEMORY!=='1'||process.platform!=='win32')return;
      const cdp=await browser.newBrowserCDPSession();
      const {processInfo}=await cdp.send('SystemInfo.getProcessInfo');await cdp.detach();
      const ids=processInfo.map(p=>Number(p.id)).filter(n=>Number.isInteger(n)&&n>0);
      const command='(Get-Process -Id '+ids.join(',')+' -ErrorAction SilentlyContinue | Measure-Object WorkingSet64 -Sum).Sum';
      const memory=Number(require('node:child_process').execFileSync('powershell',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true}));
      assert(memory>0);console.log('Isolated Chrome working-set sum, '+label+': '+Math.round(memory/1048576)+' MiB (shared pages may be counted twice)');
    };
    await sampleMemory('before conversion');
    await page.evaluate(()=>{const dt=new DataTransfer();dt.items.add(document.querySelector('#test-source').files[0]);document.querySelector('#register-drop').dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}));});
    if(process.env.REGISTER_MEMORY==='1'){
      await page.waitForFunction(()=>/東京都 変換/.test(document.querySelector('#register-progress').textContent),{},{timeout:180000});
      await sampleMemory('during Tokyo workbook');
    }
    await page.waitForFunction(()=>/公開保留|未公開/.test(document.querySelector('#register-progress').textContent),{},{timeout:360000});
    assert.match(await page.locator('#register-progress').textContent(),/10 \/ 10.*未公開/);
    assert.equal(await page.locator('#register-review tbody tr').count(),10);
    assert(await page.evaluate(async()=>{const r=await fetch(document.querySelector('#register-download').href);return (await r.blob()).size>10000000;}));
    if(process.argv[3]){
      const event=page.waitForEvent('download');await page.locator('#register-download').click();
      await (await event).saveAs(process.argv[3]);
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: boot, ledger/revision/training/report navigation, profile switching, one-region fetch, preview only, unserved region, real ten-workbook drop/worker/release package');
  }finally{await browser?.close();await new Promise(r=>server.close(r));}
}
run().catch(e=>{console.error(e.message);process.exitCode=1;});
