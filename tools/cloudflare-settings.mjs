// One-time migration helper. Never writes credentials to disk or prints values.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const siteId='a5c7120c-dcdf-4180-92d2-49c3ba4e32fb';
const command=process.argv[2];
if(!['build','upload','inspect'].includes(command))throw new Error('Use build, upload or inspect');
let token=process.env.NETLIFY_AUTH_TOKEN;
if(!token){const config=JSON.parse(await fs.readFile(path.join(os.homedir(),'Library/Preferences/netlify/config.json'),'utf8'));const auth=config.users[config.userId].auth;token=typeof auth==='string'?auth:auth.token;}
async function get(url){
 for(let attempt=0;attempt<3;attempt++)try{
  const response=await fetch(url,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('Configuration API returned '+response.status);
  return await response.json();
 }catch(error){if(attempt===2)throw error;}
}
const site=await get('https://api.netlify.com/api/v1/sites/'+siteId);
const rows=await get('https://api.netlify.com/api/v1/accounts/'+site.account_id+'/env?site_id='+siteId);
if(!Array.isArray(rows))throw new Error('Invalid configuration response');
const value=key=>{const values=rows.find(row=>row.key===key)?.values||[];return (values.find(v=>v.context==='production')||values.find(v=>v.context==='all'))?.value;};
const env={VITE_SUPABASE_URL:value('VITE_SUPABASE_URL')||value('SUPABASE_URL'),VITE_SUPABASE_ANON_KEY:value('VITE_SUPABASE_ANON_KEY')||value('SUPABASE_ANON_KEY')};
if(!env.VITE_SUPABASE_URL||!env.VITE_SUPABASE_ANON_KEY)throw new Error('Public Supabase configuration missing');
const key=env.VITE_SUPABASE_ANON_KEY;
if(!key.startsWith('sb_publishable_')){
 const claims=JSON.parse(Buffer.from(key.split('.')[1],'base64url'));
 if(claims.role!=='anon')throw new Error('Refusing to publish a privileged key');
}
if(command==='inspect'){
 const functions=await get('https://api.netlify.com/api/v1/sites/'+siteId+'/functions').catch(()=>[]);
 const list=Array.isArray(functions)?functions:functions.functions||[];
 console.log(JSON.stringify({keys:Object.keys(env),emailConfigured:Boolean(value('RESEND_API_KEY')),siteUrl:value('PUBLIC_SITE_URL'),schedules:site.function_schedules,functions:list.map(f=>({name:f.name,schedule:f.schedule,keys:Object.keys(f)}))}));
}else{
 const result=command==='build'
  ?spawnSync('npm',['run','build'],{env:{...process.env,...env},stdio:'inherit'})
  :spawnSync('npx',['wrangler','secret','bulk'],{input:JSON.stringify(env),encoding:'utf8'});
 if(command==='upload'){process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');}
 if(result.error)throw result.error;
 process.exitCode=result.status||0;
}
