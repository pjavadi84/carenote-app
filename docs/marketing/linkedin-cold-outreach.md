# LinkedIn cold outreach — direct messages

> **Drafting in batch?** Use the [`/lead-batch`](../../.claude/skills/lead-batch/SKILL.md) Claude Code skill — paste 5–15 leads, get back personalised drafts in seconds, review and send manually. Output lands in [`outreach-batches/`](./outreach-batches/) (gitignored). The skill uses the templates below — this doc remains the canonical source.

**Goal:** 10 personalised messages per day, ~50/week. Expect 15–25% reply rate. Of replies, ~30% convert to a call. Of calls, ~30% convert to pilot. Math: 50 messages → 10 replies → 3 calls → 1 pilot signup.

**Rules:**
1. **Personalise the first sentence every time.** Reference one specific thing about their facility, a recent post, an award, a location-specific detail. Without that, you're spam.
2. **Keep it under 80 words.** Long messages don't get read on mobile.
3. **One clear ask.** Not "let me know what you think" — "are you open to a 15-min call next week?"
4. **No links in the first message.** Sound human, not like a campaign. Drop the kinroster.com link in the second exchange when they reply.
5. **Don't follow up more than twice.** One 5-day follow-up, one 14-day follow-up, then drop it. Move on.

---

## US — English templates

### Template 1 — owner/admin of a small RCFE (most common case)

> Hi {{first_name}}, I noticed you run {{facility_name}} in {{city}} — a 6–20 bed RCFE.
>
> I'm working with a few small facility owners in California on a tool that takes the 15-minute paperwork tax off every shift. Caregivers speak a 90-second summary, AI turns it into a structured, audit-ready note. Families get opt-in updates; the resident's doctor can pull a summary before a visit.
>
> Free pilot for five facilities this round. Would 15 minutes next week make sense to see if it fits?

**Personalisation slots to fill:**
- `{{first_name}}` — their first name, not "there"
- `{{facility_name}}` — exact facility name as they brand it
- `{{city}}` — adds local credibility
- Bonus: replace "I noticed you run X" with something more specific if they have a recent LinkedIn post (e.g., "Saw your post about the new state survey changes — couldn't agree more.")

### Template 2 — admin who has posted about state audits or compliance recently

> Hi {{first_name}}, your post about {{audit_topic}} resonated — small RCFEs are getting squeezed on documentation in a way that the big chains barely feel.
>
> I built a tool specifically for facilities your size. Caregivers speak a 90-second shift summary, it becomes an audit-ready structured note, families get opt-in updates without the admin doing extra work. HIPAA + audit log built in.
>
> Pilot is free for five facilities this round. Worth a 15-min call?

### Template 3 — admin who is openly hiring or expanding

> Hi {{first_name}}, saw you're {{hiring/expanding}} at {{facility_name}} — congrats. The documentation load on new caregivers is the silent friction when you scale a 6–20 bed RCFE.
>
> I built a tool that lets new staff speak a 90-second shift summary instead of writing 15 min of paperwork. Onboarding gets shorter, audit posture gets better, families stay informed.
>
> Free pilot for five facilities this round. Open to a 15-min call next week?

### Template 4 — placement consultant / geriatric care manager

> Hi {{first_name}}, I'm building Kinroster — a documentation tool for small RCFEs (6–20 beds). I'd love your perspective on what separates a facility you'd recommend to a family from one you wouldn't, especially around how they communicate with families and doctors.
>
> Not pitching anything — just trying to make sure I'm building the right thing. 15 minutes on Zoom this week?

(This one is intentionally non-salesy because consultants hate being sold to but love being consulted. The relationship matters more than the immediate convert.)

---

## Follow-up sequence

If no reply after **5 business days:**

> Hi {{first_name}}, following up on this — I know May is busy. Quick recap: free pilot, 90-second voice-to-structured-note for caregivers, audit-ready output. Even if not now, would love your take on whether this is something a facility your size would use. Two sentences is plenty.

If no reply after **14 business days from the original:**

> No worries if not a fit — closing the loop. Best of luck with {{facility_name}}, and please reach out if anything changes.

(That's it. Don't message a third time. The polite "closing the loop" message gets ~10% conversion because it removes the pressure.)

---

## Taiwan — 繁體中文 templates

For when you switch to Taiwan outreach (after the first US pilot).

**Channels in Taiwan:** primarily LINE and Facebook. LinkedIn penetration is low in Taiwan elder-care administration. The templates below work for LINE / Facebook messenger; tone is slightly more formal than US.

### Template TW-1 — facility owner / 主任

> {{稱呼}}您好,我注意到您經營{{facility_name}}已經{{years}}年了,真的很不容易。
>
> 我目前在為6-20床的長照機構開發一套協助工具:照服員只要花90秒口述當班觀察,AI就能整理成符合長照法規範的結構化紀錄。家屬可選擇接收定期更新,醫師看診前也能先取得摘要。
>
> 本月有5家機構可參加免費試用。是否方便下週15分鐘線上會議,聊聊看是否合適?

### Template TW-2 — 長照協會 / 公會聯絡人

> {{稱呼}}您好,我目前在開發一套針對小型長照機構(6-20床)的紀錄工具,主要解決照服員每班花15分鐘寫紙本紀錄、家屬資訊不對稱、評鑑文件準備耗時的問題。
>
> 因為您在{{org_name}}長期推動小型機構的權益,想跟您15分鐘了解一下,從業者角度最迫切需要的是什麼。沒有要推銷,單純想確保我做的東西是真的有用。

---

## Daily workflow (paste into your morning routine)

1. Open LinkedIn, search "RCFE administrator [your state]" + filter by company size 1–10.
2. Pick 10 results you haven't messaged. Open each profile in a new tab.
3. For each: read the latest 2–3 posts, find one personalisation hook (place / recent post / hiring / award).
4. Pick the template above that fits. Personalise the first sentence.
5. Send. Don't wait. Move to the next.
6. Log in your tracker (Notion / spreadsheet): name, facility, date, template used, status = "sent".

**Time budget:** 45 minutes for 10 messages. Block it daily at 8am before the day gets noisy.

**Tracking columns:**
- Name
- Facility
- City / state
- LinkedIn URL
- Date sent
- Template used
- Reply (Y/N)
- Status (sent / replied / call scheduled / pilot agreed / dropped)
- Notes

When response patterns emerge after a week, kill the templates that aren't working and double down on the ones that are.
