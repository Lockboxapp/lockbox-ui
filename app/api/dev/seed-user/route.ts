import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

const prisma = new PrismaClient();

export async function POST() {
  try {
    const email = "test@example.com";
    const password = "Passw0rd!";

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ ok: true, user: existing, note: "already exists" });
    }

    const hash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { email, name: "Test User", passwordHash: hash },
    });

    return NextResponse.json({ ok: true, user });
  } catch (err: any) {
    console.error("seed-user error:", err);
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
