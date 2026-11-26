# Blue Hour marketing funnel (v1, 25 Nov 2026)

The whole system on one page, then each stage in detail. Built on docs/FUNNEL.md (ICP report + Clarity review).
Where they disagree, this file wins for marketing; FUNNEL.md stays the record of the research and decisions.

## 0. The whole thing in one picture

| Stage | Who's in it | Goal | Main channels | Offer | Where they land | One number that matters |
|---|---|---|---|---|---|---|
| **TOFU** Strangers | Never heard of us | Get seen, get a pouch in hand | Event pouches, Crew and creator posts, IG/TikTok organic, $5 boosts on winners | None. Free pouch at events | Instagram profile, /up-early, /festival, /tried | Cost per engaged person (3-sec hold, saves, QR scans) |
| **MOFU** Warm | Engaged, followed, visited, tried a pouch | Make them trust it and remember it | Retargeting (video viewers, engagers), email, creator #2 and #3 posts, Reddit answers | Founding counter, "email me this", "send me this tomorrow" | /shop, /build, /learn, segment pages | Email opt-ins per week |
| **BOFU** Ready | Opted in, checked the price, built a pouch, carted | Close the first roll | Email flows, cart reminder, morning-after email, founder note | Founding price $99 (first 100), crew kit 3 × $89 | /shop#buy, /build, checkout | Orders and checkout completion |
| **Retain / refer** Buyers | Bought a roll | Second roll, bring friends | Thank-you page, post-purchase emails, Crew | Founding number, reorder link, Crew code | /thank-you, /build?mix=…, /crew | Reorders and Crew sign-ups from buyers |

The rule that holds it together: **you can't buy trust at $5 a day.** Top of funnel borrows trust from people and
places they already trust and puts a pouch in their hand. Middle keeps us in their head. Bottom closes the morning
after, not at 2am.

## 1. How we divide people into TOFU, MOFU and BOFU

Everyone starts in TOFU. They move down on a **signal** we can see. They never move back up, they just go quiet.

| Stage | They count as this stage when… | Where we see it |
|---|---|---|
| TOFU | No signal yet. Saw a post, walked past the stall | Instagram reach, event headcount |
| MOFU | Any of: watched 50% of a Reel; saved, shared or commented; followed; visited the site once (`curious` or `cold` state); got a pouch at an event | Meta engagement audiences, Clarity, /api/t log (`page_view`, `section_view`) |
| BOFU | Any of: gave us their email; checked the price (`price_evaluator`); opened the builder or a lab report (`configurator`, `proof_seeker`); added to cart (`cart_holder`); scanned the QR on a pouch (/tried); came back within 7 days | /api/t log, Klaviyo `signup_source`, state.js |
| Customer | Paid | Stripe (founding metadata), `purchase` event |

**The audiences you build** (you set these up in Meta yourself; I don't touch Ads Manager):

| Name (neutral, never about drinking) | Source | Stage |
|---|---|---|
| `IG engagers 30d` | Instagram account engagement | MOFU |
| `Video 50% 14d` | People who watched 50% of any Reel | MOFU |
| `Video 95% 14d` | 95% viewers | MOFU, close to BOFU |
| `Site visitors 30d` | **Needs the Meta pixel** (not installed yet, see section 9) | MOFU |
| `Price or cart 14d` | Pixel events (later) | BOFU |
| Exclude: `Buyers 180d` | Pixel purchase (later) | — |

**Klaviyo segments** (from the `signup_source` property the site already sends):

| Segment | `signup_source` | Stage | Flow |
|---|---|---|---|
| Event pouch | `event` (with `tried_at_event`) | BOFU | Morning-after flow |
| Late-night | `tomorrow` (with `saved_link`) | BOFU | Next-morning flow |
| Built a pouch | `build` (with `saved_link`) | BOFU | Your-pouch flow |
| Footer / popup | `footer`, `popup` | MOFU | Welcome flow |
| Crew applicants | Crew form | MOFU (as buyers) | Crew flow (exists) |

## 2. TOFU: strangers → "I've seen that"

**Goal:** get the brand in front of S1–S4 in a way that borrows trust. Not sales.

**Channels, in priority order** (cheapest trust first):

1. **Event pouches.** A single pouch with a QR card at the exit, in a goodie bag or at a promoter's table.
   The card: "Tonight: one pouch before bed. Water. Sleep." QR → /tried?e=event-slug (logged per event).
   This is our best TOFU channel because the product does the talking at 4am.
2. **Founding Crew members** posting their own real nights (disclosed, #ad, own code).
3. **Micro-creators, local DJs and promoters** (1k–20k followers, in the scene, not fitness influencers).
   Pay in product + commission on their code first; flat fee only for proven ones.
4. **Instagram and TikTok organic** from the brand account, 4–5 posts a week (formats below).
5. **$5/day boosts** only on posts that already beat our organic average, optimised for video views (builds
   `Video 50%` audiences for MOFU). Never boost straight to checkout.
6. **Reddit** (r/aves, r/EDM, r/festivals, city rave subs): answer questions as the founder, disclosed, no links
   unless asked. Slow, but it's where S2 plans trips.

**Content that works at TOFU** (moment first, product second):

| Format | Example | Segment |
|---|---|---|
| POV | "POV: it's 4:12am and your alarm is set for 8" | S1 |
| 4am vs 9am | Split screen, same person | S1, S4 |
| Packing list | "What's in my festival bum bag" with a strip of pouches | S2 |
| Group chat | Screenshot-style "who's bringing what" | S3 |
| Founder | "I'm 22 and I built this for my own scene" | All |
| Day party | Sunlight, no drinks in shot | S4 |

**Never at TOFU:** price, countdowns, "first 100" (it reads as fake to strangers, see FUNNEL.md §1), hangover
anything, drinks in shot, NAC in the hook.

**Landing pages for TOFU clicks:** the Instagram profile first (most will check it before clicking anything), then
the segment page: /up-early (S1, S4), /festival (S2), /crew (S3 recruiting only). Not the homepage, and not /crew for
selling rolls (Clarity: 118 Crew-ad visitors, almost nobody saw the product).

**TOFU numbers to watch weekly:** 3-second hold rate, % watching to 50%, saves + shares per 1,000 reach, follows,
pouches handed out → QR scans.

## 3. MOFU: "I've seen that" → "I get it and I trust it"

**Goal:** they understand what it is, believe it's legit, and give us a way to reach them again (email first).

**What moves people here:**

| Tool | What it does | Status |
|---|---|---|
| Retargeting `Video 50%` and `IG engagers` with **a different creative** within 3–7 days | A real review or the founder, never the same ad | You run it in Meta |
| Second and third creator posts | Same creator, new angle, so the face is familiar | Ask creators whose post beat average |
| /learn (the article) | Teaches first, sells second, every number sourced | Live |
| /up-early and /festival | Their night, their job, then the product | **Live now** |
| /build with packs | "Lights Out", "Long Weekend", "The Basics", plus their own | **Live now** |
| Lab reports and "why no 5-HTP, no caffeine" | Proof for `proof_seeker` visitors | Live (B12 report still missing) |
| Email capture with a reason | "Email me this pouch" on /build, "Send me this tomorrow" after 11pm on phones, QR on event pouches | **Live now** |
| Welcome popup | Off while the founding price runs (no discount codes; founding price is the deal) | Paused on purpose |
| Founding counter | Shows real paid orders once 10+ exist, warm visitors only | Built, untested on live Stripe |

**Content at MOFU:** reviews with faces, "what's in the pouch" carousels, the lab report video, founder Q&A in
Stories, "why we don't use caffeine", the packing-list post saved as a Highlight.

**MOFU numbers:** email opt-ins per week (target: 25+ in Phase 1), opt-in rate per page, return visits within 7
days, `section_view` depth on segment pages (do they reach the offer?).

## 4. BOFU: "I trust it" → first roll

**Goal:** close, honestly, at the right moment. The right moment is **Sat/Sun 10am–1pm** and **Sun 6–10pm**, not 2am.

**Offers at BOFU (and only here):**
- **Founding price:** $99 (crossed-out $129) for the first 100 orders, real counter, real cap. Price goes to $129 at
  order #100 and stays there. Never extend it quietly.
- **Crew kit:** 2 rolls $94 each, 3 rolls $89 each, one checkout. Lead with this for S2 and S3.
- **Founding number** (#001–#100) on the thank-you page.
- Free US shipping, no subscription, refund any time before it ships.
- **No extra discounts for cart abandoners.** It trains people to wait.

**The email flows** (Klaviyo; the site already sends the data, the flows themselves still need building):

| Flow | Trigger | Emails | What's in them |
|---|---|---|---|
| **Morning-after** | `signup_source = event` | Sat/Sun 10am–1pm, Sun 6–10pm, +3 days, +10 days | "Morning. How'd you wake up?", founder note + 3 reviews + counter, founding offer, last honest reminder |
| **Next-morning (late-night)** | `signup_source = tomorrow` | 9–10am their time next day, then +2 days | "You were looking at this at 1am" + `saved_link` button, then reviews + founding offer |
| **Your pouch** | `signup_source = build` | Right away, +1 day, +4 days | The `saved_link` button (rebuilds their exact pouch), what each capsule does, founding offer |
| **Welcome** | `footer` or `popup` | Right away, +2, +5 days | What it is, founder story, founding offer |
| **Cart / checkout abandon** | Stripe Checkout expired (or Klaviyo started-checkout once wired) | 1h, 24h, 72h | Their cart, the guarantee, FAQ. No new discount |
| **Post-purchase** | Purchase | Day 0, ships, +5 nights, +25 nights | Founding number, tracking, review ask, reorder link `/build?mix=…` + Crew invite |

**On-site BOFU tools (all live):** cart reminder on next visit, saved-pouch chip, founding counter for warm visitors,
"builder hesitator" nudge to The Signature, reorder links and saved packs after purchase.

**BOFU numbers:** add-to-cart rate (supplement median ~9%), checkout completion (median ~57%), orders by source,
days from first touch to order, founding counter progress.

## 5. Each segment through the funnel

| | TOFU (how they first see us) | MOFU (what makes them trust it) | BOFU (what closes) | Page |
|---|---|---|---|---|
| **S1 Out Late, Up Early** | Event pouch, POV and 4am-vs-9am posts | Reviews from people with 9–5s, /learn | Morning-after email, $99 founding | /up-early |
| **S2 Festival traveller** | Packing-list posts 4–6 weeks before a festival, Reddit | Long Weekend pack, festival creators | Crew kit 3 × $89, "order by Thursday" only when delivery really makes it | /festival |
| **S3 Crew organiser** | Group-chat posts, tagged by friends | Founding Crew, personal code | Crew kit, their code for friends | /crew, /festival |
| **S4 Soft-clubber** | Day-party and wellness-adjacent creators | "Nothing that keeps you up", ingredient education | Founding price, The Basics pack (no NAC) | /up-early |
| S5 Long shift | Later, separate page after launch | | | — |

## 6. Links and UTMs (so every order has a source)

Format: `?utm_source=<where>&utm_medium=<type>&utm_campaign=<what>&utm_content=<which>`

| Where | Example |
|---|---|
| Instagram bio | `/?utm_source=ig&utm_medium=bio&utm_campaign=evergreen` |
| IG Story link | `/festival?utm_source=ig&utm_medium=story&utm_campaign=festival-2027&utm_content=packing-list` |
| Boosted post | `/up-early?utm_source=ig&utm_medium=paid&utm_campaign=s1-boost&utm_content=pov-412am` |
| TikTok | `/up-early?utm_source=tiktok&utm_medium=organic&utm_campaign=s1&utm_content=4am-vs-9am` |
| Creator | `/?code=NAME&utm_source=creator&utm_medium=social&utm_campaign=NAME` |
| Event QR | `/tried?e=event-slug` (already tracked; add the event in src/data/events.js first) |
| Reddit | `/?utm_source=reddit&utm_medium=organic&utm_campaign=r-aves` |

Lowercase, hyphens, no spaces. The site keeps first and last source and sends both to Stripe with every order.

## 7. Weekly cadence

| Day | Do |
|---|---|
| Mon | Read last week's numbers (section 8). Kill or keep boosts. Reply to every DM and comment |
| Tue | Main post (S1). Creator outreach: 5 DMs |
| Wed | Main post (S2/S3). Boost the best post of the last 7 days if it beat average |
| Thu | "Pack it for the weekend" Story. Line up event pouches |
| Fri–Sat | Nothing paid. Event pouches out. Crew members post their nights |
| Sat/Sun 10am–1pm | Morning-after emails land. Reply to replies |
| Sun 6–10pm | Founder note / Story Q&A. Sunday email to warm list |

## 8. Numbers, targets and kill rules

Targets are ours for Phase 1, not industry figures, and get reset after 4 weeks of real data.

| Stage | Metric | Phase 1 target | If it misses |
|---|---|---|---|
| TOFU | 3-sec hold on Reels | 30%+ | Change the first frame and first line, not the product |
| TOFU | Pouch → QR scan | 15%+ | Change the card copy and where the pouch is handed out |
| MOFU | Segment page → reaches the offer section | 35%+ | Shorten the page above the offer |
| MOFU | Email opt-ins | 25+/week | Move the capture higher, test the "send me this tomorrow" wording |
| BOFU | Opt-in → order within 14 days | 5%+ | Rework the morning-after email and the founder note |
| BOFU | Checkout completion | 50%+ | Check Apple Pay, shipping copy, iPhone in-app browser |
| Boosts | Cost per 50% video view | Keep the cheapest 1–2 posts, kill the rest after 3 days | — |

## 9. Budget (bootstrapped, by phase)

| Phase | Spend | On what |
|---|---|---|
| 0. This week | $0 | Segment pages, tracking, flows written, clarity test with 10 strangers, nightstand photo |
| 1. Seeding | ~$50–120 | 1–2 rolls split into single pouches + QR cards for a pilot event and Crew members |
| 2. Warm close | ~$5/day boosts ($35/week) | Only on organic winners, to build `Video 50%` audiences; retarget them with reviews |
| 3. Scale | Set by results | More events and creators where cost per order is proven |

**Not built yet that this plan needs:**
- **Klaviyo flows** (all six in section 4). The site sends the data; the flows aren't set up.
- **Meta pixel**: no pixel is on the site, so `Site visitors` and `Price or cart` audiences can't be built yet. Send
  me the pixel ID when you want it and I'll add it and update the privacy policy to match.
- **Pause the Crew ads** until /crew leads with the product (FUNNEL.md decision 6, still yours to make).
