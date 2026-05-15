// ============================================================
// lib/keyholder-actions.ts
//
// Shared keyholder-side helpers used by the mobile Bearer routes
// under /api/keyholder/requests/[id]/*. The existing email-flow
// routes under /api/unlock-requests/[token]/* are not touched —
// they keep their own OTP-session auth and their own duplicated
// approve/deny logic so production keyholder emails are not at
// risk of regression.
//
// AUTH MODEL
// ----------
// These helpers DO NOT validate the actor's identity themselves.
// The caller is expected to have already proven that the request
// came from a signed-in user via getRequestUserId. The helpers
// take the actor's email + (optional) KeyholderProfile id and use
// those to:
//   1. Locate the unlock request by `id` (not approvalToken).
//   2. Confirm there is an ACTIVE KeyholderRelationship for the
//      owning user that covers the request's box (scope ALL, or
//      scope SELECTED with this box in the join table).
//   3. Confirm the matched relationship's profile email equals
//      the actor's email — i.e. the signed-in user really is the
//      keyholder on file.
// If any of those checks fail, the helpers return a structured
// error and the caller maps it to a 401/403/404/409.
// ============================================================

import { prisma } from "@/lib/db";
import { BOX_STATUS, UNLOCK_STATUS } from "@/lib/types";
import { getServerPosthog } from "@/lib/posthog-server";

const DENY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export type KeyholderActionInput = {
  unlockRequestId: string;
  actorUserId: string;
  actorEmail: string;
};

export type KeyholderActionFailure = {
  ok: false;
  status: number;
  error: string;
  code?: string;
};

export type ApproveSuccess = {
  ok: true;
  approved: true;
  pendingUserAcceptance: boolean;
  boxName: string;
  destinationBoxName?: string | null;
};

export type DenySuccess = {
  ok: true;
  denied: true;
  boxName: string;
  cooldownUntil: Date;
};

/**
 * Returns the keyholder context for `unlockRequestId` if and only if
 * `actorEmail` matches an active keyholder for the owning box.
 *
 * Resolves the actor's KeyholderProfile.id on the way — callers can
 * pass it through to audit events.
 */
async function resolveKeyholderContext(input: KeyholderActionInput) {
  const unlockRequest = await prisma.unlockRequest.findUnique({
    where: { id: input.unlockRequestId },
    include: { box: true },
  });

  if (!unlockRequest) {
    return {
      ok: false as const,
      status: 404,
      error: "Request not found",
    };
  }

  const activeRelationship = await prisma.keyholderRelationship.findFirst({
    where: {
      userId: unlockRequest.box.userId,
      status: "ACTIVE",
      OR: [
        { scopeType: "ALL" },
        {
          scopeType: "SELECTED",
          boxes: { some: { boxId: unlockRequest.boxId } },
        },
      ],
    },
    include: { profile: true },
  });

  if (!activeRelationship) {
    return {
      ok: false as const,
      status: 403,
      error: "No active keyholder for this box",
    };
  }

  const actorEmail = input.actorEmail.trim().toLowerCase();
  const profileEmail = (activeRelationship.profile.email ?? "").toLowerCase();
  if (profileEmail !== actorEmail) {
    return {
      ok: false as const,
      status: 403,
      error: "You are not the keyholder for this request",
    };
  }

  return {
    ok: true as const,
    unlockRequest,
    activeRelationship,
    profileId: activeRelationship.profile.id,
  };
}

export async function approveUnlockRequest(
  input: KeyholderActionInput,
): Promise<ApproveSuccess | KeyholderActionFailure> {
  const ctx = await resolveKeyholderContext(input);
  if (!ctx.ok) return ctx;
  const { unlockRequest, profileId } = ctx;

  if (unlockRequest.status !== UNLOCK_STATUS.PENDING) {
    return {
      ok: false,
      status: 409,
      error: `Request already ${unlockRequest.status.toLowerCase()}`,
    };
  }

  const isTransfer = unlockRequest.requestType === "TRANSFER";

  if (isTransfer) {
    const amt = unlockRequest.transferAmount ?? 0;
    const destId = unlockRequest.destinationBoxId;
    if (!destId || amt <= 0) {
      return {
        ok: false,
        status: 400,
        error: "Invalid transfer request data",
      };
    }
    const destBox = await prisma.box.findUnique({ where: { id: destId } });
    if (
      !destBox ||
      destBox.userId !== unlockRequest.box.userId ||
      destBox.isClosed
    ) {
      return {
        ok: false,
        status: 400,
        error: "Destination box unavailable",
      };
    }
    if (unlockRequest.box.lockedAmount < amt) {
      return {
        ok: false,
        status: 400,
        error: "Locked amount insufficient for transfer",
      };
    }

    // Sprint 14 — if the destination is HARD or KEYHOLDER, defer.
    // The owner has to explicitly accept because funds will be
    // re-locked on arrival.
    const destNeedsAcceptance =
      destBox.lockType === "HARD" || destBox.lockType === "KEYHOLDER";

    if (destNeedsAcceptance) {
      await prisma.unlockRequest.update({
        where: { id: unlockRequest.id },
        data: { status: UNLOCK_STATUS.PENDING_USER_ACCEPTANCE },
      });
      await prisma.auditEvent.create({
        data: {
          actor: "KEYHOLDER",
          actorId: profileId ?? undefined,
          action: "REQUEST_APPROVED_PENDING_USER_ACCEPTANCE",
          targetId: unlockRequest.id,
          metadata: JSON.stringify({
            boxId: unlockRequest.boxId,
            destinationBoxId: destBox.id,
            destinationLockType: destBox.lockType,
            keyholderEmail: input.actorEmail,
            source: "mobile",
          }),
        },
      });

      // Owner email — best effort.
      try {
        const owner = await prisma.user.findUnique({
          where: { id: unlockRequest.box.userId },
          select: { email: true, name: true },
        });
        if (owner?.email) {
          const { sendTransferAwaitingAcceptance } = await import("@/lib/email");
          await sendTransferAwaitingAcceptance({
            to: owner.email,
            ownerName: owner.name,
            sourceBoxName: unlockRequest.box.name,
            destinationBoxName: destBox.name,
            destinationLockType: destBox.lockType,
            amountDollars: amt / 100,
            keyholderDisplay:
              ctx.activeRelationship.profile.name ??
              ctx.activeRelationship.profile.email,
          });
        }
      } catch (emailErr) {
        console.error(
          "[approveUnlockRequest] awaiting-acceptance email errored:",
          emailErr,
        );
      }

      const ph = getServerPosthog();
      ph.capture({
        distinctId: unlockRequest.box.userId,
        event: "transfer_pending_user_acceptance",
        properties: {
          box_id: unlockRequest.boxId,
          destination_box_id: destBox.id,
          source: "mobile",
        },
      });
      await ph.shutdown();

      return {
        ok: true,
        approved: true,
        pendingUserAcceptance: true,
        boxName: unlockRequest.box.name,
        destinationBoxName: destBox.name,
      };
    }

    // Auto-execute: dest is SOFT or Wallet.
    try {
      await prisma.$transaction([
        prisma.box.update({
          where: { id: unlockRequest.boxId },
          data: {
            balance: { decrement: amt },
            lockedAmount: { decrement: amt },
          },
        }),
        prisma.box.update({
          where: { id: destId },
          data: { balance: { increment: amt } },
        }),
        prisma.transaction.create({
          data: {
            userId: unlockRequest.box.userId,
            boxId: unlockRequest.boxId,
            type: "TRANSFER_OUT",
            amount: amt,
            description: `Keyholder-approved transfer to ${destBox.name}`,
          },
        }),
        prisma.transaction.create({
          data: {
            userId: unlockRequest.box.userId,
            boxId: destId,
            type: "TRANSFER_IN",
            amount: amt,
            description: `Keyholder-approved transfer from ${unlockRequest.box.name}`,
          },
        }),
        prisma.unlockRequest.update({
          where: { id: unlockRequest.id },
          data: { status: UNLOCK_STATUS.APPROVED, resolvedAt: new Date() },
        }),
      ]);
    } catch (txErr) {
      console.error("[approveUnlockRequest] $transaction failed:", txErr);
      await prisma.unlockRequest.update({
        where: { id: unlockRequest.id },
        data: { status: "FAILED", resolvedAt: new Date() },
      });
      await prisma.auditEvent.create({
        data: {
          actor: "SYSTEM",
          action: "TRANSFER_FAILED",
          targetId: unlockRequest.id,
          metadata: JSON.stringify({
            boxId: unlockRequest.boxId,
            source: "mobile",
            reason: (txErr as Error)?.message ?? "unknown",
          }),
        },
      });
      try {
        const owner = await prisma.user.findUnique({
          where: { id: unlockRequest.box.userId },
          select: { email: true, name: true },
        });
        if (owner?.email) {
          const { sendTransferResult } = await import("@/lib/email");
          await sendTransferResult({
            to: owner.email,
            ownerName: owner.name,
            sourceBoxName: unlockRequest.box.name,
            destinationBoxName: destBox.name,
            amountDollars: amt / 100,
            outcome: "FAILED",
          });
        }
      } catch (emailErr) {
        console.error(
          "[approveUnlockRequest] FAILED-result email errored:",
          emailErr,
        );
      }
      return {
        ok: false,
        status: 500,
        error:
          "Transfer could not be completed. The request has been marked failed and both parties have been notified.",
        code: "transfer_failed",
      };
    }

    // Notify owner of successful transfer.
    try {
      const owner = await prisma.user.findUnique({
        where: { id: unlockRequest.box.userId },
        select: { email: true, name: true },
      });
      if (owner?.email) {
        const { sendTransferResult } = await import("@/lib/email");
        await sendTransferResult({
          to: owner.email,
          ownerName: owner.name,
          sourceBoxName: unlockRequest.box.name,
          destinationBoxName: destBox.name,
          amountDollars: amt / 100,
          outcome: "APPROVED",
        });
      }
    } catch (emailErr) {
      console.error(
        "[approveUnlockRequest] APPROVED-result email errored:",
        emailErr,
      );
    }
  } else {
    // Full UNLOCK — release everything, then start a 30-minute
    // temporary unlock window (Sprint 4). The box flips to
    // status=UNLOCKED so funds can be moved; we also remember
    // the box's protection type in `originalLockType` and
    // temporarily flip `lockType` to SOFT so downstream code
    // that gates on lockType (UI badges, keyholder-only paths)
    // doesn't accidentally trigger during the window. The cron
    // job at /api/cron/relock reverses this at expiry.
    const TEMPORARY_UNLOCK_MS = 30 * 60 * 1000;
    const temporaryUnlockExpiresAt = new Date(
      Date.now() + TEMPORARY_UNLOCK_MS,
    );
    const originalLockType = unlockRequest.box.lockType;
    await prisma.$transaction([
      prisma.unlockRequest.update({
        where: { id: unlockRequest.id },
        data: { status: UNLOCK_STATUS.APPROVED, resolvedAt: new Date() },
      }),
      prisma.box.update({
        where: { id: unlockRequest.boxId },
        data: {
          status: BOX_STATUS.UNLOCKED,
          lockedAmount: 0,
          temporaryUnlockExpiresAt,
          originalLockType,
          lockType: "SOFT",
        },
      }),
    ]);
  }

  await prisma.auditEvent.create({
    data: {
      actor: "KEYHOLDER",
      actorId: profileId ?? undefined,
      action: "REQUEST_APPROVED",
      targetId: unlockRequest.id,
      metadata: JSON.stringify({
        boxId: unlockRequest.boxId,
        keyholderEmail: input.actorEmail,
        source: "mobile",
      }),
    },
  });

  const ph = getServerPosthog();
  ph.capture({
    distinctId: unlockRequest.box.userId,
    event: "unlock_approved",
    properties: {
      box_id: unlockRequest.boxId,
      request_type: unlockRequest.requestType,
      source: "mobile",
    },
  });
  await ph.shutdown();

  return {
    ok: true,
    approved: true,
    pendingUserAcceptance: false,
    boxName: unlockRequest.box.name,
  };
}

export async function denyUnlockRequest(
  input: KeyholderActionInput,
): Promise<DenySuccess | KeyholderActionFailure> {
  const ctx = await resolveKeyholderContext(input);
  if (!ctx.ok) return ctx;
  const { unlockRequest, profileId } = ctx;

  if (unlockRequest.status !== UNLOCK_STATUS.PENDING) {
    return {
      ok: false,
      status: 409,
      error: `Request already ${unlockRequest.status.toLowerCase()}`,
    };
  }

  const cooldownUntil = new Date(Date.now() + DENY_COOLDOWN_MS);

  await prisma.$transaction([
    prisma.unlockRequest.update({
      where: { id: unlockRequest.id },
      data: {
        status: UNLOCK_STATUS.DENIED,
        resolvedAt: new Date(),
        cooldownUntil,
      },
    }),
    prisma.box.update({
      where: { id: unlockRequest.boxId },
      data: { status: BOX_STATUS.LOCKED },
    }),
  ]);

  await prisma.auditEvent.create({
    data: {
      actor: "KEYHOLDER",
      actorId: profileId ?? undefined,
      action: "REQUEST_DENIED",
      targetId: unlockRequest.id,
      metadata: JSON.stringify({
        boxId: unlockRequest.boxId,
        keyholderEmail: input.actorEmail,
        cooldownUntil: cooldownUntil.toISOString(),
        source: "mobile",
      }),
    },
  });

  const ph = getServerPosthog();
  ph.capture({
    distinctId: unlockRequest.box.userId,
    event: "unlock_denied",
    properties: {
      box_id: unlockRequest.boxId,
      request_type: unlockRequest.requestType,
      source: "mobile",
    },
  });
  await ph.shutdown();

  return {
    ok: true,
    denied: true,
    boxName: unlockRequest.box.name,
    cooldownUntil,
  };
}
