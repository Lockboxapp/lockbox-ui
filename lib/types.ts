// lib/types.ts
export const TX = {
  DEPOSIT: "DEPOSIT",
  LOCK: "LOCK",
  WITHDRAW: "WITHDRAW",
  TRANSFER_IN: "TRANSFER_IN",
  TRANSFER_OUT: "TRANSFER_OUT",
  INCOME: "INCOME",
  // Sprint 15 — distinct from WITHDRAW so card purchases get their own
  // icon + merchant display in the activity feed.
  CARD_SPEND: "CARD_SPEND",
} as const;

export type TransactionType = (typeof TX)[keyof typeof TX];

export const CAT = {
  INCOME: "INCOME",
  EXPENSE: "EXPENSE",
} as const;
export type CategoryType = (typeof CAT)[keyof typeof CAT];

// Box status flow
export const BOX_STATUS = {
  CREATED: "CREATED",
  FUNDING: "FUNDING",
  LOCKED: "LOCKED",
  UNLOCK_PENDING: "UNLOCK_PENDING",
  UNLOCKED: "UNLOCKED",
  CLOSED: "CLOSED",
} as const;
export type BoxStatus = (typeof BOX_STATUS)[keyof typeof BOX_STATUS];

// Unlock request status
// Sprint 14 — two new intermediate/terminal states for keyholder-approved
// transfers landing in HARD/KEYHOLDER destinations (user must accept) and
// user-side cancellation after keyholder approval.
export const UNLOCK_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  DENIED: "DENIED",
  FAILED: "FAILED",
  PENDING_USER_ACCEPTANCE: "PENDING_USER_ACCEPTANCE",
  CANCELLED_BY_USER: "CANCELLED_BY_USER",
} as const;
export type UnlockStatus = (typeof UNLOCK_STATUS)[keyof typeof UNLOCK_STATUS];
