import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
("");

export async function POST() {
  const email = "test@example.com";
  const passwordHash = await bcrypt.hash("Passw0rd!", 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash, name: "Test User" },
  });

  return NextResponse.json({ ok: true, user });
}
