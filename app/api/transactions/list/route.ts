// ============================================================
// app/api/transactions/list/route.ts
// GET — paginated, filterable box-transaction list for the signed-in user
// ============================================================
// Filters:
//   boxId   — specific box or omitted for all
//   type    — deposit | withdraw | transfer | card_spend | all
//   range   — this_week | this_month | last_3_months | all
//   limit   — default 25, max 100
//   offset  — default 0, for "Load more" style pagination
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function rangeToDate(range: string | null): Date | null {
  if (!range || range === "all") return null;
  const d = new Date();
  if (range === "this_week") {
    d.setDate(d.getDate() - 7);
    return d;
  }
  if (range === "this_month") {
    d.setDate(d.getDate() - 30);
    return d;
  }
  if (range === "last_3_months") {
    d.setDate(d.getDate() - 90);
    return d;
  }
  return null;
}

function bucketToTypes(bucket: string | null): string[] | null {
  if (!bucket || bucket === "all") return null;
  switch (bucket) {
    case "deposit":
      return ["DEPOSIT"];
    case "withdraw":
      // accept legacy WITHDRAWAL rows too
      return ["WITHDRAW", "WITHDRAWAL"];
    case "transfer":
      return ["TRANSFER_IN", "TRANSFER_OUT", "TRANSFER"];
    case "card_spend":
      return ["CARD_SPEND"];
    case "lock":
      return ["LOCK"];
    case "unlock":
      return ["UNLOCK"];
    case "protection":
      return ["PROTECTION_TYPE_CHANGED"];
    default:
      return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const boxId = searchParams.get("boxId");
    const bucket = searchParams.get("type");
    const range = searchParams.get("range");
    const offsetRaw = Number(searchParams.get("offset") ?? "0");
    const limitRaw = Number(searchParams.get("limit") ?? DEFAULT_LIMIT);
    const offset =
      Number.isFinite(offsetRaw) && offsetRaw >= 0 ? Math.floor(offsetRaw) : 0;
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(Math.floor(limitRaw), MAX_LIMIT)
        : DEFAULT_LIMIT;

    const types = bucketToTypes(bucket);
    const since = rangeToDate(range);

    const where: Record<string, unknown> = { userId: session.user.id };
    if (boxId) where.boxId = boxId;
    if (types) where.type = { in: types };
    if (since) where.postedAt = { gte: since };

    const [total, rows] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        orderBy: [{ postedAt: "desc" }, { id: "desc" }],
        skip: offset,
        take: limit,
        select: {
          id: true,
          type: true,
          amount: true,
          description: true,
          postedAt: true,
          box: { select: { id: true, name: true, lockType: true } },
        },
      }),
    ]);

    return NextResponse.json({
      total,
      offset,
      limit,
      hasMore: offset + rows.length < total,
      transactions: rows.map((tx) => ({
        id: tx.id,
        type: tx.type,
        amountCents: tx.amount,
        description: tx.description ?? "",
        postedAt: tx.postedAt,
        box: tx.box
          ? { id: tx.box.id, name: tx.box.name, lockType: tx.box.lockType }
          : null,
      })),
    });
  } catch (err) {
    console.error("[GET /api/transactions/list]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
