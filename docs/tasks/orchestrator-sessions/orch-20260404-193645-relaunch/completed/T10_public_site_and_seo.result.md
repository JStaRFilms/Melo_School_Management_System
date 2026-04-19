# T10 Public Site and SEO

## Status

Completed on `2026-04-13`.

## What Changed

1. Built a real public-facing `apps/www` surface for the school website.
2. Implemented core public pages from the approved sitemap:
   - `/`
   - `/about`
   - `/academics`
   - `/admissions`
   - `/fees`
   - `/visit`
   - `/contact`
3. Added a reusable content and branding layer in `apps/www/lib/site.ts` so school-specific branding and copy can be swapped later without rewriting the site tree.
4. Added shared public-site UI primitives in `apps/www/lib/site-ui.tsx` for header, footer, hero, cards, and CTA patterns.
5. Added the SEO baseline:
   - metadata and canonical URLs
   - `robots.ts`
   - `sitemap.ts`
   - homepage JSON-LD structured data
   - `app/icon.svg`
6. Synced the FR and feature docs.
7. Review pass fix: corrected the public-site admissions contact channel so the dedicated admissions line now uses `admissionsPhone` instead of the general phone number.

## Files Updated

- `apps/www/package.json`
- `apps/www/next.config.js`
- `apps/www/postcss.config.js`
- `apps/www/tailwind.config.js`
- `apps/www/tsconfig.json`
- `apps/www/next-env.d.ts`
- `apps/www/app/layout.tsx`
- `apps/www/app/globals.css`
- `apps/www/app/icon.svg`
- `apps/www/app/page.tsx`
- `apps/www/app/about/page.tsx`
- `apps/www/app/academics/page.tsx`
- `apps/www/app/admissions/page.tsx`
- `apps/www/app/fees/page.tsx`
- `apps/www/app/visit/page.tsx`
- `apps/www/app/contact/page.tsx`
- `apps/www/app/not-found.tsx`
- `apps/www/app/robots.ts`
- `apps/www/app/sitemap.ts`
- `apps/www/lib/site.ts`
- `apps/www/lib/site-ui.tsx`
- `docs/issues/FR-011.md`
- `docs/features/PublicSiteAndSeoFoundation.md`

## Verification Run

- `pnpm --filter @school/www exec tsc --noEmit -p tsconfig.json` ✅
- `pnpm --filter @school/www build` ✅
- `pnpm --filter @school/www exec tsc --noEmit -p tsconfig.json` ✅

## Notes

- This task implements the tenant school public site, not the platform's own product-marketing website.
- A separate future task has now been recorded as `T17` for the platform marketing website.
- Admissions workflow automation remains out of scope.
