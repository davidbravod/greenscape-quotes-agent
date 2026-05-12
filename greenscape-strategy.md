# Greenscape Pro — AI Agent Strategy

**Prepared for:** Marcus Tate, Founder & CEO · **By:** L&S Consulting
**Scope:** Top 5 AI agents to build, ranked by ROI and leverage


## Considered and rejected
**Crew Coaching Agent** (Marcus's stated #3). Real pain, but only ~$104K/year. It's also a *behavioral* problem — crews not asking the right on-site questions — and an in-pocket AI doesn't fix that alone; adoption among non-tech-forward installers is a real risk. Phase 2 candidate once the higher-leverage agents are earning. 

**The marketing/content agent (his #4) was rejected outright** — Marcus admitted on the call he's quote-constrained, not lead-constrained, so more content just creates more leads he can't convert.

---

## #1 — Quote Acceleration Agent
**Compress the quote cycle from 6–9 days to 24–48 hours by doing the cognitive work of turning Marcus's site walk into a priced scope.**

- Marcus records a 5–10 min voice memo post-walk. Agent transcribes and structures it.
- Maps spoken scope to line items in the existing 200-item pricing spreadsheet, flagging low-confidence matches.
- Drafts the quote
- Outputs draft PDF + upload and update opportunity in GHL. **Marcus reviews and approves in one screen** — 10–15 min vs. the current 2–4 hours.

**Replaces:** Marcus's entire 2–4 hour proposal-drafting block — interpreting notes, opening the pricing sheet, building line items, exporting PDF.

**ROI:** ~$1.3M/year recovered. Math: ~500 qualified leads/year (150 deals at 30% close), with 35–40% lost to faster competitors at the proposal stage = ~175–200 speed-lost deals × $28K = $4.9M–$5.6M walking away annually. At ~25% recovery of that cohort, the agent returns ~$1.3M/year. Plus 6–10 Marcus-hours/week redirected to more site walks (which close at 70%+).

**Guardrails:** Never auto-sends. Confidence <80% on line-item mapping surfaces to Marcus. Pricing sheet is source of truth — agent cannot invent line items. Unclear scope triggers a structured clarification list, not a guess.

**Model & cost:** Claude Sonnet (default for drafting) + Whisper (default for transcription). ~$1/proposal, <$200/year.

**Why #1:** Biggest hole in the bucket. Every other agent compounds when the quote cycle is fast — faster proposals mean less downstream follow-up, less anxiety in the post-sign phase, more bandwidth for everything else.

## Why #1 is not the founder's stated #1 (it actually is — for a different reason)
Marcus's stated #1 was "speed up quoting." We agree on the priority but disagree on what the agent has to do. Marcus framed it as a writing problem. 
**The real bottleneck is that Marcus is the only person who can translate a site walk into a priced scope.** 
A proposal-templating tool would fail — it still requires him to do the cognitive work upfront. Our agent takes a voice memo and does the scope translation, collapsing Marcus's role from 2–4 hours of drafting to 10–15 minutes of review. That's the unlock most consultancies will miss.

---

## #2 — Closed-Lost Reactivation Agent
**Systematically work the 1,400-lead graveyard with personalized, Marcus-voiced outreach.**

- Pulls each lead's GHL notes — original scope, season, price point, last-contact reason.
- Drafts a personal-feeling SMS or email referencing the specific project ("the patio you were considering last spring") in Marcus's voice.
- Drips in batches of 30–50/week to keep review load manageable and protect deliverability.
- Routes responses into the regular sales flow for Marcus or Brittany.

**Replaces:** Brittany's sporadic re-engagement blasts. The current "closed a handful" result.

**ROI:** $780K in latent revenue. 1,400 leads × 1–2% re-close × $28K = $390K–$780K one-time. Highest dollar-leverage agent after #1.

**Guardrails:** Marcus approves batches in bulk (30 drafts in 15 min) — no autonomous sending. Drafts referencing details not in GHL notes get blocked (grounding check). Suppression list honored. Daily send cap.

**Model & cost:** Claude Sonnet. ~$0.03/lead. ~$50 total to work the full backlog.

**Why #2 (not founder's stated #2):** Closed-lost is a one-time ~$780K inventory sitting untouched. No need to pay for ads. Data is already there. Process is there. Nurturing is a big part of the sales process.

---

## #3 — Post-Sign Logistics Agent
**Eliminate the 4–6 week post-sign limbo by automating HOA, permit, and deposit follow-ups.**

- Triggered on contract signature. Spawns a per-project tracker with HOA / permit / deposit / final-design milestones.
- Sends customer-facing nudges on cadence ("HOA package sent 10 days ago — want help getting it in front of the board?") in Marcus's voice.
- Alerts Jenna internally only when a stage stalls past threshold or a customer reply needs judgment.
- Admin dashboard view: every project, current stage, days-since-movement, color-coded.

**Replaces:** Jenna's manual chasing across 8–12 limbo projects. Cuts the average cycle from 4–6 weeks toward the targeted 2.

**ROI:** Pulls forward $224K–$336K of currently-delayed revenue (8–12 projects × $28K in limbo at any time). Frees ~6–10 Jenna-hours/week. Earlier deposits improve cash position.

**Guardrails:** Jenna approves first 2 weeks of sends to calibrate tone, then spot-checks. All sends logged in GHL. Hard rule: logistical nudges only, never legal/contract content.

**Model & cost:** Claude Haiku. ~$0.005/message. <$30/month.

---

## #4 — Build-Phase Progress Agent
**Automate the customer communication during the build that Marcus knows drives referrals but only does 30% of the time.**

- Watches CompanyCam photo uploads and Jobber daily check-ins.
- At milestones (kickoff, 25%, 50%, 75%, walkthrough), drafts a short customer update in Marcus's voice with 2–3 photos attached.
- At halfway, prompts Marcus to record a 60-second Loom (highest-value touch he mentioned) and handles everything around it.
- Detects potential concerns from CompanyCam comments and crew message patterns; routes to humans.

**Replaces:** The inconsistent ad-hoc updates that trigger anxious customer calls to Jenna. Also replaces Marcus's manual Loom workflow on the 30% of jobs he currently touches.

**ROI:** ~$100K–$155K/year, driven primarily by referrals. Math: Marcus already gets referrals from the 30% of customers who receive his personal updates ("you are the only contractor who kept us informed" — direct quote). The agent extends that experience to the other 70% — ~105 additional customers/year. At a conservative 10% referral rate × 50% close rate × $28K, that's ~$147K. Discount by ~30% for referrals that would have happened anyway, plus ~$10K in Jenna's recovered time fielding anxiety calls. Also the Customer Satisfaction will increase. "Happy Wife, Happy Life", customer is your wife LOL.

**Guardrails:** Marcus approves milestone templates once at setup. Never sends without verified photo upload — no "great progress today!" with no evidence. Customer replies route to human, never auto-respond.

**Model & cost:** Claude Haiku. ~$0.003/message. <$20/month.

---

## #5 — Voice Pre-Qualification Agent
**Call every new Meta/Google lead within 5 minutes — qualify, book, or route — in Marcus's cloned voice.**

- Triggered on new lead in GHL. Places an outbound call within 5 minutes using xAI Grok Voice Agent API, in a custom-cloned Marcus voice.
- Runs a 3–5 minute conversation through 4–5 qualifying questions: scope, timeline, budget range, ownership, ZIP. Handles natural objections and clarifications mid-call.
- Books qualified leads directly into Marcus's calendar; routes others to Brittany's nurture sequence. Falls back to SMS if no pickup after 2 attempts.
- Hands Marcus a one-line summary plus the recorded call before each site walk: scope, budget signal, timeline, red flags, tone of customer.

**Replaces:** (a) The 10–15 min Marcus spends on each of 4–6 unqualified calls/week — 1–2 hours of his most expensive time. (b) The 1–3 day delay before Marcus calls a new lead, during which faster competitors steal them.

**ROI:** Two stacked effects. First, $80–$160K/year in Marcus-hours opportunity cost recovered (same as SMS version). Second — and bigger — closing the lead-response gap. With 500 qualified leads/year and a 5-minute response window beating the 1–3 day current lag, expect a meaningful close-rate lift on the *non*-speed-lost cohort too. Even a 3pt lift = ~15 extra deals × $28K = $420K/year. Combined plausible range: $500K–$600K/year.

**Guardrails:** Edge cases ($200K job with vague timeline, customer asks complex questions, customer requests human) auto-transfer to Marcus or route to voicemail with a callback flag, never auto-decline. Calls are recorded with consent disclosure at intro. Marcus reviews the first 20 calls before agent goes fully autonomous.

**Model & cost:** xAI Grok Voice Agent API at $0.05/min + LiveKit hosting at $0.01/min = ~$0.06/min. At 4 min avg × 15–20 leads/week × 52 weeks = ~$200–$250/year. Custom voice clone of Marcus is free with xAI (one-time setup).

**Why #5:** Smaller revenue scale than #1–4 but the highest *brand* leverage on the list — Greenscape's premium positioning is built on "we're the contractor who actually shows up." A voice agent that calls within 5 minutes of a Meta form submission, in Marcus's voice, is the most visible signal of that promise.
---
