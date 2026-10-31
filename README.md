# Earthclique AMC

On-demand IT, network and CCTV support for businesses. A company raises a ticket, nearby verified engineers' phones ring, one accepts, travels to site, starts with the company's OTP, fixes it and closes with proof.

For larger planned projects (e.g. 70 CCTV cameras, a server room), companies post a **project requirement**; Earthclique checks it and sends it to verified, subscribed vendors in that state, who ask questions and submit itemised quotes the company compares and awards (spec §14).

Product and technical spec: [docs/SPEC.md](docs/SPEC.md).

## Repo layout

```
apps/api        Fastify API, dispatch engine (BullMQ), WebSocket, engineer simulator
apps/web        Next.js 16 — company portal (/app) and ops console (/admin)
apps/engineer   Flutter Android app for engineers (see its README)
packages/db     Drizzle schema, migrations, seed (Postgres + PostGIS)
packages/shared Ticket state machine, categories, zod schemas, event types
```

## Run locally

Requirements: Node 24, pnpm 10, Docker.

```bash
pnpm install
```

```bash
cp .env.example .env    # then set JWT_SECRET (openssl rand -hex 32)
```

```bash
pnpm db:up              # Postgres+PostGIS on :5433, Redis on :6380
```

```bash
pnpm db:migrate && pnpm db:seed
```

```bash
pnpm dev                # API on :4000, web on :3001
```

Seeded dev accounts (values in `.env.example`):

| Who | Where | Login |
|-----|-------|-------|
| Ops admin | http://localhost:3001/admin/login | `admin@earthclique.test` / `admin12345` |
| Demo company | http://localhost:3001/login | `demo@acme.test` / `demo12345` |
| Demo vendors | http://localhost:3001/vendor/login | `vendor@netsecure.test` / `vendor12345` (CCTV/network/servers in Gujarat, Maharashtra, Rajasthan), `priya@datacore.test` / `vendor12345` (servers/data centre, all India), `arjun@quickfix.test` / `vendor12345` (pending verification) |
| Demo engineers | engineer app / simulator | phones `9000000001` (PC, network), `9000000002` (PC, CCTV), `9000000003` (network, CCTV) — OTP is printed by the API and returned as `devCode` in dev |

The demo site and engineers are placed around `SEED_LAT`/`SEED_LNG` (default Ahmedabad).

## Try the dispatch loop without a phone

The simulator behaves like an engineer's phone: logs in, goes online, listens for rings.

```bash
pnpm simulate:engineer --phone 9000000002 --accept --drive
```

```bash
pnpm simulate:engineer --phone 9000000001 --decline
```

Then raise a Windows/PC ticket as the demo company. Watch the ring, the accept, and the engineer moving on the map. Read the start code off the ticket page to continue with the API or the app.

## Try the quotation flow

1. Sign in as the demo company → **Projects → Post a requirement** (e.g. CCTV, 70 cameras; the demo site is in Gujarat).
2. Sign in as ops → **Projects** → approve it. Matching vendors are emailed (printed in the API log in dev).
3. Sign in as `vendor@netsecure.test` → the requirement appears → ask a question, submit a quote.
4. Back as the company → compare, shortlist (reveals contact details both ways), request a revision, award.

## Checks

```bash
pnpm typecheck && pnpm lint && pnpm build
```

## Phase 1 limits (known, by design)

- **Email**: vendor and company notifications are printed to the API log (`[email:console]`). Wire SendGrid/Resend before launch.
- **Vendor subscriptions**: ops sets the end date by hand in Ops → Vendors. Razorpay is Phase B.
- **SMS**: login OTPs are printed to the API log (`SMS_PROVIDER=console`). Real SMS needs DLT template registration (MSG91 / Twilio Verify).
- **Background rings**: need a Firebase project (`FIREBASE_SERVICE_ACCOUNT` on the API, dart-defines in the app). Without it, rings arrive over WebSocket only while the app is running.
- **File storage**: local disk (`apps/api/uploads`). Move to S3/R2 before deploying.
- **Maps**: OpenStreetMap public tiles, fine for development only; use a tile provider in production.
- **Payments**: amounts are recorded and ops marks tickets paid. Razorpay is Phase 2.
- **Pricing and commission**: visit fees are placeholders, editable in Ops → Dispatch settings. Engineer "earnings" show job value, before any commission.
- **Company users** see all of their company's tickets (no per-site restriction yet).
