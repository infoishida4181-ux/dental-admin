// Verify a reviewed package against a fresh offline conversion before promoting it.
// No Git operations, writes, or extraction. Unknown archive names are never used as paths.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
require('../assets/js/register-archive.js');
require('../assets/js/register-regions.js');
async function checkPackage(reviewedZip,freshDir,repo=path.resolve(__dirname,'..')){
  const read=(base,name)=>fs.readFile(path.join(base,name));
  const parsed=bytes=>JSON.parse(new TextDecoder().decode(bytes));
  assert((await fs.stat(reviewedZip)).size<=128*1048576,'Oversized package');
  const zip=RegisterArchive.read(await fs.readFile(reviewedZip));
  const get=async name=>{assert(zip.has(name),'Missing '+name);return RegisterArchive.bytes(zip.get(name));};
  const before=parsed(await get('previous-manifest.json'));
  assert.deepEqual(before,parsed(await read(repo,'assets/data/manifest.json')),'Published baseline changed; rebuild');
  assert.deepEqual(before,parsed(await read(freshDir,'previous-manifest.json')));
  assert.deepEqual(parsed(await get('review.json')),parsed(await read(freshDir,'review.json')));
  const mp='assets/data/manifest.json', supplied=parsed(await get(mp)),fresh=parsed(await read(freshDir,mp));
  const comparable=m=>({...m,datasets:m.datasets.map(({updatedAt,...rest})=>rest)});
  assert.deepEqual(comparable(supplied),comparable(fresh),'Manifest differs from independent conversion');
  const expected=new Set([mp,'previous-manifest.json','review.json']);
  for(const code of RegisterRegions.kanto){
    const meta=RegisterRegions.active(fresh,code),name=meta.file.slice(2);
    assert(new RegExp('^assets/data/prefectures/'+code+'/dental-r[0-9]{4}-[0-9a-f]{16}\\.json$').test(name));
    expected.add(name);
    const data=await get(name);
    assert.equal(await RegisterRegions.hash(data),meta.checksum);
    assert.deepEqual(Buffer.from(data),await read(freshDir,name));
    try{assert.deepEqual(Buffer.from(data),await read(repo,name),'An immutable dataset already exists with different bytes');}
    catch(e){if(e.code!=='ENOENT')throw e;}
  }
  assert.deepEqual(new Set(zip.keys()),expected);
}
module.exports=checkPackage;
if(require.main===module)checkPackage(...process.argv.slice(2)).then(()=>console.log('PASS: baseline, archive allowlist, manifest and immutable data match independent conversion')).catch(e=>{console.error(e.message.split('\n')[0]);process.exitCode=1;});
