# Tracking: events, visitor states and rules

Blue Hour's behaviour tracking, adapted from the conversion report (sections 5.2, 6.2 to 6.4).
Code: `src/scripts/track.js` (sending), `src/scripts/state.js` (states), `src/scripts/site.js` (where events fire),
`api/t.js` (our own event log), `api/checkout.js` (attribution saved on orders).

## Where the data goes

| Destination | What it's for | Where to look |
|---|---|---|
| Microsoft Clarity | Recordings and heatmaps, filtered by event, state or tag | clarity.microsoft.com > Blue Hour > Recordings > Filters > Custom events / Custom tags |
| Our event log (`/api/t`) | Counts and funnels we own. One JSON line per event, `type: "bh_event"` | Vercel > project > Logs, search `bh_event`. Set `EVENTS_WEBHOOK_URL` to forward to a database later. |
| Stripe order metadata | Revenue by source and experiment | Stripe > Payments > a payment > Metadata: `source_first`, `source_last`, `visitor`, `experiments` |
| `window.dataLayer` | Ready for GA4 / Tag Manager later. Nothing reads it today. | — |

Stripe is the record of money. Events are the record of behaviour. Don't count revenue from events.

## Event dictionary

| Event | Fires when | Parameters |
|---|---|---|
| `page_view` | Any page loads | `page_type`, `source` |
| `section_view` | A section is at least half on screen for 1 second (40% of the screen for tall ones), once per page view | `section` |
| `hero_cta_click` | Homepage hero button | `cta`, `page_type` |
| `cta_click` | Any other button marked `data-cta` | `cta`, `page_type` |
| `view_item` | Shop page loads | `value` |
| `view_supplement_facts` | A Supplement Facts panel opens | `page_type` |
| `open_lab_report` | A lab report PDF link is tapped | `report` |
| `faq_open` | A FAQ opens (first time per page) | `topic` |
| `build_started` | First change in the pouch builder | `from` |
| `builder_change` | Any builder change | `action` (add, remove, reset), `count`. Never which capsule. |
| `build_completed` | A custom pouch is added to the cart | `count` |
| `quantity_selected` | Number of rolls changed | `qty`, `value` |
| `add_to_cart` | A roll goes in the cart | `rolls`, `kind` (signature, custom), `value`, `from` |
| `remove_from_cart` | A roll comes out | `rolls` |
| `view_cart` | Cart opens | `rolls`, `value` |
| `code_applied` | A discount or Crew code is saved | `crew` |
| `begin_checkout` | Checkout button pressed | `rolls`, `value`, `crew` |
| `checkout_error` | Checkout didn't open | `error` (not_configured, stripe_error, network...) |
| `purchase` | Thank-you page with a Stripe session | `tx` (last 12 characters), `rolls`, `value` |
| `newsletter_opt_in` | Email sign-up succeeds | `form` |
| `crew_application` | Founding Crew form step 1 sent | `step`, `form` |
| `state_change` | Visitor moves to a new state | `from`, `state` |
| `nudge_shown` / `nudge_click` | A state rule shows something / it's tapped | `cta` |

Privacy rules: only these parameter names get through (`ALLOWED` in track.js, re-checked in api/t.js). Never names,
emails, addresses, payment details, typed text, health details or exact capsule picks.

## Clarity tags (filter recordings by these)

`page_type`, `source_first`, `source_last`, `campaign`, `visit` (new, returning), `device` (phone, desktop),
`state`, and `exp_<id>` for each live experiment. Cart, checkout and purchase visits are marked to always be kept.

## Visitor states (report 5.2)

Highest first. A visitor is in the first one that fits. Stored in their browser only.

| State | Signal | What the site does |
|---|---|---|
| `buyer` | Reached thank-you after paying | Order updates by email (Stripe receipt for now) |
| `cart_holder` | Added a roll, hasn't paid | On their next visit, one line in the top bar: "Your roll is still in your cart." Shop shows the founding terms beside the buttons. |
| `configurator` | Changed the builder | Custom pouch saved for next visit. After 6 changes or 45 seconds without adding, one offer of The Signature (once per visit). |
| `price_evaluator` | Changed rolls, or opened a price, shipping or pre-order question | Shop shows "$99 while the first 100 orders last, then $129. Ships free and arrives in 5 to 9 days." above the buttons |
| `proof_seeker` | Opened Supplement Facts, a lab report, or a safety, testing or medication question | Shop shows the lab-tested line with a link to the reports above the buttons |
| `curious` | Saw what you get, The Signature, how it works, or the shop | Nothing extra. The page order does the work. |
| `cold` | Nothing yet | Nothing extra |

Never: fake countdowns, "only X left", hidden subscriptions, pressure messages, or guessing anything about someone's
health, drinking or medication from what they do (report section 9).

## Adding an event

1. Call `track('event_name', { allowed_param: value })` from `site.js` or a page script.
2. If it needs a new parameter name, add it to `ALLOWED` in track.js. api/t.js accepts any lowercase key, but keep the list tight.
3. Add a row to the table above.
