// ============================================================
// app/api/plaid/transactions/list/route.ts
// GET — paginated, filterable Plaid transaction list (read-only).
// Sprint 17 extended hotfix — backs the new /plaid/transactions
// in-app view. Distinct from /api/transactions/list which surfaces
// LockBox box-transactions.
// ============================================================
// Filters:
//   range    — this_week | this_month | last_3_months | all
//   category — Plaid personal-finance primary category, e.g. "FOOD_AND_DRINK"
//   q        — search query (case-insensitive substring on merchant)
//   limit    — default 50, max 200
//   offset   — default 0
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

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

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range");
    const category = searchParams.get("category");
    const q = searchParams.get("q");
    const offsetRaw = Number(searchParams.get("offset") ?? "0");
    const limitRaw = Number(searchParams.get("limit") ?? DEFAULT_LIMIT);
    const offset =
      Number.isFinite(offsetRaw) && offsetRaw >= 0 ? Math.floor(offsetRaw) : 0;
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(Math.floor(limitRaw), MAX_LIMIT)
        : DEFAULT_LIMIT;

    const where: Record<string, unknown> = { userId: session.user.id };
    const since = rangeToDate(range);
    if (since) where.date = { gte: since };
    if (category) where.category = category;
    if (q && q.trim().length > 0) {
      where.merchant = { contains: q.trim(), mode: "insensitive" };
    }

    const [total, rows, categoriesRaw] = await Promise.all([
      prisma.plaidTransaction.count({ where }),
      prisma.plaidTransaction.findMany({
        where,
        orderBy: [{ date: "desc" }, { id: "desc" }],
        skip: offset,
        take: limit,
        select: {
          id: true,
          merchant: true,
          amount: true,
          category: true,
          date: true,
        },
      }),
      // Distinct categories for the filter dropdown.
      prisma.plaidTransaction.findMany({
        where: { userId: session.user.id, category: { not: null } },
        select: { category: true },
        distinct: ["category"],
        orderBy: { category: "asc" },
      }),
    ]);

    const categories = categoriesRaw
      .map((c) => c.category)
      .filter((c): c is string => typeof c === "string" && c.length > 0);

    return NextResponse.json({
      total,
      offset,
      limit,
      hasMore: offset + rows.length < total,
      categories,
      transactions: rows,
    });
  } catch (err) {
    console.error("[GET /api/plaid/transactions/list]", err);
    return NextResponse.json(
      { error: "Failed to load transactions" },
      { status: 500 },
    );
  }
}
