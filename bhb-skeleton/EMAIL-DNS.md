# Email authentication for backhomebuddy.ng

**This is the one item on the fix list that no amount of code can close.** The app
now sends reliably and records every send outcome (see "Verifying" below), but
whether a message reaches an inbox is decided by DNS records on your domain, not
by the application.

Since Gmail and Yahoo's February 2024 bulk-sender rules, a domain sending
transactional mail without SPF, DKIM **and** DMARC gets filtered aggressively —
often silently, with no bounce. That matches the "client says he never received
it" pattern exactly.

DNS for backhomebuddy.ng is at Cloudflare, so all of this happens in
**Cloudflare → your domain → DNS → Records**.

---

## Before you start

Open **Resend → Domains → backhomebuddy.ng**. Resend generates the exact record
values for *your* domain — in particular the DKIM public key, which is unique to
you and which I cannot supply. Everything below tells you *what* to add and *why*;
the actual values come from that page. Copy them, don't retype them.

If `backhomebuddy.ng` isn't listed there yet, add it (Add Domain → enter the
domain → choose the region closest to your users) and Resend will show you the
records.

---

## The four records

### 1. DKIM — cryptographic signature (Resend gives you this)

| Field | Value |
|---|---|
| Type | `TXT` |
| Name | `resend._domainkey` |
| Content | the long `p=MIGfMA0...` string from Resend — copy it whole |
| TTL | Auto |
| Proxy | N/A (TXT records are never proxied) |

This is what lets receiving servers prove the message really came from you and
wasn't altered. **This is the single most important record.** The value is long;
paste it in one piece with no line breaks or added spaces.

### 2. SPF — who is allowed to send

Resend will show you an SPF record to add. If you're verifying the **root**
domain (which you are — `EMAIL_FROM` is `notifications@backhomebuddy.ng`), and
you have **no existing SPF record**, add:

| Field | Value |
|---|---|
| Type | `TXT` |
| Name | `@` |
| Content | `v=spf1 include:amazonses.com ~all` |

**Check first whether an SPF record already exists** — this is where people break
their mail. Run:

```
nslookup -type=txt backhomebuddy.ng 8.8.8.8
```

- **No `v=spf1` line comes back** → add the record above.
- **A `v=spf1` line already exists** → do **not** add a second one. A domain may
  have only one SPF record; two means both fail. Merge instead, by adding the
  include into the existing record before the `all` mechanism. For example, if
  you currently have `v=spf1 include:spf.protection.outlook.com -all`, it becomes
  `v=spf1 include:spf.protection.outlook.com include:amazonses.com -all`.

Note the `~all` (softfail) rather than `-all` (hardfail). Start soft. Once you've
confirmed for a few weeks that nothing legitimate is failing, tighten to `-all`.

### 3. MX for bounce handling (only if Resend asks for it)

Resend's setup page may show an MX record on a `send` subdomain, used for bounce
and complaint feedback:

| Field | Value |
|---|---|
| Type | `MX` |
| Name | `send` |
| Content | the `feedback-smtp.<region>.amazonses.com` host Resend shows |
| Priority | `10` |

This is on the **`send` subdomain only**. It does not touch the MX records that
deliver mail to your actual inboxes — leave those exactly as they are.

### 4. DMARC — the policy that ties it together

| Field | Value |
|---|---|
| Type | `TXT` |
| Name | `_dmarc` |
| Content | `v=DMARC1; p=none; rua=mailto:dmarc@backhomebuddy.ng; fo=1` |

`p=none` means "don't reject anything yet, just report". Start here. It's the
record's *presence* that satisfies the Gmail/Yahoo requirement, and the reports
tell you whether your alignment is actually working before you enforce anything.

Make sure `dmarc@backhomebuddy.ng` exists as a real mailbox or alias, or the
reports go nowhere.

**After 2–4 weeks** of clean reports, tighten in stages:

```
v=DMARC1; p=quarantine; pct=25; rua=mailto:dmarc@backhomebuddy.ng; fo=1
```

then `pct=100`, then `p=reject`. Don't jump straight to `p=reject` — if
something legitimate isn't aligned, you'll silently lose real mail.

---

## Verifying it worked

Give DNS 15–30 minutes, then:

**1. Confirm the records are live:**
```
nslookup -type=txt resend._domainkey.backhomebuddy.ng 8.8.8.8
nslookup -type=txt backhomebuddy.ng 8.8.8.8
nslookup -type=txt _dmarc.backhomebuddy.ng 8.8.8.8
```

**2. Confirm Resend agrees.** The Resend Domains page should flip the domain to
**Verified**. Until it does, nothing else matters.

**3. Send yourself a real one.** Admin → Notification Settings → the test-email
box at the top. Send to a Gmail address, then in Gmail open the message →
⋮ → **Show original**. You want three lines reading `PASS`:

```
SPF:   PASS
DKIM:  PASS
DMARC: PASS
```

Any `FAIL` or `NEUTRAL` tells you which record to revisit.

**4. Confirm the app's side.** In Supabase SQL editor:

```sql
select created_at, detail
from audit_log
where action = 'email_send'
order by created_at desc
limit 50;
```

Every essential email now writes a row here, plus every failure of any kind.
`sent: true` means Resend accepted the message — so if it still didn't arrive,
the problem is DNS or spam filing, not the app. `sent: false` with a `reason`
means it never left, and the reason says why.

That query is what turns "the client says he never got it" into a fact.

---

## What to expect

Deliverability doesn't snap to perfect the moment the records go in. Reputation
builds over days of consistent, authenticated sending. But the records are the
precondition — without them, no amount of good behaviour helps.
