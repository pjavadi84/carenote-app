# Facility admin interviews — does the clinician share solve a real problem?

**Window:** 2026-05 (same as clinician interviews)
**Owner:** Pouya
**Companion to:** `docs/research/clinician-interviews-2026-05.md`. Together with pilot metrics in `clinician-share-metrics.sql`, this drives the go/no-go on further clinician-share investment.

## Why we're talking to admins too

Clinicians tell us whether the feature has clinical value to *them*. Admins tell us whether it solves a problem they actually *have*. Both matter — a feature can be clinically valuable but never used (admin forgets it exists), or heavily used but provide no clinical lift (admin sends them because it looks proactive). The intersection is what we want.

## Targets

The **first 2–3 pilot facility admins**. No need to recruit broadly — these are people you already have a relationship with and who have actual usage to reflect on.

## Format

- 15 min, voice call (no video needed)
- Explicit framing: "Trying to figure out what to build next; not a sales call; your honest answer is more useful than the polite one."
- Best timing: end of a shift transition, or first thing in the morning before the floor gets busy.

## Interview script

### Preamble (1 min)
- Thank them. Frame the question.
- "I'm trying to decide whether to keep building on the clinician-share feature or focus on the caregiver/documentation side. The pilot data tells me one thing; I want your gut answer too."

### Last-month usage (5 min)
- In the **last 4 weeks**, how many times did you use the "share with clinician" feature? (Get a number — even rough.)
- Walk me through the **last time** you used it. What were you trying to accomplish? What happened after?
- Did the doctor open it? Did they say anything? Did anything change clinically?

### The "missing" question (3 min)
- In the same 4 weeks, how many times did you wish you could send a doctor a summary but *didn't*? Why didn't you?
  - Forgot the feature existed?
  - Doctor wouldn't read it?
  - Wrong recipient (no email on file)?
  - Other?
- Of those, how many would have changed care if the doctor had received it?

### The "if we removed it" question (3 min)
- If we removed the clinician share entirely tomorrow, what would break in your workflow? What would you do instead?
- (If they say "nothing would break") — is there anything about it you'd genuinely miss?

### The "keep one feature" question (2 min)
- Of all the things Kinroster does — voice notes, structured shift notes, family updates, clinician share, PDF export, audit log — which **one** would you keep if you could only keep one?
- Which one is the reason you keep paying / would keep paying?

### Wrap (1 min)
- Anything you'd want me to build next that we haven't talked about?
- Thanks.

## Synthesis (fill in as interviews complete)

### Admin 1 — {{facility name}}, {{date}}
- **Times used in last 4 weeks:**
- **Last-use scenario:**
- **Times they wished they could send but didn't:**
- **If removed, what breaks:**
- **Keep-one-feature pick:**
- **Top quote:**

### Admin 2 — {{facility name}}, {{date}}
- _(same template)_

### Admin 3 — {{facility name}}, {{date}}
- _(same template)_

## Cross-cut

**Median uses-per-month across admins:**

**Median wished-could-send-but-didn't:**

**Keep-one-feature distribution:**
- Caregiver voice notes / structured docs: ___
- Family updates: ___
- Clinician share: ___
- PDF export: ___
- Audit log / compliance: ___

**Strongest signal:** _(what one sentence captures what the admins actually felt about this feature?)_

## Feeds into

The decision section at the bottom of `clinician-interviews-2026-05.md`. Both interview synthesis blocks plus the pilot metrics combine into a single go/no-go/hold call.
