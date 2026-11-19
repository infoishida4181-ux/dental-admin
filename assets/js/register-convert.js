/* Loaded only by the admin worker and the offline release tool. */
(function(root){
  'use strict';
  const {check}=RegisterArchive;
  const norm=s=>String(s??'').normalize('NFKC').replace(/\s+/g,'');
  const enc=new TextEncoder();
  function date(input){
    const s=norm(input);
    const jp=/^(昭和|平成|令和)(元|\d+)年(\d+)月(\d+)日$/.exec(s);
    const iso=/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(s);
    const parts=jp?[({昭和:1925,平成:1988,令和:2018})[jp[1]]+(jp[2]==='元'?1:+jp[2]),+jp[3],+jp[4]]:iso?.slice(1).map(Number);
    if(!parts)return '';
    const [y,m,d]=parts, dt=new Date(Date.UTC(y,m-1,d));
    return dt.getUTCFullYear()===y && dt.getUTCMonth()===m-1 && dt.getUTCDate()===d?dt.toISOString().slice(0,10):'';
  }
  async function xml(entry,events){
    check(entry,'必要なExcel XMLがありません。');
    const p=sax.parser(true,{strictEntities:true}), decoder=new TextDecoder('utf-8',{fatal:true});
    p.ondoctype=()=>{throw new Error('DTDは非対応です。');};
    Object.assign(p,events);
    await entry.consume(chunk=>p.write(decoder.decode(chunk,{stream:true})));
    p.write(decoder.decode()).close();
  }
  const columns={pref:'都道府県コード',name:'都道府県名',type:'区分',id:'医療機関番号',clinic:'医療機関名称',facility:'受理届出名称',code:'受理記号',number:'受理番号',start:'算定開始年月日',zip:'医療機関所在地(郵便番号)',address:'医療機関所在地(住所)',phone:'電話番号',note:'備考(見出し)',value:'備考(データ)'};
  async function workbook(bytes,pref,file,version){
    const book=RegisterArchive.read(bytes,true), sheets=[...book.keys()].filter(n=>/^xl\/worksheets\/[^/]+\.xml$/.test(n));
    check(sheets.length===1 && ![...book.keys()].some(n=>/\.(?:bin|zip|xlsx)$/i.test(n) && !/^xl\/printerSettings\/printerSettings\d+\.bin$/.test(n)),'非対応のExcel構成です。単一シートの公式帳票を使用してください。');
    const strings=[];
    let s='',take=false,phonetic=false;
    if(book.has('xl/sharedStrings.xml')) await xml(book.get('xl/sharedStrings.xml'),{
      onopentag(n){if(n.name==='si')s='';if(n.name==='rPh')phonetic=true;if(n.name==='t'&&!phonetic)take=true;},
      ontext(t){if(take)s+=t;},
      onclosetag(n){if(n==='rPh')phonetic=false;if(n==='t')take=false;if(n==='si'){check(strings.length<500000 && s.length<8192,'共有文字列の上限を超えました。');strings.push(s);}}
    });
    const clinics=new Map(), duplicateRows=[];
    let map,asOfDate,generatedDate,row,num=0,col,kind,reading=false,val='',headerRow,facilityCount=0;
    const requireRow=(ok,msg)=>check(ok,num+'行：'+msg);
    function endRow(){
      if(!row.some(x=>x))return;
      if(!map){
        requireRow(num<=64,'ヘッダーを確認できません。');
        const cells=row.map(norm);
        const dates=cells.join('').match(/\[((?:令和|平成)\d+年\d+月\d+日)現在\]((?:令和|平成)\d+年\d+月\d+日)作成/);
        if(dates){asOfDate=date(dates[1]);generatedDate=date(dates[2]);}
        if(!cells.includes(columns.id))return;
        map={};headerRow=num;
        for(const [key,h] of Object.entries(columns)){
          const idx=cells.indexOf(h);requireRow(idx>=0 && cells.lastIndexOf(h)===idx,'列の不足または重複：'+h);map[key]=idx;
        }
        return;
      }
      const get=k=>(row[map[k]]??'').trim(),id=norm(get('id'));
      requireRow(norm(get('pref'))===pref && get('name')===RegisterRegions.codes[pref] && get('type')==='歯科','都県または区分が一致しません。');
      requireRow(/^\d{7}$/.test(id),'医療機関番号は7桁の文字列が必要です。');
      requireRow(get('clinic'),'医療機関名称がありません。');
      let c=clinics.get(id);
      if(!c){
        c={medicalInstitutionNumber:id,clinicName:get('clinic'),address:[get('zip'),get('address')].filter(Boolean).join(' '),phone:get('phone'),facilities:[]};
        clinics.set(id,c);
      }
      requireRow(c.clinicName===get('clinic'),'同じ医療機関番号で名称が異なります。');
      if(!['facility','code','number','start','note','value'].some(k=>get(k)))return;
      requireRow(get('facility') && get('code') && get('number'),'届出名・受理記号・番号が不足しています。');
      const start=date(get('start'));requireRow(start,'算定開始年月日を確認してください。');
      const f={acceptedName:get('facility'),acceptedCode:get('code'),acceptedNumber:get('number'),startDate:start.replaceAll('-','/'),remarks:[get('note'),get('value')].filter(Boolean).join('：')};
      if(c.facilities.some(x=>x.acceptedCode===f.acceptedCode && x.acceptedNumber===f.acceptedNumber && x.startDate===f.startDate && x.remarks===f.remarks && x.acceptedName===f.acceptedName))duplicateRows.push(num);
      c.facilities.push(f);facilityCount++;
    }
    await xml(book.get(sheets[0]),{
      onopentag(n){
        if(n.name==='row'){const r=Number(n.attributes.r);check(Number.isInteger(r)&&r>num&&r<=180000,'行番号が不正です。');num=r;row=[];}
        if(n.name==='c'){
          const m=/^([A-Z]{1,2})(\d+)$/.exec(n.attributes.r);requireRow(m && +m[2]===num,'セル番地不正');
          col=[...m[1]].reduce((v,ch)=>v*26+ch.charCodeAt(0)-64,0)-1;requireRow(col<128 && !(col in row),'列数またはセル重複');
          kind=n.attributes.t;val='';
        }
        if(n.name==='f')requireRow(false,'数式セルは対応していません。');
        if(n.name==='rPh')phonetic=true;
        if(n.name==='v'||(n.name==='t'&&!phonetic))reading=true;
      },
      ontext(t){if(reading)val+=t;},
      onclosetag(n){
        if(n==='v'||n==='t')reading=false;
        if(n==='rPh')phonetic=false;
        if(n==='c'){
          requireRow(kind!=='s'||(/^\d+$/.test(val)&& +val<strings.length),'共有文字列参照が不正です。');
          if(map && (!kind||kind==='n') && /^\d+$/.test(val)){
            if(col===map.pref)val=val.padStart(2,'0');
            if(col===map.id)val=val.padStart(7,'0');
          }
          row[col]=kind==='s'?strings[+val]:val;
        }
        if(n==='row')endRow();
      }
    });
    check(map&&clinics.size&&asOfDate&&generatedDate&&generatedDate>=asOfDate,'データ行・基準日・作成日を確認できません。');
    return {schemaVersion:'1.1.0',datasetId:'dental-'+pref+'-'+version,datasetName:RegisterRegions.codes[pref]+' 歯科施設基準',prefectureCode:pref,area:pref==='13'?'tokyo':pref,category:'dental',format:'grouped-by-clinic',sourceFileName:file,sourceDate:asOfDate,asOfDate,generatedDate,headerDisplayRow:headerRow,duplicateRows,recordsByClinic:Array.from(clinics.values()),recordCount:facilityCount,institutionCount:clinics.size,facilityCount};
  }
  function diff(old,d){
    const index=ds=>{
      const m=new Map();
      for(const c of ds?.recordsByClinic||[])for(const f of c.facilities){
        const k=c.medicalInstitutionNumber+'|'+norm(f.acceptedCode),list=m.get(k)||[];
        list.push(JSON.stringify([norm(f.acceptedName),norm(f.acceptedNumber),norm(f.startDate),norm(f.remarks)]));m.set(k,list);
      }return m;
    };
    const a=index(old),b=index(d);let added=0,changed=0,removed=0;
    for(const k of new Set([...a.keys(),...b.keys()])){
      const before=a.get(k)||[],after=b.get(k)||[],rest=before.slice();
      let different=0;
      for(const v of after){const i=rest.indexOf(v);if(i>=0)rest.splice(i,1);else different++;}
      const paired=Math.min(rest.length,different);changed+=paired;added+=different-paired;removed+=rest.length-paired;
    }
    return {prefectureCode:d.prefectureCode,oldInstitutions:old?.institutionCount??null,institutions:d.institutionCount,oldFacilities:old?.facilityCount??null,facilities:d.facilityCount,added,changed,removed,asOfDate:d.asOfDate,generatedDate:d.generatedDate};
  }
  async function convert(input,name,manifest,loadPrior,progress,drop=10){
    check(Number.isFinite(drop)&&drop>=0&&drop<=100,'減少率の設定が不正です。');
    const match=/^shisetsu_shika_(r\d{4})\.zip$/i.exec(name);check(match,'公式ZIPのファイル名を確認してください。');
    const version=match[1].toLowerCase(), archive=RegisterArchive.read(input), sources=new Map();
    for(const [path,entry] of archive){
      if(path.endsWith('/')){check(path===name.slice(0,-4)+'/' && !entry.size,'想定外のフォルダです。');continue;}
      const file=path.split('/').pop(),pref=file.slice(0,2);
      check((path===file || path===name.slice(0,-4)+'/'+file) && RegisterRegions.kanto.includes(pref) && file.endsWith(version+'.xlsx')&&!sources.has(pref),'対象外・重複したファイル：'+file);
      sources.set(pref,{entry,file});
    }
    check(sources.size===RegisterRegions.kanto.length,'10都県すべてのExcelが必要です。');
    progress('ZIP検査・都県識別：10 / 10');
    const files=new Map(), reports=[], datasets=manifest.datasets.map(x=>({...x})), now=new Date().toISOString();
    for(const [i,pref] of RegisterRegions.kanto.entries()){
      const {entry,file}=sources.get(pref);progress(RegisterRegions.codes[pref]+' 変換・検証中 ('+(i+1)+'/10)');
      try{
        const d=await workbook(await RegisterArchive.bytes(entry),pref,file,version);
        const base=RegisterRegions.active(manifest,pref),old=base?await loadPrior(base):null;
        check(!base||old,'比較元を取得できません。');
        if(old){
          if(!old.recordsByClinic && Array.isArray(old.records)){
            const grouped=new Map();
            for(const f of old.records){
              const id=norm(f.medicalInstitutionNumber??f.medicalId);
              check(/^\d{1,7}$/.test(id),'比較元の医院番号が不正です。');
              const key=id.padStart(7,'0');
              if(!grouped.has(key))grouped.set(key,{medicalInstitutionNumber:key,facilities:[]});
              grouped.get(key).facilities.push(f);
            }
            old.recordsByClinic=[...grouped.values()];
          }
          check(Array.isArray(old.recordsByClinic),'比較元の形式が不正です。');
          old.institutionCount??=old.recordsByClinic.length;
          old.facilityCount??=old.recordsByClinic.reduce((n,c)=>n+c.facilities.length,0);
        }
        const report={...diff(old,d),duplicates:d.duplicateRows.length,duplicateRows:d.duplicateRows};
        const priorDate=old?.asOfDate||old?.sourceDate;
        check(!old || ((!priorDate || (date(priorDate) && d.asOfDate>=date(priorDate))) && (!base.version || version>=base.version) && d.institutionCount>=old.institutionCount*(1-drop/100) && d.facilityCount>=old.facilityCount*(1-drop/100)),'基準日逆行または件数の大幅減少。公開保留：'+JSON.stringify(report));
        const bytes=enc.encode(JSON.stringify(d)),checksum=await RegisterRegions.hash(bytes);
        const path='prefectures/'+pref+'/dental-'+version+'-'+checksum.slice(0,16)+'.json';
        const meta={prefectureCode:pref,prefectureName:RegisterRegions.codes[pref],regionalBureau:'関東信越厚生局',datasetId:d.datasetId,file:'./assets/data/'+path,label:d.datasetName,schemaVersion:d.schemaVersion,asOfDate:d.asOfDate,sourceDate:d.sourceDate,generatedDate:d.generatedDate,updatedAt:now,sourceFileName:file,institutionCount:d.institutionCount,facilityCount:d.facilityCount,checksum,active:true,version,format:d.format};
        for(const x of datasets)if(x.prefectureCode===pref)x.active=false;
        const previous=datasets.find(x=>x.datasetId===meta.datasetId);
        if(previous){check(previous.checksum===checksum,'同じ版の異なる内容です。公開版を上書きできません。');previous.active=true;}
        else datasets.push(meta);
        await RegisterRegions.verify(meta,new TextDecoder().decode(bytes));
        files.set('assets/data/'+path,bytes);reports.push(report);
      }catch(e){throw new Error(file+'：'+e.message);}
    }
    const next={...manifest,manifestVersion:2,activeDatasetId:datasets.find(x=>x.prefectureCode==='13'&&x.active).datasetId,datasets};
    files.set('assets/data/manifest.json',enc.encode(JSON.stringify(next,null,2)+'\n'));
    return {files,reports,next};
  }
  root.RegisterConvert={convert,workbook,diff,date};
})(globalThis);
