// Writes only to a NEW staging directory. Never publishes or changes the active manifest.
const fs=require('node:fs/promises'),path=require('node:path');
global.sax=require('../assets/vendor/sax/sax.js');
for(const mod of ['regions','archive','convert'])require('../assets/js/register-'+mod+'.js');
async function run(){
  const [zip,dest,percent='10',baseline=path.resolve(__dirname,'..')]=process.argv.slice(2);
  if(!zip||!dest)throw new Error('Usage: node tools/register-release.cjs official.zip NEW_DIRECTORY [maximum-decrease-percent]');
  if((await fs.stat(zip)).size>128*1048576)throw new Error('ZIP exceeds 128 MiB');
  const root=path.resolve(baseline),manifestText=await fs.readFile(path.join(root,'assets/data/manifest.json'),'utf8');
  const {files,reports}=await RegisterConvert.convert(await fs.readFile(zip),path.basename(zip),JSON.parse(manifestText),async meta=>{
    const file=path.resolve(root,meta.file);
    if(!file.startsWith(path.join(root,'assets','data')+path.sep))throw new Error('Invalid manifest path');
    return RegisterRegions.verify(meta,await fs.readFile(file,'utf8'));
  },msg=>process.stdout.write(msg+'\n'),Number(percent));
  await writeStage(dest,files,reports,manifestText);
  console.table(reports);
  console.log('Peak converter RSS (MiB): '+Math.round(process.resourceUsage().maxRSS/1024));
}
async function writeStage(dest,files,reports,manifestText,io=fs){
  await io.mkdir(dest);
  const manifestPath='assets/data/manifest.json';
  for(const [name,data] of files){
    if(name===manifestPath)continue;
    const file=path.join(dest,name);
    await io.mkdir(path.dirname(file),{recursive:true});await io.writeFile(file,data,{flag:'wx'});
  }
  await io.writeFile(path.join(dest,'previous-manifest.json'),manifestText);
  await io.writeFile(path.join(dest,'review.json'),JSON.stringify(reports,null,2));
  const temp=path.join(dest,'manifest.pending');
  await io.writeFile(temp,files.get(manifestPath),{flag:'wx'});
  await io.rename(temp,path.join(dest,manifestPath));
}
module.exports={writeStage};
if(require.main===module)run().catch(e=>{process.stderr.write(e.message+'\n');process.exitCode=1;});
