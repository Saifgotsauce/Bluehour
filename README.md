# Blue Hour site

Astro site for Blue Hour, deployed on Vercel from this repo. Every push to `main` goes live.

## Pages
- `/` home, `/shop` product, `/blog` the Journal, `/blog/<post>` each post
- Sitemap at `/sitemap-index.xml`, robots at `/robots.txt`

## Add a blog post
Create a Markdown file in `src/content/blog/`. The file name becomes the address, so
`best-earplugs-for-raves.md` lives at `/blog/best-earplugs-for-raves`.

```md
---
title: "Post title"
description: "One or two sentences for Google and the post header."
pubDate: 2026-11-10
category: Guides   # Guides, Sleep, Ingredients, Comparisons or Festivals
---

Post body in Markdown.
```

A post with a future `pubDate` stays hidden until a build on or after that date.
Set `draft: true` to keep a post out of the site.

## Settings in Vercel
- `PUBLIC_CHECKOUT_URL`: your Stripe Payment Link. Until it's set, Checkout shows a "not connected yet" note.
- `SITE_URL` (optional): your domain, like `https://example.com`. Without it, the site uses Vercel's production domain.
- While the site only has a `vercel.app` address, every page is marked noindex so Google waits for the real domain.

## Daily rebuild for scheduled posts
`.github/workflows/daily-rebuild.yml` triggers a Vercel rebuild once a day.
Create a Deploy Hook in Vercel (Settings > Git > Deploy Hooks), then add its URL to this repo as the
Actions secret `VERCEL_DEPLOY_HOOK`.

## Reviews
Add real customer quotes, with permission, to `src/data/reviews.ts`. The section stays hidden while the list is empty.
