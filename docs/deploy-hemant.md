# Deploy hemantbhatt63883428-star's fork

Status: preparation only. No hosting account, live deployment, or Marketplace approval is created by this change.

The opt-in entry point `node scripts/build-fork.mjs` generates both production manifests with a dedicated, stable add-in ID, the fork's support URL and the configured hosting origin, then builds the existing Vite app. The dev manifest and ordinary build remain unchanged. Do not distribute the old checked-in production manifest; download the newly generated one from your own deployment.

## Cloudflare Pages setup

1. In your Cloudflare account, open Workers & Pages, create a Pages project, and connect `hemantbhatt63883428-star/pi-for-excel` through GitHub.
2. Use the reviewed deployment branch for initial testing; switch to main after merging the PR.
3. Set build command to `node scripts/build-fork.mjs`, output directory to `dist`, and `NODE_VERSION` to `24`.
4. Set `ADDIN_BASE_URL` to the actual stable HTTPS origin assigned to YOUR Pages project, such as `https://your-chosen-name.pages.dev`. That example is not a reserved or deployed address. If the origin is only assigned after initial setup, set the variable and retry deployment.
5. Keep the production taskpane and icons publicly reachable for Office and Microsoft validation. Do not put a hosting login page in front of them.
6. Download `/manifest.prod.xml` from the successful deployment. Confirm its SourceLocation points to the same origin, at `/src/taskpane.html`.

The build translates existing Vercel headers and callback rewrites into Pages `_headers` and `_redirects`; it does not relax CSP. A fixed-destination Pages Function at `/api/inception/v1/chat/completions` relays Mercury requests with the user's key, and `/api/inception/v1/models` handles model discovery. It does not accept arbitrary upstream URLs or store keys. Confirm response headers, relay and callback routes on the live host before release. Do not reuse a preview URL for the Marketplace submission.

After installing the add-in, open `/settings` → Custom gateways and enter:

| Field | Value |
| --- | --- |
| Name | Mercury 2.5 |
| Endpoint | `https://<your-stable-pages-domain>/api/inception/v1` |
| Model | `mercury-2.5` |
| Context window | `260000` |
| API key | Your Inception key (enter in the add-in only) |

Use your actual Pages domain in the endpoint. The SDK adds `/chat/completions`; do not append it in the setting. Test on a sample workbook by asking the add-in to read and write cells. The provider offers introductory credits, not unlimited free inference.

Cloudflare Pages offers a free tier with limits; AI provider charges are separate. Confirm account terms and usage limits before deployment. The built-in Mercury relay is a Pages Function and requires Cloudflare Pages hosting. Vercel Hobby is restricted to personal, non-commercial use, so do not assume it covers company work.

## Verification before submission

Run `npm ci`, `npm run check`, `npm run test:models`, and the fork build. Run `npx office-addin-manifest validate manifest.prod.xml` against the generated production file. Check that icons and taskpane return successfully over HTTPS.

Use a permitted Excel test environment with sample data. Connect Inception through the same-origin relay; read a range, write a formula, verify changes, close/reopen the taskpane, and test recovery. Record the Excel versions/platforms that actually work. Hosting does not supply the other localhost OAuth proxy, Python, LibreOffice, or tmux bridges. Do not advertise these as installation-free features. Company network rules may block Pages or Office add-in features.

## Marketplace handoff

See [Marketplace submission preparation](./marketplace-hemant.md). Publishing requires the owner's verified Partner Center publisher account and Microsoft certification; hosting alone does not make the add-in appear in Excel's store.

## Sources

- https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite3-project/
- https://developers.cloudflare.com/pages/configuration/headers/
- https://vercel.com/docs/plans/hobby
- https://learn.microsoft.com/en-us/office/dev/add-ins/publish/publish
