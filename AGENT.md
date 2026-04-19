# AGENT.md — LockBox Project Context
# ============================================================
# READ THIS ENTIRE FILE BEFORE WRITING ANY CODE.
# This file is the single source of truth for any AI agent
# working on this codebase, regardless of model or tool.
# Last updated: April 19, 2026 — Sprint 8 complete, all known bugs resolved.
# ============================================================

---

## SECTION 1 — WHAT LOCKBOX IS

LockBox is a behavioral accountability fintech app. Users lock real money into
named containers and optionally require a trusted "keyholder" (a partner,
friend, or family member) to approve any early withdrawal. The core value
proposition is making impulsive access to saved money genuinely difficult —
not simulated tracking, not virtual envelopes. Real money. Real friction.

**One-liner:** "Lock your bill money until due day — rent, guaranteed."

**Target user:** Renters and savers who struggle with impulse spending and need
hard guardrails. They've tried budgeting apps and failed. They need money to be
physically out of reach until it's needed.

**Domain:** lockboxfinance.com
**Repo:** github.com/Lockboxapp/lockbox-ui
**Deployed at:** https://lockboxfinance.com (Vercel, production)
**Admin dashboard:** https://lockboxfinance.com/admin

---

## SECTION 2 — TECH STACK

| Layer          | Technology                                              |
|----------------|---------------------------------------------------------|
| Framework      | Next.js (App Router, Turbopack)                         |
| Language       | TypeScript — must be clean before every commit          |
| Styling        | Tailwind CSS only — no new CSS libraries                |
| Database       | Neon PostgreSQL (cloud-hosted)                          |
| ORM            | Prisma 5.22                                             |
| Auth           | NextAuth                                                |
| Hosting        | Vercel (auto-deploys on push to main)                   |
| Email          | Resend — domain: lockboxfinance.com                     |
| SMS            | Twilio (keyholder notifications — not yet wired)        |
| AI/Banker      | OpenAI — NOT YET BUILT, placeholder only               |
| BaaS           | Unit — outreach done, in evaluation, NOT integrated     |
| Analytics      | PostHog — planned, not yet wired                        |
| Monitoring     | Sentry — planned, not yet wired                         |
| Branch pattern | main / dev / feature/*                                  |

---

## SECTION 3 — CRITICAL IMPORT CONVENTIONS

ALWAYS use these. Never deviate. Never create new instances.

  import { db } from '@/lib/db'            // Prisma — ONLY instance in the app
  import { authOptions } from '@/lib/auth' // NextAuth — ONLY auth config

**MIDDLEWARE FILE:** Named proxy.ts, NOT middleware.ts.
This is intentional for Next.js 16 compatibility. Do NOT rename it.

**TypeScript:** Run pnpm tsc --noEmit before every commit. Must be clean.

**No new dependencies** without explicit founder approval. Tailwind CSS only
for all UI work.

---

## SECTION 4 — ROUTING ARCHITECTURE

The app uses Next.js App Router with route groups. This was a board-level
architectural decision made April 7, 2026. Do not revert to a monolith.

  app/
  layout.tsx                        <- root layout (providers, fonts, PWA meta)
  (auth)/                           <- unauthenticated routes — no shell
    signin/page.tsx                 <- /signin
    signup/page.tsx                 <- /signup
  (shell)/                          <- authenticated routes — shared shell
    layout.tsx                      <- header + bottom nav lives HERE ONLY
    page.tsx                        <- / -> home dashboard
    vaults/page.tsx                 <- /vaults -> all boxes
    card/page.tsx                   <- /card -> virtual card placeholder
    banker/page.tsx                 <- /banker -> AI Banker (placeholder)
    rewards/page.tsx                <- /rewards -> consistency streak
    keyholders/page.tsx             <- /keyholders -> keyholder management
  keyholder/
    [token]/page.tsx                <- /keyholder/:token — NO AUTH REQUIRED
                                       Standalone. Keyholders never log in.
  admin/
    page.tsx                        <- /admin — isAdmin protected, server component

**Bottom nav (4 tabs):** Home / Vaults / Card / Banker
**Rewards** lives in Settings drawer — not in bottom nav.
**Keyholders** page is accessible but not in bottom nav.

---

## SECTION 5 — DATABASE SCHEMA (Complete as of Sprint 7)

### User
  model User {
    id           String   @id @default(cuid())
    name         String?
    email        String   @unique
    passwordHash String
    isAdmin      Boolean  @default(false)
    createdAt    DateTime @default(now())
    updatedAt    DateTime @updatedAt
  }

### Box
  model Box {
    id            String    @id @default(cuid())
    name          String
    userId        String
    lockType      String    // 'SOFT' | 'HARD' | 'KEYHOLDER'
    status        String    // 'CREATED' | 'FUNDING' | 'LOCKED' |
                            // 'UNLOCK_PENDING' | 'UNLOCKED' | 'CLOSED'
    balance       Int       @default(0)   // stored in CENTS
    lockedAmount  Int       @default(0)   // stored in CENTS — source of truth
    targetAmount  Int?                    // stored in CENTS
    lockUntil     DateTime?
    isPriority    Boolean   @default(false)
    isClosed      Boolean   @default(false)  // NOT a status value
    isWallet      Boolean   @default(false)  // one per user, system-managed
    createdAt     DateTime  @default(now())
    updatedAt     DateTime  @updatedAt
  }

IMPORTANT: balance and lockedAmount are stored in CENTS (integers).
Convert to dollars only at the display layer. Never store floats for money.

### WaitlistEntry
  model WaitlistEntry {
    id        String   @id @default(cuid())
    email     String   @unique
    createdAt DateTime @default(now())
  }

### UnlockRequest
  model UnlockRequest {
    id                      String      @id @default(cuid())
    boxId                   String
    userId                  String
    keyholderRelationshipId String?
    requestType             RequestType @default(UNLOCK)
    status                  String      // 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED'
    reason                  String?
    transferAmount          Int?        // CENTS — for TRANSFER type only
    destinationBoxId        String?     // for TRANSFER type only
    token                   String      @unique  // single-use approval token
    expiresAt               DateTime    // 24-hour expiry
    requestedAt             DateTime    @default(now())
  }

  enum RequestType {
    UNLOCK    // full box unlock
    TRANSFER  // partial amount, box stays locked
  }

### KeyholderRelationship
  model KeyholderRelationship {
    id        String   @id @default(cuid())
    userId    String
    email     String
    name      String?
    scope     String   // 'ALL' | 'SELECTED'
    status    String   // 'PENDING' | 'ACTIVE' | 'PAUSED' | 'REVOKED'
    token     String   @unique
    expiresAt DateTime
    createdAt DateTime @default(now())
  }

### KeyholderRelationshipBox (join table for SELECTED scope)
  model KeyholderRelationshipBox {
    id                      String @id @default(cuid())
    keyholderRelationshipId String
    boxId                   String
  }

### AuditEvent
  model AuditEvent {
    id        String   @id @default(cuid())
    actor     String
    action    String   // LOCK | UNLOCK | TRANSFER | DEPOSIT | WITHDRAW |
                       // CLOSE | REOPEN | KEYHOLDER_INVITED | KEYHOLDER_ACCEPTED |
                       // KEYHOLDER_REVOKED | SWITCHED_TO_FLEXIBLE |
                       // UNLOCK_REQUESTED | UNLOCK_APPROVED | UNLOCK_DENIED |
                       // TRANSFER_REQUESTED | TRANSFER_APPROVED | TRANSFER_DENIED
    targetId  String?
    metadata  Json?
    createdAt DateTime @default(now())
  }

### Transaction
  model Transaction {
    id          String   @id @default(cuid())
    boxId       String
    userId      String
    type        String   // DEPOSIT | WITHDRAW | TRANSFER_IN | TRANSFER_OUT | LOCK | UNLOCK
    amount      Int      // CENTS
    description String?
    createdAt   DateTime @default(now())
  }

---

## SECTION 6 — API ROUTES (All existing as of Sprint 7)

### Authentication
  POST /api/auth/signup           <- creates user + Wallet + 2 starter boxes
  POST /api/auth/signin           <- NextAuth signin
  POST /api/auth/otp/request      <- request OTP code
  POST /api/auth/otp/verify       <- verify OTP
  POST /api/auth/forgot-password  <- password reset flow
  POST /api/auth/reset-password   <- complete reset with token

### Boxes
  GET    /api/boxes               <- all boxes for user (lazy-backfills Wallet)
  POST   /api/boxes               <- create box (HARD/KEYHOLDER auto-lock)
  PATCH  /api/boxes/:id           <- multi-action: lock | unlock | reopen |
                                     switchToFlexible | general update
  DELETE /api/boxes/:id           <- close box, returns blockers if not eligible

### Box Money Movement
  POST /api/boxes/:id/deposit     <- external deposit into box
  POST /api/boxes/:id/withdraw    <- withdraw (respects lockType + lockedAmount)
  POST /api/boxes/transfer        <- internal transfer between boxes

### Unlock / Transfer Requests
  POST /api/unlock-requests                   <- create UNLOCK or TRANSFER request
  POST /api/unlock-requests/[token]/approve   <- keyholder approves (no auth)
  POST /api/unlock-requests/[token]/deny      <- keyholder denies (no auth)

### Keyholders
  GET    /api/keyholders                <- all relationships for user
  POST   /api/keyholders                <- invite keyholder (sends Resend email)
  PATCH  /api/keyholders/:id            <- update (scope, status)
  DELETE /api/keyholders/:id            <- revoke
  POST   /api/keyholders/accept/[token] <- accept invitation (no auth)

### Admin
  GET /api/admin/stats            <- usage stats (isAdmin guard — 403 otherwise)

### Waitlist
  POST /api/waitlist              <- add email to waitlist

### Card
  POST /api/card/simulate         <- simulate card spend (isAdmin only, dev tool)

---

## SECTION 7 — BOX LIFECYCLE & LOCK TYPE RULES

### Status State Machine
  CREATED -> FUNDING -> LOCKED -> UNLOCK_PENDING -> UNLOCKED -> (back to LOCKED)
                                                             |
                                                         isClosed=true (archived)

- HARD and KEYHOLDER skip CREATED/FUNDING — auto-lock at creation.
- SOFT: CREATED -> user funds -> user locks manually.
- isClosed is separate from status. Closed boxes are reopenable.
- Status = lock lifecycle. isClosed = existence. Never set status='CLOSED'.

### SOFT (Flexible)
  Unlock:    Self-confirmed. No reason required. No keyholder.
  Transfer:  Allowed (enforces balance - lockedAmount).
  Withdraw:  Allowed (enforces balance - lockedAmount).
  Deposit:   Always allowed.
  Keyholder: NEVER. No keyholder language in SOFT flows.
  Due date:  Editable via three-dot menu.

### HARD (Fully Locked)
  Unlock:    Self-initiated. Reason required. No keyholder.
  Transfer:  BLOCKED while LOCKED. Must unlock first via HardSelfUnlockForm.
             DO NOT show TransferForm for a locked HARD box.
  Withdraw:  BLOCKED while LOCKED.
  Deposit:   Always allowed.
  Keyholder: NEVER. No keyholder language in HARD flows.
  Due date:  NOT editable after creation.
  AFTER UNLOCK (status=UNLOCKED): transfers and re-lock MUST be permitted.
  BUG-01: re-lock route currently rejects UNLOCKED status — needs fix.
  BUG-02: transfer route checks lockType not status — needs fix.

### KEYHOLDER (Person-Based Approval)
  Unlock:    Keyholder must approve via email. No self-override in v1.
  Transfer:  Keyholder must approve (TRANSFER type, box stays LOCKED).
  Withdraw:  Blocked — routes through UNLOCK request flow.
  Deposit:   Always allowed.
  Recovery:  If no ACTIVE keyholder: show recovery state (invite KH or
             switch to SOFT). Never create a dead end.
  Language:  Always name the keyholder. "Request sent to [Name]." Never generic.

### CRITICAL TRANSFER PERMISSION RULE (Board Decision)
  Transfer permission must gate on STATUS, not lockType alone.
  if (status === 'UNLOCKED') -> allow transfer regardless of lockType
  if (status === 'LOCKED' && lockType === 'HARD') -> block
  if (status === 'LOCKED' && lockType === 'KEYHOLDER') -> keyholder request
  NEVER check lockType without also checking status.

---

## SECTION 8 — WALLET RULES (Non-Negotiable)

One Wallet per user. Created at signup. System-managed.

WALLET CANNOT:
- Be locked, closed, or deleted
- Be assigned a keyholder
- Appear in keyholder box selectors or dropdowns
- Appear in Priority Boxes or Today's Actions
- Have its name changed
- Have a due date set
- Have a three-dot menu

WALLET CAN:
- Receive deposits at any time
- Transfer funds to other boxes
- Be the card spending source (v1 only)

In all queries: filter with isWallet: false unless building the Wallet card.
Card spending routes through Wallet only. Per-box virtual cards are v1.1 (not built).

---

## SECTION 9 — KEYHOLDER SYSTEM

- Keyholders DO NOT need a LockBox account.
- /keyholder/[token] is STANDALONE — outside the authenticated shell.
- Tokens are single-use, 24-hour expiry.
- Email sent via Resend from lockboxfinance.com domain.
- Lock enforcement is SERVER-SIDE ONLY. Approval token is NEVER visible
  to the requesting user. Board-level non-negotiable.

Invitation flow:
  1. User creates keyholder from /keyholders.
  2. API creates KeyholderRelationship (PENDING) + sends Resend email.
  3. Keyholder clicks link -> /keyholder/[token] -> accepts -> ACTIVE.

Keyholder scope:
  ALL:      covers all KEYHOLDER boxes for this user.
  SELECTED: covers only specific boxes (KeyholderRelationshipBox join).

UNLOCK_BOX request flow:
  1. User taps unlock on KEYHOLDER box.
  2. Banker intervention: "Do you need all of it? Consider a transfer."
  3. User confirms -> request created -> keyholder notified.
  4. Keyholder approves/denies via /keyholder/[token].
  5. Approved: box -> UNLOCKED. Denied: stays LOCKED, 24hr cooldown.

TRANSFER_OUT request flow:
  1. User taps transfer on KEYHOLDER box -> TransferRequestForm.
  2. Request created: requestType=TRANSFER, amount, destinationBoxId.
  3. Keyholder notified: "X wants to transfer $Y from [box] to [dest]."
  4. Box STAYS LOCKED throughout. Only the amount moves on approval.
  5. Approval: atomically decrements source balance + lockedAmount,
     increments destination balance, writes paired transaction records.

Recovery state (no active keyholder):
  Never silently block. Show:
  1. Invite a new keyholder -> /keyholders
  2. Switch to Flexible (SOFT) — only if no ACTIVE keyholder exists.
  Server rejects switchToFlexible if any ACTIVE keyholder still attached.

---

## SECTION 10 — MONEY MOVEMENT RULES

  Action          SOFT        HARD         KEYHOLDER
  Transfer out    Allowed     Block/unlock  KH request (TRANSFER)
  (while locked)             first
  Withdraw        Allowed     Block/unlock  KH request (UNLOCK)
  (while locked)             first
  Deposit         Always      Always        Always
  After unlock    Allowed     Allowed       Allowed
  (status=UNLOCKED)

lockedAmount = source of truth for how much is protected.
available = balance - lockedAmount (for SOFT enforcement).
Always enforce available on transfer/withdraw source.

TRANSFER requests do NOT flip box to UNLOCK_PENDING.
Box stays LOCKED before, during, and after review. Only the amount moves.

---

## SECTION 11 — HOME DASHBOARD LOGIC

Money Snapshot:
  Wallet balance           -> always liquid
  Protected in boxes       -> sum(lockedAmount) across all non-wallet active boxes
  Total in LockBox         -> wallet balance + sum of all box balances
  Labels: Wallet / Protected in boxes / Total in LockBox

Priority Boxes — qualifies if ANY of:
  1. status === 'UNLOCK_PENDING'
  2. lockUntil within 7 days AND balance < targetAmount
  3. lockUntil within 14 days AND balance < 80% of targetAmount
  4. isPriority === true
  Max 3, ranked by urgency. Wallet never qualifies.
  Empty: "No priority boxes right now. Your important boxes are on track."

Today's Actions — fires when ALL of:
  status === 'LOCKED'
  lockUntil is not null
  lockUntil within 14 days
  balance < 80% of targetAmount
  Empty: "You're all caught up. Stay consistent. — The Banker"

Deep linking: /vaults?box={boxId} -> highlighted card, ring-2 ring-emerald-500,
fades after 2s.

---

## SECTION 12 — THE BANKER (AI — PLACEHOLDER ONLY)

Status: NOT BUILT. /banker page exists with static placeholder.
Do not build AI functionality without explicit instruction.

When built — insight ladder (priority order):
  1. Empty locked box (HARD/KEYHOLDER, balance=0)
     "You created [box] to lock away some money. Let's start doing that."
  2. Unlock pending on priority box
     "You have a pending unlock. Think carefully before proceeding."
  3. Box behind target + due soon (<14d, <80%)
     "Your [box] is behind. You may not hit your target in time."
  4. Wallet <$20 with money in boxes
     "Your Wallet is running low. Only move what you need."
  5. 30 days no unlock attempts
     "30 days of discipline. Keep it going."
  6. Default: "You are on track. Stay consistent."

Banker intervention on KEYHOLDER unlock:
  Show before unlock form: "Do you actually need all of it?"
  "Request transfer instead" -> swaps to TransferRequestForm in-place.
  "Unlock anyway" -> dismisses card, shows reason inputs.
  HARD and SOFT flows: NO intervention. Never mention keyholders.

Tone: warm, direct, practical. Never preachy. Never generic when named is possible.

---

## SECTION 13 — WHAT IS BUILT (Sprint 8, April 19, 2026)

BUILT AND DEPLOYED:
  Authentication — signup, signin, OTP, forgot/reset password
  Onboarding flow — multi-step, wired to API
  Home dashboard — Money Snapshot, Priority Boxes, Today's Actions, Banker card
  Vaults screen — all box types, lock/unlock, deposit, transfer, close, reopen
  Wallet — system box, pinned at top of /vaults, card spend source
  Lock behavior system — SOFT/HARD/KEYHOLDER, server + client enforcement
  State machine — re-lock after unlock works; transfer/withdraw gate on status first
  Keyholder invite flow — email via Resend, accept page, relationship active
  Keyholder management — /keyholders, scope, revoke, live refresh on focus
  Unlock request flow — UNLOCK and TRANSFER types, both working
  Keyholder approval page — /keyholder/[token], standalone, no auth
  Banker intervention — in-form card on KEYHOLDER unlock, transfer swap
  Close box — blockers checked, funds moved to Wallet, archived
  Reopen box — single PATCH, no data mutation
  Virtual card page — /card, placeholder UI, admin simulate spend
  Admin dashboard — /admin, isAdmin protected, usage stats
  Landing page — lockboxfinance.com, email capture waitlist
  Rewards page — consistency streak (UI only)
  Due date editing — SOFT boxes only, three-dot menu
  Add funds source picker — Move from Wallet vs external deposit
  Protection-type messaging — correct language per lockType throughout
  Keyholder page live updates — refetch on window focus / visibility change
  Wallet excluded from keyholder box selectors globally

---

## SECTION 14 — WHAT IS NOT BUILT

  Real money movement (BaaS) — no Unit integration. All balances are manual.
  The Banker AI — OpenAI not integrated. Placeholder only.
  PostHog analytics — no event tracking wired.
  Sentry monitoring — not wired.
  Landing page visit tracking — no analytics on lockboxfinance.com.
  Onboarding completion tracking — no admin event on completion.
  Per-box virtual cards — v1.1, requires Unit.
  Plaid — deferred post-beta.
  Twilio SMS — Resend email works. Twilio not wired.
  Native mobile app — PWA first. React Native deferred.
  Direct deposit + auto-allocation — future feature.
  Debt payoff helper — future feature.
  Timed self-release for HARD — designed, not built.
  Emergency override (Tier B/C) — designed, not built.
  Admin user management tools — move money, reset codes, restrict accounts.
  Rotating sign-in messages — requested, not built.
  Full balance snapshot on home dashboard — shows Wallet balance only currently.

---

## SECTION 15 — KNOWN BUGS (Open as of April 19, 2026)

No known bugs. All cleared in Sprint 8 (commit 589a8d7).

RESOLVED:
  BUG-01 — Lock route now accepts UNLOCKED status. Fixed in Sprint 8.
  BUG-02 — Transfer/withdraw gate on status first, then lockType. Fixed in Sprint 8.
  BUG-03 — Wallet filtered from keyholder box selector. Fixed in Sprint 8.
  BUG-04 — Box list refetches on focus at /keyholders. Fixed in Sprint 8.
  BUG-05 — text-gray-900 added to keyholder invite inputs. Fixed in Sprint 8.

---

## SECTION 16 — BOARD-LEVEL NON-NEGOTIABLE RULES

1.  Lock enforcement is SERVER-SIDE ONLY. Client shows state; server enforces.
2.  Keyholder approval token is NEVER visible to the requesting user.
3.  Keyholders do NOT need a LockBox account. Approval page has no auth.
4.  No new features until core loop works end-to-end. Core loop is working
    as of Sprint 7. Open bugs (Section 15) must be fixed first.
5.  Real money integration is non-negotiable. No manual bank tracking workarounds.
6.  Wallet cannot be locked, closed, deleted, or assigned a keyholder. Ever.
7.  Transfer permission gates on STATUS not lockType. See Section 7.
8.  CLOSED = isClosed field, not a status value. Never set status='CLOSED'.
9.  Deposits are always allowed regardless of lockType or status.
10. Zero balance does not equal unlocked. Lock state is independent of balance.
11. LockBox can create friction, but CANNOT create a dead end.
12. Keyholder language (mentions of keyholders, named approval) is ONLY used
    for KEYHOLDER lockType. HARD and SOFT flows never mention keyholders.
13. TRANSFER requests never flip box status. Box stays LOCKED throughout.
14. Mobile-first PWA. React Native deferred post-beta.
15. lockedAmount is the source of truth. totalLocked = sum(lockedAmount),
    not count of boxes with status=LOCKED.

---

## SECTION 17 — FILE CONVENTIONS & PATTERNS

Prisma:       Always @/lib/db. Never new PrismaClient().
Auth:         Always @/lib/auth. Never hardcode auth config.
Server pages: Use getServerSession(authOptions) directly in page.tsx.
API routes:   Auth check is always the first line. Return 403 for unauthorized.
Error format: { error: 'message', code: 'snake_case_code' } for known errors.
Money:        Always CENTS in DB. Dollar conversion at display layer only.
Transactions: prisma.$transaction([...]) for all money movement between boxes.
TypeScript:   pnpm tsc --noEmit must pass before every commit.
Middleware:   proxy.ts protects (shell) group. Admin handled at page level.

---

## SECTION 18 — SPRINT HISTORY (Summary)

Sprint 1  — UI Wiring (Apr 7)
  BoxesScreen wired to real API. Basic vault display working.

Sprint 2  — Home Logic + Vault Interaction (Apr 14, commit d2d5dc6)
  Priority Boxes, Today's Actions, lock amount chips, lockedAmount schema,
  deep linking, lock type badges, Banker card tappable, SOFT partial lock.

Sprint 3  — Data Accuracy + Logic Alignment (Apr 14)
  Banker insights, balance accuracy, state fixes, data truthfulness.

Sprint 4  — Wallet + Close Box + Virtual Card (Apr 14, commit 140378b)
  Wallet system box, close/reopen box, /card placeholder, 4-tab nav,
  Rewards moved to Settings drawer, isClosed schema field.

Sprint 5  — Auto-lock + Rename (Apr 14)
  HARD/KEYHOLDER auto-lock on creation, box rename via three-dot menu,
  hotfix for stale KEYHOLDER box states.

Sprint 6  — Money Movement Logic Alignment (Apr 15, commit fadc414)
  TRANSFER_OUT request type, HARD self-unlock form, Banker intervention
  on KEYHOLDER unlock, unlock messaging by lockType, closed box exclusion
  from transfer destinations, RequestType enum in schema.

Sprint 7  — Request Flow + State Accuracy (Apr 15, commit 5dce447)
  Add funds source picker, KEYHOLDER recovery state, HARD unlock visible
  result fix (effectivelyLocked logic), keyholder page live updates on
  window focus, SOFT due date editing, protection-type messaging,
  success messages named to keyholder, switchToFlexible server action,
  validation rules for all request flows.

Sprint 8  — Bug Sprint / Final (Apr 19, commit 589a8d7)
  BUG-01: lock route accepts UNLOCKED status for re-lock.
  BUG-02: transfer + withdraw gate on status first, then lockType.
  BUG-03: Wallet filtered from keyholder box selectors globally.
  BUG-04: box list refetches on focus at /keyholders.
  BUG-05: text-gray-900 on keyholder invite inputs.
  All 5 known bugs resolved. Section 15 cleared.

Hotfix — Stale Unlock Requests Cleared (Apr 15)
  Stale PENDING unlock requests cleared via SQL in Neon console.

---

## SECTION 19 — WHEN TO UPDATE THIS FILE

Update after:
  - Sprint completes (Sections 13, 14)
  - Bug found (add to Section 15)
  - Bug fixed (remove from Section 15)
  - Board decision made (Section 16)
  - New API route added (Section 6)
  - Schema migration runs (Section 5)
  - New dependency approved (Section 2)
  - Architectural rule changes (Section 16)

Do NOT update after every small code change. Only meaningful shifts.

---

## SECTION 20 — PRE-TASK CHECKLIST FOR EVERY AI AGENT

Before writing any code, confirm:

  [ ] Have I read the existing route or component this task touches?
  [ ] Does logic I'm about to write already exist in the codebase?
  [ ] Am I checking STATUS and lockType where money movement is involved?
  [ ] Am I filtering Wallet (isWallet: false) from any box selector I touch?
  [ ] Am I using @/lib/db and @/lib/auth imports only?
  [ ] Am I storing money values in CENTS?
  [ ] Am I wrapping money movement in prisma.$transaction()?
  [ ] Am I using keyholder language ONLY for KEYHOLDER lockType boxes?
  [ ] Does this task create any dead end for a user? (It must not.)
  [ ] Will pnpm tsc --noEmit pass after my changes?

If any answer is uncertain, read the relevant section of this file before
proceeding. Do not guess. Do not assume.

---

AGENT.md — LockBox | Maintained by Darian Garrett, Founder
Do not remove, abbreviate, or summarize this file. It is the project memory.
