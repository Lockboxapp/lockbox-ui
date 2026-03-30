import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PrismaClient, Prisma } from "@prisma/client";
import { z } from "zod";

/** Reuse Prisma in dev (Next hot reload) */
const prisma =
  (globalThis as any).prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
if (process.env.NODE_ENV !== "production") (globalThis as any).prisma = prisma;

/* ──────────────────────────────────────────────────────────────
   Validation
   ────────────────────────────────────────────────────────────── */
const getQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Math.min(100, Math.max(1, Number(v))) : 20)),
  cursor: z.string().nullish(), // transaction.id
  // Matches your TransactionType enum
  type: z
    .enum([
      "DEPOSIT",
      "LOCK",
      "WITHDRAW",
      "TRANSFER_IN",
      "TRANSFER_OUT",
      "INCOME",
    ])
    .optional(),
  vaultId: z.string().optional(),
  categoryId: z.string().optional(),
  // Optional filter by CategoryType (INCOME | EXPENSE)
  categoryType: z.enum(["INCOME", "EXPENSE"]).optional(),
  from: z.string().optional(), // ISO date
  to: z.string().optional(), // ISO date
  q: z.string().optional(), // text search in description
});

const postBodySchema = z.object({
  vaultId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  type: z.enum([
    "DEPOSIT",
    "LOCK",
    "WITHDRAW",
    "TRANSFER_IN",
    "TRANSFER_OUT",
    "INCOME",
  ]),
  amount: z.number().int().positive(), // cents
  description: z.string().max(280).nullable().optional(),
  postedAt: z.string().datetime().optional(), // ISO
});

/* ──────────────────────────────────────────────────────────────
   GET /api/transactions
   Query:
     limit, cursor, type, vaultId, categoryId, categoryType, from, to, q
   Returns: { items: TxWithJoins[], nextCursor: string|null }
   ────────────────────────────────────────────────────────────── */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const parsed = getQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Bad request", detail: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const {
    limit,
    cursor,
    type,
    vaultId,
    categoryId,
    categoryType,
    from,
    to,
    q,
  } = parsed.data;

  const where: Prisma.TransactionWhereInput = {
    userId: session.user.id,
    ...(type ? { type } : {}),
    ...(vaultId ? { vaultId } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(categoryType
      ? {
          category: {
            // joins Category.type (INCOME | EXPENSE)
            type: categoryType as any,
          },
        }
      : {}),
    ...(from || to
      ? {
          postedAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          description: q ? { contains: q } : undefined,
        }
      : {}),
  };

  // Stable, infinite-scroll-friendly pagination.
  // Using composite order (postedAt desc, id desc) and cursor on id.
  const items = await prisma.transaction.findMany({
    where,
    orderBy: [{ postedAt: "desc" }, { id: "desc" }],
    take: (limit as number) + 1,
    ...(cursor ? { cursor: { id: cursor } } : {}),
    skip: cursor ? 1 : 0,
    include: {
      vault: true,
      category: true,
    },
  });

  let nextCursor: string | null = null;
  if (items.length > (limit as number)) {
    const next = items.pop(); // remove the lookahead record
    nextCursor = next!.id;
  }

  return NextResponse.json({ items, nextCursor });
}

/* ──────────────────────────────────────────────────────────────
   POST /api/transactions
   Body (cents-based):
     { type, amount, description?, vaultId?, categoryId?, postedAt? }
   Returns: created transaction (with vault/category)
   ────────────────────────────────────────────────────────────── */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = await req.json().catch(() => null);
  const parsed = postBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Bad request", detail: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const {
    vaultId = null,
    categoryId = null,
    type,
    amount,
    description = null,
    postedAt,
  } = parsed.data;

  const tx = await prisma.transaction.create({
    data: {
      userId: session.user.id,
      vaultId,
      categoryId,
      type,
      amount, // cents
      description,
      postedAt: postedAt ? new Date(postedAt) : new Date(),
    },
    include: { vault: true, category: true },
  });

  return NextResponse.json(tx, { status: 201 });
}
