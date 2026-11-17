// Optional isolated PostgreSQL/WASM regression; never connects to production.
// PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js node tests/cleanlinessPhotoLimit.postgres.mjs
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db=new PGlite();
try {
 await db.exec(`create role anon; create role authenticated; create schema private;
 create table public.cs_duty_submissions(id text primary key,deleted_at timestamptz);
 create table public.cs_submission_photos(id text primary key,submission_id text references public.cs_duty_submissions(id),deleted_at timestamptz);
 insert into public.cs_duty_submissions(id) values ('a'),('b');`);
 await db.exec(await readFile(new URL('../supabase/migrations/20261117061627_cleanliness_ten_photo_limit.sql',import.meta.url),'utf8'));
 await db.exec(`insert into public.cs_submission_photos(id,submission_id) select 'a'||i,'a' from generate_series(1,10) i;`);
 await assert.rejects(db.exec(`insert into public.cs_submission_photos values ('extra','a',null)`),/CLEANLINESS_PHOTO_LIMIT/);
 await db.exec(`update public.cs_submission_photos set deleted_at=now() where id='a1'; insert into public.cs_submission_photos values ('extra','a',null);`);
 await assert.rejects(db.exec(`update public.cs_submission_photos set deleted_at=null where id='a1'`),/CLEANLINESS_PHOTO_LIMIT/);
 await db.exec(`update public.cs_submission_photos set submission_id='a' where id='extra'; insert into public.cs_submission_photos values ('b1','b',null);`);
 await assert.rejects(db.exec(`update public.cs_submission_photos set submission_id='a' where id='b1'`),/CLEANLINESS_PHOTO_LIMIT/);
 const {rows}=await db.query(`select count(*)::int n from public.cs_submission_photos where submission_id='a' and deleted_at is null`);
 assert.equal(rows[0].n,10);
 console.log('PASS PostgreSQL: accepts 10, rejects 11, delete frees slot, restore/reparent cannot bypass cap, same-parent update allowed');
} finally { await db.close(); }
