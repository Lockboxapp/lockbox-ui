import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

/* ──────────────────────────────────────────────────────────────
   Validation
   ────────────────────────────────────────────────────────────── */
const getQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Math.min(100, Math.max(1, Number(v))) : 20)),
  cursor: z.string().nullish(),
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
  categoryType: z.enum(["INCOME", "EXPENSE"]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  q: z.string().optional(),
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
  amount: z.number().int().positive(),
  description: z.string().max(280).nullable().optional(),
  postedAt: z.string().datetime().optional(),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const parsed = getQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Bad request", detail: parsed.error.flatten() },
      { status: 400 },
    );

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

  const where: any = {
    userId: session.user.id,
    ...(type ? { type } : {}),
    ...(vaultId ? { vaultId } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(categoryType ? { category: { type: categoryType as any } } : {}),
    ...(from || to
      ? {
          postedAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
    ...(q ? { description: { contains: q } } : {}),
  };

  const items = await prisma.transaction.findMany({
    where,
    orderBy: [{ postedAt: "desc" }, { id: "desc" }],
    take: (limit as number) + 1,
    ...(cursor ? { cursor: { id: cursor } } : {}),
    skip: cursor ? 1 : 0,
    include: { vault: true, category: true },
  });

  let nextCursor: string | null = null;
  if (items.length > (limit as number)) {
    const next = items.pop();
    nextCursor = next!.id;
  }

  return NextResponse.json({ items, nextCursor });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = await req.json().catch(() => null);
  const parsed = postBodySchema.safeParse(raw);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Bad request", detail: parsed.error.flatten() },
      { status: 400 },
    );

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
      amount,
      description,
      postedAt: postedAt ? new Date(postedAt) : new Date(),
    },
    include: { vault: true, category: true },
  });

  return NextResponse.json(tx, { status: 201 });
}
