# Cloudflare Workers hosting

Worker: `colorteam-activities`; production hostname: `colorteam.gritspace.cc`.
The Supabase project and its RLS, Auth, Storage and existing data are unchanged.

## Deployment

Use Node 22.23.2 or later in the Node 22 series. Run `npm ci` and `npm test`.
Provide `VITE_SUPABASE_URL` and the public `VITE_SUPABASE_ANON_KEY` when running
`npm run build`, then `npx wrangler deploy`. Never use a service-role key in Vite.
Set those same two values as Workers secrets (`wrangler secret bulk`, JSON on stdin).
For the initial migration only, `node tools/cloudflare-settings.mjs build` and
`node tools/cloudflare-settings.mjs upload` retrieve the production settings from
the locally authenticated Netlify CLI account without printing their values.

Assets are served by Workers Static Assets. Both `/api/…` and legacy
`/.netlify/functions/…` PDF URLs are supported. `/api/health` identifies the host
and deployed application version. Browser Run renders PDFs using bundled Thai
fonts, and rejects non-Supabase image sources and redirects. Requests are bounded
to 4 KB and rate-limited to six per minute per IP and endpoint.

## Free only

The account owner confirmed Workers Free. Do not upgrade the plan. Browser Run
free allowance is 10 browser minutes per day, shared with other account usage;
new browser sessions are limited to one per 20 seconds. Daily exhaustion returns
429 without paid fallback; concurrent throttling asks the user to retry shortly.
There is no Netlify fallback. This is a provider-enforced Free-plan limit, not a
paid-plan budget cap. Reconfirm this policy before changing billing plans.

`ENABLE_DAILY_EMAIL=false`, no cron triggers, and no anonymous email endpoint.
Automatic mail must remain disabled unless the owner explicitly requests it.
No Resend credential was copied to Workers.

## Domain and rollback

Change only the `colorteam.gritspace.cc` DNS/Worker mapping; preserve other zone
records. Its previous DNS-only CNAME was `cleanlinesst-tsn.netlify.app` (Auto TTL).
If the custom-domain API rejects the existing externally managed record, use a
proxied CNAME plus the exact Worker route `colorteam.gritspace.cc/*` instead.
To roll back a route deployment, remove that route and restore the CNAME to
DNS-only. For a custom-domain deployment, remove the custom-domain mapping first,
then restore the previous CNAME. Netlify may still be unavailable while its
account credit limit is exhausted. Do not delete either host or Supabase data.

## Verification

Run `npm test`, `wrangler deploy --dry-run`, check the public practice page and
`/api/health`, and export a daily and date-range PDF using real read-only report
data. Pace PDF smoke tests at least 20 seconds apart. Render and inspect each
exported PDF with Poppler. Do not create production test reports or send mail.

## Daily cleanliness report (2.4.1)

The public cleanliness page's Export PDF button uses browser printing (choose
Save as PDF), so this action does not consume Browser Run time. It prints only
the selected day's owner, canonical summary scores and all area rows, not the
photo-card webpage. The existing authenticated `create-public-pdf` endpoint
uses the same layout and reads the existing public overview RPC directly;
it no longer navigates to the home/menu page or waits a fixed number of seconds.
Authentication on that endpoint is unchanged. No scoring formula changed.

Both paths fit A4 portrait with bundled Thai fonts on the server and a compact
table when needed. They preserve rows/remarks and fail visibly rather than clip
text if unusually long details cannot fit legibly on a single page.
Run `node tests/renderCleanlinessDaily.mjs` for synthetic 12/25-area and no-duty
checks; add `--live YYYY-MM-DD` to verify a read-only day's public data using
the public Supabase client settings from a correctly configured local build.

Version 2.4.2 adds one representative public photo per area beside its score.
Photos are cover-cropped without stretching; portrait focus is biased upward.
Browser printing waits for image decoding. Server exports fetch bounded image
bytes only from the configured Supabase project's public storage, reject
redirects, and embed export-only JPEG crops at up to 300 DPI. Missing/failed
images retain their area's text and scores. Original uploads are unchanged.

Version 2.4.3 suggests concise filenames such as `สะอาด_ม่วง_02-11-69.pdf`,
using the selected Gregorian date converted to a two-digit Buddhist year and
the actual scheduled team, including overrides. Browser printing sets the
document title until `afterprint`; the final Save as PDF name remains under
browser/OS control. Authenticated downloads supply the same Thai filename via
RFC 5987 `filename*`, plus an ASCII fallback for older clients. Days without a
scheduled team use `งดเวร` instead of an invented color.

## Admin-only export policy (2.4.5)

Only active application Admins see the cleanliness PDF print action or the
practice PDF/PNG export dialog. Public practice reporting and viewing remain
available without login. Non-admin pages do not mount the dedicated print sheet.
The browser revalidates the current user and their database profile before an
export. Practice exports carry the current session's Bearer access token.

All three server entry points (`create-practice-pdf`, `create-public-pdf`, and
`validate-pdf-login`), including their legacy URL aliases, validate that token
with Supabase Auth `getUser` and then read the caller's `cs_profiles` row under
their own RLS-protected session. The row must match the authenticated ID and
have `role=admin` and `active=true`. Neither request-body roles/passwords nor
`user_metadata` grant export permission. Missing/invalid tokens return 401;
non-admin/inactive/missing profiles return 403; verification outages fail closed.
No privileged key, new database function, grant, or RLS change is needed.

The legacy Netlify mail handlers are also guarded and default to disabled.
Cloudflare still exposes no mail HTTP endpoint and has no cron trigger. Keep
`ENABLE_DAILY_EMAIL=false`. Do not enable any automatic rendering/mail as part
of a deployment. Previously deployed legacy hosts must be redeployed with this
policy before being reactivated; the current production domain is Workers.

Run `node tests/practicePdfApi.mjs https://colorteam.gritspace.cc` to check all
anonymous exports are refused without consuming Browser Run time. Optional
authenticated PDF checks read `EXPORT_ADMIN_ACCESS_TOKEN` from the environment;
never log, commit, or send this token in chat. Unit tests cover inactive admins,
presidents, forged metadata, verification failures, and admin/non-admin UI.
Screenshots and a browser's own print/save commands cannot be prevented for
information that remains publicly viewable; this policy controls system exports.
