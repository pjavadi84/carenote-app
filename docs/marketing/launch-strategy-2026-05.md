# Kinroster launch strategy — May 2026

**Owner:** Pouya
**Stage:** end-to-end product working in two regions (US + Taiwan); pre-pilot; solo founder.
**Goal:** find 5–10 pilot facilities to validate the product (especially the clinician-share question) before deepening any feature area.

## Framing — what we are actually selling

We are **not** selling AI documentation software. The buyer (a stressed-out admin running a 6–20 bed RCFE on thin margins) doesn't care about AI or our tech stack. We are selling:

- **"Your caregivers will document better and faster."** (Caregivers spend less time writing, notes are more complete, audit-ready.)
- **"Your families will stay informed without you fielding phone calls."** (Family update flow.)
- **"Your audits will pass."** (HIPAA / 長照法 compliance, append-only audit log, structured notes.)
- **"You'll spend less time on paperwork."** (Lift the documentation tax off the admin.)

Lead with one of these in every channel and every conversation. Never lead with the AI or the model names. The AI is *how* we deliver these outcomes — outcomes are what get bought.

## Channel prioritisation

### Tier 1 — This week. Highest ROI for our stage.

Goal: get in front of 30–50 facility admins in two weeks. From that, expect 5–10 conversations and 2–3 pilots.

#### 1.1 Direct LinkedIn outreach to facility admins
- **Volume:** 10 personalised messages per day, 50/week.
- **Targets:** LinkedIn searches for "RCFE administrator", "residential care administrator", "assisted living director" filtered by California, Oregon, Washington (densest small-facility populations). For Taiwan, "長照機構主任", "護理之家負責人".
- **Personalisation rule:** mention one specific thing about their facility (location, bed count, a recent post they made, an award). No templates that look templated.
- **Use template:** `docs/marketing/linkedin-cold-outreach.md`
- **Anchor link in every outreach:** the foundational LinkedIn post (1.2 below). When they click, they see your story before they decide whether to reply.

#### 1.2 Foundational LinkedIn post
- **Pinned post on your profile.** Every outreach links back here.
- **Use draft:** `docs/marketing/linkedin-foundational-post.md`
- Post Monday morning Pacific (highest engagement for healthcare ops audiences). Tag CALA, Argentum once each — no more.
- **Engagement goal:** not vanity metrics, but 2–3 inbound DMs from admins. Reply to every comment within 24h.

#### 1.3 Personal network email
- 3-sentence email to anyone in your network who's adjacent to elder care: healthcare consultants, geriatric care managers, families with parents in care, doctors, nurses.
- **Use template:** `docs/marketing/email-network-ask.md`
- The ask is not "buy this" — it's "do you know any RCFE admins I should talk to?" Warm intros convert 5–10× cold ones.

### Tier 2 — Next 2–4 weeks. Build authority while pilots run.

#### 2.1 Industry communities
Lurk for a week, comment substantively on 5–10 other people's posts, then post one thing about your work.

**US:**
- [CALA](https://caassistedliving.org) — California Assisted Living Association. Has small-facility working groups.
- [Argentum](https://www.argentum.org/) — national; mostly chains but useful for credentialing.
- [NCAL](https://www.ahcancal.org/Pages/Default.aspx) — same.
- Facebook groups: "RCFE Owners and Administrators", "California RCFE Owners Network". Closed/private — request access, introduce yourself genuinely. These groups smell pitches a mile away.

**Taiwan:**
- [中華民國老人福利機構協會](https://www.charity.org.tw)
- [台灣長期照護專業協會](https://www.ltcpa.org.tw)
- LINE groups for facility administrators — harder to find, ask in industry groups for an invite.

#### 2.2 Geriatric care managers & placement consultants
- [A Place for Mom](https://www.aplaceformom.com) regional advisors
- [Aging Life Care Association](https://www.aginglifecare.org) members
- Local senior-placement consultants (search Google for "senior placement [your city]")

These people recommend facilities to families. If they know about Kinroster, they mention it when discussing "modern" or "well-documented" facilities. Low effort, compounds over time. Cold-email each one with the question "what would make you more likely to recommend a facility to a family?" — softer ask, opens a relationship.

#### 2.3 One industry-publication pitch
- **McKnight's Senior Living** — mostly chains, but covers tech.
- **Senior Housing News** — more business-y, smaller-facility content too.
- **I Advance Senior Care** — multi-format, accepts contributed pieces.

Email a contributor with this pitch: "Small RCFEs are getting squeezed by documentation requirements. I built a tool. Want to write 600 words on what we learned during pilot?" Op-eds get published when you have a story; after 1–2 pilots, you'll have one.

### Tier 3 — After 2–3 pilot wins. The flywheel.

#### 3.1 Case studies on kinroster.com
One paragraph each: facility name (with permission), problem before, what changed, quote from admin. Goal: 3 case studies live on the homepage within 60 days of first pilot.

#### 3.2 SEO blog posts
Aim for searches your buyer actually types when frustrated:
- "HIPAA documentation requirements for a 12-bed RCFE"
- "Taiwan 長照法 documentation checklist"
- "how to document a shift in a residential care facility"
- "RCFE software for small facilities"

Each post: 1200–1800 words, one specific pain, one specific outcome, soft CTA to free pilot. Publish on `kinroster.com/blog/`.

#### 3.3 60-second product demo video
Phone-vertical, voice-intake → structured note. Show the timer dropping from 15 min to 90 seconds. Admins watch on phones during shift turnover. Post to LinkedIn natively (don't link to YouTube — LinkedIn punishes outbound links).

#### 3.4 Customer-written content
Once you have a flagship customer, get them to write about it. A facility owner blogging about Kinroster reaches 10× what you can reach yourself. Offer to ghostwrite the first draft if they're stuck.

## What NOT to do at this stage

| Channel | Why skip |
|---|---|
| Product Hunt | Wrong audience. Tech founders don't run RCFEs. |
| Hacker News | Same — useful only for hiring or finding technical co-founders. |
| Mass cold email blasts | Elder-care niche has tight networks; getting flagged as spammy haunts you. |
| Paid ads (Google/Facebook) | Target is too narrow for ad targeting to work; conversion impossible without warm trust. |
| Big conferences ($1500+ booth) | Wait until you have customers and case studies. |
| TikTok / dance-around-the-product content | Your buyer is 45–65 and skeptical of viral content. |
| AI Twitter / "we built X with Claude" | Your buyer doesn't care and may be put off by the AI emphasis. |

## Metrics to track (lightweight)

Don't over-instrument. Track in a single Notion / spreadsheet, weekly:

- **Outreach:** messages sent / replies / interested / scheduled
- **Inbound:** DM volume on LinkedIn / form submissions on kinroster.com
- **Conversions:** intro call → pilot agreement → first active use
- **Time-to-respond:** how long between an admin showing interest and you replying. Goal: <4 business hours.

## Tomorrow's checklist (start here)

When you sit down, in this order:

- [ ] Open `docs/marketing/linkedin-foundational-post.md` — pick variant A or B, polish 5 minutes, post to LinkedIn, pin it.
- [ ] Open `docs/marketing/email-network-ask.md` — copy template, send to 10 people in your network. 10 minutes.
- [ ] Open `docs/marketing/linkedin-cold-outreach.md` — pick 10 facility admins on LinkedIn, send 10 personalised messages. 45 minutes.
- [ ] Set a recurring 30-minute slot daily at 8am for outreach. Compounds.
- [ ] Add a simple Notion table to track who you've reached out to, status, last touch.

Total time tomorrow morning: ~90 minutes of focused outreach. By end of week: 50+ admins touched. By end of week 2: 5–10 conversations. By end of week 4: first pilot.

## Companion docs

- [linkedin-foundational-post.md](./linkedin-foundational-post.md) — pinned post draft (2 variants).
- [linkedin-cold-outreach.md](./linkedin-cold-outreach.md) — direct-message templates (US + Taiwan).
- [email-network-ask.md](./email-network-ask.md) — warm-intro email template.

## A note on the Taiwan side

You have a Taiwan deployment but no Taiwan customers yet. Taiwan elder care is a different cultural and regulatory environment — channels are LINE and Facebook (not LinkedIn), buyers are often more relationship-driven than US admins, and 長照法 documentation is more standardised so the "compliance" angle lands harder. Don't try to run Taiwan and US outreach in parallel as a solo founder. Pick one for the next 4 weeks. **Recommend: start US** since the LinkedIn motion is more scalable for a solo founder; circle back to Taiwan after first US pilot.
