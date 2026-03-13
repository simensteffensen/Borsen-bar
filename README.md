# TaxMate

**Production-grade crypto tax and portfolio accounting platform for Norway.**

TaxMate is a serious accounting engine for digital assets. It imports all crypto activity from exchanges, wallets, and CSV files — normalizes, classifies, and reconciles transactions — and calculates gains, losses, and income under Norwegian tax rules with a full audit trail.

---

## Overview

### What TaxMate Does

- **Import** transactions from Binance, Coinbase, Kraken, and many more (CSV + API)
- **Normalize** all data into a canonical ledger model
- **Classify** every transaction against Norwegian tax rules (Skatteetaten guidance)
- **Reconcile** transfers between own wallets, bridge pairs, and duplicates automatically
- **Calculate** realized gains/losses (FIFO/HIFO/LIFO), taxable income, and year-end holdings
- **Detect** missing cost basis, unmatched transfers, impossible balance situations
- **Report** tax summaries, disposal reports, and prior-year corrections for Skatteetaten

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS |
| Backend | Next.js Server Actions |
| Database | PostgreSQL + Prisma ORM |
| Auth | Clerk |
| Background Jobs | BullMQ + Redis |
| Charts | Recharts |
| Tables | TanStack Table |
| Price Data | CoinGecko API |
| Arithmetic | Decimal.js (no floating point errors) |

---

## Project Structure

```
taxmate/
├── prisma/
│   ├── schema.prisma          # Full database schema (20+ models)
│   └── seed.ts                # Seed known assets
├── src/
│   ├── app/                   # Next.js App Router pages
│   │   ├── page.tsx           # Landing page
│   │   ├── sign-in/           # Clerk auth pages
│   │   ├── sign-up/
│   │   └── dashboard/
│   │       ├── layout.tsx     # Sidebar navigation
│   │       ├── page.tsx       # Workspace list / create
│   │       └── [workspaceId]/
│   │           ├── page.tsx          # Dashboard overview
│   │           ├── transactions/     # Transaction explorer
│   │           ├── holdings/         # Holdings by asset
│   │           ├── tax-lots/         # Cost basis lot viewer
│   │           ├── issues/           # Issue inbox
│   │           ├── reports/          # Tax reports
│   │           ├── imports/          # Data sources
│   │           └── settings/         # Workspace settings
│   ├── lib/
│   │   ├── db.ts              # Prisma client singleton
│   │   ├── utils.ts           # Formatting utilities (NOK, amounts, dates)
│   │   ├── types/             # Core domain types (decoupled from Prisma)
│   │   ├── engines/
│   │   │   ├── norwegian-tax-rules.ts  # Tax rules engine (versioned by year)
│   │   │   ├── cost-basis.ts           # FIFO/HIFO/LIFO lot tracking
│   │   │   ├── pricing.ts              # Historical NOK pricing with fallbacks
│   │   │   ├── reconciliation.ts       # Transfer detection, duplicate detection
│   │   │   └── classifier.ts           # Transaction type classification
│   │   ├── importers/
│   │   │   └── csv-parser.ts           # Exchange CSV parsers
│   │   └── actions/           # Next.js Server Actions
│   │       ├── workspace.ts
│   │       ├── import.ts
│   │       ├── transactions.ts
│   │       ├── issues.ts
│   │       ├── holdings.ts
│   │       └── reports.ts
│   └── __tests__/
│       └── cost-basis.test.ts # Unit tests for all core engines
```

---

## Core Engines

### Norwegian Tax Rules Engine (`engines/norwegian-tax-rules.ts`)
Versioned, configurable rules for every transaction type:
- `isTaxableDisposal` — does this event trigger capital gains calculation?
- `isTaxableIncomeOnReceipt` — is the received value taxable income?
- `createsTaxLot` / `consumesTaxLot` — cost basis tracking
- `requiresPriceLookup` / `requiresManualReview` — data quality flags
- Override support with audit trail
- Disclaimer strings per uncertain treatment

### Cost Basis Engine (`engines/cost-basis.ts`)
- FIFO, LIFO, HIFO accounting methods
- `Decimal.js` precision — no floating point rounding errors
- Partial disposals across multiple lots
- Graceful handling of missing history (warns, doesn't fabricate)
- Per-disposal `DisposalMatch` records for full audit trail

### Reconciliation Engine (`engines/reconciliation.ts`)
- Own-wallet transfer detection (time + amount proximity matching)
- Bridge out/in pair matching
- Duplicate import detection
- Running balance verification → impossible balance issues

### Pricing Engine (`engines/pricing.ts`)
Fallback hierarchy:
1. CoinGecko direct NOK price
2. USD price × USD/NOK rate
3. Stablecoin 1:1 peg
4. Wrapped token → underlying asset price
5. Estimated (manual input required)

Every price tagged with source + confidence score.

### Classification Engine (`engines/classifier.ts`)
- Provider-specific type maps (Binance, Coinbase, Kraken)
- Generic keyword fallback
- Every classification includes reason + confidence (0–1)
- Unknown types flagged for manual review

---

## Database Schema

Key entities:
- **User** — Clerk auth integration, role-based (individual/accountant/admin)
- **Workspace** — Multi-tenant, per-country tax rules
- **DataSource** — Exchange connections and CSV uploads
- **RawImportRecord** — Original payload preserved forever (audit)
- **Asset** — Normalized asset registry with CoinGecko mapping
- **Account** — Exchange accounts and wallet addresses (is_user_owned flag)
- **CanonicalTransaction** — The normalized ledger (50+ transaction types)
- **TransactionGroup** — Groups multi-leg events (swap, bridge, etc.)
- **TaxLot** — Cost basis per acquisition
- **DisposalMatch** — How each disposal consumes lots (full audit trail)
- **PricePoint** — Historical price cache
- **TaxReport** — Versioned, snapshotted reports (never lost)
- **Issue** — Accounting problems with severity + resolution tracking
- **ManualAdjustment** — User overrides with reason field
- **AuditLog** — Every action logged

---

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Clerk account (free tier works for development)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Add your DATABASE_URL and Clerk keys to .env

# 3. Set up database
npx prisma generate
npx prisma db push

# 4. Seed assets
npm run db:seed

# 5. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Run tests

```bash
npx jest
# or: npx jest --coverage
```

---

## Norwegian Tax Rules

| Transaction Type | Disposal? | Income on Receipt? | Notes |
|-----------------|-----------|-------------------|-------|
| Market buy | No | No | Creates tax lot |
| Market sell | **Yes** | No | Capital gain/loss in NOK |
| Crypto-to-crypto swap | **Yes** | No | Both sides processed |
| Self-transfer (own wallets) | No | No | Cost basis preserved |
| Staking reward | No | **Yes** | Taxable at NOK receipt value |
| Airdrop | No | **Yes** | Taxable, manual review recommended |
| Mining reward | No | **Yes** | Taxable at NOK receipt value |
| Lending interest | No | **Yes** | Taxable ordinary income |
| Bridge out/in (own wallet) | No | No | Cost basis preserved |
| NFT purchase (paid in crypto) | **Yes** | No | Crypto paid = disposal |
| LP deposit/withdrawal | Yes* | No | Uncertain — flagged for review |
| Lost asset / theft | Yes | No | Capital loss, needs documentation |

*LP treatment is disputed under Norwegian tax law. TaxMate flags for review.

---

## MVP Implementation Roadmap

### Phase 1 — Foundation ✅ (current)
- Authentication and workspace management
- CSV import (Binance, Coinbase, Kraken, generic)
- Canonical transaction model + classification
- Own-wallet transfer detection
- FIFO + HIFO cost basis engine
- Issue detection and inbox
- Tax report generation (draft)
- Dashboard, all core pages

### Phase 2 — Production-Ready
- Live CoinGecko pricing integration
- Exchange API connections
- Ethereum/EVM wallet scanning
- PDF/CSV export
- Manual adjustment UI
- Prior-year correction workflow

### Phase 3 — Advanced Features
- Deep DeFi support (LP, yield farming, vaults)
- NFT accounting
- Accountant/advisor multi-client mode
- AI-assisted transaction classification
- Subscription billing (Stripe)
- Multi-jurisdiction support

---

## Architecture Decisions

**Why Server Actions instead of a separate API?**
For an MVP, Server Actions reduce boilerplate significantly while keeping type safety. The service layer (`lib/engines/`, `lib/actions/`) is decoupled from Next.js so a separate API can be extracted later.

**Why Clerk?**
Production-grade auth with minimal setup. Handles SSO, MFA, session management. Easy to swap for Auth.js if needed.

**Why Decimal.js?**
Crypto amounts can have 18 decimal places. JavaScript's `number` type loses precision at this scale. `Decimal.js` ensures all tax calculations are exact.

**Why separate CanonicalTransaction from RawImportRecord?**
Raw data is preserved forever for auditability. The canonical model is the normalized representation. If classification rules change, raw data can be re-processed without data loss.

---

## Disclaimer

TaxMate provides calculations based on best-effort interpretation of Norwegian tax rules as of the time of implementation. This does not constitute tax advice. Always consult a qualified Norwegian tax advisor (skatterådgiver) before submitting to Skatteetaten. Tax rules can change and TaxMate's interpretations may not reflect the latest guidance.
