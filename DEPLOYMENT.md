# Deployment

This project should be deployed as one Cloudflare Worker with Static Assets.

Do not deploy this repository as a Cloudflare Pages project. The contact form
uses Cloudflare's `send_email` binding, and that binding belongs to Workers, not
Pages Functions.

## How It Works

1. Astro builds the static site into `dist`.
2. `worker/index.js` handles `/api/contact`.
3. The same Worker serves all static assets from `dist` through the `ASSETS`
   binding.
4. The contact form sends email through Cloudflare Email Routing's `EMAIL`
   binding.
5. The scheduled GitHub workflow checks the menu spreadsheet and redeploys the
   Worker when menu data changes.

## Cloudflare Worker Settings

The source of truth is `wrangler.toml`.

- Worker name: `dvije-zarulje`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Static assets directory: `dist`
- Worker entrypoint: `worker/index.js`

The Worker needs these environment variables:

- `SPREADSHEET_ID`
- `GOOGLE_SHEETS_GID` if the sheet tab is not gid `0`
- `CONTACT_TO_EMAIL` - the verified inbox that receives contact messages.
- `CONTACT_FROM_EMAIL` - the sender on your Email Routing domain, for example
  `kontakt@dvije-zarulje.hr`.

## Contact Form Email

Enable Cloudflare Email Routing for the domain first. The recipient in
`CONTACT_TO_EMAIL` must be a verified Email Routing destination. The sender in
`CONTACT_FROM_EMAIL` must be an address on the domain where Email Routing is
active.

`wrangler.toml` defines:

```toml
[[send_email]]
name = "EMAIL"
```

The binding is intentionally unrestricted in config so the recipient can be set
with `CONTACT_TO_EMAIL` per environment. Cloudflare still only allows delivery to
verified Email Routing destinations.

## GitHub Settings

Set these repository variables or secrets:

- `SPREADSHEET_ID`
- `GOOGLE_SHEETS_GID` if needed
- `CLOUDFLARE_API_TOKEN` as a secret
- `CLOUDFLARE_ACCOUNT_ID` as a secret

The API token must be able to deploy Workers.

## Local Commands

```sh
npm run build
npx wrangler dev
npm run cf:deploy
```

`npm run cf:deploy` builds Astro and deploys the Worker with static assets.
