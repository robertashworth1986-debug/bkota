# bkota.co connection handoff

Status refreshed September 12, 2026: **Arthur selected `bkota.co` to replace the Shopify destination; code is prepared, but GoDaddy DNS and GitHub domain verification are not complete until the live checks below pass.**

## Existing public state

- `bkota.co` A response: `23.227.38.32` (Shopify destination).
- `www.bkota.co` CNAME response: `shops.myshopify.com`.
- Nameservers: `ns75.domaincontrol.com` and `ns76.domaincontrol.com` (GoDaddy).
- Browser visit to `https://bkota.co/`: Shopify displayed “This store is currently unavailable.” This does not establish its billing, ownership, or recoverability status.
- BKOTA source repository: `robertashworth1986-debug/bkota`.
- Existing Pages preview: `https://robertashworth1986-debug.github.io/bkota/`.

This is not a complete DNS backup. Do not infer email configuration from the website records or remove any MX, mail-related TXT, DKIM, SPF, DMARC, verification, or unrelated records.

## Arthur's decision

Arthur chose to replace the unavailable Shopify destination with the BKOTA movement at **bkota.co**. Do not renew or reactivate Shopify merely for this cutover. Before canceling any other GoDaddy or Shopify product, verify that it is not providing Arthur's email, domain registration, or data he still needs.

The domain manager must sign into GoDaddy directly, completing any authentication themselves. Do not paste passwords, login codes, recovery codes, or private account exports into chat or this public repository. Do not reactivate a paid Shopify service, buy hosting, or transfer the domain as part of a DNS connection without a separate explicit decision.

## Connection sequence after account access

1. Refresh the repository, deployment source, DNS zone, existing website, and account ownership. Preserve an authenticated DNS snapshot outside this public repository. Confirm the exact change and rollback records.
2. Complete the code review/merge gate and verify the new static site on its existing Pages address. The selected canonical hostname is `bkota.co`.
3. Verify the domain under the correct GitHub account using the actual TXT challenge GitHub supplies. Keep the verification record after success; do not invent a challenge value. [GitHub domain verification](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages).
4. Add `bkota.co` to the repository's Pages settings **before** pointing DNS at Pages. Branch publishing uses the reviewed root `CNAME` file, and the static release allowlist includes it. Canonical, Open Graph, robots, and sitemap URLs use `https://bkota.co/`. [GitHub custom-domain configuration](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).
5. In GoDaddy, replace only the Shopify website records with GitHub's current documented values. Preserve nameservers and unrelated/email records. Do not add wildcard DNS:

   | Type | Name | Value |
   |---|---|---|
   | A | `@` | `185.199.108.153` |
   | A | `@` | `185.199.109.153` |
   | A | `@` | `185.199.110.153` |
   | A | `@` | `185.199.111.153` |
   | CNAME | `www` | `robertashworth1986-debug.github.io` |
   | TXT | GitHub-supplied challenge name | GitHub-supplied challenge value |

   Remove the Shopify apex A record `23.227.38.32` and `www` target `shops.myshopify.com` only as part of this approved replacement. Never invent the GitHub TXT challenge.
6. Run `npm run verify:domain`, then verify the studio, downloads, offline behavior, and forms in real desktop and phone browsers at the final URL. Record the deployed commit and receipts. The script fails closed unless the exact GitHub DNS, apex HTTPS page identity, canonical URL, and `www` redirect all pass. If HTTPS is still provisioning, report it as pending.

The source now contains the reviewed custom-domain `CNAME` and root-domain metadata. The account-side GitHub setting, GoDaddy DNS mutation, Shopify cancellation, and public-submission activation remain separate actions with their own receipts. The quality workflow validates the site; it does not change DNS.

## Public stories and video are a separate service

DNS gives the website a name. It does not create moderation, a database, video storage, or checkout. Public submission enablement requires an approved backend, accountable moderator access, consent and removal workflow, validated submission receipts, storage/abuse limits, backups, and an end-to-end test of approval and rejection. Do not simply flip `moderatedServiceEnabled` to true.

Until that service is connected and verified, the collection stays in the visitor's browser. Its JSON export includes stories and video links, not video files. The UI must continue saying that local saves are not submissions.
