import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requireAdminExport} from '../netlify/functions/utils/adminExportAuth.mjs';
import {withPdfRuntime} from '../shared/pdfRuntime.mjs';
import practicePdf from '../netlify/functions/create-practice-pdf.mjs';
import publicPdf from '../netlify/functions/create-public-pdf.mjs';
import validatePdf from '../netlify/functions/validate-pdf-login.mjs';
import backgroundPdf from '../netlify/functions/send-public-pdf-background.mjs';
const env={VITE_SUPABASE_URL:'https://example.supabase.co',VITE_SUPABASE_ANON_KEY:'public-test-key'};
const request=(token='verified-token')=>new Request('https://site.test/api/create-practice-pdf',{method:'POST',headers:token?{Authorization:'Bearer '+token}:{},body:'{}'});
function factory(profile,{authError=null,profileError=null,user={id:'user-1',user_metadata:{role:'admin'}}}={}){
 return (url,key,options)=>{
  assert.equal(url,env.VITE_SUPABASE_URL);assert.equal(key,'public-test-key');assert.match(options.global.headers.Authorization,/^Bearer /);
  return {auth:{getUser:async token=>{assert.equal(token,'verified-token');return{data:{user},error:authError};}},from:table=>{
   assert.equal(table,'cs_profiles');return {select:columns=>{assert.equal(columns,'id,role,active');return {eq:(column,id)=>{assert.equal(column,'id');assert.equal(id,'user-1');return {maybeSingle:()=>({abortSignal:async()=>({data:profile,error:profileError})})};}};}};
  }};
 };
}
test('only verified, active database admins can export',async()=>{
 const profile={id:'user-1',role:'admin',active:true};
 const result=await withPdfRuntime({env},()=>requireAdminExport(request(),{clientFactory:factory(profile)}));assert.equal(result,profile);
});
test('presidents, inactive admins, missing profiles and mismatched profiles cannot export even with admin metadata',async()=>{
 for(const profile of [{id:'user-1',role:'president',active:true},{id:'user-1',role:'admin',active:false},{id:'another-user',role:'admin',active:true},null]){
  await assert.rejects(withPdfRuntime({env},()=>requireAdminExport(request(),{clientFactory:factory(profile)})),error=>error.status===403);
 }
});
test('invalid/expired tokens and database outages fail closed',async()=>{
 await assert.rejects(withPdfRuntime({env},()=>requireAdminExport(request(),{clientFactory:factory(null,{authError:{message:'Invalid JWT'}})})),error=>error.status===401);
 await assert.rejects(withPdfRuntime({env},()=>requireAdminExport(request(),{clientFactory:factory(null,{profileError:{message:'Database unavailable'}})})),error=>error.status===503);
});
test('all export entry points reject anonymous calls before parsing bodies or starting a browser',async()=>{
 for(const handler of [practicePdf,publicPdf,validatePdf,backgroundPdf]){
  let launches=0;
  const response=await withPdfRuntime({env,launchBrowser:()=>{launches++;throw new Error('Must not render');}},()=>handler(request(null)));
  assert.equal(response.status,401);assert.equal(launches,0);assert.equal(response.headers.get('cache-control'),'no-store');
 }
});
test('body credentials and role fields cannot bypass the bearer-token gate',async()=>{
 const req=new Request('https://site.test/api/create-public-pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:'irrelevant',role:'admin'})});
 assert.equal((await publicPdf(req)).status,401);
});
