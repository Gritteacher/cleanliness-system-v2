import fs from 'node:fs';
import assert from 'node:assert/strict';
const config=JSON.parse(fs.readFileSync(process.argv[2]));
for(const token of [config.anon,config.anon.split('.').slice(0,2).join('.')+'.invalid']){
  const form=new FormData();form.append('report',JSON.stringify({operation:'delete',id:'e0632981-47b6-4814-bcaa-35912d0658b4',role:'admin',isAdmin:true}));
  const response=await fetch(config.url+'/functions/v1/practice-admin',{method:'POST',headers:{apikey:config.anon,Authorization:'Bearer '+token},body:form});
  assert.equal(response.status,401,await response.text());
}
console.log('PASS: anonymous and forged tokens cannot invoke admin mutations; caller-supplied admin flags ignored');
