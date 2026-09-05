# bkota.co connection handoff

Status recorded September 5, 2026: **domain identified; connection not changed**. Refresh all DNS and account state at action time.

## Existing public state

- `bkota.co` A response: `23.227.38.32` (Shopify destination).
- `www.bkota.co` CNAME response: `shops.myshopify.com`.
- Nameservers: `ns75.domaincontrol.com` and `ns76.domaincontrol.com` (GoDaddy).
- Browser visit to `https://bkota.co/`: Shopify displayed “This store is currently unavailable.” This does not establish its billing, ownership, or recoverability status.
- BKOTA source repository: `robertashworth1986-debug/bkota`.
- Existing Pages preview: `https://robertashworth1986-debug.github.io/bkota/`.

This is not a complete DNS backup. Do not infer email configuration from the website records or remove any MX, mail-related TXT, DKIM, SPF, DMARC, verification, or unrelated records.

## Decision still needed

Arthur must choose whether to replace the Shopify destination with the new site at **bkota.co**, or preserve Shopify and connect the community site at **community.bkota.co**. No choice is implied by the current unavailable-store page.

The domain manager must sign into GoDaddy directly, completing any authentication themselves. Do not paste passwords, login codes, recovery codes, or private account exports into chat or this public repository. Do not reactivate a paid Shopify service, buy hosting, or transfer the domain as part of a DNS connection without a separate explicit decision.

## Connection sequence after the decision and account access

1. Refresh the repository, deployment source, DNS zone, existing website, and account ownership. Preserve an authenticated DNS snapshot outside this public repository. Confirm the exact change and rollback records.
2. Complete the code review/merge gate and verify the new static site on its existing Pages address. Confirm Arthur's chosen hostname.
3. Verify the domain under the correct GitHub account using the actual TXT challenge GitHub supplies. Keep the verification record after success; do not invent a challenge value. [GitHub domain verification](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages).
4. Add the hostname to the repository's Pages settings **before** pointing DNS at Pages. If branch publishing creates a `CNAME`, reconcile that commit and explicitly include the file in the release build's allowlist before a later artifact deployment. Update canonical/OG/sitemap URLs for the chosen hostname. [GitHub custom-domain configuration](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).
5. Change only the approved hostname records, using GitHub's current documented values and the actual Pages configuration. Preserve nameservers and unrelated/email records. A subdomain CNAME targets `robertashworth1986-debug.github.io`, without `/bkota/`; exact apex changes depend on the selected route. Do not add wildcard DNS.
6. Verify public DNS, HTTPS certificate coverage, redirects, the homepage, studio, downloads, offline behavior, and forms at the final URL. Record the deployed commit and receipts. If HTTPS is still provisioning, report it as pending.

No custom-domain `CNAME`, DNS mutation, Shopify account change, paid service, or public-submission activation is part of this source update. The quality workflow validates the site; it does not deploy it.

## Public stories and video are a separate service

DNS gives the website a name. It does not create moderation, a database, video storage, or checkout. Public submission enablement requires an approved backend, accountable moderator access, consent and removal workflow, validated submission receipts, storage/abuse limits, backups, and an end-to-end test of approval and rejection. Do not simply flip `moderatedServiceEnabled` to true.

Until that service is connected and verified, the collection stays in the visitor's browser. Its JSON export includes stories and video links, not video files. The UI must continue saying that local saves are not submissions.
