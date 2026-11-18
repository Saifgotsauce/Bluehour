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
- `STRIPE_SECRET_KEY`: your Stripe secret key. Start with the test key (`sk_test_...`), then switch to the live key (`sk_live_...`) when you launch. Until it's set, Checkout shows a "not switched on yet" note.
- `SITE_URL` (optional): your domain, like `https://example.com`. Without it, the site uses Vercel's production domain.
- While the site only has a `vercel.app` address, every page is marked noindex so Google waits for the real domain.

## Checkout
`api/checkout.js` is a Vercel function. It re-checks the cart against the pouch limits in `src/data/ingredients.js`,
then opens a Stripe Checkout page: US shipping addresses only, free shipping, $129 per roll. Each order's pouch recipe
(ingredient names and counts) is saved on the Stripe payment under Metadata, so you can pack it in OK Capsule.
After paying, customers land on `/thank-you`, which clears their cart.

## Daily rebuild for scheduled posts
`.github/workflows/daily-rebuild.yml` triggers a Vercel rebuild once a day.
Create a Deploy Hook in Vercel (Settings > Git > Deploy Hooks), then add its URL to this repo as the
Actions secret `VERCEL_DEPLOY_HOOK`.

## Reviews
Add real customer quotes, with permission, to `src/data/reviews.ts`. The section stays hidden while the list is empty.

## Founding Crew (ambassadors)
- `/crew` is the application page. Applications land in Klaviyo (see `api/crew.js`).
- Every ambassador is a Stripe promotion code on the coupon `bh-crew-5`, with `crew=1` in its metadata. Their code takes
  $5 off each roll (checkout applies a `bh-crew-5-xN` coupon for N rolls).
  Crew codes work during pre-order; other codes don't.
- `/api/crew-admin?key=CREW_ADMIN_KEY` is the back office: approve people (makes their code), pause a code, see
  what each person has earned and why each order did or didn't count, record PayPal payouts and free rolls.
- The rules live in `api/_crew.js` and the numbers in `src/data/crew.js`: no commission on refunded or disputed orders,
  on the ambassador's own orders (same email, address, card or name), or on the same buyer twice in 30 days;
  commission waits until after the hold; every order keeps at least $8 a roll after commission; the free roll is
  given once, only after the profit kept on that person's orders covers it.
