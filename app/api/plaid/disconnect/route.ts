// ============================================================
// app/api/plaid/disconnect/route.ts
// POST — disconnect a single PlaidItem (or, if no plaidItemId is
// supplied, all of the signed-in user's items).
// Sprint 17 extended hotfix — multi-bank aware: deletes only the
// targeted item, removes the user's PlaidTransactions whose plaidId
// originated from it (best-effort: we don't track per-tx item, so we
// only fully wipe transactions on a full disconnect), and promotes
// another item to primary if the disconnected one was primary.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPlaidClient } from "@/lib/plaid/client";
import { decrypt } from "@/lib/encryption";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const plaidItemId: unknown = body?.plaidItemId;

    if (typeof plaidItemId === "string" && plaidItemId) {
      const item = await prisma.plaidItem.findFirst({
        where: { id: plaidItemId, userId: session.user.id },
      });
      if (!item) {
        return NextResponse.json({ success: true, alreadyDisconnected: true });
      }

      try {
        const plaid = getPlaidClient();
        const accessToken = decrypt(item.accessToken);
        await plaid.itemRemove({ access_token: accessToken });
      } catch (err) {
        console.warn(
          "[plaid disconnect] itemRemove failed; deleting locally",
          err,
        );
      }

      // Count remaining items so we know whether to wipe transactions
      // and whether we need to promote a new primary.
      const otherItems = await prisma.plaidItem.findMany({
        where: { userId: session.user.id, NOT: { id: item.id } },
        orderBy: { createdAt: "asc" },
      });

      await prisma.$transaction(async (tx) => {
        await tx.plaidItem.delete({ where: { id: item.id } });

        if (otherItems.length === 0) {
          // Last bank disconnected — wipe transactions + suggestions.
          await tx.recurringBill.deleteMany({
            where: { userId: session.user.id },
          });
          await tx.plaidTransaction.deleteMany({
            where: { userId: session.user.id },
          });
        } else if (item.isPrimary) {
          // Promote the oldest remaining item to primary.
          await tx.plaidItem.update({
            where: { id: otherItems[0].id },
            data: { isPrimary: true },
          });
        }
      });

      return NextResponse.json({ success: true });
    }

    // No plaidItemId — disconnect every item for this user.
    const items = await prisma.plaidItem.findMany({
      where: { userId: session.user.id },
    });
    if (items.length === 0) {
      return NextResponse.json({ success: true, alreadyDisconnected: true });
    }

    for (const item of items) {
      try {
        const plaid = getPlaidClient();
        const accessToken = decrypt(item.accessToken);
        await plaid.itemRemove({ access_token: accessToken });
      } catch (err) {
        console.warn("[plaid disconnect all] itemRemove failed", err);
      }
    }

    await prisma.$transaction([
      prisma.recurringBill.deleteMany({ where: { userId: session.user.id } }),
      prisma.plaidTransaction.deleteMany({
        where: { userId: session.user.id },
      }),
      prisma.plaidItem.deleteMany({ where: { userId: session.user.id } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/plaid/disconnect]", err);
    return NextResponse.json({ error: "Disconnect failed" }, { status: 500 });
  }
}
