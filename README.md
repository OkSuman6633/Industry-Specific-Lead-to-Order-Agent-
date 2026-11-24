# Brilliant Brains — Lead-to-Order Agent

A local-first implementation of the Brilliant Brains product and engineering specification (Experiment 5, 20 October 2026, 1.0 - Approval Candidate) for facilities and field-service operators. It captures website enquiries and inbound WhatsApp conversations, qualifies requirements with a bounded Google ADK/Gemini agent, validates UK territories, calculates indicative quotations deterministically, requires staff approval, records an immutable audit trail, unlocks appointment scheduling only upon customer acceptance, and exports leads to CSV.

## Architecture and implementation notes

- **Frontend:** React + TypeScript + Vite; responsive operations dashboard with live funnel metrics, lead review, AI qualification suggestions with evidence cards, quote lifecycle controls, appointment calendar handover, audit event viewer, catalogue & territory editor, and workspace settings.
- **API:** FastAPI with typed Pydantic request contracts, request validation, and tenant scoping.
- **Persistence:** SQLite3 with tenant-scoped tables, foreign keys, WAL mode, payload-verified idempotency records, optimistic quote generation versions (CAS preconditions), and append-only audit events.
- **Agents:** Google ADK orchestrator with narrow lead-intake and qualification sub-agents. Customer inputs are treated as untrusted data with prompt injection defense. No agent has a pricing, approval, messaging, calendar, or unrestricted tool capability.
- **Business rules:** quote arithmetic, VAT exemption, territory checks (UK postcode prefix filtering), catalogue versioning, and approval transitions are deterministic backend operations, not LLM decisions.
- **Outbound communication:** the included send endpoint is a local sandbox outbox only. It records the send action without contacting external parties.
- **Inbound WhatsApp adapter:** `/v1/webhooks/whatsapp` supports Meta challenge verification (GET) and signature-verified webhook ingestion (POST with HMAC-SHA256 signature verification and deduplication).
- **Scheduling (J5):** appointments cannot be scheduled without an approved and accepted quote. Validates UK timezones (`Europe/London`).
- **Production architecture difference:** the design specification describes Cloud Storage object state, Cloud Tasks, and BigQuery event analytics. This local build intentionally uses SQLite3 for the requested developer environment. A repository/service boundary should be retained when implementing the production GCP adapters; BigQuery must not be used as an online approval database.

## Project layout

```text
brilliant_brains/
├── backend/
│   ├── app/
│   │   ├── agents/
│   │   │   ├── agent.py                 # ADK orchestrator
│   │   │   ├── shared_libraries/prompts.py
│   │   │   └── sub_agents/
│   │   │       ├── lead_intake/agent.py
│   │   │       └── qualification/agent.py
│   │   ├── api/routes.py                # FastAPI routes (Leads, Quotes, Webhooks, Scheduling, Settings)
│   │   ├── core/                        # settings, JWT, security
│   │   ├── db/database.py               # SQLite schema + connection
│   │   ├── schemas/contracts.py         # Pydantic models & validation
│   │   ├── services/                    # audit + ADK qualification
│   │   └── main.py                      # FastAPI app & lifespan initialization
│   ├── tests/
│   │   ├── test_api.py
│   │   ├── test_rules.py
│   │   └── test_e2e_matrix.py           # Complete Section 9 E2E test matrix
│   ├── .env.example
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── lib/api.ts
    │   ├── App.tsx                      # Full lead-to-order UI console
    │   ├── main.tsx
    │   ├── styles.css
    │   └── vite-env.d.ts
    └── package.json
```

## Run locally (Windows PowerShell)

### 1. Backend

```powershell
cd backend
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
```

Open `backend/.env` and configure:

```env
GEMINI_API_KEY=YOUR_REAL_GEMINI_API_KEY
GEMINI_MODEL=gemini-2.5-flash
JWT_SECRET=replace-with-a-long-random-secret
WHATSAPP_APP_SECRET=bb_dev_whatsapp_secret_2026
WHATSAPP_VERIFY_TOKEN=bb_dev_verify_token_2026
```

Then start the API:

```powershell
uvicorn app.main:app --reload --port 8000
```

OpenAPI docs: http://localhost:8000/docs. Health: http://localhost:8000/health.

### 2. Frontend

```powershell
cd frontend
npm install
npm run build
npm run dev
```

Open http://localhost:5173.

### Local demo login

- Email: `admin@example.com`
- Password: `ChangeMe123!`

## Main workflow

1. **J1 Lead capture:** Inbound lead captured from website form (with consent) or inbound WhatsApp webhook (`POST /v1/webhooks/whatsapp`). Idempotency key prevents duplicate cases; conflicting payloads return 409.
2. **J2 Qualification:** Agent classifies urgency, category, and extracts requirements. Missing fields are requested, never invented. Prompt injection attacks are detected and flagged for human review.
3. **J3 Quote draft:** Service matched from tenant catalogue. Deterministic fee calculation, territory verification (out-of-area postcodes rejected with 422), and optional VAT-exempt case support.
4. **J4 Approval:** Manager/admin approves quote with expected generation version checking (CAS protection against simultaneous modifications).
5. **Sandbox send:** Outbox records approved quote send without external messaging side-effects.
6. **Customer acceptance:** Customer accepts quote, unlocking appointment scheduling.
7. **J5 Scheduling:** Staff confirms appointment with date, time, assigned field technician, and timezone (`Europe/London`).
8. **J7 Admin settings & analytics:** Versioned service catalogue, allowed UK postcode territories, operating hours, and conversion funnel metrics.

## API routes

| Route | Method | Purpose |
|---|---|---|
| `/v1/auth/login` | POST | Obtain JWT |
| `/v1/auth/me` | GET | Current identity and tenant |
| `/v1/dashboard` | GET | Dashboard counters, stats, and recent activity |
| `/v1/analytics/funnel` | GET | Lead-to-appointment funnel and pipeline metrics |
| `/v1/leads` | POST | Idempotent, consent-validated lead capture |
| `/v1/leads` | GET | Tenant-scoped lead listing with status and search filters |
| `/v1/leads/{id}` | GET | Tenant-scoped lead details, quotes, history, appointments |
| `/v1/leads/{id}` | PATCH | Update lead details / clarification |
| `/v1/leads/{id}/qualify` | POST | Bounded ADK qualification job (returns 202 job_id) |
| `/v1/jobs/{id}` | GET | Bounded job execution details and metadata |
| `/v1/services` | GET / POST | Tenant service catalogue |
| `/v1/territories` | GET / POST / DELETE | Tenant authorized UK postcode territories |
| `/v1/leads/{id}/quotes` | POST | Draft deterministic quotation with territory & VAT checks |
| `/v1/quotes` | GET | Tenant quotations list |
| `/v1/quotes/{id}` | GET | Single quotation detail |
| `/v1/quotes/{id}/approve` | POST | Staff approval with optimistic generation version check (409 on stale) |
| `/v1/quotes/{id}/reject` | POST | Reject quotation with audit reason |
| `/v1/quotes/{id}/send` | POST | Sandbox outbox send on permitted channel |
| `/v1/quotes/{id}/accept` | POST | Customer acceptance of approved quote |
| `/v1/leads/{id}/schedule` | POST | Schedule appointment (requires accepted quote; validates timezone) |
| `/v1/appointments` | GET | Tenant confirmed appointments list |
| `/v1/webhooks/whatsapp` | GET | Meta webhook subscription verification |
| `/v1/webhooks/whatsapp` | POST | Inbound WhatsApp webhook (HMAC signature verified, deduplicated) |
| `/v1/settings` | GET / POST | Tenant admin operating settings |
| `/v1/events` | GET | Immutable audit events ledger |
| `/v1/exports/leads.csv` | GET | CSV export of captured leads |

## Verification and test suite

The test suite covers the complete **Section 9 End-to-End Test Matrix**:

```powershell
cd backend
python -m pytest tests/
```

- **Positives:** Normal service request (`test_01`), multi-message clarification (`test_02`), in-territory job (`test_03`), VAT-exempt policy case (`test_04`), approved quote & appointment scheduling (`test_05`).
- **Negatives & Guardrails:** Malformed webhook (`test_06`), spoofed signature (`test_07`), repeated provider delivery (`test_08`), out-of-area address (`test_09`), disallowed service (`test_10`), injected instruction (`test_11`), inconsistent fee catalogue (`test_12`), simultaneous approval collision (`test_13`), vendor timeout (`test_14`), cross-tenant data request (`test_15`), missing consent (`test_16`), conflicting idempotency payload (`test_17`), Meta webhook challenge verification (`test_18`).
