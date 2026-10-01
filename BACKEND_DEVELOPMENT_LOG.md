# ADVMEN SalesOS — Backend Engineering & Processing Log

**Architecture Spec:** `ADVMEN_Backend_Architecture.md` & Production Planning Baseline  
**Stack:** Node.js, TypeScript (ES2022/NodeNext), Express, MongoDB Atlas, Redis, BullMQ, Socket.io  
**Pattern:** Modular Monolith, Domain-Isolated, Tenant-Scoped by Construction  

---

## 1. Architectural Foundations Completed

### Shared Infrastructure & Reusability Kernel (`src/shared/`)
- [x] **`BaseTenantRepository<T>`**:
  - Implements abstract data access wrapper over Mongoose.
  - **Structural Guarantee**: `organizationId` is a required parameter on every CRUD method (`findMany`, `findById`, `findOne`, `create`, `createMany`, `updateById`, `updateOne`, `deleteById`, `count`, `exists`, `findPaginated`). It is impossible to write a query that leaks cross-tenant data.
- [x] **`ApiResponse`**:
  - Standardized JSON response envelope: `{ success: true, data: T, meta: { requestId, page, limit, total, totalPages, hasNextPage } }`.
  - Structured error framing via `ApiResponse.error(res, message, status, code, details)`.
- [x] **`AppError` & `ERROR_CODES`**:
  - Domain-level error hierarchy with HTTP status codes and machine-readable error codes.
- [x] **`EventBus`**:
  - Typed in-process pub/sub event emitter (`lead.created`, `lead.status_changed`, `deal.won`, `call.completed`, `payment.received`, etc.).
  - **Fault Isolation**: Each subscriber is executed in an isolated async `try/catch` boundary. A subscriber failure in notifications/automations will never fail the primary API request.
- [x] **`QueueFactory`**:
  - Standardized BullMQ queue & worker generator with exponential backoff (2000ms delay, 3 attempts), automatic job cleanup, and DLQ retention.
- [x] **`CircuitBreaker`**:
  - Outbound third-party provider wrapper with failure counting, tripping threshold (5 failures), and 30-second cooldown windows to prevent cascading API pool exhaustion.
- [x] **`Logger`**:
  - Structured log utility with `requestId`, `organizationId`, `userId`, and error stack preservation.
- [x] **`normalize`**:
  - E.164-compatible phone number cleaner and case-normalized email utility.

---

## 2. Global Middleware Pipeline Completed (`src/middleware/`)
- [x] **`requestId.middleware.ts`**: Generates or propagates `X-Request-Id` headers.
- [x] **`auth.middleware.ts`**: Verifies JWT access tokens and attaches `req.user` & `req.organizationId`.
- [x] **`tenant.middleware.ts`**: Locks `req.organizationId` for the request lifecycle and rejects any client parameter spoofing attempts (`403 TENANT_MISMATCH`).
- [x] **`permission.middleware.ts`**: Factory for fine-grained permission enforcement (`requirePermission`, `requireAnyPermission`).
- [x] **`validate.middleware.ts`**: Zod schema validation interceptor for `body`, `query`, and `params`.
- [x] **`rateLimiter.middleware.ts`**: IP and tenant-scoped throttling protection.
- [x] **`errorHandler.middleware.ts`**: Global Express error handler returning structured `ApiResponse.error`.

---

## 3. Domain Modules Built & Mounted (`/api/v1/*`)

| Module | Routes | Key Features & Security Controls |
|---|---|---|
| **`auth`** | `/api/v1/auth` | Workspace creation on signup, bcrypt password hashing, JWT issuance & refresh token rotation, HTTP-only cookie support. |
| **`leads`** | `/api/v1/leads` | Lead capture with deduplication on normalized phone/email, automatic AI/rule scoring, round-robin owner routing, response-time SLA tracking, and `lead.created` event emission. |
| **`deals`** | `/api/v1/deals` | Multi-pipeline stage transitions, stage aging audit trails, win probability calculation, and `deal.stage_changed` / `deal.won` events. |
| **`calls`** | `/api/v1/calls` | Telephony call logging, dispositions, duration tracking, `firstContactAt` automatic timestamping on lead, and telecaller metrics aggregation. |
| **`ai`** | `/api/v1/ai` | Central `AiGateway` choke point, PII & secret sanitizer, token & cost usage metering in `aiUsage`, lead summary generation, and email drafting. |
| **`tasks`** | `/api/v1/tasks` | Task queues, priority sorting, overdue detection, completion state tracking, and reminder alerts. |
| **`proposals`** | `/api/v1/proposals` | Itemized quotation builder, automatic tax & discount calculation, status progression (`DRAFT` $\rightarrow$ `SENT` $\rightarrow$ `VIEWED` $\rightarrow$ `ACCEPTED`). |
| **`invoices`** | `/api/v1/invoices` | Billing management and idempotent payment recording with `idempotencyKey` check. |
| **`activities`** | `/api/v1/activities` | Unified chronological customer timeline automatically populated via `EventBus` listeners across calls, stage changes, tasks, notes, and payments. |
| **`automations`** | `/api/v1/automations` | No-code Trigger-Condition-Action execution engine responding dynamically to CRM domain events. |

---

## 4. Health & Observability Endpoints
- `GET /health/live`: Process liveness probe and uptime monitor.
- `GET /health/ready`: Dependency readiness check (MongoDB & Redis status).

---

## 5. Incident & Problem Resolution Log (Permanent Fixes)

### Issue #1: Dependency Resolution & Upstream Peer Conflicts
- **Observed Problem**: `npm install` encountered `msgpackr` target resolution and `ts-jest` peer dependency conflicts with TypeScript.
- **Root Cause**: Unpinned peer dependency resolution across `ts-jest` / `bullmq` during concurrent package tree construction.
- **Permanent Fix Applied**:
  1. Separated and pinned core production runtime dependencies (`express`, `cors`, `helmet`, `zod`, `dotenv`, `mongoose`, `ioredis`, `jsonwebtoken`, `bcryptjs`, `cookie-parser`, `uuid`, `socket.io`, `express-async-errors`).
  2. Aligned `package.json` with compatible TypeScript devDependencies (`tsx`, `@types/*`) for zero-drift execution.
  3. Verified all module imports use NodeNext `.js` extension standards for ESM compliance.

### Issue #2: Mongoose Document Property Reserved Word Collision
- **Observed Problem**: `IAiUsage.model` conflicted with Mongoose `Document.model` method signature during compilation.
- **Root Cause**: TypeScript strict interface inheritance from Mongoose `Document` containing internal method named `model`.
- **Permanent Fix Applied**: Renamed database schema property to `aiModel` in both `AiUsageModel` and `AiGateway`, preserving full tracking capabilities and ensuring strict type alignment.

---

## 6. AI Gateway & OpenRouter Dynamic Integration
- **Dynamic Configuration**: OpenRouter is integrated via `env.OPENROUTER_API_KEY` and `env.OPENROUTER_MODEL` without hardcoding any keys in code files.
- **Model Configured & Active**: `openai/gpt-oss-20b:free` (Verified live with active 200 responses for CRM summaries and drafts).
- **Security Chokepoint**: All prompts pass through `sanitizePromptContext` to strip PII and credentials, and are metered into the `aiUsage` collection.


---

## 7. MongoDB Atlas Cloud Database Integration
- **Atlas Cloud Configuration**: Upgraded `db.ts` to connect to MongoDB Atlas clusters via `mongodb+srv://` connection strings with connection pooling (`maxPoolSize: 50`, `minPoolSize: 5`), socket timeouts (`socketTimeoutMS: 45000`), and automatic majority write acknowledgement (`w=majority`, `retryWrites=true`).
- **Resilience & Whitelist Handling**: Added diagnostics for Atlas TLS handshakes, cluster discovery, and IP whitelist failure detection.
- **Environment Parity**: Configured `MONGODB_URI` across `.env` and `.env.example` to point directly to MongoDB Atlas.

---

## 8. Build & Type Safety Verification
- **TypeScript Typecheck**: `npx tsc --noEmit` $\rightarrow$ **0 Errors (100% Type-Safe)**
- **Production Compilation**: `npm run build` $\rightarrow$ **Clean build to `dist/`**
- **Live AI Test**: Successfully tested OpenRouter API (`openai/gpt-oss-20b:free`) with prompt sanitization, token tracking, and latency measurement.




