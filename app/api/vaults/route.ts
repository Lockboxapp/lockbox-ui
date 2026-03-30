// app/api/vaults/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const userId = token?.sub as string | undefined;
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ✅ Only use columns that exist in your schema
  const rows = await prisma.vault.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      balance: true,
      createdAt: true,
      updatedAt: true,
      // userId: true, // include if you want it client-side
    },
  });

  // Return raw fields; your frontend already maps `balance` -> `saved`
  return NextResponse.json(rows);
}
