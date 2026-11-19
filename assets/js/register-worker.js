importScripts('../vendor/sax/sax.js','register-regions.js','register-archive.js','register-convert.js');
onmessage=async ({data:{file,drop}})=>{
  try{
    if(file.size>128*1048576)throw new Error('ZIPは128 MiB以内にしてください。');
    const base=new URL('../data/',location.href);
    async function get(url){
      const response=await fetch(url,{cache:'no-store',redirect:'error'});
      if(!response.ok)throw new Error('比較元の取得失敗：HTTP '+response.status);
      return response.text();
    }
    const previous=await get(new URL('manifest.json',base));
    const result=await RegisterConvert.convert(new Uint8Array(await file.arrayBuffer()),file.name,JSON.parse(previous),async meta=>{
      const url=new URL(meta.file.replace(/^\.?\/?assets\/data\//,''),base);
      if(url.origin!==base.origin || !url.pathname.startsWith(base.pathname))throw new Error('配布パスが不正です。');
      return RegisterRegions.verify(meta,await get(url));
    },progress=>postMessage({progress}),drop);
    result.files.set('previous-manifest.json',new TextEncoder().encode(previous));
    result.files.set('review.json',new TextEncoder().encode(JSON.stringify(result.reports,null,2)));
    postMessage({zip:RegisterArchive.pack(result.files),reports:result.reports});
  }catch(e){postMessage({error:e.message});}
};
