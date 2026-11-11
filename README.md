# ChalkIn

Scaffolded with `create-nextjs-app` — Next.js (App Router, TypeScript, Tailwind) pre-wired for SEO.

## What's already set up

- **Metadata API** (`app/layout.tsx`) — title template, description, OG/Twitter cards, robots directives, canonical URL.
- **Sitemap** (`app/sitemap.ts`) — generates `/sitemap.xml` automatically.
- **Robots** (`app/robots.ts`) — generates `/robots.txt`, points crawlers at the sitemap.
- **OG image** (`app/opengraph-image.tsx`) — auto-generated share card, no design tool needed.
- **JSON-LD** (`components/JsonLd.tsx`) — structured data helper, `WebSite` schema wired into the root layout.
- **Semantic HTML** (`app/page.tsx`) — single `<h1>`, real landmark tags, per-page metadata override example.

## Before you deploy — SEO checklist

- [ ] Replace `SITE_URL` in `app/layout.tsx`, `app/sitemap.ts`, `app/robots.ts` with your real domain.
- [ ] Write a real, unique title + description per route (override `metadata` in each `page.tsx`).
- [ ] Add every real route to `app/sitemap.ts`.
- [ ] Swap the generated OG image for a branded one, or customize `app/opengraph-image.tsx`.
- [ ] Add favicon.ico + apple-touch-icon.png to `public/`.
- [ ] Add relevant JSON-LD per page (Article, Product, FAQPage, BreadcrumbList — see [schema.org](https://schema.org)).
- [ ] Set up Google Search Console + submit the sitemap; fill in `verification` in `app/layout.tsx`.
- [ ] Run Lighthouse / PageSpeed Insights — Core Web Vitals are a ranking factor.
- [ ] Use `next/image` for every image (already configured for AVIF/WebP).

## Commands

```bash
npm run dev     # local dev server
npm run build   # production build
npm run start   # run the production build
npm run lint    # eslint
```
