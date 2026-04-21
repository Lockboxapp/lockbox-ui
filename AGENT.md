# AGENT.md — LockBox Project Context
# ============================================================
# READ THIS ENTIRE FILE BEFORE WRITING ANY CODE.
# This file is the single source of truth for any AI agent
# working on this codebase, regardless of model or tool.
# Last updated: April 21, 2026 — Sprint 14 complete (transfer in, protected display, lock warning, user acceptance, banker carousel).
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
| Analytics      | PostHog — wired in Sprint 9 (posthog-js + posthog-node) |
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
    id                    String    @id @default(cuid())
    name                  String?
    email                 String    @unique
    passwordHash          String
    isAdmin               Boolean   @default(false)
    onboardingCompletedAt DateTime?                 // Sprint 9 — set at end of /lock
    isRestricted          Boolean   @default(false) // Sprint 9 — blocks sign-in
    restrictedAt          DateTime?                 // Sprint 9
    restrictedReason      String?                   // Sprint 9
    timezone              String?                   // Sprint 13 — IANA TZ captured on signup; null = UTC fallback
    createdAt             DateTime  @default(now())
    updatedAt             DateTime  @updatedAt
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
    id           String    @id @default(cuid())
    email        String    @unique
    createdAt    DateTime  @default(now())
    // Sprint 10 — welcome email sequence tracking
    email1SentAt DateTime?
    email2SentAt DateTime?
    email3SentAt DateTime?
    unsubscribed Boolean   @default(false)
  }

### UnlockRequest
  model UnlockRequest {
    id                      String      @id @default(cuid())
    boxId                   String
    userId                  String
    keyholderRelationshipId String?
    requestType             RequestType @default(UNLOCK)
    // Sprint 14 — status now includes PENDING_USER_ACCEPTANCE, CANCELLED_BY_USER, FAILED
    status                  String      // PENDING | APPROVED | DENIED | EXPIRED |
                                         // PENDING_USER_ACCEPTANCE | CANCELLED_BY_USER | FAILED
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
    id              String    @id @default(cuid())
    userId          String
    profileId       String
    scopeType       String    // 'ALL' | 'SELECTED'
    status          String    // 'PENDING' | 'ACTIVE' | 'PAUSED' | 'REVOKED'
    inviteToken     String    @unique
    inviteExpiresAt DateTime?
    acceptedAt      DateTime?
    revokedAt       DateTime?
    revokedBy       String?   // Sprint 11 — 'KEYHOLDER' (opt-out) | 'OWNER' (removed)
    safetyMode      Boolean   @default(false)
    createdAt       DateTime  @default(now())
    updatedAt       DateTime  @updatedAt
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
  POST /api/unlock-requests                          <- create UNLOCK or TRANSFER request
  POST /api/unlock-requests/[token]/approve          <- keyholder approves (no auth)
  POST /api/unlock-requests/[token]/deny             <- keyholder denies (no auth)
  POST /api/unlock-requests/[token]/accept           <- owner accepts a keyholder-approved
                                                        TRANSFER into HARD/KEYHOLDER dest;
                                                        [token] value is UnlockRequest.id
                                                        (session-authed owner, idempotent)
  POST /api/unlock-requests/[token]/cancel-by-user   <- owner cancels the above, funds stay

### Keyholders
  GET    /api/keyholders                   <- all relationships for user
  POST   /api/keyholders                   <- invite keyholder (sends Resend email);
                                              also detects existing ACTIVE SELECTED
                                              relationship + new boxIds and sends
                                              scope-update email instead of new invite
  PATCH  /api/keyholders/[token]           <- keyholder accepts invite (no auth),
                                              sends welcome email on success
  DELETE /api/keyholders/manage/[id]       <- owner removes keyholder (Sprint 11);
                                              sets status=REVOKED, revokedBy=OWNER,
                                              notifies keyholder by email
  GET    /api/keyholder/optout?token=      <- returns opt-out context (no auth)
  POST   /api/keyholder/optout             <- keyholder steps down via opt-out page
                                              (Sprint 11); no auth; status=REVOKED,
                                              revokedBy=KEYHOLDER, notifies owner

### Admin
  GET /api/admin/stats            <- usage stats (isAdmin guard — 403 otherwise)
  POST  /api/admin/move-funds     <- manual money move between any two boxes (audited)
  POST  /api/admin/reset-password <- trigger password reset email for any user
  PATCH /api/admin/restrict-user  <- toggle isRestricted on any user (audited)

### Onboarding
  POST /api/onboarding/complete   <- marks User.onboardingCompletedAt (idempotent)

### Waitlist
  POST /api/waitlist                            <- add email + send Email 1 immediately
  GET  /api/waitlist/unsubscribe?token=<b64(id)> <- sets unsubscribed=true
  GET  /api/cron/waitlist-emails                <- Vercel cron; Bearer CRON_SECRET;
                                                   sends Day 3 / Day 7 emails

### Card
  POST /api/card/simulate         <- simulate card spend from Wallet (all users)
                                     • approved: $transaction debits Wallet +
                                       WITHDRAW Transaction ("Card purchase — {merchant}")
                                     • declined (wallet<amt): NO money moves,
                                       NO Transaction; AuditEvent
                                       { action: "CARD_DECLINED", metadata:
                                         { merchant, amountCents, walletBalance } }

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

## SECTION 13 — WHAT IS BUILT (Sprint 14, April 21, 2026)

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
  PostHog analytics — 8 events wired (waitlist, signup, onboarding, box,
    lock, unlock, keyholder invite, share); admin onboarding completion count
  Landing page waitlist-only — no Get started / Sign in; app still reachable by URL
  Admin support tools — manual money move, password reset trigger, restrict account
  Account restriction enforcement in lib/auth.ts credentials flow
  Waitlist welcome email sequence — Email 1 on signup, Day 3 + Day 7 via Vercel cron
  Waitlist unsubscribe endpoint with base64-token URL
  Keyholder opt-out page + API — standalone, no auth, token-based
  Owner remove keyholder — only in Settings → Keyholders → Manage; confirmation
    modal with affected-box warning; notifies keyholder by email
  Missing keyholder recovery state — derived per box; amber banner on vault card
    with Assign / Switch to Flexible CTAs; banker nudge on home
  Keyholder welcome email on acceptance + scope update email when existing
    keyholder gets new boxes; opt-out link in all keyholder emails
  Card simulation + decline logic — merchant presets, amount input, all-user
    Charge card action; approved purchases write WITHDRAW Transaction;
    declines are AuditEvent-only (CARD_DECLINED, metadata with merchant +
    attempted cents + wallet balance), no money moves, no Transaction, no
    activity-feed entry. Wallet-low warning on Card tab when balance < $20.
  KEYHOLDER transfer approval — approval route branches on requestType,
    atomic $transaction, idempotent via status pre-check, explicit FAILED
    state + owner email on $transaction failure. Keyholder approval page
    shows transfer vs unlock language (headline, detail rows, button labels,
    success/denied copy). Pending TRANSFER requests surfaced in Today's
    Actions on home.
  "Target date" rename — no "due date" / "due in" / "Due today" anywhere in
    UI (creation, settings, vault card, Priority Boxes, Banker, Today's
    Actions, emails, keyholder pages, landing). Schema field lockUntil
    unchanged (UI/copy only).
  Overdue target date handling — toVaultShape adds daysRemaining + isOverdue;
    overdue boxes always qualify for Priority with "Overdue" label; Banker
    ladder has overdue branch; Today's Actions has overdue_box entry; past
    dates render "Target date passed", never negatives.
  Banker pace calculation — remainingCents / daysRemaining / 100 ceil'd;
    handles all edge cases (daysLeft=0, overdue, fully funded, almost there,
    null inputs). Copy: "Your [box] target is [date]. You need $X/day to
    get there on time."
  User.timezone captured on signup — Intl.DateTimeFormat().resolvedOptions();
    null fallback for pre-Sprint-13 users.
  Transfer IN never blocked by destination lockType (enforcement gates only
    on source box).
  Protected display — HARD and KEYHOLDER vault cards show a single amber
    "Protected: $X" figure instead of Saved/Locked split. SOFT boxes keep
    the split; Wallet unchanged.
  Lock warning before direct transfers into HARD/KEYHOLDER destinations.
  PENDING_USER_ACCEPTANCE flow — keyholder-approved transfers into
    HARD/KEYHOLDER destinations are NOT auto-executed. UnlockRequest is set
    to PENDING_USER_ACCEPTANCE, user gets an email + a top-of-Today's-Actions
    row that opens a modal. Accept executes atomically (idempotent; FAILED
    on $transaction error). Cancel sets CANCELLED_BY_USER, funds stay.
  Banker carousel — priority-ordered array of messages, swipeable on mobile,
    dot indicators + chevrons for multi-card, single-card visual unchanged.

---

## SECTION 14 — WHAT IS NOT BUILT

  Real money movement (BaaS) — no Unit integration. All balances are manual.
  The Banker AI — OpenAI not integrated. Placeholder only.
  Sentry monitoring — not wired.
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

Sprint 9  — Growth Infrastructure (Apr 19, commit 9ea3d9d)
  PostHog analytics: posthog-js + posthog-node; lib/posthog.ts + lib/posthog-server.ts;
    8 events wired across waitlist/signup/onboarding/box/unlock/keyholder/share;
    admin dashboard shows onboarding completion count.
  Landing page waitlist-only: removed Get started + Sign in CTAs; added
    "We'll let you know when you're in." under hero form; app still URL-accessible.
  Admin support tools: manual move funds, trigger password reset, restrict/unrestrict
    account; schema adds User.onboardingCompletedAt + isRestricted + restrictedAt +
    restrictedReason; lib/auth.ts blocks restricted sign-in.

Hotfix — PostHog Serverless Flush (Apr 19, commit 3b2e021)
  lib/posthog-server.ts: removed singleton + captureServer wrapper; exports only
    getServerPosthog() factory with flushAt:1 + flushInterval:0. Every capture site
    now uses explicit pattern: create client, capture, await shutdown. Events flush
    before Vercel closes the function.

Sprint 10 — Welcome Email Sequence (Apr 19, commit 8e3d53d)
  WaitlistEntry adds email1SentAt / email2SentAt / email3SentAt / unsubscribed.
  lib/email.ts: plain-text senders for Email 1/2/3 from darian@lockboxfinance.com,
    verbatim approved copy, base64-token unsubscribe footer.
  Email 1 sent immediately on POST /api/waitlist (idempotent via email1SentAt).
  Vercel cron GET /api/cron/waitlist-emails runs daily 10am UTC behind CRON_SECRET;
    Day 3 sends Email 2, Day 7 sends Email 3, skips unsubscribed, sequential
    (Email 3 requires Email 2 sent).
  GET /api/waitlist/unsubscribe?token=<base64(id)> flips unsubscribed=true and
    returns plain HTML confirmation regardless of token validity.
  vercel.json crons block + CRON_SECRET placeholder in .env.local.

Sprint 14 — Transfer In + Protected Display + Lock Warning + User Acceptance + Banker Carousel (Apr 21, commit 0e5ad45)
  Bug 1: transfer route documented — destination lockType never blocks
    transfer in; only source is gated.
  Protected display: toVaultShape adds isFullyProtected + protectedAmount;
    VaultsScreen card shows amber "Protected: $X" for HARD/KEYHOLDER; SOFT
    and Wallet unchanged.
  Direct transfer lock warning: TransferForm opens a confirmation modal
    when destination is HARD/KEYHOLDER before hitting /api/boxes/transfer.
  PENDING_USER_ACCEPTANCE + CANCELLED_BY_USER + FAILED added to
    UNLOCK_STATUS constants (no DB migration — status column is String).
  Approve route (TRANSFER branch) now defers auto-execution when the
    destination is HARD/KEYHOLDER — sets PENDING_USER_ACCEPTANCE and
    emails the owner via sendTransferAwaitingAcceptance. SOFT/Wallet
    destinations still auto-execute.
  Two new session-authed routes (both idempotent):
    POST /api/unlock-requests/[token]/accept
    POST /api/unlock-requests/[token]/cancel-by-user
    (dynamic slot is [token] for route-collision safety; incoming value is
    UnlockRequest.id, not the keyholder approval token).
  PendingAcceptanceRow client component at the top of Today's Actions —
    tap opens a modal with amount/source/destination copy and Accept /
    Cancel buttons that call the routes + router.refresh().
  BankerCarousel client component — priority-ordered message array,
    swipe/chevron/dot-indicator navigation, single-card fallback.

Sprint 13 — Transfer Approval + Target Date + Banker Pace + Timezone (Apr 21, commit 59dc8b9)
  Bug 1 (P0): GET /api/unlock-requests/[token] exposes requestType +
    transferAmount + destinationBoxName. Approve route hardened — atomic
    $transaction, idempotent (status pre-check), FAILED status +
    sendTransferResult(outcome=FAILED) email to owner on transaction error,
    sendTransferResult(outcome=APPROVED) on success. Keyholder approval page
    branches on requestType everywhere (headline, detail rows, approval-text
    box, button labels, success/denied states). Pending TRANSFER surfaces in
    Today's Actions as "Waiting for your keyholder to approve your transfer
    from [Box]".
  Target date rename (no schema change): every "due date" instance replaced
    with "target date" in UI/copy across home, vaults, VaultsScreen, create
    form, lock modal, edit modal, keyholder pages, welcome email, landing
    page. lockUntil field name unchanged.
  Overdue handling: toVaultShape adds daysRemaining + isOverdue. scoredBoxes
    on home qualifies overdue boxes always; urgency score +6 (highest);
    "Overdue" label; "Target date passed" copy; Banker overdue branch;
    Today's Actions overdue_box entry; underfunded bucket excludes overdue.
  Banker pace: buildPaceMessage on home — Math.ceil(remainingCents /
    daysLeft / 100) with null-safe branches for all edge cases; "$X/day"
    copy on qualifying priority boxes.
  User.timezone String?: migration add-user-timezone; signup page captures
    Intl.DateTimeFormat().resolvedOptions().timeZone and POSTs it; /api/signup
    zod schema accepts + persists. Null tolerated for existing users.
  Vault card contrast: box name text-gray-900, subline text-gray-600.

Sprint 12 — Card Simulation + Decline Logic (Apr 20, commit 1aa56eb)
  POST /api/card/simulate: all users (admin gate removed). Accepts
    { amountInDollars, merchant }. Approved path uses prisma.$transaction()
    to debit Wallet and create a WITHDRAW Transaction with description
    "Card purchase — {merchant}". Declined path writes AuditEvent only
    (action: CARD_DECLINED, metadata { merchant, amountCents, walletBalance })
    — per board override, no DECLINED enum, no migration, clean ledger.
  app/(shell)/card/CardSimulate.tsx: merchant preset dropdown (Grocery,
    Gas, Restaurant, Pharmacy, Online, Custom free-text), amount input,
    inline approved/declined result cards, router.refresh() on result.
  Card tab: admin gate removed; Wallet-low amber warning when balance < $20;
    old AdminSimulateSpend.tsx deleted.

Sprint 11 — Keyholder Lifecycle (Apr 19, commit a159310)
  KeyholderRelationship adds revokedBy String? ('KEYHOLDER' | 'OWNER').
  Keyholder opt-out: standalone /keyholder/optout page + POST /api/keyholder/optout.
    No auth. Token = base64(relationshipId). Sets status=REVOKED, revokedBy=KEYHOLDER,
    emails owner with affected boxes.
  Owner remove keyholder: DELETE /api/keyholders/manage/[id] behind session auth.
    UI only in /keyholders page (Settings → Keyholders → Manage → Remove).
    Confirmation modal warns when removal would leave boxes uncovered.
    Notifies keyholder by email.
  Missing keyholder recovery: vaults/page.tsx derives missingKeyholder per box
    from active relationships; VaultsScreen shows amber banner with Assign /
    Switch to Flexible CTAs. Home banker ladder gains nudge above unlock_pending.
  Welcome email on acceptance + scope update email on box-addition (POST
    /api/keyholders now handles existing-ACTIVE-SELECTED + new boxIds as an
    update path instead of 409).
  All keyholder-facing emails (invite, unlock request, transfer request, welcome,
    scope update) now carry an opt-out footer linked to /keyholder/optout.

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
