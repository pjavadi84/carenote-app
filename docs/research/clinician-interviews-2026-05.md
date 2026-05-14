# Clinician interviews — does the magic-link summary actually matter?

**Window:** 2026-05 (target: 2 weeks from start)
**Owner:** Pouya
**Decision this informs:** whether to keep investing in the clinician-share feature, or focus engineering on the caregiver→facility loop.

## Why we're doing this

The caregiver→AI-structured note→facility loop has obvious daily value to the buyer (facility admin). The clinician-side share is more uncertain — it solves real "between-visit" and "weekend hand-off" moments, but the recipient (the clinician) didn't ask for it, didn't pay for it, and may never open it.

Before the next sprint either deepens the clinician share (multilingual UI, richer summaries, EHR integrations, Q&A) or pivots focus to the caregiver loop, we want signal from real clinicians.

## Targets

Aim for **3–5 conversations** across these archetypes (one per archetype is enough; doubling up adds diversity, not necessarily insight):

- [ ] **Primary-care physician** treating residential-care elderly — the most common "doctor on file" for a resident
- [ ] **Geriatrician** — specialist most likely to be the heaviest reader of a structured summary
- [ ] **On-call / weekend coverage physician** — the "hand-off" use case
- [ ] **Specialist (psychiatrist or cardiologist)** consulting on residents — the "context I don't normally have" use case
- [ ] **Second PCP** (optional, only if first PCP feedback was equivocal)

## Format

- 25 min, video, recorded with permission
- Founder-led
- Explicitly NOT a sales pitch — frame as research before committing the next sprint
- Ideal: end of their day, casual, no slides

## Recruitment ask (paste verbatim into LinkedIn / email)

> Hi {{name}} — I'm building a documentation tool for small residential care facilities (think 6–20 bed RCFEs / 長照機構). One of the features lets the facility send a structured care summary to the resident's doctor via a magic link, no login required. I'm trying to figure out whether that's actually useful to doctors or just a nice-sounding feature, and the honest signal can only come from doctors themselves. Could I get 25 minutes of your time on Zoom to learn how you currently get updates between visits? Happy to share what I find. I'm not pitching anything — I just want to know whether to keep building this.

## Interview script

Don't read verbatim. Use as a checklist. Aim for 5 min preamble, 15 min content, 5 min wrap.

### Preamble (2–3 min)
- Thank them, confirm 25 min, confirm recording OK
- Frame: "We just shipped the feature. I'm trying to decide whether to deepen it or focus elsewhere. I want your honest reaction, including 'this is useless.'"
- Establish their context: roles, # of residential-care patients on panel, frequency they see those patients

### Current state (5 min)
- Walk me through how you currently get updates on a residential-care patient between visits. Who calls whom? What information do you usually need?
- When something changes for a resident — mood, appetite, a fall, a med refusal — how does that reach you, if ever?
- What goes wrong with the current flow? Last time you wished you'd known something earlier?

### Show the sample (5–7 min)
- Show a sanitised example summary on screen (use a clean Dr. Parham-style one, no real PHI; copy from the actual portal view)
- Silent for 10 seconds — let them read
- Open prompts:
  - First reaction?
  - If this hit your inbox right now from a facility you covered, would you open it? Honestly?
  - What would make you ignore it? What would make you read every word?
  - Is there content here you'd act on clinically? What's missing? What's noise?

### The "would you change behavior" question (3–4 min)
- If a facility started sending these on a regular cadence, what would change in your week?
- Would it replace any current touchpoint (calls from the facility, EHR notes, etc.)?
- Where would you store / reference these? Just email? Snip into the EHR? Forget after reading?

### Trust + disclosure (2 min)
- This is AI-summarised from caregiver shift notes — does that change whether you'd trust it / read it / act on it?
- What disclosures or signals would matter to you (e.g., "edited by a human reviewer," "based on N notes over X days")?

### Wrap (2 min)
- Anything else you'd want from a tool like this?
- Anyone else you'd recommend I talk to?
- Thanks. Offer to share what I learn.

## Synthesis (fill in as interviews complete)

### Interview 1 — {{name}}, {{role}}, {{date}}
- **Top quote:**
- **Would they open?**
- **In what scenarios?**
- **What would make them ignore?**
- **Trust signal needed?**
- **Acted-on content vs. noise?**

### Interview 2 — {{name}}, {{role}}, {{date}}
- _(same template)_

### Interview 3 — {{name}}, {{role}}, {{date}}
- _(same template)_

### Interview 4 — {{name}}, {{role}}, {{date}}
- _(same template)_

### Interview 5 — {{name}}, {{role}}, {{date}}
- _(same template)_

## Cross-cut: ranked jobs-to-be-done

Fill in after all interviews, ranked by frequency × intensity of the underlying need:

1. _(top job — what is the clinician actually trying to accomplish that the share helps with?)_
2.
3.
4.
5.

## Cross-cut: dealbreakers

What did clinicians say would make them never use it?

- _e.g., "I won't click links in unverified emails"_
- _e.g., "AI content without a human reviewer signature isn't trustable"_

## Decision (fill in at end of window)

**Date:**

**Pilot metrics snapshot (from `clinician-share-metrics.sql`):**
- Shares created in window:
- Shares opened: ___ / ___ (___%)
- Median hours-to-first-open:
- Shares per resident (top 5):

**Admin interview snapshot (from `admin-interviews-2026-05.md`):**
- Times admins used share in last 4 weeks (median across pilot):
- Would they miss it if removed?

**Decision:**
- [ ] **Strong yes — invest more.** ≥3/5 clinicians would open and act in recurring scenarios; pilot open-rate ≥50%; admins use ≥1×/month/resident.
- [ ] **Strong no — deprioritise.** Clinicians describe as "nice but wouldn't read"; open-rate <25%; admins barely recall using it.
- [ ] **Mixed — keep as-is, don't deepen.** Some scenarios resonate but most don't; open-rate 25–50%; admins use for marketing/audit but not daily. Focus next sprint on caregiver loop.

**Rationale (2–3 sentences with the strongest quote and metric that drove the call):**
