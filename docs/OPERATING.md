# How Blue Hour runs

The operating system from the conversion report, set up for a one-person team that plans to be big.
Bootstrap the spending. Don't bootstrap the discipline.

## North star

**Contribution margin from fulfilled, satisfied customers per qualified visitor** (report 8.3).
Not time on site, not clicks, not cart adds on their own.

Contribution margin per order = what the customer paid − OK Capsule cost − Stripe fees − Crew commission or
discount − refunds − ad spend to get that order.

## Before any paid traffic (P0, check every launch and after every checkout change)

- [ ] A real order on an iPhone: add to cart > Stripe > pay > thank-you page > Stripe receipt email > refund it.
- [ ] Same on desktop.
- [ ] A Founding Crew code takes $5 off each roll at checkout.
- [ ] Clarity shows the test visit with `begin_checkout` and `purchase` events.
- [ ] Vercel logs show `bh_event` lines for the test visit.
- [ ] Stripe metadata on the test payment shows `source_first`, `source_last`, `visitor` and the pouch.
- [ ] OK Capsule can pack the exact pouch on the order (8 capsules, B12, glycine ×2).
- [ ] No `checkout_error` events in the last 7 days.

## Scorecard (weekly)

| Metric | How to get it |
|---|---|
| Qualified sessions | Visits with `view_item`, `section_view` of `signature` or `nights`, or `build_started` |
| Hero > product | `hero_cta_click` or shop `page_view` ÷ home `page_view` |
| Product view > add to cart | `add_to_cart` visits ÷ `view_item` visits |
| Builder completion | `build_completed` ÷ `build_started` |
| Cart > checkout | `begin_checkout` ÷ `view_cart` |
| Checkout completion | Stripe paid orders ÷ `begin_checkout` |
| Checkout errors | Count of `checkout_error` (should be 0) |
| Orders and revenue by source | Stripe metadata `source_last` |
| Contribution margin per order | Stripe net − OK Capsule invoice − commission |
| Refund rate | Stripe refunds ÷ orders |
| Crew share | Orders with `crew_code` ÷ all orders |

Read it by source and by device. Phone and desktop are different shops.

## Weekly review (30 minutes, every Monday)

1. **Traffic quality:** which sources brought people who reached the product or the cart? Scale, fix or pause each one.
2. **Funnel:** where was the biggest drop, by device and source? Pick one fix.
3. **Recordings:** watch 5 recordings filtered to that drop. What did people do just before leaving? Write one sentence.
4. **Questions:** what did customers, Crew members or event partners ask this week? Add repeats to the FAQ.
5. **Experiments:** check the live one in EXPERIMENTS.md. Don't call it early.
6. **Money:** contribution margin per order this week. Is any channel losing money per order?
7. **Decide:** write one change for next week in EXPERIMENTS.md. One. Not five.

## Single sources of truth

| Thing | File |
|---|---|
| Prices, tiers, capsules, doses, limits, The Signature | `src/data/ingredients.js` |
| Founding price on/off, delivery time | `src/data/preorder.js` (FOUNDING, DELIVERY) (also update refunds.md, shipping.md, terms.md, which are plain text) |
| Crew commission and codes | `src/data/crew.js` |
| Live experiments | `src/data/experiments.js` |
| Health and product claims | `docs/CLAIMS.md` |

Change the number in one place. Never type a price or a dose into a page by hand when the data file has it.
