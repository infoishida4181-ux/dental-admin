(() => {
  const box=document.getElementById('register-drop'),input=document.getElementById('register-file');
  const status=document.getElementById('register-progress'),review=document.getElementById('register-review'),download=document.getElementById('register-download');
  let url='',worker,timer;
  function stop(){clearTimeout(timer);worker?.terminate();worker=null;}
  function run(file){
    stop();if(url)URL.revokeObjectURL(url);url='';download.hidden=true;review.replaceChildren();
    if(!file)return;
    if(/\.xlsx$/i.test(file.name)){status.textContent='';ExcelImport.open();ExcelImport.loadFile(file);return;}
    status.textContent='ZIPを検査中';
    function fail(message){status.textContent='公開保留：'+message;stop();}
    try{
      worker=new Worker('./assets/js/register-worker.js');
      const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>fail('処理がタイムアウトしました。再試行してください。'),180000);};
      worker.onerror=()=>fail('変換処理を開始・継続できませんでした。');
      worker.onmessage=({data})=>{
        if(data.error)return fail(data.error);
        if(data.progress){arm();status.textContent=data.progress;return;}
        stop();
        const table=document.createElement('table');
        const header=table.createTHead().insertRow();
        for(const label of ['都県','基準日','作成日','医院 旧→新 (増減)','届出 旧→新','新規','変更','消失候補','重複候補'])header.appendChild(document.createElement('th')).textContent=label;
        const body=table.createTBody();
        for(const r of data.reports){
          const tr=body.insertRow();for(const value of [RegisterRegions.codes[r.prefectureCode],r.asOfDate,r.generatedDate,(r.oldInstitutions??'初回')+' → '+r.institutions+(r.oldInstitutions!==null?' ('+(r.institutions-r.oldInstitutions)+')':''),(r.oldFacilities??'初回')+' → '+r.facilities,r.added,r.changed,r.removed,r.duplicates])tr.insertCell().textContent=value;
        }
        review.append(table);url=URL.createObjectURL(data.zip);download.href=url;download.hidden=false;
        status.textContent='10 / 10 変換・検証完了（未公開）。消失・重複候補は要確認です。行番号は review.json を確認してください。';
      };
      arm();worker.postMessage({file,drop:document.getElementById('register-decline').valueAsNumber});
    }catch(e){fail(e.message);}
  }
  box.ondragover=e=>e.preventDefault();
  box.ondrop=e=>{e.preventDefault();run(e.dataTransfer.files[0]);};
  input.onchange=()=>{run(input.files[0]);input.value='';};
})();
