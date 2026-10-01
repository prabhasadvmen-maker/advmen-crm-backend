# ADVMEN SalesOS — Backend Architecture & Structure
**Stack:** Node.js + TypeScript + Express + MongoDB (Atlas) + Redis + BullMQ + Socket.io + AWS S3
**Pattern:** Modular monolith, domain-isolated, tenant-scoped by construction

> Note on stack: the source specification recommends Node.js/Express for the backend (React is the frontend framework). This document follows that recommendation. If you specifically need a React-based backend-for-frontend (e.g., RSC/Next.js server actions) instead of Express, let me know and I'll restructure accordingly.

---

## 1. Architectural Principles

1. **Modular monolith, not microservices-by-default.** Each business domain (`leads`, `deals`, `calls`, `billing`...) is a self-contained module with its own routes, controller, service, repository, and validators. Modules communicate through explicit interfaces (an internal event bus + typed service calls), never by reaching into each other's models directly. This gives most of microservices' isolation benefits without the operational cost — and any module can be split into its own service later without a rewrite.
2. **The server is the only source of truth for security.** `organizationId`, role, and permissions are derived from the authenticated session/token — never accepted from client input. Every query is tenant-scoped by construction (via a scoped repository base class), not by developer discipline.
3. **A failure in one module must not take down another.** Enforced via per-module error boundaries, per-module queues, circuit breakers on outbound integrations, and independent health checks — detailed in §6.
4. **Everything reusable lives one layer down from domain logic** — validators, the API response envelope, the permission middleware, the tenant-scoping repository, and the queue wrapper are all shared utilities imported by every module, so no module reimplements its own version of "how do I check permissions."

---

## 2. Top-Level Folder Structure

```
backend/
├── src/
│   ├── app.ts                      # Express app assembly (middleware + route mounting only)
│   ├── server.ts                   # HTTP server bootstrap, graceful shutdown
│   │
│   ├── config/
│   │   ├── env.ts                  # validated env (zod schema) — fail fast on missing config
│   │   ├── db.ts                   # MongoDB connection
│   │   ├── redis.ts                # Redis connection
│   │   ├── socket.ts               # Socket.io setup
│   │   └── constants.ts            # permission keys, plan tiers, enums
│   │
│   ├── middleware/                 # Cross-cutting, applies to every module
│   │   ├── auth.middleware.ts      # verifies JWT/session, attaches req.user + req.organizationId
│   │   ├── permission.middleware.ts# requirePermission('lead.edit') factory
│   │   ├── tenant.middleware.ts    # derives + locks organizationId for the request lifecycle
│   │   ├── rateLimiter.middleware.ts
│   │   ├── validate.middleware.ts  # zod schema validation wrapper
│   │   ├── errorHandler.middleware.ts # global fallback — last resort, per-module handlers preferred
│   │   ├── requestId.middleware.ts
│   │   └── auditLog.middleware.ts
│   │
│   ├── modules/                    # ONE FOLDER PER DOMAIN — the core of the system
│   │   ├── auth/
│   │   ├── organizations/
│   │   ├── users/
│   │   ├── teams-rbac/
│   │   ├── leads/
│   │   ├── contacts/
│   │   ├── companies/
│   │   ├── pipelines/
│   │   ├── deals/
│   │   ├── activities/
│   │   ├── calls/
│   │   ├── communications/         # email, whatsapp, sms, unified inbox
│   │   ├── tasks/
│   │   ├── meetings/
│   │   ├── proposals/
│   │   ├── products-services/
│   │   ├── invoices-payments/
│   │   ├── reports/
│   │   ├── automations/
│   │   ├── ai/                     # AI Gateway module
│   │   ├── integrations/
│   │   ├── notifications/
│   │   ├── subscriptions-billing/
│   │   ├── audit-logs/
│   │   └── support/
│   │   │
│   │   └── <each module, e.g. leads/>
│   │       ├── lead.routes.ts       # Express router — thin, delegates to controller
│   │       ├── lead.controller.ts   # parses req, calls service, shapes response envelope
│   │       ├── lead.service.ts      # ALL business logic lives here (pure of Express)
│   │       ├── lead.repository.ts   # extends BaseTenantRepository — only DB access point
│   │       ├── lead.model.ts        # Mongoose schema
│   │       ├── lead.validators.ts   # zod schemas for input
│   │       ├── lead.events.ts       # emits/subscribes to internal event bus
│   │       ├── lead.permissions.ts  # permission key constants for this module
│   │       ├── lead.errors.ts       # module-scoped error classes
│   │       └── lead.module.test.ts
│   │
│   ├── shared/                     # Reusable across every module — the "import anywhere" layer
│   │   ├── repository/
│   │   │   └── BaseTenantRepository.ts   # generic CRUD, auto-injects organizationId into every query
│   │   ├── response/
│   │   │   └── ApiResponse.ts            # { success, data, meta } envelope builder
│   │   ├── errors/
│   │   │   ├── AppError.ts               # base error class w/ code + httpStatus
│   │   │   └── errorCodes.ts
│   │   ├── events/
│   │   │   └── EventBus.ts               # in-process pub/sub between modules (typed)
│   │   ├── queue/
│   │   │   └── QueueFactory.ts           # wraps BullMQ, standardizes retry/backoff/DLQ per queue
│   │   ├── resilience/
│   │   │   ├── CircuitBreaker.ts         # wraps outbound provider calls (opossum-style)
│   │   │   └── retry.ts
│   │   ├── pagination/
│   │   ├── phone-email-normalize/
│   │   └── logger/
│   │
│   ├── jobs/                       # BullMQ workers — one process group per queue
│   │   ├── notifications.worker.ts
│   │   ├── communications.worker.ts
│   │   ├── reports.worker.ts
│   │   ├── imports.worker.ts
│   │   ├── ai.worker.ts
│   │   ├── automation.worker.ts
│   │   ├── billing.worker.ts
│   │   └── media.worker.ts
│   │
│   ├── integrations/                # External provider adapters — one folder per provider
│   │   ├── calling/                 # e.g. Exotel/Twilio adapter behind a common interface
│   │   ├── whatsapp/
│   │   ├── sms/
│   │   ├── email/
│   │   ├── payments/
│   │   └── ai-providers/            # Anthropic/OpenAI adapter behind a common interface
│   │
│   ├── webhooks/
│   │   ├── payment.webhook.ts       # signature verify → idempotency check → enqueue → 200 fast
│   │   ├── whatsapp.webhook.ts
│   │   └── email.webhook.ts
│   │
│   ├── routes/
│   │   └── index.ts                 # mounts every module's router under /api/v1/*
│   │
│   └── types/                       # shared cross-module TypeScript types
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   ├── rbac/                        # every role × every sensitive endpoint
│   └── tenant-isolation/            # tenant A must never read tenant B — run on every PR
│
├── scripts/                         # seed data, migrations, index creation
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
├── .env.example
├── tsconfig.json
└── package.json
```

---

## 3. The Reusability Pattern: `BaseTenantRepository`

This single class is what makes "tenant-scoped, safe, reusable data access" automatic instead of something every developer has to remember:

```ts
// shared/repository/BaseTenantRepository.ts
export abstract class BaseTenantRepository<T> {
  constructor(protected model: Model<T>) {}

  async findMany(organizationId: string, filter: FilterQuery<T> = {}, opts?: QueryOpts) {
    return this.model.find({ ...filter, organizationId }, null, opts);
  }

  async findById(organizationId: string, id: string) {
    return this.model.findOne({ _id: id, organizationId });
  }

  async create(organizationId: string, data: Partial<T>) {
    return this.model.create({ ...data, organizationId });
  }

  async updateById(organizationId: string, id: string, data: Partial<T>) {
    return this.model.findOneAndUpdate({ _id: id, organizationId }, data, { new: true });
  }
}
```

Every module's repository (`lead.repository.ts`, `deal.repository.ts`, ...) extends this. **It is structurally impossible to write a query that omits `organizationId`**, because the base class is the only path to the database. This is the backend's equivalent of the frontend's "single barrel import" pattern — one well-built base class, reused by every domain module, instead of 24 modules each writing their own (and eventually inconsistent) tenant-scoping logic.

The same reuse pattern applies to:
- **`ApiResponse`** — every controller returns through one envelope builder, so every endpoint has an identical `{ success, data, meta }` shape.
- **`QueueFactory`** — every background job is created through one factory that standardizes retries, backoff, timeout, and dead-letter handling, so no queue silently lacks error handling.
- **`CircuitBreaker`** — every outbound provider call (calling, WhatsApp, SMS, email, payment, AI) is wrapped by the same breaker utility, configured per-provider but implemented once.

---

## 4. Module Communication — Internal Event Bus (no direct cross-module DB access)

Modules never import each other's models or repositories. They communicate through a typed, in-process event bus, which is also the seam where an event queue (SQS/Kafka) could later be swapped in without touching module internals:

```ts
// modules/leads/lead.service.ts
async function updateLeadStatus(orgId: string, leadId: string, status: LeadStatus) {
  const lead = await leadRepository.updateById(orgId, leadId, { status });
  eventBus.emit('lead.status_changed', { orgId, leadId, status, at: new Date() });
  return lead;
}

// modules/automations/automation.events.ts
eventBus.on('lead.status_changed', async (payload) => {
  await automationEngine.evaluateTriggers('lead.status_changed', payload);
});

// modules/notifications/notification.events.ts
eventBus.on('lead.status_changed', async (payload) => {
  if (payload.status === 'Won') await notificationQueue.add('deal-won-notify', payload);
});
```

Why this matters for isolation: if the `automations` module throws, its `eventBus.on` handler catches and logs the error internally (each subscriber is wrapped by the bus in a try/catch) — the `leads` module that emitted the event has already returned its response to the client and is completely unaffected.

---

## 5. Layered Request Flow (per module)

```
Route (lead.routes.ts)
  → auth.middleware        (who is this?)
  → tenant.middleware       (which organization, locked for this request)
  → permission.middleware   (are they allowed: lead.edit?)
  → validate.middleware     (is the payload well-formed: lead.validators.ts)
  → Controller               (parse req → call service → shape ApiResponse)
  → Service                  (business logic, orchestrates repository + events + other services)
  → Repository (extends BaseTenantRepository)
  → MongoDB (tenant-scoped query)
```

Controllers contain **no business logic** — they exist purely to translate HTTP ↔ service calls, which is what lets a service be reused (e.g., called directly from a BullMQ worker or from another module's service) without duplicating logic for a non-HTTP context.

---

## 6. Fault Isolation Strategy (the "one module failing doesn't affect others" requirement)

| Layer | Mechanism |
|---|---|
| **Route/module level** | Each module owns a dedicated Express Router mounted at `/api/v1/<module>`. Route-level `try/catch` (via `express-async-errors` + module-scoped error handler) means an unhandled exception in `deals` returns a clean 500 for that request only — it does not crash the process or affect `leads` requests being served concurrently. |
| **Process level** | The Node process itself never crashes on a single bad request: uncaught exceptions are caught by the global handler, logged, and the process continues serving other requests (with a supervised restart via PM2/ECS if the process does become unstable). |
| **Queue level** | Every job type has its **own BullMQ queue** with its own concurrency, retry, and dead-letter config. A spike of failing `ai` jobs does not block the `notifications` queue from processing — they're fully separate Redis-backed queues, not one shared worker pool. |
| **Worker process level** | Workers for different queues run as separate processes/containers in production (`jobs/*.worker.ts` each independently deployable), so a memory leak in the AI worker doesn't take down the billing worker. |
| **Integration level** | Every outbound call to a third-party provider (calling, WhatsApp, SMS, email, payment, AI) goes through a `CircuitBreaker`. If the WhatsApp provider starts failing, the breaker opens after N failures and fast-fails subsequent calls for a cooldown window — so a degraded provider can't cause cascading timeouts that starve the whole request pool. |
| **Event bus level** | Each subscriber to an internal event is wrapped individually; one subscriber throwing does not stop other subscribers from receiving the same event, and never propagates back to the emitting module. |
| **Database level** | Each module only ever queries its own collection(s) through its own repository — a slow/blocking query pattern in `reports` can't accidentally lock unrelated collections used by `leads`. |
| **Health checks** | `/health/live` and `/health/ready` check DB/Redis connectivity independently, and can be extended to per-module readiness so an orchestrator (ECS/K8s) can route around a degraded instance before it affects users. |

---

## 7. AI Gateway Module (isolated by design)

Given the source spec's emphasis on AI never leaking cross-tenant data, `modules/ai/` is deliberately the most tightly boundaried module:

```
modules/ai/
├── ai.routes.ts
├── ai.controller.ts
├── ai.service.ts            # orchestrates: permission check → tenant-scoped retrieval → provider call
├── ai.gateway.ts             # the ONLY place allowed to call an AI provider
├── ai.piiFilter.ts           # strips secrets/PII before prompt construction
├── ai.promptPolicy.ts        # per-feature prompt templates + tool policy
├── ai.usageMeter.ts          # writes to aiUsage collection: org, user, feature, tokens, cost, latency
├── ai.actionLevels.ts        # read-only / assistive / operational / external / financial gating
└── ai.errors.ts
```

The `ai.gateway.ts` file is the single choke point through which every AI feature (lead summary, next-best-action, call summary, email draft, forecast, report copilot) must pass — this means a provider outage, a prompt-injection attempt, or a runaway cost spike is contained and observable in one place, and can never silently touch another tenant's data because retrieval is always executed through the same tenant-scoped repositories used elsewhere in the system.

---

## 8. Environments, CI/CD & Deployment

Mirrors the source spec directly:

```
Local → Development → Staging → Production
```

```
Pull Request → Lint → Type Check → Unit Tests → Build →
Security Scan → Integration Tests → Tenant-Isolation Tests →
Review → Merge → Staging Deploy → UAT → Production Approval → Production Deploy
```

- **Compute:** AWS ECS/Fargate, one service for the API, separate services per worker group.
- **Database:** MongoDB Atlas, with `{ organizationId: 1, ... }` compound indexes as specified in the source doc.
- **Cache/Queue:** managed Redis, one logical DB/namespace per queue family.
- **Secrets:** AWS Secrets Manager — never committed, rotated on schedule.
- **Observability:** correlation/request IDs from `requestId.middleware.ts` flow through logs, queue jobs, and outbound integration calls, so a single request can be traced end-to-end across module and process boundaries.

---

## 9. Testing Strategy (Backend)

| Layer | Focus |
|---|---|
| Unit | Services, validators, scoring logic, permission functions — mocked repositories |
| Integration | Real API + MongoDB (test container) + Redis, per module |
| RBAC | Every role × every sensitive endpoint (matrix test) |
| Tenant isolation | Automated: Tenant A must never read/write Tenant B's data — run on every PR, release-blocking |
| Resilience | Kill a queue worker mid-job → verify retry/DLQ; force a provider timeout → verify circuit breaker opens |
| E2E | Signup → Organization → Lead → Call → Follow-up → Deal → Payment |
| AI | Prompt injection, cross-tenant leakage attempts, hallucination-boundary checks |

---

## 10. Summary — How This Satisfies Your Two Requirements

- **"Add to code dynamically / reuse via import"** → `shared/` layer (`BaseTenantRepository`, `ApiResponse`, `QueueFactory`, `CircuitBreaker`, `EventBus`) is built once and imported by all 24 domain modules; each module itself is a self-contained, drop-in unit that can be copied as a template for a new domain in minutes.
- **"One component failure doesn't affect others"** → enforced at every layer that could otherwise cause cascading failure: per-module error handling, per-queue isolation, per-provider circuit breakers, per-subscriber event isolation, and per-module database access — detailed fully in §6.
