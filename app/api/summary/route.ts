// app/api/summary/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const userId = token?.sub as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Minimal summary (compiles even if you add more later)
  const [vaultCount, txCount] = await Promise.all([
    prisma.vault.count({ where: { userId } }),
    prisma.transaction.count({ where: { userId } }),
  ]);

  return NextResponse.json({
    ok: true,
    vaults: vaultCount,
    transactions: txCount,
  });
}
