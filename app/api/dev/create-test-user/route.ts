import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();

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
