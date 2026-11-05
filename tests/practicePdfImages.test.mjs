import {test} from 'node:test';
import assert from 'node:assert/strict';
import {imageDataForReports} from '../netlify/functions/utils/practicePdf.mjs';
const base='https://example.supabase.co',root=base+'/storage/v1/object/public/practice-duty-photos/';
const options={start:'2026-11-05',end:'2026-11-05',teamIds:['maen']};
const report={id:'latest',team_id:'maen',duty_date:'2026-11-05',created_at:'2026-11-05T12:00:00Z'};
test('fetches every full image in latest report and never fetches old or unselected reports',async()=>{
 const calls=[],original=globalThis.fetch;globalThis.fetch=async url=>{calls.push(url);return new Response(new Uint8Array([255,216,255,217]));};
 try{
  const photos=Array.from({length:6},(_,i)=>({full:root+i+'.jpg',thumbnail:root+i+'.thumb.jpg'}));
  const images=await imageDataForReports([{...report,photos},{...report,id:'old',created_at:'2026-11-05T10:00:00Z',photos:[{full:root+'old.jpg'}]},{...report,team_id:'phanu',photos:[{full:root+'other.jpg'}]}],options,base);
  assert.equal(images.size,6);assert.deepEqual(calls,photos.map(p=>p.full));
 }finally{globalThis.fetch=original;}
});
test('falls back to thumbnail only when full image fails and refuses arbitrary origins',async()=>{
 const calls=[],original=globalThis.fetch;globalThis.fetch=async url=>{calls.push(url);return url.endsWith('full.jpg')?new Response('',{status:404}):new Response(new Uint8Array([255,216,255,217]));};
 try{
  const images=await imageDataForReports([{...report,photos:[{full:root+'full.jpg',thumbnail:root+'thumb.jpg'},{full:'https://evil.test/secret',thumbnail:'http://127.0.0.1/test'}]}],options,base);
  assert.deepEqual(calls,[root+'full.jpg',root+'thumb.jpg']);assert.equal(images.size,1);assert.ok(images.has(root+'thumb.jpg'));
 }finally{globalThis.fetch=original;}
});
test('oversized storage objects are not embedded',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response(new Uint8Array(524289));
 try{assert.equal((await imageDataForReports([{...report,photos:[{full:root+'huge.jpg'}]}],options,base)).size,0);}finally{globalThis.fetch=original;}
});
