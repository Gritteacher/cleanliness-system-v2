// Public, read-only smoke tests against a deploy preview or production URL.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
const base=process.argv[2],dir=path.resolve(process.argv[3] || 'output/pdf');
if(!base)throw new Error('Usage: node tests/practicePdfApi.mjs <site-url> [output-directory]');
await fs.mkdir(dir,{recursive:true});
async function download(options,name){
  const response=await fetch(base+'/.netlify/functions/create-practice-pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(options),signal:AbortSignal.timeout(90000)});
  if(!response.ok)throw new Error(`${response.status}: ${await response.text()}`);
  assert.match(response.headers.get('content-type'),/application\/pdf/);
  const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.toString('ascii',0,4),'%PDF');
  await fs.writeFile(path.join(dir,name),bytes);return bytes.length;
}
const single=await download({start:'2026-11-02',end:'2026-11-02',teamIds:['maen','yaowaman','nipha','piyarat','phanu']},'practice-public-daily.pdf');
const range=await download({start:'2026-11-02',end:'2026-11-04',teamIds:['maen','phanu']},'practice-public-range.pdf');
const bad=await fetch(base+'/.netlify/functions/create-practice-pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({start:'2026-11-04',end:'2026-11-02',teamIds:['maen']})});assert.equal(bad.status,400);
console.log(JSON.stringify({passed:true,singleBytes:single,rangeBytes:range,checks:'public daily/range PDFs, subset selection, invalid range rejected'}));
