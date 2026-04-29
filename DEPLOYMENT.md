# Deployment

This project should be deployed as one Cloudflare Pages project.

Do not deploy this repository with `wrangler deploy`. This repo no longer has a Worker entry point or Worker static-assets config. The spreadsheet rebuild flow is:

1. Cloudflare Pages builds the Astro site from GitHub.
2. The Astro build reads the public Google Sheet CSV using `SPREADSHEET_ID` and `GOOGLE_SHEETS_GID`.
3. `.github/workflows/scheduled-build.yml` checks the Google Sheet on a schedule.
4. When the menu hash changes, GitHub Actions builds the site.
5. GitHub Actions uploads `dist` directly to the existing Cloudflare Pages project with `wrangler pages deploy`.

## Cloudflare Pages Settings

In the Cloudflare dashboard, keep only the Pages project for this site.

- Framework preset: `Astro`
- Build command: `npm run build`
- Build output directory: `dist`
- Production branch: your main branch
- Environment variables:
  - `SPREADSHEET_ID`
  - `GOOGLE_SHEETS_GID` if the sheet tab is not gid `0`
  - `CONTACT_TO_EMAIL`
  - `CONTACT_FROM_EMAIL`

Do not create a Worker just to get deploy hooks. The scheduled GitHub workflow deploys to Pages directly.

## Contact Form Email

The contact form submits to the Cloudflare Pages Function at `/api/contact`.
Email delivery uses Cloudflare Email Sending through the `EMAIL` binding in
`wrangler.toml`, so the Pages project needs these production environment
variables:

- `CONTACT_TO_EMAIL` - the inbox that should receive contact messages.
- `CONTACT_FROM_EMAIL` - the sender address on your Cloudflare email domain, for example `no-reply@dvije-zarulje.hr`.

In Cloudflare, enable Email Sending for the domain and finish any DNS records
Cloudflare asks for. The sender address must belong to the domain you onboard
for Cloudflare Email Sending.

## GitHub Settings

Set these repository variables or secrets:

- `SPREADSHEET_ID`
- `GOOGLE_SHEETS_GID` if needed
- `CLOUDFLARE_API_TOKEN` as a secret
- `CLOUDFLARE_ACCOUNT_ID` as a secret

The API token must be able to deploy to Cloudflare Pages. The scheduled workflow runs hourly and can also be started manually from the GitHub Actions tab.

## Local Commands

```sh
npm run build
npm run preview
npm run deploy-check
npm run cf:deploy
```

`npm run cf:deploy` is only for manually uploading `dist` to the existing Pages project. Normal production deploys should come from the Cloudflare Pages Git integration, or from the scheduled GitHub workflow when the spreadsheet changes.
