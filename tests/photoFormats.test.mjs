import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isHeicPhoto, photoExtension, decodeUploadPhoto } from '../src/utils/photoInput.js';
import { photoPreviewUrl } from '../src/utils/photoCompression.js';
import { validatedPhotoType } from '../supabase/functions/_shared/photoValidation.js';

test('HEIC/HEIF recognizes MIME, uppercase extensions and missing MIME headers', async () => {
  for (const file of [new File(['data'],'photo.HEIC'),new File(['data'],'photo.heif'),new File(['data'],'image',{type:'image/heic'}),new File(['0000ftypheic0000'],'image')]) assert.equal(await isHeicPhoto(file),true);
  assert.equal(await isHeicPhoto(new File(['0000ftypavif0000'],'image',{type:'image/avif'})),false);
  assert.equal(await isHeicPhoto(new File(['jpeg'],'photo.jpg',{type:'image/jpeg'})),false);
});
test('JPG and WebP keep correct extensions and matching preview paths', () => {
  assert.equal(photoExtension({type:'image/jpeg'}),'jpg');
  assert.equal(photoExtension({type:'image/webp'}),'webp');
  assert.equal(photoPreviewUrl('https://example.com/a.full.jpg?x=1'),'https://example.com/a.thumb.jpg?x=1');
  assert.equal(photoPreviewUrl('https://example.com/a.full.webp'),'https://example.com/a.thumb.webp');
  assert.equal(photoPreviewUrl('https://example.com/old.jpg'),'https://example.com/old.jpg');
});
test('non-image and oversized files are rejected before decoding',async()=>{
  await assert.rejects(decodeUploadPhoto(new File(['text'],'test.txt',{type:'text/plain'})),/เลือกไฟล์รูปภาพ/);
  await assert.rejects(decodeUploadPhoto(new File([new Uint8Array(10*1024*1024+1)],'large.heic')),/10 MB/);
});
test('server checks JPEG and WebP signatures against declared MIME',()=>{
  const jpeg=new Uint8Array(24); jpeg.set([255,216,255]); jpeg.set([255,217],22);
  const webp=new TextEncoder().encode('RIFF0000WEBPVP8 00000000');
  assert.equal(validatedPhotoType(jpeg,'image/jpeg').extension,'jpg');
  assert.equal(validatedPhotoType(webp,'image/webp').extension,'webp');
  assert.throws(()=>validatedPhotoType(jpeg,'image/webp'));
  assert.throws(()=>validatedPhotoType(webp,'image/jpeg'));
  assert.throws(()=>validatedPhotoType(jpeg.slice(0,10),'image/jpeg'));
  assert.throws(()=>validatedPhotoType(webp,'image/heic'));
});
