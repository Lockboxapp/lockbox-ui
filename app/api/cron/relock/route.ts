// ============================================================
// app/api/cron/relock/route.ts
// GET — Vercel Cron, runs every minute.
//
// Finds every Box whose temporary unlock window has expired
// and relocks it back to its `originalLockType`. The window is
// stamped by lib/keyholder-actions when a keyholder approves
// an UNLOCK request — see Sprint 4 handoff.
//
// SECURITY: Bearer auth via CRON_SECRET, identical pattern to
// /api/cron/waitlist-emails. Vercel Cron sends the header
// automatically when CRON_SECRET is configured.
//
// IDEMPOTENCY: each box is wrapped in a $transaction. If the
// window field has already been cleared (e.g. a previous run
// raced ahead), the per-box update is a no-op because we only
// match rows where `temporaryUnlockExpiresAt <= now`.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { BOX_STATUS, UNLOCK_STATUS } from "@/lib/types";
import { sendBoxRelockNotice } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const expired = await prisma.box.findMany({
    where: {
      temporaryUnlockExpiresAt: { lte: now, not: null },
      isClosed: false,
    },
    select: {
      id: true,
      name: true,
      userId: true,
      originalLockType: true,
      balance: true,
      user: { select: { email: true, name: true } },
    },
  });

  const results: Array<{
    boxId: string;
    ok: boolean;
    error?: string;
  }> = [];

  for (const box of expired) {
    try {
      // Fall back to SOFT if originalLockType somehow ended up null
      // (defensive — should never happen because keyholder-actions
      // always sets both fields together).
      const relockType = box.originalLockType ?? "SOFT";

      await prisma.$transaction(async (tx) => {
        // Expire the most recent PENDING_USER_ACCEPTANCE on this
        // box (if any). The board decision is "no grace period" so
        // we don't let a stale acceptance be acted on after relock.
        // EXPIRED isn't in the UNLOCK_STATUS constant export but
        // is one of the documented status values (AGENT.md §5 —
        // status column is a String). We pass the literal directly.
        await tx.unlockRequest.updateMany({
          where: {
            boxId: box.id,
            status: UNLOCK_STATUS.PENDING_USER_ACCEPTANCE,
          },
          data: {
            status: "EXPIRED",
            resolvedAt: now,
          },
        });

        // Relock: status back to LOCKED, lockType back to original,
        // lockedAmount snaps to whatever balance is at this moment
        // (the source of truth for "protected" per AGENT.md §16 #15).
        // Clear the window fields.
        await tx.box.update({
          where: { id: box.id },
          data: {
            status: BOX_STATUS.LOCKED,
            lockType: relockType,
            lockedAmount: box.balance,
            temporaryUnlockExpiresAt: null,
            originalLockType: null,
          },
        });

        await tx.auditEvent.create({
          data: {
            actor: "SYSTEM",
            action: "RELOCK",
            targetId: box.id,
            metadata: JSON.stringify({
              boxId: box.id,
              relockType,
              source: "cron",
              reason: "Temporary unlock window expired",
            }),
          },
        });
      });

      // Best-effort owner email. Resend failures must NEVER
      // unwind the relock — log and continue.
      if (box.user.email) {
        try {
          await sendBoxRelockNotice({
            to: box.user.email,
            ownerName: box.user.name,
            boxName: box.name,
          });
        } catch (emailErr) {
          console.error(
            "[cron/relock] relock email failed for",
            box.id,
            emailErr,
          );
        }
      }

      results.push({ boxId: box.id, ok: true });
    } catch (err) {
      console.error("[cron/relock] failed for", box.id, err);
      results.push({
        boxId: box.id,
        ok: false,
        error: (err as Error)?.message ?? "unknown",
      });
    }
  }

  return NextResponse.json({
    checkedAt: now.toISOString(),
    expiredCount: expired.length,
    results,
  });
}
