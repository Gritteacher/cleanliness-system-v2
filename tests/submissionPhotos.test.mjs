import test from 'node:test';
import assert from 'node:assert/strict';
import { activeSubmissionPhotos, removeSubmissionPhoto } from '../src/utils/submissionPhotos.js';
const photo={id:'p1',public_url:'https://example.test/full.webp',thumbnail_path:'a.thumb.webp'};
function fake({rpcError=null,row=null,readError=null,storageError=null,storageThrows=false,path='a.full.webp'}={}) {
  const calls=[];
  return {calls,client:{
    rpc:async(name,args)=>{calls.push(['rpc',name,args]);return {data:path,error:rpcError};},
    from:table=>{calls.push(['read',table]);return {select:()=>({eq:()=>({maybeSingle:async()=>({data:row,error:readError})})})};},
    storage:{from:bucket=>({remove:async paths=>{calls.push(['storage',bucket,paths]);if(storageThrows)throw Error('network');return {error:storageError};}})}
  }};
}
test('deleted photos are excluded but legacy active rows and empty parent submissions remain valid',()=>{
  const active={id:'active',deleted_at:null},legacy={id:'legacy'},deleted={id:'deleted',deleted_at:'2026-11-02'};
  assert.deepEqual(activeSubmissionPhotos([active,deleted,legacy]),[active,legacy]);
  assert.deepEqual(activeSubmissionPhotos(null),[]);
  assert.deepEqual(activeSubmissionPhotos([deleted]),[]);
});
test('successful removal deletes report metadata first then both storage variants',async()=>{
  const f=fake();assert.deepEqual(await removeSubmissionPhoto(f.client,photo),{alreadyDeleted:false,cleanupWarning:false});
  assert.deepEqual(f.calls,[['rpc','cs_delete_live_photo',{p_photo_id:'p1'}],['storage','cs-published-photos',['a.full.webp','a.thumb.webp']]]);
});
test('already deleted is a no-op only after an RLS-protected read confirms deletion',async()=>{
  const f=fake({rpcError:{message:'Photo not found'},row:{id:'p1',deleted_at:'2026-11-02'}});
  assert.deepEqual(await removeSubmissionPhoto(f.client,photo),{alreadyDeleted:true,cleanupWarning:false});
  assert.equal(f.calls.some(call=>call[0]==='storage'),false);
});
test('a missing or still-active photo never hides the server error',async()=>{
  for(const row of [null,{id:'p1',deleted_at:null}]){
    const error={message:'Photo not found'},f=fake({rpcError:error,row});
    await assert.rejects(removeSubmissionPhoto(f.client,photo),e=>e===error);
    assert.equal(f.calls.some(call=>call[0]==='storage'),false);
  }
});
test('permission failures are not converted to success or bypassed',async()=>{
  const error={message:'You cannot delete this photo'},f=fake({rpcError:error});
  await assert.rejects(removeSubmissionPhoto(f.client,photo),e=>e===error);
  assert.equal(f.calls.length,1);
});
test('an unsuccessful verification read cannot turn not-found into success',async()=>{
  const error={message:'Photo not found'},f=fake({rpcError:error,row:{deleted_at:'2026-11-02'},readError:{message:'denied'}});
  await assert.rejects(removeSubmissionPhoto(f.client,photo),e=>e===error);
});
test('storage cleanup failures preserve confirmed report deletion and surface a warning',async()=>{
  for(const options of [{storageError:{message:'denied'}},{storageThrows:true}]){
    assert.deepEqual(await removeSubmissionPhoto(fake(options).client,photo),{alreadyDeleted:false,cleanupWarning:true});
  }
});
test('private legacy photos do not trigger removal from the public bucket',async()=>{
  const f=fake();await removeSubmissionPhoto(f.client,{...photo,public_url:null});assert.equal(f.calls.length,1);
});
