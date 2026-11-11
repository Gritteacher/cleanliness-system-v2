import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apiName,errorResponse,quotaMessage} from '../worker/policy.mjs';
import {withPdfRuntime,pdfEnvironment,readPdfFont,launchPdfBrowser} from '../shared/pdfRuntime.mjs';
test('old Netlify URLs and new API URLs resolve to the same handler without intercepting assets',()=>{
 assert.equal(apiName('/api/create-practice-pdf'),'create-practice-pdf');
 assert.equal(apiName('/.netlify/functions/create-practice-pdf'),'create-practice-pdf');
 assert.equal(apiName('/assets/index.js'),null);
 assert.equal(apiName('/api-misleading'),null);
});
test('free quota errors stop rendering with a clear retryable 429 instead of a paid fallback',async()=>{
 const response=errorResponse(new Error('Unable to create new browser: code: 429: Browser time limit exceeded for today'));
 assert.equal(response.status,429);assert.deepEqual(await response.json(),{message:quotaMessage});
 assert.equal(response.headers.get('Cache-Control'),'no-store');
});
test('request-local runtime isolates env, font and browser providers across concurrent requests',async()=>{
 const run=name=>withPdfRuntime({env:{name},readFont:()=>Buffer.from(name),launchBrowser:async()=>name},async()=>{
  await new Promise(resolve=>setTimeout(resolve,name==='one'?15:1));
  assert.equal(pdfEnvironment().name,name);
  assert.equal((await readPdfFont('font.ttf')).toString(),name);
  assert.equal(await launchPdfBrowser(),name);
 });
 await Promise.all([run('one'),run('two')]);assert.equal(pdfEnvironment(),process.env);
});
test('concurrency throttling is not reported as an exhausted daily quota',async()=>{
 const response=errorResponse(new Error('429 maximum concurrent browsers reached'));
 assert.equal(response.status,429);assert.equal(response.headers.get('Retry-After'),'30');
 assert.notEqual((await response.json()).message,quotaMessage);
});
