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
