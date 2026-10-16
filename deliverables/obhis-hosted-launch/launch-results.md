# Original Olive website launch results

The approved website is live at https://www.oliveblessed.com. This records the original launch. The later [upkeep release](upkeep-results.md) supersedes its approval/domain expiry instructions and records the current publication and favicon.

## Released

- Production backend: `outgoing-warbler-782`. Preview was not changed.
- Website owner: Fedrah, school `kd73q7dt28ph1bmqjm20tsw2ed83k6j3`. Ruga remains a separate school.
- Approved draft version 2 was published as immutable revision `z17ftdc7mfadyh20hfh67hm8rx8gc5bj`. It retains the owner's `OBCA` short name, 49 fields and nine approved assets.
- Existing shared Vercel project: `melo-sites`, `prj_h2l9FPxNt8KAG8BugXc8DKytLJPl`.
- Frontend deployment: `dpl_7mC97uHooUJ9qyJLvN36QxrZAkNu`, `READY`. It redeployed the existing reviewed source commit `d2ba632a09776e43684a99b4739885974790e094` with the approved production hostname list. No deployment retry or billing change was needed.
- Both domains passed school TXT ownership, provider assignment, HTTPS certificate and deployment-marker checks before activation. `www.oliveblessed.com` is canonical; `oliveblessed.com` redirects to it.
- Required DNS routing records were applied. Email and unrelated DNS records passed preservation checks. The prior routing records are retained in the local launch ledger.

## Verification

- Canonical homepage: HTTP 200, correct school title and canonical URL.
- Apex homepage: HTTP 308 to `https://www.oliveblessed.com/`.
- Deployment marker on both hosts: HTTP 200, exact `school-sites-production-core:v1\n` body, no redirect.
- All nine public assets: HTTP 200 and SHA-256 identical to the approved uploads.
- Private `/review/obhis` page and private review asset route: HTTP 404.
- `robots.txt` and `sitemap.xml`: HTTP 200.
- Browser checks at desktop and 390px mobile width: school content loads, no mobile document overflow, gallery category selection and admissions disclosure work, phone/email links have the approved destinations. No visible broken images were found.
- Mobile screenshot: `C:\Users\johno\.takomi-code\userdata\browser-artifacts\browser-screenshot-www-oliveblessed-com-mvb5p87l-d1d33c91.png`.
- Local checks: 42 Sites backend tests passed across 12 files. Focused access/schema run passed all 11 tests. Backend typecheck, touched-source ESLint and `git diff --check` passed.
- Independent read-only review found no blocking issue in the domain-request-only permission addition. The existing Windows browser-bridge limitation and unrelated Teacher root-build failure were not repaired or represented as passing.

## Access and upkeep

`SITES_ALLOW_ACCESS_PROVISIONING` and `SITES_ALLOW_PROVIDER_WRITES` are off. Authenticated operational sessions signed out after each use. The lead's editor grants were revoked, a domain-request-only package was used and revoked, and the separately approved sensitive-publisher package was issued without extending the original access expiry, 2026-10-23 at 10:12 UTC. The independent reviewer was not changed.

The original launch used content/photo approvals and domain proofs dated to expire on 2026-11-15. That deadline was removed by the later authorized [upkeep release](upkeep-results.md), which recorded truthful independent until-revoked replacements and explicitly adopted persistent authoritative TXT proofs. The original dated records remain historical evidence; they are not the current website's renewal deadline.

Online application links, donation links/QR codes and campus details still show the existing unavailable/coming-soon states. No application submission or payment path was activated or tested.

The website review UI issue remains tracked at https://github.com/JStaRFilms/Melo_School_Management_System/issues/131.
