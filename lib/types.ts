// lib/types.ts
export const TX = {
  DEPOSIT: "DEPOSIT",
  LOCK: "LOCK",
  WITHDRAW: "WITHDRAW",
  TRANSFER_IN: "TRANSFER_IN",
  TRANSFER_OUT: "TRANSFER_OUT",
  INCOME: "INCOME",
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
export const UNLOCK_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  DENIED: "DENIED",
} as const;
export type UnlockStatus = (typeof UNLOCK_STATUS)[keyof typeof UNLOCK_STATUS];
