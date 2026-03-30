import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Params = { id: string };

export async function POST(
  req: Request,
  ctx: { params: Promise<Params> } // 👈 params is a Promise
) {
  try {
    const { id: vaultId } = await ctx.params; // 👈 await it

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!vaultId) {
      return NextResponse.json({ error: "Missing vault id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const amt = Number(body?.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const vault = await prisma.vault.findUnique({ where: { id: vaultId } });
    if (!vault || vault.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await prisma.vault.update({
      where: { id: vaultId },
      data: { balance: { increment: amt } }, // atomic increment
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (err: any) {
    console.error("Deposit error:", err);
    return NextResponse.json(
      { error: "Server error", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}

// (Optional) Let PATCH reuse the same logic.
export const PATCH = POST;
