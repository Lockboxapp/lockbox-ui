// ============================================================
// app/api/plaid/items/[id]/route.ts
// DELETE — disconnect a single PlaidItem.
//
// Bearer-compatible auth (getRequestUserId), so the native
// "Connected banks" screen can hit it. Mirrors the per-item
// branch of POST /api/plaid/disconnect: revokes the access
// token with Plaid (best-effort), deletes the local item,
// promotes another item to primary if the deleted one was
// primary, and wipes recurring bills + transactions on the
// last-bank case so the user doesn't see orphaned data.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { getRequestUserId } from "@/lib/mobile-auth";
import { getPlaidClient } from "@/lib/plaid/client";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getRequestUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Item id is required" },
        { status: 400 },
      );
    }

    const item = await prisma.plaidItem.findFirst({
      where: { id, userId },
    });
    if (!item) {
      // Idempotent: already gone (or never belonged to this user).
      return NextResponse.json({ ok: true, alreadyDisconnected: true });
    }

    // Best-effort revoke at Plaid. Don't block the local delete on
    // Plaid being unreachable — the user's intent is to remove it.
    try {
      const plaid = getPlaidClient();
      const accessToken = decrypt(item.accessToken);
      await plaid.itemRemove({ access_token: accessToken });
    } catch (err) {
      console.warn(
        "[DELETE /api/plaid/items/:id] itemRemove failed; deleting locally",
        err,
      );
    }

    const otherItems = await prisma.plaidItem.findMany({
      where: { userId, NOT: { id: item.id } },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    await prisma.$transaction(async (tx) => {
      await tx.plaidItem.delete({ where: { id: item.id } });

      if (otherItems.length === 0) {
        // Last bank — wipe derived data so the home screen doesn't
        // surface orphaned transactions or suggestions.
        await tx.recurringBill.deleteMany({ where: { userId } });
        await tx.plaidTransaction.deleteMany({ where: { userId } });
      } else if (item.isPrimary) {
        await tx.plaidItem.update({
          where: { id: otherItems[0].id },
          data: { isPrimary: true },
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/plaid/items/:id]", err);
    return NextResponse.json(
      { error: "Disconnect failed" },
      { status: 500 },
    );
  }
}
