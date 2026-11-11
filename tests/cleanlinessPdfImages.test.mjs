import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanlinessDailyBody,cleanlinessPhotoUrl} from '../shared/cleanlinessDailyLayout.mjs';
import {loadCleanlinessImages} from '../netlify/functions/utils/cleanlinessPdfImages.mjs';
const base='https://example.supabase.co',url=base+'/storage/v1/object/public/cs-published-photos/one.jpg';
const room={room_label:'1/1',photo_public_urls:[url,url.replace('one','two')]};
test('one representative image is paired with each area, with placeholders for missing photos',()=>{
 const html=cleanlinessDailyBody({date:'2026-11-02',supabaseUrl:base,overview:{rooms:[room,{room_label:'1/2'}]}});
 assert.equal((html.match(/<img /g)||[]).length,1);assert.ok(html.includes('ภาพพื้นที่ 1/1'));assert.ok(html.includes('ไม่มีภาพ'));assert.ok(!html.includes('two.jpg'));
});
test('only public storage on the configured Supabase project is accepted',()=>{
 assert.equal(cleanlinessPhotoUrl(room,base),url);
 for(const bad of ['https://evil.test/a.jpg','http://127.0.0.1/photo',base+'/storage/v1/object/sign/private/photo',base+'/rest/v1/data','javascript:alert(1)'])assert.equal(cleanlinessPhotoUrl({photo_public_urls:[bad]},base),'');
});
test('server embeds bounded image bytes, never follows redirects, and never drops area text',async()=>{
 const original=globalThis.fetch,calls=[];globalThis.fetch=async(input,init)=>{calls.push(input);assert.equal(init.redirect,'manual');return new Response(new Uint8Array([255,216,255,217]));};
 try{
  const overview={rooms:[room,room]},images=await loadCleanlinessImages(overview,base);
  assert.deepEqual(calls,[url]);assert.equal(images.size,1);
  const html=cleanlinessDailyBody({date:'2026-11-02',overview,supabaseUrl:base,imageData:images});
  assert.equal((html.match(/src="data:image\/jpeg;base64,/g)||[]).length,2);
 }finally{globalThis.fetch=original;}
});
test('redirected, oversized and non-image responses are not embedded',async()=>{
 const original=globalThis.fetch;
 try{
  for(const response of [new Response(null,{status:302,headers:{Location:'https://evil.test/private'}}),new Response('not an image'),new Response(new Uint8Array(524289))]){
   globalThis.fetch=async()=>response;
   assert.equal((await loadCleanlinessImages({rooms:[room]},base)).size,0);
  }
 }finally{globalThis.fetch=original;}
});
