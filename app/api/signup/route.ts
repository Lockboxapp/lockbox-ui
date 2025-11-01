import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function addDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // 1) Create the user
    const user = await prisma.user.create({
      data: { name: name ?? null, email, passwordHash },
      select: { id: true, email: true, name: true },
    });

    // 2) Seed two default vaults (match schema fields exactly)
    await prisma.$transaction([
      prisma.vault.create({
        data: {
          userId: user.id,
          name: "Rent safe-deposit box",
          target: 1500,
          saved: 0,
          locked: 0,
          dueDate: addDays(8),          // ✅ Date, not dueDays
          isLocked: false,
          requireKeyholder: false,
        },
      }),
      prisma.vault.create({
        data: {
          userId: user.id,
          name: "Emergency fund",
          target: 2000,
          saved: 0,
          locked: 0,
          dueDate: null,               // ✅ null is fine
          isLocked: false,
          requireKeyholder: false,
        },
      }),
    ]);

    return NextResponse.json({ ok: true, user }, { status: 201 });
  } catch (err: any) {
    // Handle unique email constraint
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
    console.error("Signup error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
