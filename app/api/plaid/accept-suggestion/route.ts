// ============================================================
// app/api/plaid/accept-suggestion/route.ts
// POST — turn a RecurringBill suggestion into a real Box.
// Body: { recurringBillId, name, lockType, targetAmountCents, lockUntilISO? }
// HARD/KEYHOLDER auto-lock per existing /api/boxes POST conventions
// (board rule, see AGENT.md Section 7). Wallet is never created here.
// Sprint 17 (Phase 2 — phase2 branch only).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BOX_STATUS } from "@/lib/types";

const VALID_LOCK_TYPES = ["SOFT", "HARD"] as const;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const recurringBillId: unknown = body?.recurringBillId;
    const nameRaw: unknown = body?.name;
    const lockTypeRaw: unknown = body?.lockType;
    const targetAmountCentsRaw: unknown = body?.targetAmountCents;
    const lockUntilISO: unknown = body?.lockUntilISO;

    if (typeof recurringBillId !== "string" || !recurringBillId) {
      return NextResponse.json(
        { error: "recurringBillId is required" },
        { status: 400 },
      );
    }
    const name =
      typeof nameRaw === "string" ? nameRaw.trim().slice(0, 50) : "";
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const lockType =
      typeof lockTypeRaw === "string" &&
      (VALID_LOCK_TYPES as readonly string[]).includes(lockTypeRaw)
        ? (lockTypeRaw as "SOFT" | "HARD")
        : "SOFT";
    const targetAmountCents =
      typeof targetAmountCentsRaw === "number" &&
      Number.isFinite(targetAmountCentsRaw) &&
      targetAmountCentsRaw > 0
        ? Math.round(targetAmountCentsRaw)
        : null;
    const lockUntil =
      typeof lockUntilISO === "string" && lockUntilISO
        ? new Date(lockUntilISO)
        : null;

    const bill = await prisma.recurringBill.findFirst({
      where: { id: recurringBillId, userId: session.user.id },
    });
    if (!bill) {
      return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
    }
    if (bill.boxId) {
      return NextResponse.json(
        { error: "Suggestion already accepted", code: "already_accepted" },
        { status: 400 },
      );
    }

    const autoLock = lockType === "HARD";

    const box = await prisma.box.create({
      data: {
        userId: session.user.id,
        name,
        lockType,
        targetAmount: targetAmountCents,
        lockUntil,
        status: autoLock ? BOX_STATUS.LOCKED : "CREATED",
        balance: 0,
        lockedAmount: 0,
      },
    });

    await prisma.recurringBill.update({
      where: { id: bill.id },
      data: { boxId: box.id },
    });

    return NextResponse.json({ success: true, box });
  } catch (err) {
    console.error("[POST /api/plaid/accept-suggestion]", err);
    return NextResponse.json(
      { error: "Failed to accept suggestion" },
      { status: 500 },
    );
  }
}
