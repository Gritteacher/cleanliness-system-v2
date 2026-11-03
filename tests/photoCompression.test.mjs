import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compressSubmissionPhoto } from '../src/utils/photoCompression.js';
import { photoExtension } from '../src/utils/photoInput.js';

async function withCanvas(encode, run, fileName = 'photo.jpg', fileType = 'image/jpeg') {
  const calls = [], canvases = [];
  let closed = 0;
  const oldDocument = globalThis.document;
  const oldBitmap = globalThis.createImageBitmap;
  globalThis.createImageBitmap = async () => ({ width: 2400, height: 1800, close() { closed++; } });
  globalThis.document = { createElement() {
    const canvas = { width: 0, height: 0, getContext() { return { fillRect() {}, drawImage() {} }; },
      toBlob(callback, type, quality) {
        calls.push({ type, quality, width: this.width, height: this.height });
        callback(encode(type, this.width, quality));
      } };
    canvases.push(canvas);
    return canvas;
  } };
  try {
    await run(() => compressSubmissionPhoto(new File(['test'], fileName, { type: fileType })), calls);
    assert.equal(closed, 1, 'decoded image must be released');
    assert.ok(canvases.every(c => c.width === 1 && c.height === 1), 'canvas memory must be released');
  } finally {
    if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument;
    if (oldBitmap === undefined) delete globalThis.createImageBitmap; else globalThis.createImageBitmap = oldBitmap;
  }
}

const blob = type => new Blob(['encoded'], { type });
test('supported WebP stays WebP and preserves full/thumbnail dimensions', async () => {
  await withCanvas(blob, async (compress, calls) => {
    const result = await compress();
    assert.equal(result.full.type, 'image/webp');
    assert.equal(result.thumbnail.type, 'image/webp');
    assert.equal(result.originalBytes, 4);
    assert.deepEqual(calls.map(c => c.width), [1600, 600]);
  });
});
test('PNG returned for unsupported WebP triggers real JPEG encoding for both variants', async () => {
  await withCanvas(type => blob(type === 'image/webp' ? 'image/png' : type), async (compress, calls) => {
    const result = await compress();
    assert.equal(result.full.type, 'image/jpeg');
    assert.equal(result.thumbnail.type, 'image/jpeg');
    assert.equal(photoExtension(result.full), 'jpg');
    assert.equal(photoExtension(result.thumbnail), 'jpg');
    assert.deepEqual(calls.map(c => c.type), ['image/webp', 'image/jpeg', 'image/jpeg']);
  });
});
test('null WebP result retries JPEG without discarding the image', async () => {
  await withCanvas(type => type === 'image/webp' ? null : blob(type), async compress => {
    assert.equal((await compress()).full.type, 'image/jpeg');
  });
});
test('thumbnail encoding failure regenerates BOTH variants as JPEG', async () => {
  await withCanvas((type, width) => blob(type === 'image/webp' && width === 600 ? 'image/png' : type), async (compress, calls) => {
    const result = await compress();
    assert.equal(result.full.type, 'image/jpeg');
    assert.equal(result.thumbnail.type, 'image/jpeg');
    assert.deepEqual(calls.map(c => c.type), ['image/webp', 'image/webp', 'image/jpeg', 'image/jpeg']);
  });
});
test('HEIC native decoding still produces JPEG directly without a WebP attempt', async () => {
  await withCanvas(blob, async (compress, calls) => {
    const result = await compress();
    assert.equal(result.full.type, 'image/jpeg');
    assert.ok(calls.every(c => c.type === 'image/jpeg'));
  }, 'photo.heic', 'image/heic');
});
test('JPEG encoding failure remains a clear error instead of uploading mislabeled PNG', async () => {
  await withCanvas(() => blob('image/png'), async compress => {
    await assert.rejects(compress(), { code: 'PHOTO_ENCODING_UNAVAILABLE' });
  });
});
test('unrelated canvas errors are not hidden or retried as compatibility failures', async () => {
  await withCanvas(() => { throw new Error('canvas failure'); }, async (compress, calls) => {
    await assert.rejects(compress(), /canvas failure/);
    assert.equal(calls.length, 1);
  });
});
