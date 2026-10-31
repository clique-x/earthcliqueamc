# Earthclique AMC — Product & Technical Spec (v0.1)

_Status: Phase 1 built · Written 2026-10-30_

On-demand and contract (AMC) IT support for businesses. A company reports an issue (Windows/PC, network, CCTV), nearby verified engineers get a ringing job alert on their phone, one accepts, travels to site with the right tools, fixes it, and closes the job with OTP + photo proof.

---

## 1. Assumptions (open decisions — change these and the spec adjusts)

| # | Decision | Default assumed in this spec |
|---|----------|------------------------------|
| A1 | Engineer model | **Managed marketplace**: independent engineers sign up, but Earthclique verifies (KYC + skill check) and approves them before they get jobs. Works for in-house staff too (flag `employment_type`). |
| A2 | Customer channel | **Web portal** (Next.js, mobile-responsive) for companies in v1. Native customer app later. |
| A3 | Launch geography | **Single city**, set via config (`DISPATCH_CITY`, service-area polygon). |
| A4 | Engineer platform | **Android first** (Flutter). iOS later — see §6.3 for why. |
| A5 | Payments in v1 | Visit charge is **recorded**, collected offline; admin marks paid. Razorpay in Phase 2. |

---

## 2. Users & roles

| Role | Where | Can do |
|------|-------|--------|
| **Company Admin** | Web portal | Register company, add sites (addresses), add users, raise/track tickets, rate engineers, view history |
| **Company User** | Web portal | Raise/track tickets for their site |
| **Engineer** | Android app | Go online/offline, receive job rings, accept/decline, navigate, OTP start/close, upload photos, view earnings |
| **Ops Admin** (Earthclique) | Web portal `/admin` | Approve engineers, view live map of jobs/engineers, manually assign, handle escalations, set pricing |

---

## 3. Service catalogue (v1)

Categories map to engineer skills. An engineer only gets rings for categories they're approved for.

| Category | Example issues | Skill tag |
|----------|----------------|-----------|
| Windows / PC | Won't boot, slow, BSOD, OS install, virus, printer driver | `pc` |
| Network | No internet, Wi‑Fi down, switch/router config, LAN cabling | `network` |
| CCTV | Camera offline, DVR/NVR not recording, remote view setup | `cctv` |

Each category has a short guided triage form (3–5 questions + optional photos) so the engineer knows what to bring before accepting.

---

## 4. Core flow — ticket lifecycle

### 4.1 State machine

```
            ┌──────────── CANCELLED (by company, before ARRIVED)
            │
OPEN ──► SEARCHING ──► ASSIGNED ──► EN_ROUTE ──► ARRIVED ──► IN_PROGRESS ──► RESOLVED ──► CLOSED
            │             │                                     │    ▲            │
            │             └─ engineer cancels ─► SEARCHING      │    │            └─ company disputes ─► IN_PROGRESS
            │                                                   ▼    │
            └─ no one accepts after all waves ─► UNASSIGNED     ON_HOLD (awaiting parts / revisit)
                 (ops admin assigns manually)
ASSIGNED / EN_ROUTE ──► REMOTE_RESOLVED ──► CLOSED   (engineer fixed it by phone / remote session)
```

Every transition is written to `ticket_events` (who, when, from → to, metadata) — this is the audit trail and the timeline shown to the company.

### 4.2 Step by step

1. **Raise ticket** — Company user picks site, category, fills triage form, adds photos, sets priority (`normal` / `urgent`). → `OPEN`, then immediately `SEARCHING`.
2. **Dispatch** — wave-based (§5). Selected engineers get a ringing alert with: category, short summary, distance, estimated fee, triage answers.
3. **Accept** — first engineer to accept wins (atomic, §5.3). Others' rings are cancelled. → `ASSIGNED`. Company sees engineer name, photo, rating, phone (masked/relayed in Phase 2).
4. **Call-first** — engineer is prompted to call the contact. If fixed remotely → `REMOTE_RESOLVED` (lower fee).
5. **Start journey** — engineer taps "Start" → `EN_ROUTE`. Live location shared with company every ~10 s; ETA shown.
6. **Arrive + Start OTP** — company contact sees a 4‑digit start OTP on the portal (and via SMS). Engineer enters it → `ARRIVED` → `IN_PROGRESS`.
7. **Work** — engineer adds notes, before/after photos, parts used. Parts above a threshold need company approval in the portal.
8. **Close OTP** — engineer marks done → `RESOLVED`; company contact gets close OTP / "Confirm fixed" button → `CLOSED`. Auto-close after 24 h if no response.
9. **Rate** — both sides rate 1–5 with optional comment.

---

## 5. Dispatch engine

### 5.1 Eligibility

An engineer is eligible for a ticket if all are true:
- `status = approved`, `is_online = true`
- has the ticket's skill tag
- last location heartbeat < 5 min old
- no active job (v1: max 1 concurrent job)
- not already declined/timed‑out on this ticket
- inside the service area

### 5.2 Waves

| Wave | Radius | Max engineers rung | Ring timeout |
|------|--------|--------------------|--------------|
| 1 | 5 km | 5 nearest | 30 s |
| 2 | 10 km | 10 nearest (excluding wave 1) | 30 s |
| 3 | 20 km | all eligible | 45 s |
| — | — | → `UNASSIGNED`, alert ops admin | — |

`urgent` tickets skip to wave 2 sizing. Ranking within a wave: skill match → distance (PostGIS `ST_DWithin` + `<->` KNN) → rating → acceptance rate. All numbers live in a `dispatch_config` table so ops can tune without a deploy.

Wave timers run as delayed jobs in **BullMQ (Redis)**.

### 5.3 Accept race

Accept is a single conditional update — whoever's update affects a row wins:

```sql
UPDATE tickets
SET status = 'ASSIGNED', engineer_id = $1, assigned_at = now()
WHERE id = $2 AND status = 'SEARCHING'
RETURNING id;
```

Zero rows → respond "Job already taken". On success, push a `ring.cancel` to every other engineer in the current wave.

### 5.4 Engineer quality signals

Tracked per engineer: acceptance rate, cancellation-after-accept rate, avg rating, avg response time. Repeated cancellations after accepting → temporary dispatch cooldown (configurable).

---

## 6. Engineer app (Flutter, Android)

### 6.1 Screens
1. Phone OTP login → onboarding (profile, skills, service area, KYC uploads: Aadhaar/PAN photo, selfie) → "Pending approval"
2. **Home**: big Online/Offline toggle, today's jobs, earnings summary
3. **Incoming ring** (full-screen): category, summary, distance, fee, countdown, Accept / Decline
4. **Job detail**: triage answers, photos, site address + contact, Call, Navigate (Google Maps intent), status buttons
5. **Job work**: Start OTP entry, notes, photo capture, parts, Mark done
6. **History & earnings**

### 6.2 Location
- While **online and idle**: heartbeat every 60 s (for dispatch eligibility).
- While **EN_ROUTE**: every ~10 s, streamed over WebSocket.
- While **offline**: no tracking. (Stated clearly in onboarding — required for trust and DPDP Act compliance.)
- Uses an Android foreground service with a persistent notification while online.

### 6.3 The "ring" — what's possible
- Delivered via **FCM high-priority data message** → app shows a notification with a **full-screen intent** + looping ringtone (`FLAG_INSISTENT`), like an incoming call, even on the lock screen.
- **Risk:** since Android 14, `USE_FULL_SCREEN_INTENT` is only auto-granted to calling/alarm apps under Play policy. We must ask the engineer to enable it in onboarding (deep link to the system setting). If not granted, it degrades to a heads-up notification that still rings loudly.
- Battery-optimisation exemption is requested during onboarding (some OEMs — Xiaomi, Oppo, Vivo — kill background apps aggressively).
- **SMS fallback** if the engineer doesn't open the ring within the timeout (Phase 2).
- **iOS** cannot do this without special entitlements (CallKit is for VoIP only; Critical Alerts needs Apple approval). Hence Android first.

---

## 7. Web portal (Next.js)

### Company side (`/app`)
- Sign up (company name, GSTIN optional, admin contact) → add sites → invite users
- Raise ticket (guided form + photos)
- **Live ticket view**: status timeline, engineer card, live map during `EN_ROUTE`, start/close OTP display, parts approval
- Ticket history, filter by site/category/status
- Rate engineer

### Ops admin (`/admin`)
- Engineer approvals queue (view KYC docs, approve/reject, set skills)
- **Live map**: online engineers, active tickets, colour by state
- Unassigned tickets queue → manual assign
- Dispatch config + pricing editor
- Companies list, ticket search, basic reports (tickets/day, avg time-to-accept, avg time-to-resolve)

---

## 8. Data model (Postgres + PostGIS, Drizzle)

```
companies        id, name, gstin, plan (null in v1), created_at
company_users    id, company_id, name, phone, email, role(admin|user), password_hash
sites            id, company_id, label, address, location geography(Point), contact_name, contact_phone

engineers        id, name, phone, photo_url, status(pending|approved|rejected|suspended),
                 employment_type(freelance|staff), skills text[], service_radius_km,
                 is_online, last_location geography(Point), last_seen_at,
                 rating_avg, rating_count, acceptance_rate, fcm_token
engineer_kyc     id, engineer_id, doc_type, file_url, verified_at, verified_by

tickets          id, code (e.g. EC-10421), company_id, site_id, raised_by, category,
                 priority, title, description, triage jsonb, status, engineer_id,
                 start_otp, close_otp, fee_estimate, fee_final,
                 created_at, assigned_at, arrived_at, resolved_at, closed_at
ticket_events    id, ticket_id, actor_type, actor_id, from_status, to_status, meta jsonb, created_at
ticket_media     id, ticket_id, uploaded_by, kind(issue|before|after), file_url
ticket_parts     id, ticket_id, name, qty, unit_price, approved_by, approved_at
dispatch_offers  id, ticket_id, engineer_id, wave, sent_at, responded_at,
                 response(accepted|declined|timeout|cancelled)
location_pings   engineer_id, ticket_id null, location, recorded_at   (EN_ROUTE only, retained 30 days)
ratings          id, ticket_id, from_type, to_type, score, comment
dispatch_config  key, value jsonb
admins           id, name, email, password_hash
```

Indexes: GiST on `engineers.last_location` and `sites.location`; `tickets(status)`, `tickets(company_id, created_at)`, `dispatch_offers(ticket_id)`.

Job start/close OTPs are stored in plain text because the company portal has to display them; they are never returned on engineer endpoints and are cleared when a ticket is re-dispatched. Engineer login OTPs are stored hashed with a 5-minute expiry and attempt limit.

---

## 9. API outline (Fastify + Zod)

```
POST /auth/engineer/otp/request · /verify
POST /auth/company/login · /signup
POST /auth/admin/login

# Company
GET/POST       /sites
POST           /tickets                    raise ticket → starts dispatch
GET            /tickets, /tickets/:id      list / detail + events
POST           /tickets/:id/cancel
POST           /tickets/:id/confirm        close confirmation
POST           /tickets/:id/parts/:pid/approve
POST           /tickets/:id/rating

# Engineer
POST           /engineer/online            { online, location }
POST           /engineer/location          heartbeat
POST           /engineer/fcm-token
POST           /offers/:id/accept · /decline
POST           /tickets/:id/start-journey | /arrive (otp) | /resolve | /remote-resolve | /hold
POST           /tickets/:id/media, /parts
GET            /engineer/jobs, /engineer/earnings

# Admin
GET            /admin/engineers?status=pending
POST           /admin/engineers/:id/approve | /reject
GET            /admin/live                 engineers + active tickets snapshot
POST           /admin/tickets/:id/assign
GET/PUT        /admin/dispatch-config

# Real-time (WebSocket, authenticated)
ticket:{id}      status changes, engineer location (company + admin)
engineer:{id}    ring, ring.cancel, job updates
admin:live       all changes
```

File uploads: presigned URLs to S3-compatible storage (Cloudflare R2 or AWS S3).

---

## 10. Stack & repo layout

| Layer | Choice |
|-------|--------|
| Monorepo | pnpm + Turborepo |
| API | Fastify, Zod, Drizzle ORM |
| DB | PostgreSQL 16 + PostGIS (Neon or self-hosted) |
| Queue / timers | Redis + BullMQ |
| Real-time | WebSocket (`@fastify/websocket`) with Redis pub/sub for multi-instance |
| Web | Next.js (App Router), shadcn/ui, Tailwind v4, MapLibre or Google Maps JS |
| Engineer app | Flutter, Riverpod, go_router, Hive (offline cache), firebase_messaging, flutter_local_notifications, geolocator |
| Push | Firebase Cloud Messaging |
| SMS / OTP | MSG91 or Twilio Verify (India needs DLT template registration — start early) |
| Storage | Cloudflare R2 |

```
earthclique-amc/
├── apps/
│   ├── api/          Fastify server, dispatch workers
│   ├── web/          Next.js — company portal + /admin
│   └── engineer/     Flutter app (not a pnpm workspace member)
├── packages/
│   ├── db/           Drizzle schema, migrations, seed
│   └── shared/       Zod schemas, ticket state machine, shared types
└── docs/
    └── SPEC.md
```

The ticket state machine lives in `packages/shared` as a single transition table that both the API and web import, so allowed transitions are defined once.

---

## 11. Security & compliance

- Role-based auth on every route; companies only see their own tickets/sites; engineers only see tickets offered/assigned to them.
- Site address and contact phone revealed to engineer **only after accept**.
- KYC documents in private bucket, short-lived signed URLs, admin-only.
- Location collected only while online; purpose stated in onboarding (DPDP Act 2023).
- Rate limits on OTP endpoints. Login OTPs hashed; job OTPs visible only to the company and ops.
- Secrets via env only; `.env.example` committed, `.env` git-ignored.

---

## 12. Phases

### Phase 1 — MVP (dispatch loop works end to end)
- Monorepo scaffold, DB schema + PostGIS, seed data
- Auth (engineer phone OTP, company + admin email/password)
- Company: sites, raise ticket, live ticket view
- Dispatch engine with waves + atomic accept
- Engineer app: onboarding, online toggle, ring, accept, job flow with OTPs + photos
- Live tracking during `EN_ROUTE`
- Admin: engineer approval, live map, manual assign
- Ratings

**Done when:** a company raises a ticket on the web, a test engineer's Android phone rings, they accept, the company watches them move on the map, OTP start/close works, and the ticket shows a full timeline.

### Phase 2 — AMC contracts & money
- AMC plans with SLA response targets + SLA breach alerts
- Asset registry per site (PCs, routers, DVRs, cameras) linked to tickets
- Scheduled preventive-maintenance visits
- Razorpay: per-visit payments, AMC subscriptions, engineer payouts
- Invoices (GST)
- SMS fallback for rings, masked calling

### Phase 3 — Scale
- Customer mobile app, iOS engineer app
- In-app remote session hand-off
- Parts inventory, multi-city, engineer tiers/levels
- Analytics dashboards for companies (uptime, issue trends)

---

## 13. Open questions

1. Engineer model — freelance marketplace, in-house staff, or both? (A1)
2. Launch city and initial service radius? (A3)
3. Pricing: flat visit fee per category, or base + per-hour? Who sets it — platform or engineer?
4. Commission model for freelance engineers (% per job vs subscription)?
5. Do companies need multi-level approval (e.g. branch user raises, HQ admin approves) before dispatch?
6. Brand name for the apps — "Earthclique AMC" or something customer-facing?

---

## 14. Project quotations (RFQ marketplace) — added 2026-10-31

Companies post large planned projects (e.g. 70 CCTV cameras, a 40-PC server setup, a data centre). Verified, subscribed vendors across India receive the ones that match them, ask questions, and submit itemised quotes. The company compares quotes side by side and awards one. This is separate from the instant-dispatch tickets in §4; it reuses company accounts, sites, the ops console, uploads and real-time events.

### 14.1 Decisions taken (defaults chosen by Claude on 2026-10-31; change here if wrong)

| # | Decision | Default |
|---|----------|---------|
| Q1 | Who pays | Companies post requirements free. Vendors need an active Earthclique subscription to receive requirements and quote. Phase A: ops sets the subscription end date by hand; Razorpay in Phase B. |
| Q2 | Quote cap | Each requirement accepts at most `rfq.maxQuotes` quotes (default 8); the best-matched vendors are invited (up to `rfq.maxInvites`, default 30) and the first to submit get the slots. Both are editable in Ops → Settings. |
| Q3 | Earthclique bidding | Off by default (`rfq.earthcliqueBids = false`). Earthclique's own vendor account, if any, is treated like every other vendor and is flagged to the company as "Earthclique" when the switch is on. |
| Q4 | Account types | Vendors are a separate account type (`vendors` + `vendor_users`), with their own portal at `/vendor`. A business that is also a company or an engineer uses separate logins for now. |
| Q5 | Visibility | Vendors see the requirement, company name and city, but the site address and contact person are hidden until the company shortlists or awards them. Vendors never see each other's quotes, only how many slots are left. Q&A answers are shown to every invited vendor so no vendor gets private information. |
| Q6 | Moderation | Every requirement is checked by ops before vendors see it (fake and price-fishing requirements are common on lead marketplaces). |
| Q7 | Notifications | Email + in-portal real-time for vendors and companies (planned work, days to respond — not a ringing phone). WhatsApp in Phase B. Dev uses a console email provider. |

### 14.2 Roles

| Role | Where | Can do |
|------|-------|--------|
| Company admin / user | `/app/projects` | Post requirement with attachments, answer vendor questions, compare quotes, shortlist, request revision, award, cancel |
| Vendor admin / member | `/vendor` | Register vendor, upload verification documents, manage team, see matched requirements, ask questions, save draft and submit itemised quotes, withdraw |
| Ops admin | `/admin/vendors`, `/admin/projects` | Verify vendors, set subscription dates, suspend, approve or reject requirements, see every quote, edit RFQ settings |

### 14.3 Project categories and structured specs

Categories: `cctv` (CCTV & surveillance), `network` (networking & cabling), `servers` (servers & workstations), `datacenter` (data centre & server room), `other`. Each has a structured spec form (defined once in `packages/shared/src/project-categories.ts`) — e.g. CCTV: camera count, camera types, indoor/outdoor, resolution, recording days, remote viewing, cabling needed, existing system. Structured specs are what make quotes comparable.

Common fields: title, description, site (gives the state/city used for matching), quote deadline (2–60 days), optional start-by date, optional budget range, site-survey allowed, attachments (floor plans, photos).

### 14.4 Lifecycle

```
Requirement:  SUBMITTED ─ops approve─► OPEN ─company awards─► AWARDED
                 │                       ├─ company/ops cancel ─► CANCELLED
                 └─ ops reject ─► REJECTED
                                         └─ deadline passes with no quotes ─► EXPIRED

Quote:  DRAFT ─submit─► SUBMITTED ─► SHORTLISTED ─► AWARDED
                            │             │
                            └─────────────┴─► REVISION_REQUESTED ─resubmit (version+1)─► SUBMITTED
                            └─ company rejects ─► REJECTED      └─ vendor withdraws ─► WITHDRAWN
```

On award, every other submitted/shortlisted quote becomes REJECTED and those vendors are told "not selected". After the deadline no new quotes are accepted; the company can still decide.

### 14.5 Matching (on ops approval)

Eligible vendor = `status = approved` AND subscription active AND requirement category ∈ vendor categories AND (requirement state ∈ vendor states OR vendor serves all India). Ranked by rating, then recent activity. The top `maxInvites` are invited (`requirement_vendors` rows + email + real-time). Quote submission is refused once `maxQuotes` quotes are in (submitted/shortlisted/revision_requested/awarded).

### 14.6 Quote structure

Line items: kind (material / labour / service / other), description, brand & model, quantity, unit, unit price (₹), GST %. Server computes subtotal, GST and total. Plus: delivery & installation timeline (days), warranty (months), payment terms, validity, notes, "site survey needed before final price" flag. Versioned: a revision creates version n+1 and keeps the previous version's totals in the audit trail.

### 14.7 Data model additions

```
vendors               id, name, gstin, status(pending|approved|rejected|suspended), rejection_reason,
                      categories project_category[], states text[] ('ALL' = whole of India), city,
                      description, website, certifications text[], team_size, founded_year,
                      subscription_until, rating_avg, rating_count, is_earthclique bool, created_at
vendor_users          id, vendor_id, name, email, phone, role(admin|member), password_hash
vendor_documents      id, vendor_id, doc_type(gst|pan|registration|certification|other), file_key, verified_at, verified_by
requirements          id, number (RQ-xxxxx), company_id, site_id, raised_by, category, title, description,
                      spec jsonb, budget_min, budget_max, quote_deadline, start_by, survey_allowed,
                      status, rejection_reason, state, city, max_quotes, awarded_quote_id,
                      created_at, approved_at, closed_at
requirement_attachments id, requirement_id, file_key, name, uploaded_by
requirement_vendors   requirement_id, vendor_id, invited_at, viewed_at, declined_at, match_rank
requirement_questions id, requirement_id, vendor_id, question, answer, asked_at, answered_at, answered_by
requirement_events    id, requirement_id, actor_type, actor_id, from_status, to_status, note, meta, created_at
quotes                id, requirement_id, vendor_id, version, status, subtotal, gst_total, total,
                      timeline_days, warranty_months, payment_terms, valid_until, notes, survey_required,
                      revision_note, submitted_at, decided_at, created_at
quote_items           id, quote_id, sort, kind, description, brand_model, qty, unit, unit_price, gst_percent
platform settings     key 'rfq' in dispatch_config: { maxQuotes, maxInvites, minDeadlineDays, maxDeadlineDays, earthcliqueBids }
```

### 14.8 Phases

- **A (built now):** vendor sign-up and verification, subscription set by ops, requirement forms per category, ops moderation, matching and invites, Q&A, draft/submit/revise itemised quotes, comparison, shortlist/revision/award/reject, email (console) + real-time notifications.
- **B:** Razorpay vendor subscriptions with plan limits, WhatsApp alerts, PDF quote export, site-visit booking, vendor ratings after project completion.
- **C:** project milestones, escrow payments through Earthclique, vendor win-rate profiles, multi-site requirements.
