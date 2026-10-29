# Color-team practice duty reports

## Public PDF export

- The public `#/practice` page offers PDF export without login: single day or inclusive date range, one or several teams.
- `create-practice-pdf` reads published reports through the anon client/RLS only. It does not accept report content from callers and performs no database writes. Request validation, public-storage URL allowlist, bounded image reads, escaped text, blocked renderer networking and per-IP rate limits protect the public endpoint.
- A4 landscape daily summary shows every selected team on one page, including explicit missing/canceled states. Latest report is featured; duplicate reports and long fields are preserved in full appendices. Images use embedded thumbnails with clickable original links. No internal report reference is shown.
- Sarabun regular/medium fonts are bundled under `netlify/assets` with OFL license, so PDFs do not depend on external font services. Chromium binary and fonts must be included in the function bundle.
- Exports over 4.4 MB return a visible request to narrow the range instead of silently dropping data. The PDF contains current public data at generation time.
- QA: `npm test`; `node tests/verifyPracticePdf.mjs <private-access-config.json> <sample.jpg>` (set `PDF_CHROME_PATH` for a non-default local Chrome path), then inspect rendered pages with Poppler. Never commit the private access config or generated QA PDFs.

- Production routes: `#/` system chooser; `#/cleanliness` original system; `#/practice` public practice reports; `#/practice/summary` admin summary/export.
- Reporting period: 2–30 November 2026 inclusive; November 7 cancelled. 28 reportable days × 5 teams = 140 required color/day slots. Multiple teacher reports count as one completed color/day slot.
- Weekends: 08:00–16:00. Weekdays through November 15: finish 19:00; from November 16: finish 20:00. Weekday start is intentionally unspecified.
- Public reports show a large photo first, followed by 1–3 manually entered teacher names, details and incident response. Additional photos have selectable thumbnails and full-size previews. No account is required. A required confirmation checkbox gates submission.
- `teacher_names` is the ordered teacher list. `teacher_name` retains the first teacher for old clients. Existing reports are backfilled to a one-name list; a nullable list remains supported during rolling upgrades. New requests validate 1–3 nonempty names (2–120 characters each). Admin summary and Excel include every name.
- Each report accepts 1–6 images. HEIC/HEIF is decoded locally (native browser or lazy `heic-to/csp` worker) and encoded into full/thumbnail JPEG pairs; other inputs retain WebP output. EXIF is not copied by canvas encoding. Original input limit 10 MiB/image; server accepts at most 512 KiB/full and 128 KiB/thumb, and caps the whole request at 4 MiB. The `practice-duty-photos` bucket must allow `image/webp` and `image/jpeg`; existing paths remain unchanged. Edge Function verifies MIME and signatures and derives extensions from the validated format.
- RLS and explicit grants allow public reading of published reports only. No client may insert, update or delete reports or upload into the new Storage bucket directly. The JWT-verified `practice-report` Edge Function accepts the frontend anon token and performs validated service-side writes. It never requires a teacher login.
- SHA-256-salted source counters enforce 20 submissions/10 minutes and 150/24 hours per observed network source; counters are service-only. This is baseline abuse throttling, not identity verification or complete bot prevention. Shared school networks share the quota.
- Idempotent UUID requests prevent duplicate reports after retry. A pending row is hidden until every image is uploaded. Failed partial uploads are cleaned up when the backend confirms the row is still pending. If the database is unreachable, the backend retains objects rather than risking deletion after a committed publish; operational recovery may be needed for abandoned pending rows.
- Realtime notifications refresh reports without remounting forms. A 20-second visible-tab poll provides fallback; drafts are separated by date/team in memory and are not persisted after leaving/reloading the page.
- Admin summary supports date range, color and incident filtering. Excel export contains the filtered reports, typed Gregorian dates, Thai text, Bangkok submission timestamps and full image links (not embedded image binaries).

## Verification

- `node --test tests/practiceSchedule.test.mjs`: five colors, both weekday cutoffs, weekends, November 7, date range, default date, 28 reportable days.
- `node tests/practiceApi.mjs <private-json-with-url-and-anon>`: creates a clearly named synthetic test report; checks server validation, anonymous submission, idempotent retry, public reading/photo access and rejection of direct writes/rate-RPC access. Run only with planned cleanup of the exact generated report and image paths.
- `node tests/practiceTeachersApi.mjs <private-json-with-url-and-anon>`: checks 1/2/3-name writes and public reads, rejects invalid name arrays, and writes exact created test IDs to `/tmp/practice-teachers-api-created.json` for scoped cleanup. Never delete other reports based on a name prefix.
- Browser: tested upload/compression/submission, required confirmation, immediate displayed report, preserved other-color draft, date switching and disabled forms on November 7.
- Browser Excel download reopened successfully; two test reports, typed dates, Thai names and image links checked.
- Existing cleanliness photos/evaluations/submissions are not modified by this feature.

## Deployment

Apply `supabase/migrations/20261028162355_practice_duty_reports.sql` and `supabase/migrations/20261028165850_practice_report_teacher_names.sql`, deploy `supabase/functions/practice-report/index.ts` with JWT verification enabled, then deploy the frontend normally through main/Netlify. Existing Supabase environment variables are reused; no service key is included in the frontend.
