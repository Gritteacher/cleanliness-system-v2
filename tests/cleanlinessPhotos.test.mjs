import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MAX_CLEANLINESS_PHOTOS,remainingPhotoSlots,validatePhotoSelection,assertPhotoCapacity,publicRoomPhotos,photoUploadError} from '../src/utils/cleanlinessPhotos.js';
test('ten photos per area; selections are rejected as a whole before uploading',()=>{
 assert.equal(MAX_CLEANLINESS_PHOTOS,10);
 assert.doesNotThrow(()=>validatePhotoSelection(0,Array(10)));
 assert.doesNotThrow(()=>validatePhotoSelection(9,[{}]));
 assert.throws(()=>validatePhotoSelection(9,[{},{}]),/อีก 1 รูป/);
 assert.throws(()=>validatePhotoSelection(10,[{}]),/ครบ 10/);
 assert.equal(remainingPhotoSlots(11),0);
 assert.equal(remainingPhotoSlots(9),1);
});
function client(result){return {from(table){assert.equal(table,'cs_submission_photos');return {select(columns,options){assert.equal(columns,'id');assert.deepEqual(options,{head:true,count:'exact'});return {eq(key,value){assert.equal(key,'submission_id');assert.equal(value,'submission');return {is(key,value){assert.equal(key,'deleted_at');assert.equal(value,null);return Promise.resolve(result);}};}};}};}};}
test('preflight counts active rows only; failure is closed rather than bypassing cap',async()=>{
 await assertPhotoCapacity(client({count:9}),'submission');
 await assert.rejects(assertPhotoCapacity(client({count:10}),'submission'),/ครบ 10/);
 await assert.rejects(assertPhotoCapacity(client({count:null}),'submission'),/ตรวจจำนวน/);
 await assert.rejects(assertPhotoCapacity(client({error:new Error('denied')}),'submission'),/denied/);
});
test('public gallery preserves all photos, deduplicates and falls back to legacy',()=>{
 const urls=Array.from({length:10},(_,i)=>`https://example.com/${i}.jpg`);
 assert.deepEqual(publicRoomPhotos({photo_public_urls:[...urls,null,urls[0]]}),urls);
 assert.deepEqual(publicRoomPhotos({legacy_public_url:'old.jpg'}),['old.jpg']);
 assert.deepEqual(publicRoomPhotos({}),[]);
 assert.match(photoUploadError({message:'CLEANLINESS_PHOTO_LIMIT'}),/ครบ 10/);
});
