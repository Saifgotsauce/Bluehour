# Experiments

One major change at a time (report 8.2). Write it here before it goes live, and write the result before the next one starts.

## Until there's enough traffic

Below a few hundred product views a week, A/B tests can't tell you much. Do this instead:
- 5 to 8 think-aloud tests: a person who goes out a lot uses the site on their phone and says what they're thinking. Record the call.
- 10 to 15 short interviews (questions in the report, section 3.5). Not supportive friends.
- Fix the obvious problems, then test.

Sample size rule of thumb: to detect a 20% relative lift on a 3% add-to-cart rate, you need roughly 13,000 product
views per variant. Use a sample-size calculator with your real baseline before calling any winner.

## Template

```
### <id>: <one line>
Status: planned | live | done
Hypothesis: If we <change>, then <metric> will <go up/down> because <reason>.
Audience / source:
Change (exact):
Primary metric:
Guardrail metric:
Start: / End:
Sample size needed:
Result:
Decision:
Next:
```

## Log

### signature-v2: NAC in The Signature, B12 for B-complex, glycine ×2 minimum
Status: live (site change, not a split test), November 2026
Hypothesis: Shoppers in this category expect NAC, so a Signature with it will lift add-to-cart rate. B12 alone removes
the niacin and B6 label worries.
Primary metric: add to cart ÷ product views. Guardrail: builder use (are people removing Prime?), refund rate.
Baseline: none yet (no orders before the change). Watch `builder_change` with `action: remove` on visits that started from The Signature.

## Backlog (from the report, in order)

1. Checkout health: real order on iPhone and desktop (P0, not a test).
2. One-sentence clarity of the hero: hero > product rate.
3. Primary ICP message by source: event-regular copy vs blended copy.
4. Price placement: $99 total, $3.30 a night, free shipping and ship date together.
5. Pre-order reassurance beside the button (done for price evaluators; test for everyone).
6. Signature-first builder vs build-first.
7. Proof placement near the price (done for proof seekers; test for everyone).
8. What's-in-the-box visual.
9. Trial route: event welcome packs as the sample (no small rolls possible yet).
10. Group bundle wording.
11. Crew creator proof: packaging walkthroughs vs lifestyle posts.
12. Review flow after delivery: ask everyone, never only happy customers.
